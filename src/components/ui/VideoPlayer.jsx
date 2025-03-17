import React, { useState, useRef, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { debugError, debugLog } from "../../utils/debug";

/**
 * VideoPlayer komponent som håndterer video med feilhåndtering og lasting
 *
 * @param {Object} props - Komponent-props
 * @param {string} props.src - Video URL
 * @param {string} props.poster - Poster-bilde URL for video (valgfritt)
 * @param {string} props.fallbackSrc - Reserve video URL ved lastfeil (valgfritt)
 * @param {string} props.className - CSS-klasser for videoen
 * @param {Function} props.onLoad - Callback når videoen er klar
 * @param {Function} props.onError - Callback ved lastfeil
 * @param {Object} props.style - Inline CSS-stiler
 * @param {boolean} props.controls - Om video-kontroller skal vises (default: true)
 * @param {boolean} props.autoPlay - Om video skal spilles automatisk (default: false)
 * @param {boolean} props.muted - Om video skal være dempet (default: true)
 * @param {boolean} props.loop - Om video skal gå i løkke (default: false)
 * @param {Object} props.videoProps - Andre props å sende til video-elementet
 */
const VideoPlayer = React.memo(
  ({
    src,
    poster = "",
    fallbackSrc = "",
    className = "",
    onLoad,
    onError,
    style = {},
    controls = true,
    autoPlay = false,
    muted = true,
    loop = false,
    ...videoProps
  }) => {
    // Referanse til video-element
    const videoRef = useRef(null);

    // State
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [usingFallback, setUsingFallback] = useState(false);

    // Faktisk kilde basert på om vi bruker fallback
    const videoSrc = !isError ? src : fallbackSrc || "";

    // Håndterer feil ved lasting av video
    const handleError = useCallback(
      (e) => {
        const video = e.currentTarget;
        const errorCode = video?.error?.code || 0;
        const errorMessage = video?.error?.message || "Ukjent videofeil";

        debugError("Videofeil:", { src, errorCode, errorMessage, event: e });

        // Hvis vi allerede bruker fallback, ikke prøv igjen
        if (usingFallback || !fallbackSrc) {
          setIsError(true);
          setIsLoading(false);

          if (onError) {
            onError(e, { code: errorCode, message: errorMessage });
          }
        } else {
          // Prøv med fallback-video
          setUsingFallback(true);
          setIsError(false);

          debugLog("Prøver fallback video:", fallbackSrc);
        }
      },
      [src, fallbackSrc, usingFallback, onError],
    );

    // Håndterer når video er klar til å spilles
    const handleCanPlay = useCallback(
      (e) => {
        setIsLoading(false);

        if (onLoad) {
          onLoad(e, {
            duration: videoRef.current?.duration || 0,
            videoWidth: videoRef.current?.videoWidth || 0,
            videoHeight: videoRef.current?.videoHeight || 0,
          });
        }

        debugLog("Video klar til avspilling:", { src: videoSrc });
      },
      [videoSrc, onLoad],
    );

    // Metode for å toggle play/pause
    const togglePlay = useCallback(() => {
      const video = videoRef.current;

      if (!video) return;

      if (video.paused || video.ended) {
        video.play().catch((err) => {
          debugError("Kunne ikke spille av video:", err);
        });
      } else {
        video.pause();
      }
    }, []);

    // Hendelseshåndterere for video-elementer
    const handlePlay = useCallback(() => setIsPlaying(true), []);
    const handlePause = useCallback(() => setIsPlaying(false), []);
    const handleEnded = useCallback(() => {
      setIsPlaying(false);
      debugLog("Video avspilling avsluttet");
    }, []);

    // Oppdater video-kilde hvis src endres
    useEffect(() => {
      setIsError(false);
      setUsingFallback(false);
      setIsLoading(true);

      // Hvis vi har en video-ref, last inn på nytt
      if (videoRef.current) {
        videoRef.current.load();
      }
    }, [src]);

    return (
      <div
        className={`video-container relative ${isError ? "video-error" : ""} ${className}`}
        style={style}
      >
        {/* Video-element */}
        <video
          ref={videoRef}
          className={`w-full h-full ${isLoading ? "opacity-0" : "opacity-100"} transition-opacity`}
          controls={controls}
          autoPlay={autoPlay}
          muted={muted}
          loop={loop}
          poster={poster}
          onError={handleError}
          onCanPlay={handleCanPlay}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          playsInline
          {...videoProps}
        >
          {/* Videokilde(r) */}
          {videoSrc && <source src={videoSrc} type="video/mp4" />}
          Din nettleser støtter ikke videoavspilling.
        </video>

        {/* Laster-indikator */}
        {isLoading && !isError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Feil-indikator */}
        {isError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 bg-opacity-90 p-4 text-center">
            <svg
              className="w-10 h-10 text-red-500 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-gray-700 font-medium">Kunne ikke laste video</p>
            <p className="text-gray-500 text-sm mt-1">
              Vennligst prøv igjen senere
            </p>
          </div>
        )}

        {/* Play/pause overlay for mobilenheter */}
        {!controls && !isError && !isLoading && (
          <div
            className="absolute inset-0 flex items-center justify-center cursor-pointer"
            onClick={togglePlay}
          >
            {!isPlaying && (
              <div className="w-16 h-16 rounded-full bg-black bg-opacity-50 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);

// PropTypes for VideoPlayer
VideoPlayer.propTypes = {
  src: PropTypes.string,
  poster: PropTypes.string,
  fallbackSrc: PropTypes.string,
  className: PropTypes.string,
  onLoad: PropTypes.func,
  onError: PropTypes.func,
  style: PropTypes.object,
  controls: PropTypes.bool,
  autoPlay: PropTypes.bool,
  muted: PropTypes.bool,
  loop: PropTypes.bool,
};

export default VideoPlayer;
