// src/hooks/useProfile.js
// 1. React og bibliotek-importer
import { useState, useEffect, useCallback } from "react";

// 2. Interne utility-importer
import { debugLog, debugError } from "../utils/debug";
import {
  createErrorFromResponse,
  ApiError,
  NetworkError,
  AuthError,
  ValidationError,
} from "../utils/errors";
import { withRetry, defaultShouldRetry } from "../utils/retryUtils";

/**
 * Custom hook for å hente og håndtere profildata med robust feilhåndtering
 * @param {Object} agent - Bluesky agent
 * @param {string} handle - Brukerhåndtak eller DID å hente profil for
 * @param {Object} options - Tilleggskonfigurasjoner
 * @param {number} options.maxRetries - Maks antall forsøk ved feil (default: 3)
 * @param {number} options.cacheTime - Tid i millisekunder for caching (default: 5min)
 * @returns {Object} Profil state og funksjoner
 */
export const useProfile = (agent, handle, options = {}) => {
  const {
    maxRetries = 3,
    cacheTime = 5 * 60 * 1000, // 5 minutter cache-tid
  } = options;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [follows, setFollows] = useState([]);
  const [followLoading, setFollowLoading] = useState(false);
  const [followCount, setFollowCount] = useState({
    followers: 0,
    following: 0,
  });
  const [profileCache, setProfileCache] = useState(new Map());
  const [retrying, setRetrying] = useState(false);

  // Formater brukerhåndtak for API-kall
  const formatHandle = useCallback((username) => {
    if (!username) return null;

    // Fjern @ fra starten hvis det finnes
    let formattedHandle = username.startsWith("@")
      ? username.substring(1)
      : username;

    // Sjekk om det er en DID
    if (formattedHandle.startsWith("did:")) {
      return formattedHandle;
    }

    // Legg til .bsky.social hvis ikke annet domene er spesifisert
    if (!formattedHandle.includes(".")) {
      formattedHandle = `${formattedHandle}.bsky.social`;
    }

    return formattedHandle;
  }, []);

  // Hent profildata med retry-logikk
  const fetchProfile = useCallback(async () => {
    if (!agent || !handle) {
      return;
    }

    setLoading(true);
    setError(null);
    setRetrying(false);

    try {
      const formattedHandle = formatHandle(handle);

      if (!formattedHandle) {
        throw new ValidationError("Ugyldig brukerhåndtak", {
          retryable: false,
        });
      }

      // Sjekk cache først
      const cacheKey = formattedHandle;
      const cachedProfile = profileCache.get(cacheKey);

      if (cachedProfile && Date.now() - cachedProfile.timestamp < cacheTime) {
        debugLog("Bruker cachet profildata for:", formattedHandle);
        setProfile(cachedProfile.data);
        setFollowCount(cachedProfile.followCount);
        setLoading(false);
        return;
      }

      debugLog("Henter profil for:", formattedHandle);

      // Hent profil med retry-logikk
      const profileData = await withRetry(
        async () => {
          try {
            // Hent profildetaljer
            const profileResponse = await agent.getProfile({
              actor: formattedHandle,
            });
            debugLog("Profildata mottatt:", profileResponse.data);

            // Hent følger-statistikk
            let followsCount = { followers: 0, following: 0 };
            try {
              const countsResponse = await agent.getFollowsCount({
                actor: formattedHandle,
              });

              followsCount = {
                followers: countsResponse.data.followers,
                following: countsResponse.data.follows,
              };

              debugLog("Følger-statistikk mottatt:", countsResponse.data);
            } catch (countError) {
              debugError("Feil ved henting av følger-statistikk:", countError);
              // Fortsett selv om vi ikke får følger-statistikk
            }

            return {
              profile: profileResponse.data,
              followsCount,
            };
          } catch (err) {
            if (err.status === 400) {
              throw new ValidationError(
                "Ugyldig brukerhåndtak. Sjekk at formatet er riktig.",
                {
                  statusCode: 400,
                  retryable: false,
                  originalError: err,
                },
              );
            } else if (err.status === 404) {
              throw new ApiError(
                "Profilen ble ikke funnet. Sjekk at brukerhåndtaket er riktig.",
                {
                  statusCode: 404,
                  retryable: false,
                  originalError: err,
                },
              );
            }

            // For andre feil, bruk standard feilhåndtering
            throw createErrorFromResponse(err, {
              endpoint: "getProfile",
              originalError: err,
            });
          }
        },
        {
          maxRetries,
          baseDelay: 1000,
          onRetry: (err, attempt) => {
            setRetrying(true);
            debugLog(
              `Prøver å hente profil på nytt (forsøk ${attempt + 1}/${maxRetries})...`,
            );
          },
        },
      );

      // Oppdater state med mottatt data
      setProfile(profileData.profile);
      setFollowCount(profileData.followsCount);

      // Oppdater cache
      setProfileCache(
        new Map(profileCache).set(cacheKey, {
          data: profileData.profile,
          followCount: profileData.followsCount,
          timestamp: Date.now(),
        }),
      );
    } catch (err) {
      debugError("Feil ved henting av profil:", err);

      // Konstruer feilobjekt
      let errorObject = {
        message: "Kunne ikke laste profilen",
        details: err.message || "Ukjent feil",
        retryable: err.isRetryable ? err.isRetryable() : true,
      };

      if (err instanceof ValidationError) {
        errorObject = {
          ...errorObject,
          message: err.message,
          retryable: false,
          statusCode: 400,
        };
      } else if (err instanceof AuthError) {
        errorObject = {
          ...errorObject,
          message: "Ikke autorisert til å se denne profilen",
          retryable: false,
          statusCode: 401,
        };
      } else if (err instanceof NetworkError) {
        errorObject = {
          ...errorObject,
          message: "Nettverksfeil ved henting av profil",
          details: "Sjekk internettforbindelsen din og prøv igjen",
          statusCode: err.statusCode || 0,
        };
      } else if (err instanceof ApiError) {
        errorObject = {
          ...errorObject,
          message: err.message,
          statusCode: err.statusCode,
          retryable: err.retryable,
        };
      }

      setError(errorObject);
      setProfile(null);
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, [agent, handle, formatHandle, profileCache, cacheTime, maxRetries]);

  // Hent følgere eller følger med retry-logikk
  const fetchFollows = useCallback(
    async (type = "followers") => {
      if (!agent || !handle || !profile) {
        return;
      }

      setFollowLoading(true);

      try {
        debugLog(`Henter ${type} for ${handle}`);
        const formattedHandle = formatHandle(handle);

        if (!formattedHandle) {
          throw new ValidationError("Ugyldig brukerhåndtak", {
            retryable: false,
          });
        }

        // Hent følgere/følger med retry-logikk
        const followsData = await withRetry(
          async () => {
            try {
              // API-kall basert på type
              let response;
              if (type === "followers") {
                response = await agent.getFollowers({ actor: formattedHandle });
              } else {
                response = await agent.getFollows({ actor: formattedHandle });
              }

              return response.data[type];
            } catch (err) {
              throw createErrorFromResponse(err, {
                endpoint: type === "followers" ? "getFollowers" : "getFollows",
                originalError: err,
              });
            }
          },
          {
            maxRetries: 2,
            baseDelay: 1000,
          },
        );

        debugLog(`${type} data mottatt:`, followsData);
        setFollows(followsData);
      } catch (err) {
        debugError(`Feil ved henting av ${type}:`, err);

        const typeNorsk = type === "followers" ? "følgere" : "følger";
        let errorMessage = `Kunne ikke laste ${typeNorsk}: ${err.message || "Ukjent feil"}`;

        setError({
          message: errorMessage,
          retryable: err.isRetryable ? err.isRetryable() : true,
          statusCode: err.statusCode,
        });
      } finally {
        setFollowLoading(false);
      }
    },
    [agent, handle, profile, formatHandle],
  );

  // Følg/avfølg en bruker med retry-logikk
  const toggleFollow = useCallback(
    async (did, isFollowing) => {
      if (!agent || !did) {
        return { success: false, error: "Mangler agent eller brukerId" };
      }

      try {
        await withRetry(
          async () => {
            try {
              if (isFollowing) {
                // Avfølg bruker
                await agent.deleteFollow(did);
                debugLog("Avfulgte bruker:", did);
              } else {
                // Følg bruker
                await agent.follow(did);
                debugLog("Fulgte bruker:", did);
              }
            } catch (err) {
              throw createErrorFromResponse(err, {
                endpoint: isFollowing ? "deleteFollow" : "follow",
                originalError: err,
              });
            }
          },
          {
            maxRetries: 2,
            baseDelay: 1000,
            shouldRetry: (error) => {
              // Ikke retry auth-feil
              if (error instanceof AuthError) return false;
              return defaultShouldRetry(error, 0);
            },
          },
        );

        // Oppdater profil etter å ha fulgt/avfulgt
        fetchProfile();

        return { success: true };
      } catch (err) {
        debugError("Feil ved følg/avfølg:", err);

        const action = isFollowing ? "avfølge" : "følge";
        return {
          success: false,
          error: `Kunne ikke ${action} bruker: ${err.message || "Ukjent feil"}`,
          statusCode: err.statusCode,
          retryable: err.isRetryable ? err.isRetryable() : false,
        };
      }
    },
    [agent, fetchProfile],
  );

  // Last profil ved initialisering
  useEffect(() => {
    if (agent && handle) {
      fetchProfile();
    }
  }, [agent, handle, fetchProfile]);

  return {
    profile,
    loading,
    error,
    follows,
    followLoading,
    followCount,
    retrying,
    fetchFollows,
    toggleFollow,
    refreshProfile: fetchProfile,
    formatHandle,
  };
};

export default useProfile;
