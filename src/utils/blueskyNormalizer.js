/**
 * blueskyNormalizer.js
 *
 * Verktøy for å normalisere og validere data fra Bluesky API.
 * Hver funksjon utfører:
 * 1. Validering av inndata
 * 2. Ekstraksjon av data fra riktig sted i API-strukturen
 * 3. Normalisering til et konsistent format
 * 4. Gir tydelige fallback-verdier
 */

// 1. Interne utility-importer
import { debugLog, debugError } from "./debug";

/**
 * Standard validering som sjekker om et objekt er definert og ikke null
 *
 * @param {any} obj - Objektet som skal valideres
 * @returns {boolean} True hvis objekt er gyldig
 */
export function isValidObject(obj) {
  return obj !== undefined && obj !== null;
}

/**
 * Standard validering for arrays
 *
 * @param {any} arr - Arrayet som skal valideres
 * @returns {boolean} True hvis array er gyldig
 */
export function isValidArray(arr) {
  return Array.isArray(arr) && arr.length > 0;
}

/**
 * Standard validering for strenger
 *
 * @param {any} str - Strengen som skal valideres
 * @returns {boolean} True hvis strengen er gyldig
 */
export function isValidString(str) {
  return typeof str === "string" && str.trim().length > 0;
}

// ===== AUTHOR NORMALIZATION =====

/**
 * Standard struktur for normalisert forfatterdata
 */
export const DEFAULT_AUTHOR = {
  did: "",
  handle: "",
  displayName: "",
  avatar: null,
  description: "",
  followersCount: 0,
  followsCount: 0,
  postsCount: 0,
  indexedAt: "",
};

/**
 * Normaliserer forfatterdata fra Bluesky API
 *
 * @param {Object} input - Forfatterdata fra API
 * @returns {Object} Normalisert forfatterdata
 */
export function normalizeAuthor(input) {
  if (!isValidObject(input)) {
    return { ...DEFAULT_AUTHOR };
  }

  try {
    return {
      did: input.did || "",
      handle: input.handle || "",
      displayName: input.displayName || input.handle || "",
      avatar: input.avatar || null,
      description: input.description || "",
      followersCount: input.followersCount || 0,
      followsCount: input.followsCount || 0,
      postsCount: input.postsCount || 0,
      indexedAt: input.indexedAt || "",
    };
  } catch (error) {
    debugError("Feil ved normalisering av forfatterdata:", error);
    return { ...DEFAULT_AUTHOR };
  }
}

/**
 * Finner og normaliserer forfatterdata fra et Bluesky-innlegg
 *
 * @param {Object} post - Post-objekt fra Bluesky API
 * @returns {Object} Normalisert forfatterdata
 */
export function getAuthorFromPost(post) {
  if (!isValidObject(post)) {
    return { ...DEFAULT_AUTHOR };
  }

  try {
    // Finn forfatterdata fra ulike steder i post-objektet
    const authorData =
      post.author || post.post?.author || post.record?.author || null;

    return normalizeAuthor(authorData);
  } catch (error) {
    debugError("Feil ved uthenting av forfatter fra post:", error);
    return { ...DEFAULT_AUTHOR };
  }
}

// ===== POST NORMALIZATION =====

/**
 * Standard struktur for normalisert post-data
 */
export const DEFAULT_POST = {
  uri: "",
  cid: "",
  author: { ...DEFAULT_AUTHOR },
  text: "",
  facets: [],
  embed: null,
  indexedAt: "",
  likeCount: 0,
  repostCount: 0,
  replyCount: 0,
  isRepost: false,
  repostedBy: null,
  isQuote: false,
  quotedPost: null,
  images: [],
  externalLink: null,
  youtubeId: null,
  labels: [],
};

/**
 * Sjekker om et innlegg er en repost
 *
 * @param {Object} post - Post-objekt fra Bluesky API
 * @returns {boolean} True hvis innlegget er en repost
 */
export function isRepost(post) {
  if (!isValidObject(post)) return false;

  return (
    !!post.reason && post.reason.$type === "app.bsky.feed.defs#reasonRepost"
  );
}

/**
 * Finner den opprinnelige posten (selv eller referert post hvis repost)
 *
 * @param {Object} post - Post-objekt fra Bluesky API
 * @returns {Object} Opprinnelig post-objekt
 */
export function getOriginalPost(post) {
  if (!isValidObject(post)) return null;

  if (isRepost(post)) {
    return post.post || post;
  }
  return post;
}

/**
 * Finner URI fra et Bluesky-innlegg
 *
 * @param {Object} post - Post-objekt fra Bluesky API
 * @returns {string} URI eller tom streng
 */
export function getPostUri(post) {
  if (!isValidObject(post)) return "";

  return post.uri || post.post?.uri || post.record?.uri || "";
}

/**
 * Finner CID fra et Bluesky-innlegg
 *
 * @param {Object} post - Post-objekt fra Bluesky API
 * @returns {string} CID eller tom streng
 */
export function getPostCid(post) {
  if (!isValidObject(post)) return "";

  return post.cid || post.post?.cid || post.record?.cid || "";
}

/**
 * Finner tekst fra et Bluesky-innlegg
 *
 * @param {Object} post - Post-objekt fra Bluesky API
 * @returns {string} Funnet tekst eller tom streng
 */
export function getPostText(post) {
  if (!isValidObject(post)) return "";

  return (
    post.text ||
    post.record?.text ||
    post.value?.text ||
    post.post?.record?.text ||
    post.post?.text ||
    ""
  );
}

/**
 * Finner facets (mentions, lenker, hashtags) fra et Bluesky-innlegg
 *
 * @param {Object} post - Post-objekt fra Bluesky API
 * @returns {Array} Facets eller tomt array
 */
export function getPostFacets(post) {
  if (!isValidObject(post)) return [];

  const facets =
    post.facets ||
    post.record?.facets ||
    post.value?.facets ||
    post.post?.record?.facets ||
    post.post?.facets ||
    null;

  return isValidArray(facets) ? facets : [];
}

/**
 * Finner tidspunkt for indeksering fra et Bluesky-innlegg
 *
 * @param {Object} post - Post-objekt fra Bluesky API
 * @returns {string} Tidspunkt eller tom streng
 */
export function getPostIndexedAt(post) {
  if (!isValidObject(post)) return "";

  return (
    post.indexedAt ||
    post.record?.createdAt ||
    post.value?.createdAt ||
    post.post?.indexedAt ||
    ""
  );
}

/**
 * Finner embed-data fra et Bluesky-innlegg
 *
 * @param {Object} post - Post-objekt fra Bluesky API
 * @returns {Object|null} Embed-data eller null
 */
export function getPostEmbed(post) {
  if (!isValidObject(post)) return null;

  return (
    post.embed ||
    post.record?.embed ||
    post.value?.embed ||
    post.post?.embed ||
    post.post?.record?.embed ||
    null
  );
}

/**
 * Normaliserer bilder fra et embed-objekt
 *
 * @param {Object} embed - Embed-objekt fra Bluesky API
 * @returns {Array} Array med normaliserte bildeobjekter
 */
export function normalizeImages(embed) {
  if (!isValidObject(embed)) return [];

  const images = [];

  try {
    // Sjekk for direkte bilder
    if (embed.$type === "app.bsky.embed.images") {
      if (isValidArray(embed.images)) {
        embed.images.forEach((image) => {
          if (image.fullsize) {
            images.push({
              fullsize: image.fullsize,
              thumb: image.thumb || image.fullsize,
              alt: image.alt || "",
              aspectRatio: image.aspectRatio || null,
            });
          }
        });
      }
    }

    // Sjekk for record-type som inneholder bilder
    if (embed.$type === "app.bsky.embed.record") {
      const record = embed.record;
      const recordEmbed = record?.embeds?.[0] || record?.embed;

      if (
        isValidObject(recordEmbed) &&
        recordEmbed.$type === "app.bsky.embed.images"
      ) {
        if (isValidArray(recordEmbed.images)) {
          recordEmbed.images.forEach((image) => {
            if (image.fullsize) {
              images.push({
                fullsize: image.fullsize,
                thumb: image.thumb || image.fullsize,
                alt: image.alt || "",
                aspectRatio: image.aspectRatio || null,
              });
            }
          });
        }
      }
    }

    // Sjekk for record-with-media type
    if (embed.$type === "app.bsky.embed.recordWithMedia") {
      // Sjekk mediedelen
      const media = embed.media;
      if (isValidObject(media) && media.$type === "app.bsky.embed.images") {
        if (isValidArray(media.images)) {
          media.images.forEach((image) => {
            if (image.fullsize) {
              images.push({
                fullsize: image.fullsize,
                thumb: image.thumb || image.fullsize,
                alt: image.alt || "",
                aspectRatio: image.aspectRatio || null,
              });
            }
          });
        }
      }
    }

    // Sjekk for ekstern lenke med bilde
    if (embed.$type === "app.bsky.embed.external") {
      if (isValidObject(embed.external) && embed.external.thumb) {
        images.push({
          fullsize: embed.external.thumb,
          thumb: embed.external.thumb,
          alt: embed.external.title || embed.external.uri || "",
          isExternal: true,
        });
      }
    }

    return images;
  } catch (error) {
    debugError("Feil ved normalisering av bilder:", error);
    return [];
  }
}

/**
 * Trekker ut YouTube ID fra en lenke
 *
 * @param {string} url - YouTube-lenke
 * @returns {string|null} YouTube ID eller null
 */
export function extractYoutubeId(url) {
  if (!isValidString(url)) return null;

  try {
    // Standard YouTube-lenker
    let match = url.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
    );
    if (match && match[1]) {
      return match[1];
    }

    // YouTube Shorts
    match = url.match(/youtube\.com\/shorts\/([^"&?\/\s]{11})/);
    if (match && match[1]) {
      return match[1];
    }

    return null;
  } catch (error) {
    debugError("Feil ved uttrekking av YouTube ID:", error);
    return null;
  }
}

/**
 * Trekker ut domenenavn fra en URI
 *
 * @param {string} uri - URI å trekke ut domene fra
 * @returns {string|null} Domenenavn eller null
 */
export function extractDomain(uri) {
  if (!isValidString(uri)) return null;

  try {
    const url = new URL(uri);
    let domain = url.hostname;

    // Fjern www. hvis det finnes
    if (domain.startsWith("www.")) {
      domain = domain.substring(4);
    }

    return domain;
  } catch (error) {
    debugError("Feil ved uttrekking av domene:", error);
    return null;
  }
}

/**
 * Normaliserer ekstern lenke fra et embed-objekt
 *
 * @param {Object} embed - Embed-objekt fra Bluesky API
 * @returns {Object|null} Normalisert ekstern lenke-objekt eller null
 */
export function normalizeExternalLink(embed) {
  if (!isValidObject(embed)) return null;

  try {
    if (
      embed.$type === "app.bsky.embed.external" &&
      isValidObject(embed.external)
    ) {
      const { uri, title, description, thumb } = embed.external;

      if (!isValidString(uri)) return null;

      // Behandle YouTube-lenker spesielt
      const youtubeId = extractYoutubeId(uri);

      return {
        uri,
        url: uri, // Alias for kompatibilitet
        title: title || extractDomain(uri) || uri,
        description: description || "",
        thumb,
        domain: extractDomain(uri),
        youtubeId,
      };
    }

    return null;
  } catch (error) {
    debugError("Feil ved normalisering av ekstern lenke:", error);
    return null;
  }
}

/**
 * Sjekker om et innlegg er et sitat av et annet innlegg
 *
 * @param {Object} post - Post-objekt fra Bluesky API
 * @param {Object} embed - Embed-objekt (valgfritt, vil bli hentet fra post hvis ikke oppgitt)
 * @returns {boolean} True hvis innlegget er et sitat
 */
export function isQuote(post, embed = null) {
  if (!isValidObject(post)) return false;

  const embedData = embed || getPostEmbed(post);

  if (!isValidObject(embedData)) return false;

  // Sjekk om embed er av type 'record'
  return (
    embedData.$type === "app.bsky.embed.record" ||
    embedData.$type === "app.bsky.embed.recordWithMedia"
  );
}

/**
 * Finner det siterte innlegget fra et Bluesky-innlegg
 *
 * @param {Object} post - Post-objekt fra Bluesky API
 * @param {Object} embed - Embed-objekt (valgfritt, vil bli hentet fra post hvis ikke oppgitt)
 * @returns {Object|null} Det siterte innlegget eller null
 */
export function getQuotedPost(post, embed = null) {
  if (!isValidObject(post)) return null;

  const embedData = embed || getPostEmbed(post);

  if (!isValidObject(embedData)) return null;

  // Hent ut det siterte innlegget basert på embed-type
  if (embedData.$type === "app.bsky.embed.record") {
    return embedData.record;
  } else if (embedData.$type === "app.bsky.embed.recordWithMedia") {
    return embedData.record?.record;
  }

  return null;
}

/**
 * Normaliserer et Bluesky-innlegg til et konsistent format
 *
 * @param {Object} postInput - Post-objekt fra Bluesky API
 * @returns {Object} Normalisert post-objekt
 */
export function normalizePost(postInput) {
  if (!isValidObject(postInput)) {
    return { ...DEFAULT_POST };
  }

  try {
    // Sjekk om det er en repost
    const isReposted = isRepost(postInput);
    let repostedBy = null;

    if (isReposted) {
      repostedBy = normalizeAuthor(postInput.reason?.by);
    }

    // Finn opprinnelig post
    const post = getOriginalPost(postInput);
    if (!isValidObject(post)) {
      return { ...DEFAULT_POST };
    }

    // Basisinformasjon
    const uri = getPostUri(post);
    const cid = getPostCid(post);
    const indexedAt = getPostIndexedAt(post);
    const text = getPostText(post);
    const facets = getPostFacets(post);
    const author = getAuthorFromPost(post);

    // Interaksjonsstatistikk
    const likeCount = post.likeCount || 0;
    const repostCount = post.repostCount || 0;
    const replyCount = post.replyCount || 0;

    // Embed-relatert informasjon
    const embed = getPostEmbed(post);
    const isQuoted = isQuote(post, embed);

    // Normaliserte data
    const images = normalizeImages(embed);
    const externalLink = normalizeExternalLink(embed);

    // Behandle siterte innlegg
    let quotedPost = null;
    if (isQuoted) {
      const rawQuotedPost = getQuotedPost(post, embed);
      if (isValidObject(rawQuotedPost)) {
        // Ikke gjør en full normalizePost for å unngå uendelig rekursjon
        quotedPost = {
          uri: getPostUri(rawQuotedPost),
          cid: getPostCid(rawQuotedPost),
          text: getPostText(rawQuotedPost),
          facets: getPostFacets(rawQuotedPost),
          author: getAuthorFromPost(rawQuotedPost),
          indexedAt: getPostIndexedAt(rawQuotedPost),
          embed: getPostEmbed(rawQuotedPost),
        };

        // Legg til bilder fra det siterte innlegget
        if (isValidObject(quotedPost.embed)) {
          quotedPost.images = normalizeImages(quotedPost.embed);
          quotedPost.externalLink = normalizeExternalLink(quotedPost.embed);
        }
      }
    }

    // Ekstraherer YouTube ID også på toppnivå for enklere tilgang
    const youtubeId = externalLink?.youtubeId || null;

    // Etiketter/labels
    const labels = post.labels?.map((label) => label.val) || [];

    return {
      uri,
      cid,
      author,
      text,
      facets,
      embed,
      indexedAt,
      likeCount,
      repostCount,
      replyCount,
      isRepost: isReposted,
      repostedBy,
      isQuote: isQuoted,
      quotedPost,
      images,
      externalLink,
      youtubeId,
      labels,
    };
  } catch (error) {
    debugError("Feil ved normalisering av post:", error);
    return { ...DEFAULT_POST };
  }
}

/**
 * Normaliserer en samling Bluesky-innlegg
 *
 * @param {Array} posts - Array med Post-objekter fra Bluesky API
 * @returns {Array} Array med normaliserte post-objekter
 */
export function normalizePosts(posts) {
  if (!isValidArray(posts)) {
    return [];
  }

  try {
    return posts.map((post) => normalizePost(post));
  } catch (error) {
    debugError("Feil ved normalisering av posts-array:", error);
    return [];
  }
}

// Eksportér alle funksjoner som objekt for enkel tilgang
export default {
  // Basisvalidering
  isValidObject,
  isValidArray,
  isValidString,

  // Forfatter
  normalizeAuthor,
  getAuthorFromPost,
  DEFAULT_AUTHOR,

  // Post
  normalizePost,
  normalizePosts,
  DEFAULT_POST,

  // Post-elementer
  isRepost,
  getOriginalPost,
  getPostUri,
  getPostCid,
  getPostText,
  getPostFacets,
  getPostIndexedAt,
  getPostEmbed,

  // Bilder
  normalizeImages,

  // Eksterne lenker
  normalizeExternalLink,
  extractYoutubeId,
  extractDomain,

  // Siterte innlegg
  isQuote,
  getQuotedPost,
};
