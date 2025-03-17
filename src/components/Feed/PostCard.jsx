import React, { useState, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";

import SafeImage from "../ui/SafeImage";
import QuotedPost from "./QuotedPost";
import RichText from "../ui/RichText";

import { formatRelativeTime } from "../../utils/dateUtils";

/**
 * Maksimal lengde for tekst før den forkortes
 */
const MAX_TEXT_LENGTH = 300;

/**
 * Viser et enkelt innlegg i feeden med normaliserte data
 *
 * @param {Object} props - Komponent-props
 * @param {Object} props.post - Normalisert post-objekt fra blueskyNormalizer
 * @param {Function} props.onProfileClick - Callback for profilklikk
 * @param {Function} props.onPostClick - Callback for postklikk
 * @param {Boolean} props.isDetailed - Om dette er detaljvisning av innlegget
 */
const PostCard = React.memo(
  ({ post, onProfileClick = null, onPostClick = null, isDetailed = false }) => {
    const navigate = useNavigate();
    const [showFullText, setShowFullText] = useState(isDetailed);

    // Returner null hvis vi ikke har data
    if (!post) {
      return null;
    }

    // Dato og tid
    const timeAgo = useMemo(
      () => formatRelativeTime(post?.indexedAt),
      [post?.indexedAt],
    );

    // Håndter klikk på forfatter-profil
    const handleAuthorClick = useCallback(
      (e) => {
        if (!e || !post?.author) return; // Nullsjekk

        e.stopPropagation();
        if (onProfileClick) {
          onProfileClick(post.author);
        } else if (post?.author?.handle) {
          navigate(`/profile/${post.author.handle}`);
        }
      },
      [onProfileClick, post?.author, navigate],
    );

    // Håndter klikk på repost-forfatter
    const handleRepostAuthorClick = useCallback(
      (e) => {
        if (!e || !post?.repostedBy) return; // Nullsjekk

        e.stopPropagation();
        if (post?.isRepost && post?.repostedBy && onProfileClick) {
          onProfileClick(post.repostedBy);
        }
      },
      [post?.isRepost, post?.repostedBy, onProfileClick],
    );

    // Håndter klikk på innlegg
    const handlePostClick = useCallback(() => {
      if (!post) return; // Nullsjekk

      if (onPostClick) {
        onPostClick(post.uri, post.cid);
      } else if (post?.cid) {
        navigate(`/post/${post.cid}`);
      }
    }, [onPostClick, post?.uri, post?.cid, navigate, post]);

    // Håndter klikk på 'vis mer' knapp
    const handleShowMoreClick = useCallback((e) => {
      if (!e) return; // Nullsjekk

      e.stopPropagation();
      setShowFullText(true);
    }, []);

    // Håndter klikk på mention
    const handleMentionClick = useCallback(
      (did, handle) => {
        if (!did && !handle) return; // Nullsjekk

        if (onProfileClick) {
          onProfileClick({ did, handle });
        } else if (handle) {
          navigate(`/profile/${handle}`);
        }
      },
      [onProfileClick, navigate],
    );

    // Håndter klikk på hashtag
    const handleHashtagClick = useCallback(
      (tag) => {
        if (!tag) return; // Nullsjekk

        navigate(`/hashtag/${tag}`);
      },
      [navigate],
    );

    // Beregn innholdsflagg og tekst
    const {
      shouldTruncate,
      truncatedText,
      hasMedia,
      hasYouTube,
      hasExternalLink,
      isQuote,
    } = useMemo(() => {
      // Begrens tekstlengde hvis det er et langt innlegg og vi ikke viser hele
      const text = post?.text || "";
      const shouldTruncateText = !showFullText && text.length > MAX_TEXT_LENGTH;
      const truncatedText = shouldTruncateText
        ? text.slice(0, MAX_TEXT_LENGTH) + "..."
        : text;

      // Hent bilder, video, lenker, osv.
      return {
        shouldTruncate: shouldTruncateText,
        truncatedText,
        hasMedia: Array.isArray(post?.images) && post.images.length > 0,
        hasYouTube: post?.youtubeId !== null && post?.youtubeId !== undefined,
        hasExternalLink:
          post?.externalLink !== null && post?.externalLink !== undefined,
        isQuote: post?.isQuote === true && post?.quotedPost !== null,
      };
    }, [post, showFullText]);

    // Håndter klikk på ekstern lenke
    const handleExternalLinkClick = useCallback((e) => {
      if (!e) return; // Nullsjekk

      e.stopPropagation();
    }, []);

    return (
      <div
        className={`post-card bg-white rounded-lg border border-gray-200 p-4 mb-4 ${!isDetailed ? "hover:border-blue-300 cursor-pointer transition-colors" : ""}`}
        onClick={!isDetailed ? handlePostClick : undefined}
      >
        {/* Repost header */}
        {post?.isRepost && post?.repostedBy && (
          <div className="repost-header flex items-center text-gray-500 text-sm mb-2">
            <svg
              className="h-4 w-4 mr-2"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M19 7h-3V5.5A1.5 1.5 0 0014.5 4h-5A1.5 1.5 0 008 5.5V7H5a1 1 0 00-1 1v10a1 1 0 001 1h14a1 1 0 001-1V8a1 1 0 00-1-1zm-9-1.5a.5.5 0 01.5-.5h5a.5.5 0 01.5.5V7h-6V5.5z" />
            </svg>
            <span
              className="font-medium hover:underline cursor-pointer"
              onClick={handleRepostAuthorClick}
            >
              {post.repostedBy?.displayName || post.repostedBy?.handle}
            </span>
            <span className="ml-1">repostet dette</span>
          </div>
        )}

        {/* Post header med forfatter, profilbilde, tid, etc. */}
        <div className="post-header flex mb-3">
          <div
            className="author-avatar mr-3 cursor-pointer"
            onClick={handleAuthorClick}
          >
            <SafeImage
              src={post.author?.avatar}
              alt={
                post.author?.displayName || post.author?.handle || "Brukerbilde"
              }
              className="h-10 w-10 rounded-full"
              defaultImage="/default-avatar.png"
            />
          </div>

          <div className="flex-grow">
            <div className="flex items-baseline">
              <div
                className="author-name font-medium hover:underline cursor-pointer"
                onClick={handleAuthorClick}
              >
                {post.author?.displayName ||
                  post.author?.handle ||
                  "Ukjent bruker"}
              </div>
              <div
                className="author-handle text-gray-500 text-sm ml-2 hover:underline cursor-pointer"
                onClick={handleAuthorClick}
              >
                @{post.author?.handle || "ukjent"}
              </div>
              <div className="post-time text-gray-500 text-sm ml-auto">
                {timeAgo}
              </div>
            </div>

            {/* Post innhold */}
            <div className="post-content mt-2">
              {/* Post tekst */}
              {post?.text && (
                <div className="post-text text-gray-800 whitespace-pre-line mb-2">
                  <RichText
                    text={truncatedText}
                    facets={post?.facets}
                    onMentionClick={handleMentionClick}
                    onHashtagClick={handleHashtagClick}
                    onLinkClick={(url) => url && window.open(url, "_blank")}
                  />

                  {shouldTruncate && (
                    <button
                      className="text-blue-500 hover:underline text-sm mt-1"
                      onClick={handleShowMoreClick}
                    >
                      Vis mer
                    </button>
                  )}
                </div>
              )}

              {/* Bilder */}
              {hasMedia && (
                <div
                  className={`post-images grid gap-2 mb-2 ${(post?.images?.length || 0) > 1 ? "grid-cols-2" : "grid-cols-1"}`}
                >
                  {post.images?.map((img, index) => (
                    <SafeImage
                      key={index}
                      src={img?.thumb || img?.fullsize}
                      alt={img?.alt || `Bilde ${index + 1}`}
                      className="rounded-lg max-h-72 w-full object-cover"
                      defaultImage="/image-placeholder.png"
                    />
                  ))}
                </div>
              )}

              {/* YouTube video */}
              {hasYouTube && (
                <div className="post-youtube mb-2">
                  <div className="relative pb-56.25 h-0 rounded-lg overflow-hidden">
                    <iframe
                      className="absolute top-0 left-0 w-full h-full rounded-lg"
                      src={`https://www.youtube.com/embed/${post.youtubeId}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title="YouTube video"
                    ></iframe>
                  </div>
                </div>
              )}

              {/* Ekstern lenke (hvis ikke YouTube) */}
              {hasExternalLink && !hasYouTube && post?.externalLink && (
                <a
                  href={post.externalLink?.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="post-link block border border-gray-200 rounded-lg overflow-hidden mb-2 hover:border-blue-300 transition-colors"
                  onClick={handleExternalLinkClick}
                >
                  {post.externalLink?.thumb && (
                    <SafeImage
                      src={post.externalLink.thumb}
                      alt={
                        post.externalLink?.title ||
                        post.externalLink?.uri ||
                        "Lenke"
                      }
                      className="w-full h-40 object-cover"
                      defaultImage="/image-placeholder.png"
                    />
                  )}
                  <div className="p-3">
                    <div className="font-medium text-blue-600 mb-1">
                      {post.externalLink?.title ||
                        post.externalLink?.uri ||
                        "Ekstern lenke"}
                    </div>
                    {post.externalLink?.description && (
                      <div className="text-gray-600 text-sm mb-1 line-clamp-2">
                        {post.externalLink.description}
                      </div>
                    )}
                    <div className="text-gray-500 text-xs">
                      {post.externalLink?.domain ||
                        (post.externalLink?.uri
                          ? new URL(post.externalLink.uri).hostname
                          : "")}
                    </div>
                  </div>
                </a>
              )}

              {/* Sitert innlegg */}
              {isQuote && post?.quotedPost && (
                <div className="quoted-post border border-gray-200 rounded-lg p-3 mb-2">
                  <QuotedPost
                    quotedPost={post.quotedPost}
                    onProfileClick={onProfileClick}
                  />
                </div>
              )}
            </div>

            {/* Interaksjoner (likes, repost, svar) */}
            <div className="post-actions flex mt-2 text-gray-500 justify-between">
              {/* Svar */}
              <button className="flex items-center text-xs hover:text-blue-500 transition-colors">
                <svg
                  className="h-4 w-4 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <span>{post?.replyCount || 0}</span>
              </button>

              {/* Repost */}
              <button className="flex items-center text-xs hover:text-green-500 transition-colors">
                <svg
                  className="h-4 w-4 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
                <span>{post?.repostCount || 0}</span>
              </button>

              {/* Like */}
              <button className="flex items-center text-xs hover:text-red-500 transition-colors">
                <svg
                  className="h-4 w-4 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
                <span>{post?.likeCount || 0}</span>
              </button>

              {/* Del */}
              <button className="flex items-center text-xs hover:text-purple-500 transition-colors">
                <svg
                  className="h-4 w-4 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
                <span>Del</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

// Definerer PropTypes for post-objektet
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
});

const PostShape = PropTypes.shape({
  uri: PropTypes.string,
  cid: PropTypes.string,
  author: PostAuthorShape,
  text: PropTypes.string,
  indexedAt: PropTypes.string,
  isRepost: PropTypes.bool,
  repostedBy: PostAuthorShape,
  isQuote: PropTypes.bool,
  quotedPost: QuotedPostShape,
  images: PropTypes.arrayOf(PostImageShape),
  externalLink: PostExternalLinkShape,
  youtubeId: PropTypes.string,
  likeCount: PropTypes.number,
  repostCount: PropTypes.number,
  replyCount: PropTypes.number,
  facets: PropTypes.array,
});

// PropTypes-definisjon for PostCard-komponenten
PostCard.propTypes = {
  post: PostShape.isRequired, // Krever post-objekt
  onProfileClick: PropTypes.func, // Callback for profilklikk
  onPostClick: PropTypes.func, // Callback for postklikk
  isDetailed: PropTypes.bool, // Om dette er detaljvisning
};

export default PostCard;
