import { useMemo, useEffect } from "react";
import { extractPostData } from "../utils/postDataExtractor";
import { DEBUG, debugLog } from "../utils/debug";

/**
 * Custom hook for å hente strukturerte data fra et post-objekt fra Bluesky API.
 *
 * Henter ut normaliserte data fra et post-objekt, inkludert:
 * - Tekst med formatering
 * - Om det er en repost/sitat/vanlig post
 * - Forfatterinformasjon
 * - Embedded media (bilder, lenker, YouTube, etc.)
 * - Siterte innlegg
 *
 * @param {Object} post - Post-objektet fra Bluesky API
 * @param {Object} options - Opsjoner for dataekstraksjonen
 * @param {boolean} options.processText - Om tekst skal prosesseres (default: true)
 * @param {boolean} options.loadQuotedPost - Om siterte innlegg skal hentes (default: true)
 * @returns {Object} Strukturerte data om innlegget
 */
export function usePostData(post, options = {}) {
  // Bruk useMemo for å unngå unødvendig reprosessering
  const postData = useMemo(() => {
    if (!post) return null;

    try {
      // Standard opsjoner
      const defaultOptions = {
        processText: true,
        loadQuotedPost: true,
      };

      // Kombiner med brukerens opsjoner
      const mergedOptions = { ...defaultOptions, ...options };

      // Hent data fra innlegget
      return extractPostData(post, mergedOptions);
    } catch (error) {
      // Logg feil, men returner et tomt objekt for å unngå feilrendering
      console.error("Feil ved behandling av post-data:", error);

      return {
        isValid: false,
        error: error.message,
        text: "",
        isRepost: false,
        isQuote: false,
        author: {},
        uri: post.uri || "",
        cid: post.cid || "",
        indexedAt: post.indexedAt || new Date().toISOString(),
        likeCount: 0,
        repostCount: 0,
        replyCount: 0,
      };
    }
  }, [post, options]);

  // Logg debugging-informasjon hvis nødvendig
  useEffect(() => {
    if (DEBUG && postData) {
      // Logg ekstra informasjon om siterte og repostede innlegg
      if (postData.isQuote && postData.quotedPost) {
        debugLog("QuotedPost funnet:", {
          quotedUri: postData.quotedPost.uri,
          quotedAuthor: postData.quotedPost.author?.handle || "ukjent",
          quotedText: postData.quotedPost.text?.substring(0, 50) + "...",
        });
      }

      if (postData.isRepost) {
        debugLog("Repost funnet:", {
          originalUri: postData.originalPost?.uri,
          originalAuthor: postData.originalPost?.author?.handle || "ukjent",
          repostedBy: postData.repostedBy?.handle || "ukjent",
        });
      }
    }
  }, [postData]);

  return postData;
}

export default usePostData;
