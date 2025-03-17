// src/components/Feed.jsx
// 1. React og biblioteksimporter
import React, { useEffect, useCallback, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import InfiniteLoader from "react-window-infinite-loader";

// 2. Egne komponenter
import PostCard from "./Feed/PostCard";
import ErrorFallback from "./ui/ErrorFallback";

// 3. Utils og hooks
import { useFeed } from "../hooks/useFeed";

/**
 * Feed-komponent med virtualisering og normalisert API-data.
 *
 * @param {Object} props - Komponent-props
 * @param {Object} props.agent - BskyAgent-instans
 * @param {string} props.handle - Brukerhåndtak (valgfritt, brukes i forfatter-feed)
 * @param {Function} props.onProfileClick - Callback for profilklikk
 * @param {string} props.feedType - Type feed (timeline, author, etc.)
 * @param {Object} props.params - Ekstra parametre til API-kall
 * @param {number} props.height - Høyde på feeden i piksler
 * @param {number} props.itemSize - Høyde på hvert innlegg i piksler
 */
const Feed = React.memo(
  ({
    agent,
    handle,
    onProfileClick = null,
    feedType = "timeline",
    params = {},
    height = 800,
    itemSize = 250,
  }) => {
    const navigate = useNavigate();
    const listRef = useRef();
    // State for å håndtere error UI
    const [shouldShowError, setShouldShowError] = useState(false);

    // Konfigurer params basert på feedType og handle
    const feedParams = useMemo(() => {
      const baseParams = { ...params };

      if (feedType === "author" && handle) {
        baseParams.actor = handle;
      } else if (feedType === "hashtag" && params?.tag) {
        // Params for hashtag-feed forventes å inneholde 'tag'
      }

      return baseParams;
    }, [feedType, handle, params]);

    // Bruk useFeed-hooken med normalisering
    const {
      data: posts = [], // Standard tom array hvis data er null/undefined
      isLoading = false,
      isRetrying = false,
      error = null,
      hasMore = false,
      isOnline = true,
      lastRefresh = null,
      fetchMore = () => Promise.resolve(),
      refresh = () => {},
      resetData = () => {},
      isNormalized = true,
    } = useFeed({
      agent,
      feedType,
      params: feedParams,
      cacheTime: 60000, // 1 minutt cache
      retryCount: 3,
      enabled: !!agent,
      normalizeData: true, // Aktiverer normalisering
    }) || {}; // Sikre at vi får et objekt selv om useFeed returnerer null

    // Rulle til toppen når feedType endres
    useEffect(() => {
      if (listRef.current) {
        listRef.current.scrollToItem(0);
      }
      // Reset data når feedType endres
      resetData();
    }, [feedType, resetData]);

    // Oppdater error state basert på error fra useFeed
    useEffect(() => {
      setShouldShowError(error !== null && !(posts?.length > 0));
    }, [error, posts?.length]);

    // Håndter klikk på profil
    const handleProfileClick = useCallback(
      (authorData) => {
        if (!authorData) return; // Nullsjekk

        if (onProfileClick) {
          onProfileClick(authorData);
        } else if (authorData?.handle) {
          // Optional chaining
          navigate(`/profile/${authorData.handle}`);
        }
      },
      [onProfileClick, navigate],
    );

    // InfiniteLoader integrasjon
    const itemCount = useMemo(() => {
      return hasMore ? (posts?.length || 0) + 1 : posts?.length || 0;
    }, [hasMore, posts?.length]);

    const loadMoreItems = useCallback(
      (startIndex, stopIndex) => {
        if (!isLoading && hasMore && (posts?.length || 0) > 0) {
          return fetchMore();
        }
        return Promise.resolve();
      },
      [isLoading, hasMore, posts?.length, fetchMore],
    );

    const isItemLoaded = useCallback(
      (index) => {
        return !hasMore || index < (posts?.length || 0);
      },
      [hasMore, posts?.length],
    );

    // Rendrer et innlegg basert på normaliserte data
    const renderPost = useCallback(
      ({ index, style }) => {
        if (!isItemLoaded(index)) {
  return (
            <div style={style} className="flex justify-center items-center p-4">
              <div className="animate-pulse text-gray-400">
                Laster flere innlegg...
              </div>
            </div>
          );
        }

        const postItem = posts?.[index];
        if (!postItem) return null; // Nullsjekk

        // Data kommer nå normalisert direkte fra useFeed
        return (
          <div style={style}>
            <PostCard
              post={postItem}
              onProfileClick={handleProfileClick}
              key={postItem.cid || index} // Fallback til index hvis cid mangler
            />
              </div>
        );
      },
      [posts, isItemLoaded, handleProfileClick],
    );

    // Memoiserte UI-elementer for å unngå unødvendig re-rendering
    const networkStatusMessage = useMemo(() => {
      if (!isOnline) {
        return (
          <div className="sticky top-0 z-10 bg-amber-100 text-amber-800 p-2 text-center text-sm">
            Du er offline. Innlegget vil bli oppdatert når du er tilbake på
            nett.
          </div>
        );
      }
      return null;
    }, [isOnline]);

    const refreshButton = useMemo(() => {
      return (
        <div className="flex justify-end mb-2 px-2">
          <button
            onClick={refresh}
            disabled={isLoading || isRetrying}
            className="text-sm text-gray-600 hover:text-indigo-500 flex items-center gap-1"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 ${isLoading || isRetrying ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {isLoading || isRetrying ? "Oppdaterer..." : "Oppdater"}
          </button>
        </div>
      );
    }, [isLoading, isRetrying, refresh]);

    const emptyFeedMessage = useMemo(() => {
      if (!isLoading && (posts?.length || 0) === 0) {
        return (
          <div className="flex flex-col items-center justify-center h-40 text-gray-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9.5 2.672a1 1 0 011 0l7 4.03a1 1 0 01.5.866V16.43a1 1 0 01-.5.866l-7 4.03a1 1 0 01-1 0l-7-4.03a1 1 0 01-.5-.866V7.57a1 1 0 01.5-.866l7-4.03z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"
              />
            </svg>
            <p>Ingen innlegg å vise</p>
            <button
              onClick={refresh}
              className="mt-2 text-indigo-500 hover:text-indigo-600 text-sm"
            >
              Oppdater
            </button>
    </div>
  );
      }
      return null;
    }, [isLoading, posts?.length, refresh]);

    const loadingIndicator = useMemo(() => {
      if (isLoading && !(posts?.length > 0)) {
    return (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
      </div>
    );
  }
      return null;
    }, [isLoading, posts?.length]);

    // Vis error state etter alle hooks er definert
    if (shouldShowError) {
    return (
        <ErrorFallback
          error={error}
          resetErrorBoundary={refresh}
          message="Kunne ikke laste inn innlegg"
        />
      );
    }

    return (
      <div className="feed-container h-full relative">
        {/* Nettverksstatus */}
        {networkStatusMessage}

        {/* Laste-indikator (bare når vi har ingen poster) */}
        {loadingIndicator}

        {/* Refresh-knapp */}
        {refreshButton}

        {/* Virtualisert feed */}
        <div className="h-full" style={{ height }}>
          <AutoSizer>
            {({ width }) => (
              <InfiniteLoader
                isItemLoaded={isItemLoaded}
                itemCount={itemCount}
                loadMoreItems={loadMoreItems}
                threshold={5}
              >
                {({ onItemsRendered, ref }) => (
                  <List
                    ref={(list) => {
                      ref(list);
                      listRef.current = list;
                    }}
                    height={height}
                    width={width}
                    itemCount={itemCount}
                    itemSize={itemSize}
                    onItemsRendered={onItemsRendered}
                  >
                    {renderPost}
                  </List>
                )}
              </InfiniteLoader>
            )}
          </AutoSizer>
        </div>

        {/* Ingen innlegg */}
        {emptyFeedMessage}
      </div>
    );
  },
);

// Fjern defaultProps og bruk bare JavaScript default parameters
Feed.propTypes = {
  agent: PropTypes.object.isRequired,
  handle: PropTypes.string,
  onProfileClick: PropTypes.func,
  feedType: PropTypes.string,
  params: PropTypes.object,
  height: PropTypes.number,
  itemSize: PropTypes.number,
};

export default Feed;
