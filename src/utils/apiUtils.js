// 1. Interne utility-importer
import { debugLog } from "./debug";

/**
 * Enkel hjelpefunksjon for å vente et gitt antall millisekunder
 *
 * @param {number} ms - Millisekunder å vente
 * @returns {Promise} Promise som løses etter gitt tid
 */
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Throttle API-kall for å unngå rate limiting
 * Sikrer minimum 5 sekunder mellom hvert API-kall
 *
 * @param {number} lastApiCallTime - Timestamp for siste API-kall
 * @param {Function} setLastApiCallTime - Callback for å oppdatere lastApiCallTime
 * @returns {Promise} Promise som løses når det er trygt å gjøre API-kall
 */
export const throttleApiCalls = async (lastApiCallTime, setLastApiCallTime) => {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCallTime;
  const MIN_TIME_BETWEEN_CALLS = 5000; // 5 sekunder

  if (timeSinceLastCall < MIN_TIME_BETWEEN_CALLS) {
    const waitTime = MIN_TIME_BETWEEN_CALLS - timeSinceLastCall;
    debugLog(
      `Venter ${waitTime}ms før neste API-kall for å unngå rate limiting`,
    );
    await sleep(waitTime);
  }

  setLastApiCallTime(Date.now());
};
