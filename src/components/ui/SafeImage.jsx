import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import PropTypes from "prop-types";
import { debugError, debugLog } from "../../utils/debug";

/**
 * SafeImage komponent som håndterer lastfeil i bilder med lazy loading
 *
 * @param {Object} props - Komponent-props
 * @param {string} props.src - Bildets URL
 * @param {string} props.alt - Alternativ tekst for bildet
 * @param {string} props.fallbackSrc - Reservebilde URL ved lastfeil (valgfritt)
 * @param {string} props.className - CSS-klasser for bildet
 * @param {Function} props.onLoad - Callback når bildet lastes inn
 * @param {Function} props.onError - Callback ved lastfeil
 * @param {Object} props.style - Inline CSS-stiler
 * @param {boolean} props.lazyLoad - Om bildet skal lazy loades (default: true)
 * @param {string} props.rootMargin - IntersectionObserver rootMargin (default: "200px")
 * @param {string} props.defaultImage - Standard bilde som vises hvis src mangler eller feiler (valgfritt)
 * @param {Object} props.imgProps - Andre props å sende til img-elementet
 */
const SafeImage = React.memo(
  ({
    src,
    alt = "",
    fallbackSrc = "",
    className = "",
    onLoad,
    onError,
    style = {},
    lazyLoad = true,
    rootMargin = "200px",
    defaultImage = "",
    ...imgProps
  }) => {
    const [imgSrc, setImgSrc] = useState(
      lazyLoad ? null : src || defaultImage || fallbackSrc,
    );
    const [hasError, setHasError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isVisible, setIsVisible] = useState(!lazyLoad);
    const imgRef = useRef(null);
    const observerRef = useRef(null);

    // Sett opp IntersectionObserver for lazy loading
    useEffect(() => {
      // Skip hvis lazy loading er deaktivert eller bildet allerede er synlig
      if (!lazyLoad || isVisible) return;

      // Lag en ny observer
      observerRef.current = new IntersectionObserver(
        (entries) => {
          // Sjekk om bildet er synlig
          if (entries[0].isIntersecting) {
            setIsVisible(true);
            setImgSrc(src || defaultImage || fallbackSrc);
            debugLog(`SafeImage: Lazy loading bilde: ${src}`);

            // Koble fra observeren når bildet er synlig
            if (observerRef.current && imgRef.current) {
              observerRef.current.unobserve(imgRef.current);
            }
          }
        },
        { rootMargin, threshold: 0.01 },
      );

      // Start observering av bildet
      if (imgRef.current) {
        observerRef.current.observe(imgRef.current);
      }

      // Rydd opp når komponenten unmountes
      return () => {
        if (observerRef.current) {
          observerRef.current.disconnect();
        }
      };
    }, [lazyLoad, isVisible, src, rootMargin, defaultImage, fallbackSrc]);

    // Reset bilde når src endres
    useEffect(() => {
      if (!lazyLoad || isVisible) {
        setImgSrc(src || defaultImage || fallbackSrc);
        setHasError(false);
        setIsLoading(true);
      }
    }, [src, lazyLoad, isVisible, defaultImage, fallbackSrc]);

    // Håndter lastfeil
    const handleError = useCallback(
      (e) => {
        debugError(`Feil ved lasting av bilde: ${src}`);
        setHasError(true);
        setIsLoading(false);

        // Bruk fallback-bilde hvis tilgjengelig
        if (fallbackSrc && fallbackSrc !== src) {
          setImgSrc(fallbackSrc);
        } else if (defaultImage && defaultImage !== src) {
          setImgSrc(defaultImage);
        }

        // Kall onError callback hvis provided
        if (onError && typeof onError === "function") {
          onError(e);
        }
      },
      [src, fallbackSrc, defaultImage, onError],
    );

    // Håndter vellykket lasting
    const handleLoad = useCallback(
      (e) => {
        setIsLoading(false);
        setHasError(false);

        // Kall onLoad callback hvis provided
        if (onLoad && typeof onLoad === "function") {
          onLoad(e);
        }
      },
      [onLoad],
    );

    // Opprett placeholder element for lazy loading
    const renderPlaceholder = useCallback(
      () => (
        <div
          ref={imgRef}
          className={`safe-image-placeholder ${className}`}
          style={style}
        />
      ),
      [className, style],
    );

    // Memoiser UI-elementer for ulike tilstander - VIKTIG: Alle hooks må defineres før betingede returverdier
    const loadingElement = useMemo(() => {
      if (isLoading) {
        return (
          <div
            className={`safe-image-loading-container ${className}`}
            style={style}
          >
            <div className="safe-image-loading-indicator" />
            <img
              ref={imgRef}
              src={imgSrc}
              alt={alt}
              className="safe-image-hidden"
              onLoad={handleLoad}
              onError={handleError}
              loading={lazyLoad ? "lazy" : "eager"}
              {...imgProps}
            />
          </div>
        );
      }
      return null;
    }, [
      isLoading,
      className,
      style,
      imgSrc,
      alt,
      handleLoad,
      handleError,
      lazyLoad,
      imgProps,
    ]);

    const errorElement = useMemo(() => {
      if (
        hasError &&
        (!fallbackSrc || fallbackSrc === src) &&
        (!defaultImage || defaultImage === src)
      ) {
        return (
          <div
            className={`safe-image-error-container ${className}`}
            style={style}
          >
            <div className="safe-image-error-message">
              <span className="safe-image-error-icon">⚠️</span>
              <span className="safe-image-error-text">
                Kunne ikke laste bildet
              </span>
            </div>
          </div>
        );
      }
      return null;
    }, [hasError, fallbackSrc, src, defaultImage, className, style]);

    const imageElement = useMemo(() => {
      if (!isLoading && !hasError) {
        return (
          <img
            ref={imgRef}
            src={imgSrc}
            alt={alt}
            className={`safe-image ${className}`}
            onError={handleError}
            style={style}
            loading={lazyLoad ? "lazy" : "eager"}
            {...imgProps}
          />
        );
      }
      return null;
    }, [
      isLoading,
      hasError,
      imgSrc,
      alt,
      className,
      handleError,
      style,
      lazyLoad,
      imgProps,
    ]);

    // Vis lazyload placeholder element etter at alle hooks er definert
    if (lazyLoad && !isVisible) {
      return renderPlaceholder();
    }

    // Returner riktig element basert på tilstand
    if (loadingElement) return loadingElement;
    if (errorElement) return errorElement;
    return imageElement;
  },
);

// PropTypes-definisjon for SafeImage
SafeImage.propTypes = {
  src: PropTypes.string,
  alt: PropTypes.string,
  fallbackSrc: PropTypes.string,
  className: PropTypes.string,
  onLoad: PropTypes.func,
  onError: PropTypes.func,
  style: PropTypes.object,
  lazyLoad: PropTypes.bool,
  rootMargin: PropTypes.string,
  defaultImage: PropTypes.string,
};

export default SafeImage;
