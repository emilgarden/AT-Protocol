/**
 * Utility-funksjoner for automatisk gjenforsøk (retry) med eksponentiell backoff
 */
// 1. Interne utility-importer
import { debugLog, debugError } from "./debug";
import { AppError, NetworkError, RateLimitError, TimeoutError } from "./errors";

/**
 * Venter en gitt tid i millisekunder
 *
 * @param {number} ms - Millisekunder å vente
 * @returns {Promise} Promise som oppløses etter angitt tid
 */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Beregner ventetid for eksponentiell backoff
 *
 * @param {number} attempt - Gjeldende forsøk (0-basert)
 * @param {Object} options - Opsjoner for backoff
 * @param {number} options.baseDelay - Basisventetid i ms (default: 1000)
 * @param {number} options.maxDelay - Maksimal ventetid i ms (default: 30000)
 * @param {boolean} options.jitter - Om tilfeldig jitter skal legges til (default: true)
 * @returns {number} Ventetid i millisekunder
 */
export const calculateBackoff = (attempt, options = {}) => {
  const { baseDelay = 1000, maxDelay = 30000, jitter = true } = options;

  // Beregn basis eksponentiell backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);

  // Begrens til maksimal ventetid
  const cappedDelay = Math.min(exponentialDelay, maxDelay);

  // Legg til jitter for å unngå thundering herd-problemer
  if (jitter) {
    // Legg til/fjern opptil 30% tilfeldig variasjon
    const jitterFactor = 0.7 + Math.random() * 0.6; // 0.7 til 1.3
    return Math.floor(cappedDelay * jitterFactor);
  }

  return cappedDelay;
};

/**
 * Kjører en asynkron funksjon med automatisk gjenforsøk ved feil
 *
 * @param {Function} fn - Asynkron funksjon som skal kjøres
 * @param {Object} options - Opsjoner for retry
 * @param {number} options.maxRetries - Maksimalt antall gjenforsøk (default: 3)
 * @param {number} options.baseDelay - Basisventetid i ms (default: 1000)
 * @param {number} options.maxDelay - Maksimal ventetid i ms (default: 30000)
 * @param {boolean} options.jitter - Om tilfeldig jitter skal legges til (default: true)
 * @param {Function} options.shouldRetry - Funksjon som avgjør om gjenforsøk skal skje (default: retry basert på feiltype)
 * @param {Function} options.onRetry - Callback som kjøres før hvert gjenforsøk
 * @returns {Promise} Resultatet av funksjonen eller siste feil
 */
export const withRetry = async (fn, options = {}) => {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    jitter = true,
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Kjør funksjonen
      return await fn();
    } catch (error) {
      lastError = error;

      // Sjekk om vi skal forsøke på nytt
      if (attempt < maxRetries && shouldRetry(error, attempt)) {
        // Beregn ventetid før neste forsøk
        const delay = calculateBackoff(attempt, {
          baseDelay,
          maxDelay,
          jitter,
        });

        // Spesialhåndtering for rate limiting: bruk retryAfter hvis tilgjengelig
        if (error instanceof RateLimitError && error.retryAfter) {
          const rateLimitDelay = error.retryAfter * 1000; // Konverter til ms
          if (rateLimitDelay > 0 && rateLimitDelay < 300000) {
            // Maksimalt 5 minutter
            debugLog(
              `Rate limit nådd. Venter ${rateLimitDelay}ms basert på retry-after header`,
            );
            await sleep(rateLimitDelay);

            // Kjør onRetry callback hvis tilgjengelig
            if (onRetry) {
              onRetry(error, attempt, rateLimitDelay);
            }

            continue;
          }
        }

        debugLog(
          `Retry ${attempt + 1}/${maxRetries} for operasjon. Venter ${delay}ms...`,
        );

        // Vent før neste forsøk
        await sleep(delay);

        // Kjør onRetry callback hvis tilgjengelig
        if (onRetry) {
          onRetry(error, attempt, delay);
        }

        continue;
      }

      // Ikke flere forsøk, kast feilen videre
      debugError(`Maks antall forsøk (${maxRetries}) nådd:`, error);
      throw lastError;
    }
  }

  // Dette bør aldri nås, men ta høyde for det likevel
  throw lastError;
};

/**
 * Standard funksjon for å avgjøre om en operasjon skal forsøkes på nytt
 *
 * @param {Error} error - Feilen som oppstod
 * @param {number} attempt - Gjeldende forsøksnummer (0-basert)
 * @returns {boolean} True hvis operasjonen skal forsøkes på nytt
 */
export const defaultShouldRetry = (error, attempt) => {
  // Hvis feilen sier den er retryable, bruk det
  if (error instanceof AppError) {
    if (!error.isRetryable()) {
      return false;
    }
  }

  // Spesifikke regler basert på feiltype
  if (error instanceof NetworkError) {
    // Hvis nettverket er nede, ikke retry automatisk
    if (error.message.includes("offline") || !navigator.onLine) {
      return false;
    }

    // Retry timeout-feil, men ikke for mange ganger
    if (error instanceof TimeoutError && attempt >= 2) {
      return false;
    }

    // Retry alltid rate-limit-feil
    if (error instanceof RateLimitError) {
      return true;
    }

    return true;
  }

  // For auth-feil, ikke retry
  if (
    error.status === 401 ||
    error.status === 403 ||
    error.message.includes("unauthorized") ||
    error.message.includes("forbidden")
  ) {
    return false;
  }

  // For server errors (5xx), retry
  if (error.status >= 500 && error.status < 600) {
    return true;
  }

  // For andre feil, retry bare på første forsøk
  return attempt === 0;
};

/**
 * Wrapper for en asynkron funksjon som skal kjøres med retry
 * Returnerer en ny funksjon som bruker retry
 *
 * @param {Function} fn - Funksjon som skal wrappes
 * @param {Object} options - Opsjoner for retry
 * @returns {Function} Wrapped funksjon med retry-funksjonalitet
 */
export const createRetryFn = (fn, options = {}) => {
  return (...args) => withRetry(() => fn(...args), options);
};

export default {
  sleep,
  calculateBackoff,
  withRetry,
  defaultShouldRetry,
  createRetryFn,
};
