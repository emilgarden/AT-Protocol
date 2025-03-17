import React, { useCallback, useMemo } from "react";
import PropTypes from "prop-types";

import SafeImage from "../ui/SafeImage";
import RichText from "../ui/RichText";

import { debugLog } from "../../utils/debug";

/**
 * Viser et sitert innlegg i et annet innlegg
 *
 * @param {Object} props - Komponent-props
 * @param {Object} props.quotedPost - Normalisert sitert post-objekt
 * @param {Function} props.onProfileClick - Callback for profilklikk
 */
const QuotedPost = React.memo(({ quotedPost = null, onProfileClick = null }) => {
  // Hvis ingen sitert innlegg, ikke vis noe
  if (!quotedPost) {
    debugLog("QuotedPost: Ingen quotedPost funnet");
    return null;
  }

  // Håndter profilklikk
  const handleAuthorClick = useCallback(
    (e) => {
      if (!e || !quotedPost?.author) return; // Nullsjekk

      e.stopPropagation();
      if (quotedPost.author && onProfileClick) {
        onProfileClick(quotedPost.author);
      }
    },
    [quotedPost?.author, onProfileClick],
  );

  // Håndter klikk på mention
  const handleMentionClick = useCallback(
    (did, handle) => {
      if (!did && !handle) return; // Nullsjekk

      if (onProfileClick) {
        onProfileClick({ did, handle });
      }
    },
    [onProfileClick],
  );

  // Håndter klikk på hashtag
  const handleHashtagClick = useCallback((tag) => {
    if (!tag) return; // Nullsjekk

    // Implementer eventuell logikk for hashtag-klikk her
    debugLog("Hashtag klikket:", tag);
  }, []);

  // Håndter klikk på lenker
  const handleLinkClick = useCallback((url) => {
    if (!url) return; // Nullsjekk

    window.open(url, "_blank");
  }, []);

  // Håndter klikk på bildet
  const handleImageClick = useCallback((url) => {
    if (!url) return; // Nullsjekk

    window.open(url, "_blank");
  }, []);

  // Håndtere klikk på hele innlegget
  const handleContainerClick = useCallback((e) => {
    if (!e) return; // Nullsjekk

    e.stopPropagation();
  }, []);

  // Finn relevante data fra det normaliserte innlegget
  const { hasMedia, hasYouTube, hasExternalLink } = useMemo(
    () => ({
      hasMedia:
        Array.isArray(quotedPost?.images) && quotedPost.images.length > 0,
      hasYouTube:
        quotedPost?.youtubeId !== null && quotedPost?.youtubeId !== undefined,
      hasExternalLink:
        quotedPost?.externalLink !== null &&
        quotedPost?.externalLink !== undefined,
    }),
    [quotedPost],
  );

  return (
    <div className="quoted-post w-full" onClick={handleContainerClick}>
      {/* Header med forfatterbilde og navn */}
      <div className="flex items-center mb-2">
        {quotedPost.author?.avatar && (
          <div className="mr-2 cursor-pointer" onClick={handleAuthorClick}>
            <SafeImage
              src={quotedPost.author.avatar}
              alt={
                quotedPost.author?.displayName ||
                quotedPost.author?.handle ||
                "Ukjent bruker"
              }
              className="h-6 w-6 rounded-full"
              defaultImage="/default-avatar.png"
            />
          </div>
        )}

        <div
          className="cursor-pointer hover:underline"
          onClick={handleAuthorClick}
        >
          <span className="font-medium text-sm text-gray-900">
            {quotedPost.author?.displayName || "Ukjent bruker"}
          </span>
          <span className="text-sm text-gray-500 ml-1">
            @{quotedPost.author?.handle || "ukjent"}
          </span>
        </div>
      </div>

      {/* Innleggstekst */}
      {quotedPost?.text && (
        <div className="mb-2">
          <RichText
            text={quotedPost.text}
            facets={quotedPost?.facets}
            onMentionClick={handleMentionClick}
            onHashtagClick={handleHashtagClick}
            onLinkClick={handleLinkClick}
            className="text-sm text-gray-700"
          />
        </div>
      )}

      {/* Bilder */}
      {hasMedia && (
        <div
          className={`grid gap-1 mb-2 ${(quotedPost?.images?.length || 0) > 1 ? "grid-cols-2" : "grid-cols-1"}`}
        >
          {quotedPost.images?.map((image, index) => (
            <SafeImage
              key={index}
              src={image?.thumb || image?.fullsize}
              alt={image?.alt || `Bilde ${index + 1}`}
              className="rounded w-full max-h-36 object-cover"
              defaultImage="/image-placeholder.png"
              onClick={() => handleImageClick(image?.fullsize)}
            />
          ))}
        </div>
      )}

      {/* YouTube-video */}
      {hasYouTube && (
        <div className="mb-2">
          <div className="relative pb-56.25 h-0 rounded overflow-hidden">
            <iframe
              className="absolute top-0 left-0 w-full h-full"
              src={`https://www.youtube.com/embed/${quotedPost.youtubeId}`}
              title="YouTube video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        </div>
      )}

      {/* Eksterne lenker */}
      {hasExternalLink && !hasYouTube && quotedPost?.externalLink && (
        <div className="mb-2">
          <a
            href={quotedPost.externalLink?.uri}
            target="_blank"
            rel="noopener noreferrer"
            className="block border border-gray-100 rounded overflow-hidden hover:border-blue-200 transition-colors"
            onClick={handleContainerClick}
          >
            {quotedPost.externalLink?.thumb && (
              <SafeImage
                src={quotedPost.externalLink.thumb}
                alt={
                  quotedPost.externalLink?.title ||
                  quotedPost.externalLink?.uri ||
                  "Lenke"
                }
                className="w-full h-24 object-cover"
                defaultImage="/image-placeholder.png"
              />
            )}
            <div className="p-2">
              <div className="text-xs font-medium text-blue-600 truncate">
                {quotedPost.externalLink?.title ||
                  quotedPost.externalLink?.uri ||
                  "Ekstern lenke"}
              </div>
              <div className="text-xs text-gray-500">
                {quotedPost.externalLink?.domain ||
                  (quotedPost.externalLink?.uri
                    ? new URL(quotedPost.externalLink.uri).hostname
                    : "")}
              </div>
            </div>
          </a>
        </div>
      )}
    </div>
  );
});

// Definerer PropTypes for quotedPost-objektet
const PostAuthorShape = PropTypes.shape({
  did: PropTypes.string,
  handle: PropTypes.string,
  displayName: PropTypes.string,
  avatar: PropTypes.string,
});

const PostExternalLinkShape = PropTypes.shape({
  uri: PropTypes.string,
  title: PropTypes.string,
  description: PropTypes.string,
  thumb: PropTypes.string,
  domain: PropTypes.string,
});

const PostImageShape = PropTypes.shape({
  thumb: PropTypes.string,
  fullsize: PropTypes.string,
  alt: PropTypes.string,
});

const QuotedPostShape = PropTypes.shape({
  uri: PropTypes.string,
  cid: PropTypes.string,
  author: PostAuthorShape,
  text: PropTypes.string,
  indexedAt: PropTypes.string,
  images: PropTypes.arrayOf(PostImageShape),
  externalLink: PostExternalLinkShape,
  youtubeId: PropTypes.string,
  facets: PropTypes.array,
});

// PropTypes-definisjon for QuotedPost-komponenten
QuotedPost.propTypes = {
  quotedPost: QuotedPostShape, // Post-objekt som vises som sitat
  onProfileClick: PropTypes.func, // Callback for profilklikk
};

export default QuotedPost;
