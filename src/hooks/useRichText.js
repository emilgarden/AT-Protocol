import { useMemo } from "react";
import { debugError } from "../utils/debug";

/**
 * Konverterer UTF-16 indekser til UTF-8 byte-indekser
 * Brukes til å finne riktige posisjoner i tekst som inneholder spesielle tegn
 *
 * @param {string} text - Teksten som skal analyseres
 * @returns {Function} Funksjon som konverterer UTF-16 indeks til UTF-8 indeks
 */
function createUtf16ToByteConverter(text) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const indices = [0];

  let bytePos = 0;
  for (let i = 0; i < text.length; i++) {
    const charBytes = encoder.encode(text[i]).length;
    bytePos += charBytes;
    indices.push(bytePos);
  }

  return function (utf16Index) {
    if (utf16Index < 0 || utf16Index > text.length) {
      throw new Error("Indeks utenfor rekkevidde");
    }
    return indices[utf16Index];
  };
}

/**
 * Konverterer UTF-8 byte-indekser til UTF-16 indekser
 *
 * @param {string} text - Teksten som skal analyseres
 * @returns {Function} Funksjon som konverterer UTF-8 indeks til UTF-16 indeks
 */
function createByteToUtf16Converter(text) {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);

  // Bygg mapping fra byte-posisjon til utf16-posisjon
  const byteToUtf16Map = new Map();
  let bytePos = 0;

  for (let i = 0; i < text.length; i++) {
    byteToUtf16Map.set(bytePos, i);
    bytePos += encoder.encode(text[i]).length;
  }

  byteToUtf16Map.set(bytePos, text.length); // Legg til sluttposisjonen

  return function (byteIndex) {
    if (byteIndex < 0 || byteIndex > bytes.length) {
      throw new Error("Indeks utenfor rekkevidde");
    }

    // Finn eksakt match eller nærmeste mindre indeks
    if (byteToUtf16Map.has(byteIndex)) {
      return byteToUtf16Map.get(byteIndex);
    }

    // Finn nærmeste mindre indeks
    let prevBytePos = 0;
    for (const pos of [...byteToUtf16Map.keys()].sort((a, b) => a - b)) {
      if (pos > byteIndex) break;
      prevBytePos = pos;
    }

    return byteToUtf16Map.get(prevBytePos);
  };
}

/**
 * Custom hook for å bygge rik tekst-segmenter fra facets
 *
 * @param {string} text - Teksten som skal behandles
 * @param {Array} facets - Facets-array med lenker, omtaler, hashtags
 * @returns {Array} Array med tekstsegmenter som kan rendres
 */
export function useRichTextSegments(text, facets) {
  return useMemo(() => {
    if (!text) return [];
    if (!facets || !Array.isArray(facets) || facets.length === 0) {
      return [{ type: "text", text }];
    }

    try {
      // Opprett konverterere for indekser
      const byteToUtf16 = createByteToUtf16Converter(text);

      // Bygg segmenter fra facets
      const segments = [];

      // Behandle facets først
      for (const facet of facets) {
        if (
          !facet ||
          !facet.index ||
          !facet.features ||
          !Array.isArray(facet.features)
        ) {
          continue;
        }

        const { index } = facet;
        if (
          typeof index.byteStart !== "number" ||
          typeof index.byteEnd !== "number"
        ) {
          continue;
        }

        // Konverter byte-posisjoner til UTF-16 posisjoner
        try {
          const utf16Start = byteToUtf16(index.byteStart);
          const utf16End = byteToUtf16(index.byteEnd);
          const facetText = text.substring(utf16Start, utf16End);

          // Legg til segmenter for alle features i denne faceten
          for (const feature of facet.features) {
            let segment = null;

            if (feature.$type === "app.bsky.richtext.facet#mention") {
              segment = {
                type: "mention",
                start: utf16Start,
                end: utf16End,
                text: facetText,
                did: feature.did,
              };
            } else if (feature.$type === "app.bsky.richtext.facet#link") {
              segment = {
                type: "link",
                start: utf16Start,
                end: utf16End,
                text: facetText,
                url: feature.uri,
              };
            } else if (feature.$type === "app.bsky.richtext.facet#tag") {
              segment = {
                type: "hashtag",
                start: utf16Start,
                end: utf16End,
                text: facetText,
                tag: feature.tag,
              };
            }

            if (segment) {
              segments.push(segment);
            }
          }
        } catch (err) {
          debugError("Feil ved konvertering av byte-indekser:", err);
          continue;
        }
      }

      // Sorter segmenter etter startposisjon
      segments.sort((a, b) => a.start - b.start);

      // Finn overlappende segmenter (noe som kan skje ved feil facets-data)
      const validSegments = [];
      for (let i = 0; i < segments.length; i++) {
        const current = segments[i];
        let overlapping = false;

        for (const valid of validSegments) {
          if (
            (current.start >= valid.start && current.start < valid.end) ||
            (current.end > valid.start && current.end <= valid.end) ||
            (current.start <= valid.start && current.end >= valid.end)
          ) {
            overlapping = true;
            break;
          }
        }

        if (!overlapping) {
          validSegments.push(current);
        }
      }

      // Bygg resultatsegmenter som inkluderer vanlig tekst
      const result = [];
      let lastIndex = 0;

      for (const segment of validSegments) {
        // Legg til vanlig tekst før dette segmentet
        if (segment.start > lastIndex) {
          result.push({
            type: "text",
            text: text.substring(lastIndex, segment.start),
          });
        }

        // Legg til segmentet
        result.push(segment);

        lastIndex = segment.end;
      }

      // Legg til resten av teksten
      if (lastIndex < text.length) {
        result.push({
          type: "text",
          text: text.substring(lastIndex),
        });
      }

      return result;
    } catch (error) {
      debugError("Feil ved segmentering av rik tekst:", error);
      // Ved feil, returner originalteksten som et enkelt segment
      return [{ type: "text", text }];
    }
  }, [text, facets]);
}

/**
 * Gjør URL-er i tekst klikkbare (brukes for vanlig tekst uten facets)
 *
 * @param {string} text - Tekst som skal behandles
 * @returns {Array} Array med tekstsegmenter
 */
export function useUrlSegmentation(text) {
  return useMemo(() => {
    if (!text) return [];

    try {
      const segments = [];
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      let lastIndex = 0;
      let match;

      // Finn alle URL-er og lag segmenter
      while ((match = urlRegex.exec(text)) !== null) {
        const startIndex = match.index;
        const endIndex = startIndex + match[0].length;

        // Legg til tekst før URL
        if (startIndex > lastIndex) {
          segments.push({
            type: "text",
            text: text.substring(lastIndex, startIndex),
          });
        }

        // Legg til URL-segment
        segments.push({
          type: "link",
          text: match[0],
          url: match[0],
        });

        lastIndex = endIndex;
      }

      // Legg til resten av teksten
      if (lastIndex < text.length) {
        segments.push({
          type: "text",
          text: text.substring(lastIndex),
        });
      }

      return segments;
    } catch (error) {
      debugError("Feil ved segmentering av URL-er:", error);
      return [{ type: "text", text }];
    }
  }, [text]);
}

/**
 * Custom hook for å forkorte tekst med "vis mer" funksjonalitet
 *
 * @param {string} text - Original tekst
 * @param {number} maxLength - Maksimal lengde før forkortning (default: 280)
 * @returns {Object} Objekt med forkortet tekst og om den er forkortet
 */
export function useTextTruncation(text, maxLength = 280) {
  return useMemo(() => {
    if (!text || text.length <= maxLength) {
      return {
        truncatedText: text,
        isTruncated: false,
        originalText: text,
      };
    }

    // Finn en passende posisjon å kutte på (helst ved mellomrom)
    let truncateAt = maxLength;
    while (truncateAt > maxLength - 20 && truncateAt > 0) {
      if (text.charAt(truncateAt) === " ") {
        break;
      }
      truncateAt--;
    }

    // Hvis vi ikke fant et egnet kuttpunkt, bruk maxLength
    if (truncateAt <= maxLength - 20) {
      truncateAt = maxLength;
    }

    // Forkortet tekst
    const truncatedText = text.substring(0, truncateAt) + "...";

    return {
      truncatedText,
      isTruncated: true,
      originalText: text,
    };
  }, [text, maxLength]);
}

export default { useRichTextSegments, useUrlSegmentation, useTextTruncation };
