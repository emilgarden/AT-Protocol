import { debugError, debugWarn, DEBUG, debugLog } from "./debug";

/**
 * Henter ut bilder fra embed-data
 * @param {Object} embed - Embed-data fra Bluesky API
 * @param {string} authorDid - Forfatterens DID
 * @returns {Array} Array med bilde-URLer
 */
export const getImagesFromEmbed = (embed, authorDid) => {
  if (!embed) return [];

  const images = [];

  try {
    // Debug info
    debugLog(
      "getImagesFromEmbed - Embed type:",
      embed.$type,
      "AuthorDID:",
      authorDid,
    );

    if (
      embed.$type === "app.bsky.embed.images" ||
      embed.$type === "app.bsky.embed.images#view"
    ) {
      // Direkte bildeembed
      (embed.images || []).forEach((img, index) => {
        // Debug info
        debugLog(`getImagesFromEmbed - Bilde ${index}:`, img);

        let imageUrl = null;

        // Sjekk alle mulige steder for bilde-URL
        if (img.thumb && img.thumb.ref && img.thumb.ref.$link) {
          // Standard Bluesky API-format
          imageUrl = `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${authorDid}&cid=${img.thumb.ref.$link}`;
        } else if (img.thumb && typeof img.thumb === "string") {
          // Direkte URL-string
          imageUrl = img.thumb;
        } else if (img.thumb && img.thumb.url) {
          // URL i thumb.url
          imageUrl = img.thumb.url;
        } else if (img.fullsize && img.fullsize.ref && img.fullsize.ref.$link) {
          // Prøv fullsize hvis thumb ikke finnes
          imageUrl = `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${authorDid}&cid=${img.fullsize.ref.$link}`;
        } else if (img.fullsize && typeof img.fullsize === "string") {
          // Direkte URL-string for fullsize
          imageUrl = img.fullsize;
        } else if (img.fullsize && img.fullsize.url) {
          // URL i fullsize.url
          imageUrl = img.fullsize.url;
        } else if (img.image && img.image.ref && img.image.ref.$link) {
          // Alternativt format
          imageUrl = `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${authorDid}&cid=${img.image.ref.$link}`;
        } else if (img.url) {
          // Direkte URL på bildet
          imageUrl = img.url;
        } else if (typeof img === "string") {
          // Hvis img selv er en string
          imageUrl = img;
        }

        // Sjekk om vi fant en URL og legg til i listen
        if (imageUrl) {
          // Sjekk om URL-en allerede er en CDN-URL
          if (!imageUrl.startsWith("http")) {
            imageUrl = `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${authorDid}&cid=${imageUrl}`;
          }

          images.push(imageUrl);
        } else if (DEBUG) {
          debugWarn("getImagesFromEmbed - Kunne ikke finne bilde-URL:", img);
        }
      });
    } else if (
      embed.$type === "app.bsky.embed.recordWithMedia" ||
      embed.$type === "app.bsky.embed.recordWithMedia#view"
    ) {
      // Innlegg med media
      if (
        embed.media?.$type === "app.bsky.embed.images" ||
        embed.media?.$type === "app.bsky.embed.images#view"
      ) {
        return getImagesFromEmbed(embed.media, authorDid);
      } else if (embed.media) {
        // Prøv å hente bilder direkte fra media-objektet
        return getImagesFromEmbed(embed.media, authorDid);
      }
    } else if (
      embed.$type === "app.bsky.embed.external" ||
      embed.$type === "app.bsky.embed.external#view"
    ) {
      // Ekstern lenke med thumbnail
      if (embed.external?.thumb) {
        const thumbUrl = embed.external.thumb;
        if (typeof thumbUrl === "string") {
          images.push(thumbUrl);
        } else if (thumbUrl.url) {
          images.push(thumbUrl.url);
        } else if (thumbUrl.ref && thumbUrl.ref.$link) {
          images.push(
            `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${authorDid}&cid=${thumbUrl.ref.$link}`,
          );
        }
      }
    }

    // Sjekk om vi har bilder i embed.record
    if (
      images.length === 0 &&
      embed.record &&
      typeof embed.record === "object"
    ) {
      // Rekursivt kall for å sjekke om det er bilder i embed.record
      const recordImages = getImagesFromEmbed(embed.record.embed, authorDid);
      images.push(...recordImages);
    }

    // Debug info
    debugLog("getImagesFromEmbed - Fant bilder:", images);
  } catch (error) {
    debugError("Feil ved henting av bilder fra embed:", error);
  }

  return images;
};

/**
 * Henter domenenavn fra en URI
 * @param {string} uri - URI som skal analyseres
 * @returns {string} Domenenavn
 */
export const getDomainFromUri = (uri) => {
  try {
    return new URL(uri).hostname;
  } catch (e) {
    debugError("Feil ved parsing av URI:", e);
    return uri;
  }
};

/**
 * Konstruerer en thumbnail-URL basert på embed data
 * @param {Object} embed - Embed-data fra Bluesky API
 * @param {string} authorDid - Forfatterens DID
 * @returns {string|null} Thumbnail URL eller null hvis ikke funnet
 */
export const getThumbnailUrl = (external, authorDid) => {
  if (!external) return null;

  if (external.thumb && external.thumb.ref && external.thumb.ref.$link) {
    return `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${authorDid}&cid=${external.thumb.ref.$link}`;
  } else if (external.thumb) {
    if (typeof external.thumb === "string") {
      return external.thumb;
    } else if (external.thumb.url) {
      return external.thumb.url;
    }
  }

  return null;
};
