import { debugLog, debugError, DEBUG } from "./debug";
import MediaUtils from "./MediaUtils";

/**
 * Sjekker om et innlegg er en repost
 * @param {Object} post - Post-objekt fra Bluesky API
 * @returns {boolean} true hvis innlegget er en repost
 */
export function isRepostCheck(post) {
  return (
    !!post?.reason && post.reason.$type === "app.bsky.feed.defs#reasonRepost"
  );
}

/**
 * Finner det opprinnelige innlegget (enten postens innhold eller repostet innhold)
 * @param {Object} post - Post-objekt fra Bluesky API
 * @returns {Object} Det opprinnelige innlegget
 */
export function getOriginalPost(post) {
  if (isRepostCheck(post)) {
    return post.post || post;
  }
  return post;
}

/**
 * Finner tekst fra et innlegg på riktig sted i objektet
 * @param {Object} post - Post-objekt fra Bluesky API
 * @returns {string} Funnet tekst eller tom streng
 */
export function findPostText(post) {
  if (!post) return "";

  // Sjekk potensielle steder for tekst
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
 * Finner forfatterdata fra et innlegg
 * @param {Object} post - Post-objekt fra Bluesky API
 * @returns {Object|null} Forfatterdata eller null
 */
export function findAuthorData(post) {
  if (!post) return null;

  // Sjekk potensielle steder for forfatterdata
  const author = post.author || post.post?.author;

  if (!author) return null;

  return {
    did: author.did,
    handle: author.handle,
    displayName: author.displayName || author.handle,
    avatar: author.avatar,
  };
}

/**
 * Finner embed-data fra et innlegg
 * @param {Object} post - Post-objekt fra Bluesky API
 * @returns {Object|null} Embed-data eller null
 */
export function findEmbedData(post) {
  if (!post) return null;

  // Sjekk potensielle steder for embed
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
 * Finner facets fra et innlegg
 * @param {Object} post - Post-objekt fra Bluesky API
 * @returns {Array|null} Facets eller null
 */
export function findFacets(post) {
  if (!post) return null;

  // Sjekk potensielle steder for facets
  return (
    post.facets ||
    post.record?.facets ||
    post.value?.facets ||
    post.post?.record?.facets ||
    post.post?.facets ||
    null
  );
}

/**
 * Sjekker om et innlegg er et sitat av et annet innlegg
 * @param {Object} post - Post-objekt fra Bluesky API
 * @returns {boolean} true hvis innlegget er et sitat
 */
export function isQuoteCheck(post, embed) {
  if (!post) return false;

  // Vi har allerede embed fra findEmbedData
  const embedData = embed || findEmbedData(post);

  if (!embedData) return false;

  // Sjekk om embed er av type 'record'
  return (
    embedData.$type === "app.bsky.embed.record" ||
    embedData.$type === "app.bsky.embed.recordWithMedia"
  );
}

/**
 * Finner det siterte innlegget fra et innlegg
 * @param {Object} post - Post-objekt fra Bluesky API
 * @param {Object} embed - Embed fra innlegget (valgfritt)
 * @returns {Object|null} Det siterte innlegget eller null
 */
export function findQuotedPost(post, embed) {
  if (!post) return null;

  // Vi har allerede embed fra findEmbedData
  const embedData = embed || findEmbedData(post);

  if (!embedData) return null;

  // Hent ut det siterte innlegget basert på embed-type
  if (embedData.$type === "app.bsky.embed.record") {
    return embedData.record;
  } else if (embedData.$type === "app.bsky.embed.recordWithMedia") {
    return embedData.record.record;
  }

  return null;
}

/**
 * Finner tekst fra det siterte innlegget
 * @param {Object} quotedPost - Det siterte innlegget
 * @returns {string} Tekst fra sitert innlegg eller tom streng
 */
export function findQuotedText(quotedPost) {
  if (!quotedPost) return "";

  // Siterte innlegg kan ha tekst på forskjellige steder
  return (
    quotedPost.value?.text || quotedPost.record?.text || quotedPost.text || ""
  );
}

/**
 * Finner forfatter av det siterte innlegget
 * @param {Object} quotedPost - Det siterte innlegget
 * @returns {Object|null} Forfatterdata eller null
 */
export function findQuotedAuthor(quotedPost) {
  if (!quotedPost) return null;

  const author = quotedPost.author;

  if (!author) return null;

  return {
    did: author.did,
    handle: author.handle,
    displayName: author.displayName || author.handle,
    avatar: author.avatar,
  };
}

/**
 * Finner facets fra det siterte innlegget
 * @param {Object} quotedPost - Det siterte innlegget
 * @returns {Array|null} Facets eller null
 */
export function findQuotedFacets(quotedPost) {
  if (!quotedPost) return null;

  return (
    quotedPost.value?.facets ||
    quotedPost.record?.facets ||
    quotedPost.facets ||
    null
  );
}

/**
 * Komplett funksjon for å ekstrahere all relevant data fra et innlegg
 * @param {Object} postInput - Innlegget å ekstrahere data fra
 * @returns {Object} Ekstrahertt data
 */
export function extractPostData(postInput) {
  try {
    if (!postInput) {
      debugError("extractPostData: Ingen post mottatt");
      return null;
    }

    // Sjekk om det er en repost
    const isRepost = isRepostCheck(postInput);
    let repostedBy = null;

    if (isRepost) {
      repostedBy = findAuthorData(postInput);
    }

    // Finn det opprinnelige innlegget
    const post = getOriginalPost(postInput);

    // Finn URI og CID
    const uri = post.uri;
    const cid = post.cid;

    // Finn når innlegget ble indeksert
    const indexedAt =
      post.indexedAt ||
      post.record?.createdAt ||
      post.value?.createdAt ||
      post.post?.indexedAt ||
      "";

    // Finn tekst
    const text = findPostText(post);

    // Finn forfatterdata
    const author = findAuthorData(post);

    // Finn embed
    const embed = findEmbedData(post);

    // Finn facets
    const facets = findFacets(post);

    // Sjekk om innlegget er et sitat
    const isQuote = isQuoteCheck(post, embed);
    let quotedPost = null;
    let quotedText = "";
    let quotedAuthor = null;
    let quotedFacets = null;

    if (isQuote) {
      quotedPost = findQuotedPost(post, embed);
      quotedText = findQuotedText(quotedPost);
      quotedAuthor = findQuotedAuthor(quotedPost);
      quotedFacets = findQuotedFacets(quotedPost);
    }

    // Finn bilder fra embed
    const images = MediaUtils.getImagesFromEmbed(embed);

    // Finn ekstern lenke fra embed
    const externalData = MediaUtils.getExternalLinkFromEmbed(embed);

    // Skill ut YouTube-ID og eksterne lenker
    let youtubeId = null;
    let externalLink = null;

    if (externalData) {
      if (externalData.youtubeId) {
        youtubeId = externalData.youtubeId;
      } else {
        externalLink = externalData;
      }
    }

    // Hent ut metrics og reaksjoner
    const likeCount = post.likeCount || 0;
    const repostCount = post.repostCount || 0;
    const replyCount = post.replyCount || 0;

    // Logg debug-informasjon
    if (DEBUG) {
      debugLog("extractPostData:", {
        uri,
        isRepost,
        isQuote,
        hasEmbed: !!embed,
        hasQuotedPost: !!quotedPost,
        hasImages: images.length > 0,
        hasYouTube: !!youtubeId,
        hasExternalLink: !!externalLink,
        textLength: text?.length,
      });
    }

    // Returner ekstrahert data
    return {
      uri,
      cid,
      indexedAt,
      text,
      facets,
      author,
      embed,
      isRepost,
      repostedBy,
      isQuote,
      quotedPost,
      quotedText,
      quotedAuthor,
      quotedFacets,
      images,
      youtubeId,
      externalLink,
      likeCount,
      repostCount,
      replyCount,
    };
  } catch (error) {
    debugError("Feil ved ekstraksjon av postdata:", error);
    return null;
  }
}

export default {
  extractPostData,
  isRepostCheck,
  getOriginalPost,
  findPostText,
  findAuthorData,
  findEmbedData,
  findFacets,
  isQuoteCheck,
  findQuotedPost,
  findQuotedText,
  findQuotedAuthor,
  findQuotedFacets,
};
