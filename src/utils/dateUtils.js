/**
 * Formateringsverktøy for dato og tid
 */

// Norske månedsnavnene
const MONTHS_NO = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
];

// Korte norske månedsnavnene
const SHORT_MONTHS_NO = [
  "jan",
  "feb",
  "mar",
  "apr",
  "mai",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "des",
];

// Norske ukedagsnavnene
const DAYS_NO = [
  "søndag",
  "mandag",
  "tirsdag",
  "onsdag",
  "torsdag",
  "fredag",
  "lørdag",
];

// Korte norske ukedagsnavnene
const SHORT_DAYS_NO = ["søn", "man", "tir", "ons", "tor", "fre", "lør"];

/**
 * Formater en dato relativt til nå (f.eks. "3 timer siden")
 * 
 * @param {string|Date} dateInput - ISO 8601 datostreng eller Date-objekt
 * @param {Object} options - Formateringsalternativer
 * @param {string} options.now - Dato som brukes som "nå" for testing
 * @return {string} Formatert dato-streng
 */
export function formatRelativeTime(dateInput, options = {}) {
  if (!dateInput) {
    return "";
  }

  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = options.now ? new Date(options.now) : new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  // Håndter fremtidige datoer
  if (diffInSeconds < 0) {
    return "i fremtiden";
  }

  // Definer tidsintervaller i sekunder
  const intervals = {
    år: 31536000,
    måned: 2592000,
    uke: 604800,
    dag: 86400,
    time: 3600,
    minutt: 60,
    sekund: 1,
  };

  // Finn passende tidsintervall
  for (const [unit, seconds] of Object.entries(intervals)) {
    const count = Math.floor(diffInSeconds / seconds);
    
    if (count >= 1) {
      // Håndter flertall
      const plural = count > 1 ? (unit === "måned" ? "er" : "er") : "";
      return `for ${count} ${unit}${plural} siden`;
    }
  }

  return "akkurat nå";
}

/**
 * Formater en dato til et kort format, f.eks. "15. jan"
 * 
 * @param {string|Date} dateInput - ISO 8601 datostreng eller Date-objekt
 * @return {string} Formatert dato-streng
 */
export function formatShortDate(dateInput) {
  if (!dateInput) {
    return '';
  }
  
  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    
    // Sjekk om dato er gyldig
    if (isNaN(date.getTime())) {
      return '';
    }
    
    // Korte navn på måneder
    const months = [
      'jan', 'feb', 'mar', 'apr', 'mai', 'jun', 
      'jul', 'aug', 'sep', 'okt', 'nov', 'des'
    ];
    
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const currentYear = new Date().getFullYear();
    
    // Hvis det er i år, vis ikke år
    if (year === currentYear) {
      return `${day}. ${month}`;
    }
    
    // Ellers vis år også
    return `${day}. ${month} ${year}`;
    
  } catch (error) {
    console.error('Feil ved formatering av dato:', error);
    return '';
  }
}

/**
 * Formater en ISO-dato til en relativ tidsbeskrivelse (som "5 min siden")
 * eller en absolutt dato hvis den er eldre
 *
 * @param {string|Date} date - Datoen som skal formateres, enten en ISO-streng eller Date-objekt
 * @param {boolean} includeTime - Om klokkeslett skal inkluderes i absolutt dato
 * @param {number} fullDateThreshold - Antall timer før full dato vises (default 24 timer)
 * @returns {string} Den formaterte datostrengen
 */
export function formatDate(date, includeTime = true, fullDateThreshold = 24) {
  if (!date) return "";

  // Konverter til Date-objekt hvis det er en streng
  const dateObj = typeof date === "string" ? new Date(date) : date;

  // Hvis datoen er ugyldig, returner tom streng
  if (isNaN(dateObj.getTime())) return "";

  const now = new Date();
  const diffMs = now - dateObj;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  // Relativ tid for nyere datoer
  if (diffHour < fullDateThreshold) {
    if (diffMin < 1) return "nå nettopp";
    if (diffMin < 60) return `${diffMin} min siden`;
    return `${diffHour} ${diffHour === 1 ? "time" : "timer"} siden`;
  }

  // Siste uke
  if (diffDay < 7) {
    const day = DAYS_NO[dateObj.getDay()];
    if (includeTime) {
      const hours = dateObj.getHours().toString().padStart(2, "0");
      const minutes = dateObj.getMinutes().toString().padStart(2, "0");
      return `${day} ${hours}:${minutes}`;
    }
    return day;
  }

  // I år
  const isSameYear = dateObj.getFullYear() === now.getFullYear();
  if (isSameYear) {
    const day = dateObj.getDate();
    const month = SHORT_MONTHS_NO[dateObj.getMonth()];

    if (includeTime) {
      const hours = dateObj.getHours().toString().padStart(2, "0");
      const minutes = dateObj.getMinutes().toString().padStart(2, "0");
      return `${day}. ${month} ${hours}:${minutes}`;
    }

    return `${day}. ${month}`;
  }

  // Tidligere år
  const day = dateObj.getDate();
  const month = SHORT_MONTHS_NO[dateObj.getMonth()];
  const year = dateObj.getFullYear();

  if (includeTime) {
    const hours = dateObj.getHours().toString().padStart(2, "0");
    const minutes = dateObj.getMinutes().toString().padStart(2, "0");
    return `${day}. ${month} ${year} ${hours}:${minutes}`;
  }

  return `${day}. ${month} ${year}`;
}

/**
 * Formater en ISO-dato til en full norsk dato
 *
 * @param {string|Date} date - Datoen som skal formateres, enten en ISO-streng eller Date-objekt
 * @param {boolean} includeWeekday - Om ukedag skal inkluderes
 * @param {boolean} includeTime - Om klokkeslett skal inkluderes
 * @returns {string} Den formaterte datostrengen
 */
export function formatFullDate(
  date,
  includeWeekday = true,
  includeTime = true,
) {
  if (!date) return "";

  // Konverter til Date-objekt hvis det er en streng
  const dateObj = typeof date === "string" ? new Date(date) : date;

  // Hvis datoen er ugyldig, returner tom streng
  if (isNaN(dateObj.getTime())) return "";

  const day = dateObj.getDate();
  const month = MONTHS_NO[dateObj.getMonth()];
  const year = dateObj.getFullYear();

  let result = `${day}. ${month} ${year}`;

  if (includeWeekday) {
    const weekday = DAYS_NO[dateObj.getDay()];
    result = `${weekday} ${result}`;
  }

  if (includeTime) {
    const hours = dateObj.getHours().toString().padStart(2, "0");
    const minutes = dateObj.getMinutes().toString().padStart(2, "0");
    result += ` kl. ${hours}:${minutes}`;
  }

  return result;
} 