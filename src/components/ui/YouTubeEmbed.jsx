import React, { useState, useRef, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { debugError, debugLog } from "../../utils/debug";
import SafeImage from "./SafeImage";

/**
 * YouTubeEmbed komponent som laster YouTube-videoer med lazy loading
 *
 * @param {Object} props - Komponent-props
 * @param {string} props.videoId - YouTube video ID
 * @param {string} props.className - CSS-klasser for containeren
 * @param {Object} props.style - Inline CSS-stiler
 * @param {boolean} props.lazyLoad - Om komponenten skal lazy loades (default: true)
 * @param {number} props.aspectRatio - Aspektforhold - bredde/høyde (default: 16/9)
 * @param {boolean} props.showControls - Om kontroller skal vises (default: true)
 * @param {boolean} props.allowFullscreen - Om fullskjerm skal tillates (default: true)
 */
const YouTubeEmbed = React.memo(
  ({
    videoId,
    className = "",
    style = {},
    lazyLoad = true,
    aspectRatio = 16 / 9,
    showControls = true,
    allowFullscreen = true,
  }) => {
    // Sjekk om vi har en gyldig videoId
    if (!videoId) {
      debugError("YouTubeEmbed: Ingen videoId angitt");
      return null;
    }

    const [isVisible, setIsVisible] = useState(!lazyLoad);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const containerRef = useRef(null);
    const observerRef = useRef(null);

    // Bygg YouTube thumbnail URL
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

    // Bygg YouTube embed URL
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0${showControls ? "&controls=1" : "&controls=0"}`;

    // Beregn containerhøyde basert på aspektforhold
    const containerStyle = {
      position: "relative",
      paddingBottom: `${(1 / aspectRatio) * 100}%`,
      width: "100%",
      ...style,
    };

    // Sett opp IntersectionObserver for lazy loading
    useEffect(() => {
      if (!lazyLoad || isVisible) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            setIsVisible(true);
            debugLog(`YouTubeEmbed: Synlig i viewport. Video ID: ${videoId}`);

            // Koble fra observeren når elementet er synlig
            if (observerRef.current && containerRef.current) {
              observerRef.current.unobserve(containerRef.current);
            }
          }
        },
        { rootMargin: "200px", threshold: 0.01 },
      );

      if (containerRef.current) {
        observerRef.current.observe(containerRef.current);
      }

      // Rydd opp ved unmounting
      return () => {
        if (observerRef.current) {
          observerRef.current.disconnect();
        }
      };
    }, [lazyLoad, isVisible, videoId]);

    // Håndter lastfeil for thumbnail
    const handleThumbnailError = useCallback(() => {
      debugError(`Kunne ikke laste thumbnail for YouTube-video: ${videoId}`);
      setHasError(true);
    }, [videoId]);

    // Håndter klikk på thumbnail for å starte avspilling
    const handleThumbnailClick = useCallback(() => {
      setIsPlaying(true);
      debugLog(`YouTubeEmbed: Starter avspilling av video: ${videoId}`);
    }, [videoId]);

    // Vis feilstatus
    if (hasError) {
      return (
        <div
          ref={containerRef}
          className={`youtube-embed error ${className}`}
          style={containerStyle}
        >
          <div className="youtube-error">
            <span className="error-icon">⚠️</span>
            <span className="error-text">Kunne ikke laste YouTube-videoen</span>
            <p className="video-id">Video ID: {videoId || "Ukjent"}</p>
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="youtube-link"
            >
              Se på YouTube
            </a>
          </div>
        </div>
      );
    }

    // Vis thumbnail når videoen ikke spilles ennå
    if (!isPlaying) {
      return (
        <div
          ref={containerRef}
          className={`youtube-embed thumbnail ${className}`}
          style={containerStyle}
          onClick={handleThumbnailClick}
        >
          <SafeImage
            src={thumbnailUrl}
            alt={`YouTube thumbnail for video ${videoId}`}
            onError={handleThumbnailError}
            onLoad={() => setIsLoading(false)}
            lazyLoad={lazyLoad}
            className="youtube-thumbnail"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          <div className="youtube-play-button">
            <svg height="100%" version="1.1" viewBox="0 0 68 48" width="100%">
              <path
                className="youtube-play-button-bg"
                d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z"
                fill="#f00"
              ></path>
              <path d="M 45,24 27,14 27,34" fill="#fff"></path>
            </svg>
          </div>
        </div>
      );
    }

    // Vis iframe når videoen spilles
    return (
      <div
        ref={containerRef}
        className={`youtube-embed playing ${className}`}
        style={containerStyle}
      >
        <iframe
          src={embedUrl}
          title={`YouTube video ${videoId}`}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen={allowFullscreen}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
        />
      </div>
    );
  },
);

// PropTypes for YouTubeEmbed
YouTubeEmbed.propTypes = {
  videoId: PropTypes.string.isRequired,
  className: PropTypes.string,
  style: PropTypes.object,
  lazyLoad: PropTypes.bool,
  aspectRatio: PropTypes.number,
  showControls: PropTypes.bool,
  allowFullscreen: PropTypes.bool,
};

export default YouTubeEmbed;
