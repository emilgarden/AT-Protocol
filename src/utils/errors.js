/**
 * Strukturerte feilklasser for applikasjonen
 *
 * Dette modulen definerer et hierarki av feilklasser for å håndtere
 * ulike typer feil i applikasjonen, spesielt nettverksfeil.
 */

/**
 * Basefeilklasse for applikasjonen
 */
export class AppError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.retryable = options.retryable !== undefined ? options.retryable : true;
    this.statusCode = options.statusCode;
    this.originalError = options.originalError;

    // Dette gjør at stack trace inneholder riktig class name
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Helper-metode for å sjekke om feilen kan forsøkes på nytt
   */
  isRetryable() {
    return this.retryable;
  }

  /**
   * Lag en strengrepresentasjon av feilen for logging
   */
  toString() {
    let result = `[${this.name}]: ${this.message}`;
    if (this.statusCode) {
      result += ` (Status: ${this.statusCode})`;
    }
    return result;
  }

  /**
   * Returner et objekt med feildata som kan sendes til feillogging
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      retryable: this.retryable,
      statusCode: this.statusCode,
      stack: this.stack,
    };
  }
}

/**
 * Feilklasse for nettverksfeil
 */
export class NetworkError extends AppError {
  constructor(message, options = {}) {
    // Nettverksfeil er vanligvis retryable
    super(message, {
      retryable: options.retryable !== undefined ? options.retryable : true,
      ...options,
    });
    this.connectionInfo = options.connectionInfo || {};
  }

  /**
   * Sjekker om det er en timeout-feil
   */
  isTimeout() {
    return (
      this.message.includes("timeout") ||
      this.message.includes("timed out") ||
      this.originalError?.message?.includes("timeout")
    );
  }
}

/**
 * Feilklasse for feil når nettverket er nede (offline)
 */
export class OfflineError extends NetworkError {
  constructor(message = "Ingen internettforbindelse", options = {}) {
    super(message, options);
    this.retryable = false; // Ikke retryable automatisk - må vente på nettverkstilkobling
  }
}

/**
 * Feilklasse for timeout
 */
export class TimeoutError extends NetworkError {
  constructor(message = "Forespørselen tok for lang tid", options = {}) {
    super(message, options);
  }
}

/**
 * Feilklasse for rate limiting
 */
export class RateLimitError extends NetworkError {
  constructor(
    message = "For mange forespørsler. Vennligst prøv igjen senere.",
    options = {},
  ) {
    super(message, { statusCode: 429, ...options });
    this.retryAfter = options.retryAfter; // Sekunder før retry
  }
}

/**
 * Feilklasse for server errors (5xx)
 */
export class ServerError extends NetworkError {
  constructor(
    message = "Serverfeil, vennligst prøv igjen senere",
    options = {},
  ) {
    super(message, options);
  }
}

/**
 * Feilklasse for api errors
 */
export class ApiError extends AppError {
  constructor(message, options = {}) {
    super(message, options);
    this.endpoint = options.endpoint;
    this.responseData = options.responseData;
  }
}

/**
 * Feilklasse for autentiseringsfeil
 */
export class AuthError extends ApiError {
  constructor(message = "Autentiseringsfeil", options = {}) {
    super(message, {
      retryable: false,
      statusCode: options.statusCode || 401,
      ...options,
    });
  }
}

/**
 * Feilklasse for data validation errors
 */
export class ValidationError extends AppError {
  constructor(message = "Valideringsfeil", options = {}) {
    super(message, { retryable: false, ...options });
    this.validationErrors = options.validationErrors || [];
  }
}

/**
 * Factory-funksjon for å opprette riktig feil basert på HTTP-status
 *
 * @param {Error} error - Opprinnelig feil
 * @param {Object} options - Tilleggsopsjoner
 * @returns {AppError} Passende feilinstans
 */
export function createErrorFromResponse(error, options = {}) {
  // Hvis det allerede er en av våre feiltyper, bruk den
  if (error instanceof AppError) {
    return error;
  }

  const status = error.status || options.statusCode;
  const message = error.message || "Ukjent feil";

  // Sjekk om det er nettverksproblemer
  if (
    !navigator.onLine ||
    message.includes("offline") ||
    message.includes("network")
  ) {
    return new OfflineError(message, { originalError: error, ...options });
  }

  // Sjekk om det er timeout
  if (message.includes("timeout") || message.includes("timed out")) {
    return new TimeoutError(message, { originalError: error, ...options });
  }

  // Håndter basert på HTTP-statuskode
  if (status) {
    if (status === 429) {
      return new RateLimitError(message, {
        originalError: error,
        statusCode: status,
        ...options,
      });
    }

    if (status >= 500) {
      return new ServerError(message, {
        originalError: error,
        statusCode: status,
        ...options,
      });
    }

    if (status === 401 || status === 403) {
      return new AuthError(message, {
        originalError: error,
        statusCode: status,
        ...options,
      });
    }

    if (status === 400 || status === 422) {
      return new ValidationError(message, {
        originalError: error,
        statusCode: status,
        ...options,
      });
    }
  }

  // Generisk API-feil
  return new ApiError(message, {
    originalError: error,
    statusCode: status,
    ...options,
  });
}

/**
 * Helper-funksjon for å håndtere fetch-errors
 *
 * @param {Promise} fetchPromise - Fetch-promise
 * @param {Object} options - Tilleggsopsjoner
 * @returns {Promise} Oppløst promise eller en av våre feiltyper
 */
export async function handleFetchErrors(fetchPromise, options = {}) {
  try {
    const response = await fetchPromise;

    // Sjekk om responsen er OK
    if (!response.ok) {
      // Prøv å parse response som JSON, hvis mulig
      let responseData = {};
      try {
        responseData = await response.json();
      } catch (e) {
        // Ignorerer feil ved parsing av response
      }

      // Opprett passende feil basert på statuskode
      throw createErrorFromResponse(
        new Error(responseData.message || response.statusText),
        {
          statusCode: response.status,
          responseData,
          endpoint: options.endpoint || response.url,
        },
      );
    }

    return response;
  } catch (error) {
    // Hvis det ikke er en av våre feiltyper, konverter den
    if (!(error instanceof AppError)) {
      throw createErrorFromResponse(error, options);
    }
    throw error;
  }
}

export default {
  AppError,
  NetworkError,
  OfflineError,
  TimeoutError,
  RateLimitError,
  ServerError,
  ApiError,
  AuthError,
  ValidationError,
  createErrorFromResponse,
  handleFetchErrors,
};
