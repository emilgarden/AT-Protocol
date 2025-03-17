import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";

/**
 * RichText-komponent for sikker håndtering av rik tekst
 * Erstatter dangerouslySetInnerHTML med komponent-basert rendering
 *
 * @param {Object} props
 * @param {string} props.text - Teksten som skal rendres
 * @param {Array} props.facets - Facets-array fra Bluesky med mentions, hashtags, lenker
 * @param {Object} props.options - Alternativer for prosessering
 * @param {boolean} props.options.linkifyUrls - Om vanlige URL-er skal gjøres klikkbare (default: true)
 * @param {Function} props.onMentionClick - Callback for klikk på mentions
 * @param {Function} props.onHashtagClick - Callback for klikk på hashtags
 * @param {Function} props.onLinkClick - Callback for klikk på eksterne lenker
 * @param {string} props.className - CSS-klasse for teksten
 */
const RichText = React.memo(
  ({
    text = "",
    facets = [],
    options = {},
    onMentionClick,
    onHashtagClick,
    onLinkClick,
    className = "",
  }) => {
    // Kombiner med standardinnstillinger
    const defaultOptions = {
      linkifyUrls: true,
    };

    const mergedOptions = { ...defaultOptions, ...options };

    /**
     * Prosesser tekst og facets for å bygge opp strukturen
     */
    const processedContent = useMemo(() => {
      if (!text) return []; // Returner tomt array hvis det ikke er tekst

      // Sorter facets på startposisjon og lag segments
      const sortedFacets = Array.isArray(facets)
        ? [...facets].sort((a, b) => {
            return (a?.index?.byteStart || 0) - (b?.index?.byteStart || 0);
          })
        : [];

      const segments = [];
      let currentPosition = 0;

      // Iterer gjennom sorterte facets og lag segmenter
      for (const facet of sortedFacets) {
        if (!facet?.index?.byteStart || !facet?.index?.byteEnd) continue;

        const { byteStart, byteEnd } = facet.index;

        // Legg til vanlig tekst før denne facet
        if (byteStart > currentPosition) {
          segments.push({
            type: "text",
            text: text.substring(currentPosition, byteStart),
            key: `text-${currentPosition}-${byteStart}`,
          });
        }

        // Identifiser facet-type
        const features = facet.features || [];
        let facetType = "text";
        let facetData = null;

        // Støtte for forskjellige facet-typer
        for (const feature of features) {
          if (feature.$type === "app.bsky.richtext.facet#mention") {
            facetType = "mention";
            facetData = feature;
            break;
          } else if (feature.$type === "app.bsky.richtext.facet#link") {
            facetType = "link";
            facetData = feature;
            break;
          } else if (feature.$type === "app.bsky.richtext.facet#tag") {
            facetType = "hashtag";
            facetData = feature;
            break;
          }
        }

        // Legg til facet-segment
        segments.push({
          type: facetType,
          text: text.substring(byteStart, byteEnd),
          data: facetData,
          key: `${facetType}-${byteStart}-${byteEnd}`,
        });

        currentPosition = byteEnd;
      }

      // Legg til gjenværende tekst hvis det er noe
      if (currentPosition < text.length) {
        segments.push({
          type: "text",
          text: text.substring(currentPosition),
          key: `text-${currentPosition}-${text.length}`,
        });
      }

      // Hvis det er aktivert, også finn og linkify vanlige URL-er i tekstsegmenter
      if (mergedOptions.linkifyUrls) {
        const finalSegments = [];
        const urlRegex = /(https?:\/\/[^\s]+)/g;

        // Gå gjennom alle segmenter og se på tekstsegmenter
        for (const segment of segments) {
          if (segment.type === "text") {
            let lastIndex = 0;
            let match;
            let textToProcess = segment.text;
            let hasMatches = false;

            // Hvis det matcher en URL, bryt det opp i flere segmenter
            while ((match = urlRegex.exec(textToProcess)) !== null) {
              hasMatches = true;
              // Tekst før URL
              if (match.index > lastIndex) {
                finalSegments.push({
                  type: "text",
                  text: textToProcess.substring(lastIndex, match.index),
                  key: `${segment.key}-text-${lastIndex}`,
                });
              }

              // URL-segmentet
              finalSegments.push({
                type: "autolink",
                text: match[0],
                data: { uri: match[0] },
                key: `${segment.key}-autolink-${match.index}`,
              });

              lastIndex = match.index + match[0].length;
            }

            // Hvis vi fant en match, legg til gjenværende tekst
            if (hasMatches && lastIndex < textToProcess.length) {
              finalSegments.push({
                type: "text",
                text: textToProcess.substring(lastIndex),
                key: `${segment.key}-text-end`,
              });
            }
            // Hvis vi ikke fant matcher, legg til originalsegmentet
            else if (!hasMatches) {
              finalSegments.push(segment);
            }
          } else {
            // Ikke tekstsegmenter går direkte gjennom
            finalSegments.push(segment);
          }
        }

        return finalSegments;
      }

      return segments;
    }, [text, facets, mergedOptions.linkifyUrls]);

    /**
     * Rendrer et segment basert på typen
     */
    const renderSegment = (segment) => {
      switch (segment.type) {
        case "mention":
          // Håndterer mentions
          const mention = segment?.data?.did;
          const handle = segment.text.startsWith("@")
            ? segment.text.substring(1)
            : segment.text;

          const handleMentionClick = (e) => {
            if (onMentionClick) {
              e.preventDefault();
              onMentionClick(handle, mention);
            }
          };

          return (
            <Link
              to={`/profile/${handle}`}
              className="text-blue-600 hover:underline"
              onClick={handleMentionClick}
              key={segment.key}
            >
              {segment.text}
            </Link>
          );

        case "hashtag":
          // Håndterer hashtags
          const tag = segment.text.startsWith("#")
            ? segment.text.substring(1)
            : segment.text;

          const handleHashtagClick = (e) => {
            if (onHashtagClick) {
              e.preventDefault();
              onHashtagClick(tag);
            }
          };

          return (
            <Link
              to={`/tag/${tag}`}
              className="text-blue-600 hover:underline"
              onClick={handleHashtagClick}
              key={segment.key}
            >
              {segment.text}
            </Link>
          );

        case "link":
        case "autolink":
          // Håndterer lenker
          const url = segment?.data?.uri || segment.text;

          const handleLinkClick = (e) => {
            if (onLinkClick) {
              e.preventDefault();
              onLinkClick(url);
            }
          };

          // Hvis lenken ikke har protokoll, legg til https://
          const href = url.match(/^https?:\/\//) ? url : `https://${url}`;

          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
              onClick={handleLinkClick}
              key={segment.key}
            >
              {segment.text}
            </a>
          );

        case "text":
        default:
          // Vanlig tekst
          return (
            <React.Fragment key={segment.key}>{segment.text}</React.Fragment>
          );
      }
    };

    // Hvis ingenting å rendere, returner null
    if (!processedContent || processedContent.length === 0) {
      return null;
    }

    // Rendre alle segmenter
    return (
      <span className={className}>{processedContent.map(renderSegment)}</span>
    );
  },
);

// PropTypes-definisjon for RichText-komponenten
RichText.propTypes = {
  text: PropTypes.string,
  facets: PropTypes.arrayOf(
    PropTypes.shape({
      index: PropTypes.shape({
        byteStart: PropTypes.number,
        byteEnd: PropTypes.number,
      }),
      features: PropTypes.array,
    }),
  ),
  options: PropTypes.shape({
    linkifyUrls: PropTypes.bool,
  }),
  onMentionClick: PropTypes.func,
  onHashtagClick: PropTypes.func,
  onLinkClick: PropTypes.func,
  className: PropTypes.string,
};

export default RichText;
