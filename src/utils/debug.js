// src/utils/debug.js

// Enable/disable debugging
export const DEBUG = false;
export const DEBUG_CONTENT = false;
export const DEBUG_API = false;

/**
 * Skriver ut logginformasjon til konsollen hvis DEBUG er aktivert
 * @param {string} message - Hovedmelding
 * @param {...any} rest - Ytterligere data å logge
 */
export const debugLog = (message, ...rest) => {
  if (DEBUG) {
    console.log(`[BLUESKY-DEBUG] ${message}`, ...rest);
  }
};

/**
 * Skriver ut feilmeldinger til konsollen hvis DEBUG er aktivert
 * @param {string} message - Feilmelding
 * @param {...any} rest - Ytterligere data å logge
 */
export const debugError = (message, ...rest) => {
  if (DEBUG) {
    console.error(`[BLUESKY-ERROR] ${message}`, ...rest);
  }
};

/**
 * Skriver ut advarsler til konsollen hvis DEBUG er aktivert
 * @param {string} message - Advarsel
 * @param {...any} rest - Ytterligere data å logge
 */
export const debugWarn = (message, ...rest) => {
  if (DEBUG) {
    console.warn(`[BLUESKY-WARN] ${message}`, ...rest);
  }
};

/**
 * Skriver ut innholdsrelatert debugging hvis DEBUG_CONTENT er aktivert
 * @param {string} message - Hovedmelding
 * @param {...any} rest - Ytterligere data å logge
 */
export const debugContent = (message, ...rest) => {
  if (DEBUG_CONTENT) {
    console.log(`[BLUESKY-CONTENT] ${message}`, ...rest);
  }
};

/**
 * Skriver ut API-relatert debugging hvis DEBUG_API er aktivert
 * @param {string} message - Hovedmelding
 * @param {...any} rest - Ytterligere data å logge
 */
export const debugAPI = (message, ...rest) => {
  if (DEBUG_API) {
    console.log(`[BLUESKY-API] ${message}`, ...rest);
  }
};

/**
 * Måler tiden en funksjon bruker på å kjøre
 * @param {string} name - Navn på funksjonen eller operasjonen
 * @param {function} fn - Funksjon som skal kjøres
 * @returns {any} - Resultatet av funksjonen
 */
export const measure = (name, fn) => {
  if (!DEBUG) return fn();

  console.time(`[BLUESKY-PERF] ${name}`);
  const result = fn();
  console.timeEnd(`[BLUESKY-PERF] ${name}`);
  return result;
};

/**
 * Måler tiden en asynkron funksjon bruker på å kjøre
 * @param {string} name - Navn på funksjonen eller operasjonen
 * @param {function} promiseFn - Asynkron funksjon som skal kjøres
 * @returns {Promise<any>} - En Promise som løses med resultatet av funksjonen
 */
export const measureAsync = async (name, promiseFn) => {
  if (!DEBUG) return promiseFn();

  console.time(`[BLUESKY-PERF] ${name}`);
  try {
    const result = await promiseFn();
    console.timeEnd(`[BLUESKY-PERF] ${name}`);
    return result;
  } catch (error) {
    console.timeEnd(`[BLUESKY-PERF] ${name}`);
    throw error;
  }
};

/**
 * Teller antall ganger en funksjon blir kalt
 */
export const createCounter = (name) => {
  let count = 0;

  return {
    increment: () => {
      count++;
      if (DEBUG) {
        console.log(`[BLUESKY-COUNT] ${name}: ${count}`);
      }
    },
    get: () => count,
    reset: () => {
      count = 0;
      if (DEBUG) {
        console.log(`[BLUESKY-COUNT] ${name} reset: ${count}`);
      }
    },
  };
};
