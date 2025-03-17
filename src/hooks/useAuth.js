// src/hooks/useAuth.js
import { useState, useEffect, useCallback } from "react";
import { BskyAgent } from "@atproto/api";
import { debugLog, debugError } from "../utils/debug";
import {
  AuthError,
  NetworkError,
  OfflineError,
  TimeoutError,
  createErrorFromResponse,
} from "../utils/errors";
import { withRetry, defaultShouldRetry } from "../utils/retryUtils";

// Konstanter for innlogging
const SERVICE_URL = "https://bsky.social";
const LOCAL_STORAGE_KEY = "bluesky_auth";

/**
 * Custom hook for å håndtere Bluesky-autentisering med robust feilhåndtering og retry-logikk
 * @returns {Object} Authentication state og funksjoner
 */
export const useAuth = () => {
  const [agent, setAgent] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Opprett en agent
  const createAgent = useCallback(() => {
    debugLog("Oppretter Bluesky agent...");
    const newAgent = new BskyAgent({ service: SERVICE_URL });
    setAgent(newAgent);
    return newAgent;
  }, []);

  // Logg inn med brukernavn og passord
  const login = useCallback(
    async (username, password) => {
      setIsLoading(true);
      setError(null);

      try {
        const currentAgent = agent || createAgent();

        debugLog("Forsøker innlogging...");

        // Bruk retry-logikk for innloggingen
        const response = await withRetry(
          async () => {
            try {
              const result = await currentAgent.login({
                identifier: username,
                password,
              });
              return result;
            } catch (err) {
              // Konverter til våre feilklasser
              if (err.status === 401) {
                throw new AuthError("Feil brukernavn eller passord", {
                  statusCode: 401,
                  retryable: false,
                  originalError: err,
                });
              }
              throw createErrorFromResponse(err, { endpoint: "login" });
            }
          },
          {
            maxRetries: 3,
            baseDelay: 1000,
            shouldRetry: (error) => {
              // Ikke retry auth-feil
              if (error instanceof AuthError) return false;
              // Kun retry nettverksfeil
              return (
                error instanceof NetworkError &&
                !(error instanceof OfflineError)
              );
            },
            onRetry: (err, attempt) => {
              debugLog(
                `Prøver innlogging på nytt (forsøk ${attempt + 1}/3)...`,
              );
            },
          },
        );

        // Lagre brukerinformasjon
        setUser(response.data);

        // Lagre sessjon i localStorage for persistens
        const sessionData = {
          service: SERVICE_URL,
          did: response.data.did,
          handle: response.data.handle,
          email: response.data.email,
          accessJwt: response.data.accessJwt,
          refreshJwt: response.data.refreshJwt,
          timestamp: Date.now(),
        };

        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessionData));
        debugLog("Innlogging vellykket for:", response.data.handle);

        return { success: true, user: response.data };
      } catch (err) {
        debugError("Innlogging feilet:", err);

        let errorMessage = "Innlogging feilet";
        let errorObject = err;

        // Håndter spesifikke feilmeldinger basert på feilklasse
        if (err instanceof AuthError) {
          errorMessage = err.message;
          errorObject = {
            statusCode: 401,
            message: errorMessage,
            retryable: false,
          };
        } else if (err instanceof OfflineError) {
          errorMessage =
            "Nettverksfeil: Ingen internettforbindelse. Sjekk at du er tilkoblet internett.";
          errorObject = {
            statusCode: 0,
            message: errorMessage,
            retryable: false,
          };
        } else if (err instanceof TimeoutError) {
          errorMessage = "Forespørselen tok for lang tid. Prøv igjen senere.";
          errorObject = {
            statusCode: 408,
            message: errorMessage,
            retryable: true,
          };
        } else if (err instanceof NetworkError) {
          errorMessage = "Nettverksfeil. Sjekk internettforbindelsen din.";
          errorObject = {
            statusCode: 0,
            message: errorMessage,
            retryable: true,
          };
        } else {
          errorMessage = `Innlogging feilet: ${err.message || "Ukjent feil"}`;
          errorObject = { message: errorMessage };
        }

        setError(errorObject);
        setUser(null);
        return { success: false, error: errorObject };
      } finally {
        setIsLoading(false);
      }
    },
    [agent, createAgent],
  );

  // Logg ut
  const logout = useCallback(() => {
    debugLog("Logger ut...");

    // Fjern data fra localStorage
    localStorage.removeItem(LOCAL_STORAGE_KEY);

    // Nullstill state
    setUser(null);
    if (agent) {
      agent.session = null;
    }

    return { success: true };
  }, [agent]);

  // Gjenopprett sesjon fra localStorage med forbedret feilhåndtering
  const restoreSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const sessionData = localStorage.getItem(LOCAL_STORAGE_KEY);

      if (!sessionData) {
        debugLog("Ingen lagret sesjon funnet");
        setUser(null);
        setIsLoading(false);
        return { success: false };
      }

      const session = JSON.parse(sessionData);
      debugLog("Gjenoppretter sesjon for:", session.handle);

      // Sjekk om sesjonen er utløpt (24 timer)
      const sessionAge = Date.now() - session.timestamp;
      const isExpired = sessionAge > 24 * 60 * 60 * 1000;

      if (isExpired) {
        debugLog("Sesjonen er utløpt, logger ut");
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        setUser(null);
        setIsLoading(false);
        return { success: false };
      }

      // Opprett agent og sett sesjon
      const currentAgent = agent || createAgent();
      currentAgent.session = {
        did: session.did,
        handle: session.handle,
        email: session.email,
        accessJwt: session.accessJwt,
        refreshJwt: session.refreshJwt,
      };

      // Bruk retry-logikk for å verifisere sesjonen
      try {
        const response = await withRetry(
          async () => {
            try {
              // Hent oppdatert profilinfo
              return await currentAgent.getProfile({ actor: session.handle });
            } catch (err) {
              // Hvis auth-feil, prøv refresh token
              if (err.status === 401) {
                debugLog("Sesjon ugyldig, forsøker token refresh...");
                await currentAgent.refreshSession();

                // Oppdater localStorage med nye tokens
                const updatedSession = {
                  ...session,
                  accessJwt: currentAgent.session.accessJwt,
                  refreshJwt: currentAgent.session.refreshJwt,
                  timestamp: Date.now(),
                };

                localStorage.setItem(
                  LOCAL_STORAGE_KEY,
                  JSON.stringify(updatedSession),
                );

                // Prøv på nytt med nye tokens
                return await currentAgent.getProfile({ actor: session.handle });
              }

              // Ellers kast feil videre
              throw createErrorFromResponse(err, { endpoint: "getProfile" });
            }
          },
          {
            maxRetries: 2,
            baseDelay: 1000,
            shouldRetry: (error) => {
              // Ikke retry auth-feil (håndteres med token refresh)
              if (error instanceof AuthError) return false;
              return defaultShouldRetry(error, 0);
            },
          },
        );

        setUser({
          ...session,
          ...response.data,
          timestamp: Date.now(),
        });

        // Oppdater localStorage med ny timestamp
        localStorage.setItem(
          LOCAL_STORAGE_KEY,
          JSON.stringify({
            ...session,
            timestamp: Date.now(),
          }),
        );

        debugLog("Sesjon gjenopprettet for:", session.handle);
        return { success: true, user: response.data };
      } catch (verifyError) {
        debugError("Kunne ikke validere sesjon:", verifyError);

        // Hvis feil ved token refresh eller annen auth-feil, logg ut
        if (verifyError instanceof AuthError || verifyError.status === 401) {
          debugLog("Token refresh feilet eller sesjon er ugyldig");
          localStorage.removeItem(LOCAL_STORAGE_KEY);

          setUser(null);
          setError({
            message: "Sesjonen er utløpt. Vennligst logg inn på nytt.",
            retryable: false,
            statusCode: 401,
          });

          return {
            success: false,
            error: "Sesjonen er utløpt",
          };
        }

        // For andre typer feil (f.eks. nettverksfeil)
        let errorMessage = "Kunne ikke validere sesjonen";
        let errorObject = verifyError;

        if (verifyError instanceof OfflineError) {
          errorMessage =
            "Kunne ikke validere sesjonen: Ingen internettforbindelse";
          errorObject = { message: errorMessage, retryable: false };
          // I dette tilfellet beholder vi sesjonen for å prøve igjen når nettverket er tilbake
          setUser(session);
        } else {
          // For andre feil, logg ut
          localStorage.removeItem(LOCAL_STORAGE_KEY);
          setUser(null);
        }

        setError(errorObject);
        return { success: false, error: errorMessage };
      }
    } catch (err) {
      debugError("Feil ved gjenoppretting av sesjon:", err);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setUser(null);

      const errorMessage =
        "Kunne ikke gjenopprette sesjon: " + (err.message || "Ukjent feil");
      setError({ message: errorMessage });

      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, [agent, createAgent]);

  // Initialiser autentisering når komponenten lastes
  useEffect(() => {
    if (!isInitialized) {
      debugLog("Initialiserer autentisering...");
      const initialAgent = createAgent();
      setAgent(initialAgent);
      restoreSession();
    }
  }, [isInitialized, createAgent, restoreSession]);

  return {
    agent,
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    login,
    logout,
    restoreSession,
  };
};

export default useAuth;
