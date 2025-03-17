// src/hooks/useFeed.js
// React-importering
import { useState, useEffect, useCallback, useRef } from "react";
import PropTypes from "prop-types";

// Utils-importering
import { debugLog, debugError, DEBUG } from "../utils/debug";
import normalizer from "../utils/blueskyNormalizer";

/**
 * Custom hook for å hente og administrere feed data med avansert feilhåndtering, caching og paginering
 *
 * @param {Object} options - Konfigurasjon for feed
 * @param {Object} options.agent - BskyAgent-instans
 * @param {string} options.feedType - Type feed (timeline, author, etc.)
 * @param {Object} options.params - Parametere for feed-forespørselen
 * @param {number} options.cacheTime - Tid i millisekunder å cache data (default: 60000)
 * @param {number} options.retryCount - Antall forsøk ved feil (default: 3)
 * @param {number} options.retryDelay - Delay mellom forsøk i ms (default: 1000)
 * @param {boolean} options.enabled - Om hooken skal hente data (default: true)
 * @param {boolean} options.normalizeData - Om data skal normaliseres (default: true)
 * @returns {Object} - Feed data og tilhørende funksjoner
 */
export function useFeed({
  agent,
  feedType = "timeline",
  params = {},
  cacheTime = 60000,
  retryCount = 3,
  retryDelay = 1000,
  enabled = true,
  normalizeData = true,
}) {
  // State for feed-data
  const [posts, setPosts] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Cache
  const cacheRef = useRef({
    timestamp: 0,
    data: [],
    cursor: null,
  });

  // Forsøkstellere
  const retryCountRef = useRef(0);
  const initialFetchRef = useRef(false);
  const abortControllerRef = useRef(null);

  // Cache-nøkkel genereres basert på feedType og params
  const generateCacheKey = useCallback(() => {
    return `${feedType}:${JSON.stringify(params || {})}`;
  }, [feedType, params]);

  // Globalt cache-objekt
  const staticCache = useRef({});

  // Sjekk om cache er gyldig
  const isCacheValid = useCallback(() => {
    const cacheKey = generateCacheKey();
    const cacheEntry = staticCache.current[cacheKey];

    if (!cacheEntry) return false;

    const now = Date.now();
    return now - cacheEntry.timestamp < cacheTime;
  }, [generateCacheKey, cacheTime]);

  // Hent data fra API
  const fetchFeed = useCallback(
    async (loadMore = false, forceRefresh = false) => {
      // Ikke gjør noe hvis hooken er deaktivert
      if (!enabled) return;

      // Sjekk om vi har en agent
      if (!agent) {
        setError(new Error("Ingen agent tilgjengelig"));
        return;
      }

      // Sjekk for manglende obligatoriske parametere
      if (feedType === "author" && !params?.actor && !params?.handle) {
        setError(
          new Error("Mangler actor eller handle parameter for author feed"),
        );
        return;
      }

      // Stopp pågående forespørsel
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Opprett ny abort controller
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {
        // Sjekk cache først hvis dette ikke er last mer og ikke force refresh
        if (!loadMore && !forceRefresh) {
          const cacheKey = generateCacheKey();
          const cacheEntry = staticCache.current[cacheKey];

          if (cacheEntry && Date.now() - cacheEntry.timestamp < cacheTime) {
            debugLog("Bruker cached feed data for:", cacheKey);

            setPosts(cacheEntry.data || []);
            setCursor(cacheEntry.cursor);
            setHasMore(!!cacheEntry.cursor);
            setLoading(false);
            setError(null);
            initialFetchRef.current = true;
            return;
          }
        }

        // Vis last-indikator
        setLoading(true);

        // Hvis dette er en last-mer-operasjon, behold eksisterende posts
        // Ellers, tilbakestill state
        if (!loadMore) {
          if (!forceRefresh) {
            setPosts([]);
          }

          // Hvis force refresh, beholder vi eksisterende posts mens vi laster
        }

        let feedData, currentCursor;
        const feedParams = { ...params };

        // Legg til cursor for paginering hvis vi laster mer
        if (loadMore && cursor) {
          feedParams.cursor = cursor;
        }

        debugLog(`Henter ${feedType} feed med params:`, feedParams);

        // Velg riktig API-kall basert på feedType
        switch (feedType) {
          case "timeline":
            const timeline = await agent.getTimeline(feedParams, { signal });
            feedData = timeline.data;
            currentCursor = timeline?.data?.cursor;
            break;

          case "author":
            // Støtt både handle og DID for author feed
            const authorParams = { ...feedParams };
            if (authorParams.handle && !authorParams.actor) {
              authorParams.actor = authorParams.handle;
              delete authorParams.handle;
            }

            const authorFeed = await agent.getAuthorFeed(authorParams, {
              signal,
            });
            feedData = authorFeed.data;
            currentCursor = authorFeed?.data?.cursor;
            break;

          case "hashtag":
            // Hashtag feed via ATP-API (Lexicon 'app.bsky.feed.searchPosts')
            const hashtagQuery = `#${params?.tag?.replace(/^#/, "")}`;
            const hashtagFeed = await agent.app.bsky.feed.searchPosts(
              { q: hashtagQuery, ...(feedParams || {}) },
              { signal },
            );
            feedData = hashtagFeed.data;
            currentCursor = hashtagFeed?.data?.cursor;
            break;

          case "likes":
            const likesFeed = await agent.getLikes(
              { ...feedParams },
              { signal },
            );
            feedData = likesFeed.data;
            currentCursor = likesFeed?.data?.cursor;
            break;

          case "suggested":
            const suggestedFeed = await agent.getSuggestions(
              { ...feedParams },
              { signal },
            );
            feedData = {
              feed: suggestedFeed.data.actors.map((actor) => ({
                post: { author: actor },
              })),
            };
            break;

          default:
            throw new Error(`Ukjent feed-type: ${feedType}`);
        }

        // Sjekk om feedData er tilgjengelig
        if (!feedData || !feedData.feed) {
          throw new Error(`Ingen feed-data mottatt for ${feedType}`);
        }

        // Normaliser data om nødvendig
        let processedFeed = feedData.feed;
        if (normalizeData) {
          try {
            processedFeed = processedFeed.map((item) =>
              normalizer.normalizePost(item),
            );
          } catch (normErr) {
            debugError("Feil ved normalisering av feed:", normErr);
            // Fortsett med original data ved normaliseringsfeil
          }
        }

        // Oppdater state basert på om dette er initial load eller last mer
        if (loadMore) {
          // Filtrer ut duplikater når vi laster mer
          const existingIds = new Set(posts.map((p) => p.id || p.post?.id));
          const uniqueNewPosts = processedFeed.filter(
            (p) => !existingIds.has(p.id || p.post?.id),
          );

          setPosts((prev) => [...prev, ...uniqueNewPosts]);
        } else {
          setPosts(processedFeed);
          setLastRefresh(Date.now());
        }

        // Oppdater cursor og hasMore state
        setCursor(currentCursor);
        setHasMore(!!currentCursor);

        // Oppdater cache hvis ikke last mer
        if (!loadMore) {
          const cacheKey = generateCacheKey();
          staticCache.current[cacheKey] = {
            timestamp: Date.now(),
            data: processedFeed,
            cursor: currentCursor,
          };

          cacheRef.current = {
            timestamp: Date.now(),
            data: processedFeed,
            cursor: currentCursor,
          };
        }

        // Nullstill retry counter ved vellykket kall
        retryCountRef.current = 0;
        initialFetchRef.current = true;
      } catch (err) {
        // Ignorer AbortError - dette er forventet når vi kansellerer
        if (err.name === "AbortError") {
          debugLog("Feed-forespørsel avbrutt");
          return;
        }

        // Håndter andre feil
        debugError(`Feil ved henting av ${feedType} feed:`, err);

        // Forsøk igjen hvis vi ikke har overskredet grensen
        if (retryCountRef.current < retryCount) {
          const delay = retryDelay * Math.pow(2, retryCountRef.current);
          retryCountRef.current++;

          debugLog(
            `Forsøker igjen (${retryCountRef.current}/${retryCount}) om ${delay}ms`,
          );

          setRetrying(true);

          // Forsøk igjen etter forsinkelse
          setTimeout(() => {
            setRetrying(false);
            fetchFeed(loadMore, forceRefresh).catch(debugError);
          }, delay);

          return;
        }

        // Hvis vi har nådd maks antall forsøk, vis feil
        setError(err);

        // Hvis vi har noe cached data, bruk det som fallback ved feil
        const cacheKey = generateCacheKey();
        const cacheEntry = staticCache.current[cacheKey];

        if (!loadMore && cacheEntry?.data?.length > 0) {
          debugLog("Bruker cached data som fallback ved feil");
          setPosts(cacheEntry.data);
          setCursor(cacheEntry.cursor);
        }
      } finally {
        setLoading(false);
        abortControllerRef.current = null;
      }
    },
    [
      enabled,
      agent,
      feedType,
      params,
      cursor,
      posts,
      retryCount,
      retryDelay,
      generateCacheKey,
      cacheTime,
      normalizeData,
      setLastRefresh,
    ],
  );

  // Last inn data når hooken monteres eller avhengigheter endres
  useEffect(() => {
    if (enabled && agent) {
      // Reset state når feed-type eller params endres
      setPosts([]);
      setCursor(null);
      setError(null);
      setHasMore(true);
      retryCountRef.current = 0;

      fetchFeed(false, false).catch(debugError);
    }

    // Cleanup funksjon for å avbryte pågående forespørsler
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [enabled, agent, feedType, JSON.stringify(params)]);

  // Funksjon for å laste mer data
  const loadMore = useCallback(() => {
    if (!loading && hasMore && !error) {
      fetchFeed(true).catch(debugError);
    }
  }, [loading, hasMore, error, fetchFeed]);

  // Funksjon for å oppdatere feed
  const refresh = useCallback(() => {
    setError(null);
    retryCountRef.current = 0;
    setLastRefresh(Date.now());
    return fetchFeed(false, true);
  }, [fetchFeed]);

  // Funksjon for å tilbakestille data
  const resetData = useCallback(() => {
    setPosts([]);
    setCursor(null);
    setError(null);
    setHasMore(true);
    retryCountRef.current = 0;
  }, []);

  return {
    posts: posts || [],
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    retrying,
    data: posts || [],
    isLoading: loading,
    isRetrying: retrying,
    isOnline: true,
    lastRefresh,
    fetchMore: loadMore,
    resetData,
    isNormalized: normalizeData,
  };
}

// PropTypes for useFeed
useFeed.propTypes = {
  options: PropTypes.shape({
    agent: PropTypes.object.isRequired,
    feedType: PropTypes.oneOf([
      "timeline",
      "author",
      "hashtag",
      "likes",
      "suggested",
    ]),
    params: PropTypes.object,
    cacheTime: PropTypes.number,
    retryCount: PropTypes.number,
    retryDelay: PropTypes.number,
    enabled: PropTypes.bool,
    normalizeData: PropTypes.bool,
  }),
};
