// App.jsx
// 1. React og biblioteksimporter
import React, { useState, useRef, useEffect, useCallback } from "react";
import { BskyAgent } from "@atproto/api";

// 2. Egne komponenter
import Profile from "./components/Profile";
import Feed from "./components/Feed";

// 3. Utils og hooks
import { debugLog, debugError } from "./utils/debug";
import { sleep, throttleApiCalls } from "./utils/apiUtils";

const App = () => {
  // State declarations
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [postContent, setPostContent] = useState("");
  const [status, setStatus] = useState({ type: "", message: "" });
  const [currentView, setCurrentView] = useState("feed");
  const [currentProfile, setCurrentProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [postCharCount, setPostCharCount] = useState(0);
  const MAX_POST_LENGTH = 300;
  const [error, setError] = useState(null);
  const [lastApiCall, setLastApiCall] = useState(0);

  // Agent reference
  const agentRef = useRef(null);

  // Hjelpefunksjon for å sikre at vi ikke gjør for mange API-kall
  const throttleApiCall = async () => {
    await throttleApiCalls(lastApiCall, (time) => setLastApiCall(time));
  };

  // Initialize agent
  useEffect(() => {
    agentRef.current = new BskyAgent({ service: "https://bsky.social" });

    // Check for saved session
    const savedSession = localStorage.getItem("bluesky_session");
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        // Sjekk om sesjonen er utløpt (mer enn 12 timer gammel)
        const sessionTime = localStorage.getItem("bluesky_session_time");
        const now = Date.now();

        if (
          !session ||
          !session.did ||
          !session.handle ||
          !sessionTime ||
          now - parseInt(sessionTime) > 12 * 60 * 60 * 1000
        ) {
          debugLog("Sesjonen er utløpt eller ugyldig, logger ut");
          localStorage.removeItem("bluesky_session");
          localStorage.removeItem("bluesky_session_time");
          setIsLoggedIn(false);
          setCurrentProfile(null);
        } else {
          resumeSession(session);
        }
      } catch (error) {
        debugError(
          "Failed to parse saved session:",
          error.message || "Ukjent feil",
        );
        localStorage.removeItem("bluesky_session");
        localStorage.removeItem("bluesky_session_time");
        setIsLoggedIn(false);
        setCurrentProfile(null);
      }
    }
  }, []);

  // Status message timeout
  useEffect(() => {
    if (status.message) {
      const timer = setTimeout(() => {
        setStatus({ type: "", message: "" });
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [status]);

  // Resume session
  const resumeSession = async (session) => {
    try {
      setIsLoading(true);
      await throttleApiCall();

      if (!session || !session.did || !session.handle) {
        throw new Error("Ugyldig sesjon");
      }

      // Prøv å gjenoppta sesjonen med timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Tidsavbrudd ved tilkobling til server")),
          15000,
        ),
      );

      // Prøv å gjenoppta sesjonen og verifiser at den fortsatt er gyldig
      const resumePromise = agentRef.current
        .resumeSession(session)
        .then(async () => {
          // Verifiser sesjonen ved å gjøre et test-kall
          await agentRef.current.getProfile({ actor: session.handle });
        });

      await Promise.race([resumePromise, timeoutPromise]);

      setIsLoggedIn(true);
      setCurrentProfile(session.handle);
      setUsername(session.handle);
      setStatus({
        type: "success",
        message: `Velkommen tilbake, @${session.handle}!`,
      });
    } catch (error) {
      debugError("Failed to resume session:", error.message || "Ukjent feil");
      // Fjern lagret sesjon ved feil
      localStorage.removeItem("bluesky_session");
      localStorage.removeItem("bluesky_session_time");
      setIsLoggedIn(false);
      setCurrentProfile(null);

      // Vis en mer brukervennlig feilmelding
      setStatus({
        type: "error",
        message: "Sesjonen din har utløpt. Vennligst logg inn på nytt.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      await throttleApiCall();

      // Formater brukernavn riktig
      let identifier = username;
      if (!identifier.includes(".")) {
        identifier += ".bsky.social";
      }
      if (!identifier.includes("@") && !identifier.startsWith("did:")) {
        identifier = identifier.replace(/^@?/, ""); // Fjern @ hvis det finnes
      }

      debugLog("Forsøker å logge inn med:", identifier);

      // Legg til timeout for å unngå at kallet henger
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Tidsavbrudd ved tilkobling til server")),
          15000,
        ),
      );

      // Prøv å logge inn med timeout
      const loginPromise = agentRef.current.login({ identifier, password });
      const response = await Promise.race([loginPromise, timeoutPromise]);

      setIsLoggedIn(true);
      setCurrentProfile(response.data.handle || identifier);
      setStatus({
        type: "success",
        message: `Logget inn som ${response.data.handle || identifier}`,
      });

      // Save session with timestamp
      localStorage.setItem("bluesky_session", JSON.stringify(response.data));
      localStorage.setItem("bluesky_session_time", Date.now().toString());
    } catch (error) {
      debugError("Login error:", error.message || "Ukjent feil");

      // Vis en mer brukervennlig feilmelding basert på feiltypen
      let errorMessage = "Feil ved innlogging";

      if (
        error.message?.includes("timeout") ||
        error.message?.includes("Tidsavbrudd")
      ) {
        errorMessage =
          "Kunne ikke koble til BlueSkys server. Sjekk internettforbindelsen din.";
      } else if (
        error.status === 400 ||
        error.message?.includes("Invalid") ||
        error.message?.includes("Ugyldig")
      ) {
        errorMessage =
          "Feil brukernavn eller passord. Husk å bruke fullt brukernavn (f.eks. brukernavn.bsky.social)";
      } else if (
        error.status === 429 ||
        error.message?.includes("Rate Limit")
      ) {
        errorMessage =
          "For mange innloggingsforsøk. Vennligst vent litt før du prøver igjen.";
      }

      setStatus({
        type: "error",
        message: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Logout handler
  const handleLogout = () => {
    agentRef.current = new BskyAgent({ service: "https://bsky.social" });
    setIsLoggedIn(false);
    setCurrentProfile(null);
    setCurrentView("feed");
    localStorage.removeItem("bluesky_session");
    localStorage.removeItem("bluesky_session_time");
    setStatus({
      type: "success",
      message: "Du er nå logget ut",
    });
  };

  // Post handler
  const handlePost = async (e) => {
    e.preventDefault();

    if (postContent.trim().length === 0) {
      setStatus({
        type: "error",
        message: "Innlegget kan ikke være tomt",
      });
      return;
    }

    if (postContent.length > MAX_POST_LENGTH) {
      setStatus({
        type: "error",
        message: `Innlegget kan ikke være lengre enn ${MAX_POST_LENGTH} tegn`,
      });
      return;
    }

    try {
      setIsLoading(true);

      if (!agentRef.current.session) {
        throw new Error("Ikke logget inn. Prøv å logge inn på nytt.");
      }

      await throttleApiCall();

      // Sjekk om innlegget inneholder en YouTube-lenke
      const youtubeRegex =
        /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([^\s&]+)/;
      const youtubeMatch = postContent.match(youtubeRegex);

      let embed = undefined;
      if (youtubeMatch) {
        embed = {
          external: {
            uri: `https://youtube.com/watch?v=${youtubeMatch[1]}`,
            title: "YouTube Video",
            description: postContent,
          },
        };
      }

      await agentRef.current.post({
        text: postContent,
        embed: embed,
        createdAt: new Date().toISOString(),
      });
      setStatus({
        type: "success",
        message: "Innlegg publisert!",
      });
      setPostContent("");
      setPostCharCount(0);
    } catch (error) {
      debugError("Posting error:", error.message || "Ukjent feil");

      // Håndter rate limiting
      if (error.message?.includes("Rate Limit") || error.status === 429) {
        setStatus({
          type: "error",
          message: "Rate limit nådd. Vennligst vent litt før du prøver igjen.",
        });
      } else {
        setStatus({
          type: "error",
          message: `Feil ved publisering: ${error.message || "Ukjent feil"}`,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Profile navigation handler
  const handleProfileNavigation = useCallback((handle) => {
    // Ikke bytt hvis vi allerede er på denne profilen
    if (currentProfile === handle && currentView === "profile") {
      return;
    }

    setCurrentProfile(handle);
    setCurrentView("profile");
  }, [currentProfile, currentView]);

  // Callback for å håndtere profilklikk i Feed og Profile
  const handleProfileClick = useCallback((handle) => {
    setCurrentProfile(handle);
    setCurrentView("profile");
  }, []);

  // Callback for å håndtere tilbakeknapp i Profile
  const handleBackClick = useCallback(() => {
    setCurrentView("feed");
  }, []);

  // Post content change handler
  const handlePostContentChange = (e) => {
    const content = e.target.value;
    setPostContent(content);
    setPostCharCount(content.length);
  };

  // Legg til error boundary
  useEffect(() => {
    const handleError = (error) => {
      debugError("App Error:", error.message || "Ukjent feil");
      // Bruk setTimeout for å unngå setState under rendering
      setTimeout(() => {
        setError(error);
      }, 0);
    };

    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  // Render main content based on current view
  const renderMainContent = useCallback(() => {
    switch (currentView) {
      case "feed":
        return (
          <Feed
            agent={agentRef.current}
            feedType="timeline"
            height={800}
            itemSize={280}
            onProfileClick={handleProfileClick}
          />
        );
      case "profile":
        return (
          <Profile
            agent={agentRef.current}
            handle={currentProfile}
            onBackClick={handleBackClick}
            onProfileClick={handleProfileClick}
          />
        );
      default:
        return (
          <Feed
            agent={agentRef.current}
            feedType="timeline"
            height={800}
            itemSize={280}
            onProfileClick={handleProfileClick}
          />
        );
    }
  }, [currentView, currentProfile, handleProfileClick, handleBackClick]);

  // Vis feilmelding hvis noe går galt
  if (error) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <h2 className="text-red-600 text-lg font-semibold mb-2">
            Noe gikk galt
          </h2>
          <p className="text-gray-600">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Last siden på nytt
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Legg til en loading state */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        </div>
      )}

      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-sky-500 mr-1.5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
              </svg>
              <h1 className="text-lg font-bold bg-gradient-to-r from-sky-600 to-indigo-600 text-transparent bg-clip-text">
                Bluesky
              </h1>
            </div>
            {isLoggedIn && (
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <button
                    onClick={() => setCurrentView("feed")}
                    className={`px-3 py-1.5 rounded-md transition-all text-sm ${
                      currentView === "feed"
                        ? "bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <span className="flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5 mr-1"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                      Feed
                    </span>
                  </button>
                  <button
                    onClick={() => {
                      setCurrentProfile(username);
                      setCurrentView("profile");
                    }}
                    className={`px-3 py-1.5 rounded-md transition-all text-sm ${
                      currentView === "profile" && currentProfile === username
                        ? "bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-sm"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <span className="flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3.5 w-3.5 mr-1"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Min Profil
                    </span>
                  </button>
                </div>
                <button
                  onClick={handleLogout}
                  className="ml-1 px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-md transition-all flex items-center text-sm"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5 mr-1"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Logg ut
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 py-6 space-y-6">
        {!isLoggedIn ? (
          // Login Form
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-gradient-to-r from-sky-500 to-indigo-600 p-6 text-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 text-white mx-auto mb-3"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                  <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                </svg>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Velkommen til Bluesky
                </h2>
                <p className="text-sky-100 text-sm">
                  Logg inn for å utforske det desentraliserte sosiale nettverket
                </p>
              </div>
              <div className="p-6">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label
                      htmlFor="username"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Brukernavn
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 text-gray-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="pl-10 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 text-sm"
                        required
                        disabled={isLoading}
                        placeholder="brukernavn.bsky.social"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Passord
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 text-gray-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 text-sm"
                        required
                        disabled={isLoading}
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-70 transition-all"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="flex items-center">
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Logger inn...
                      </span>
                    ) : (
                      "Logg inn"
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        ) : (
          // Logged in view
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">{renderMainContent()}</div>
            <div className="hidden lg:block">
              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 sticky top-20">
                <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mr-1.5 text-sky-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Om Bluesky
                </h3>
                <div className="prose prose-sm prose-sky text-gray-600">
                  <p className="mb-2 text-sm">
                    Dette er en enkel proof-of-concept applikasjon for Bluesky,
                    et desentralisert sosialt nettverk bygget på AT Protocol.
                  </p>
                  <p className="mb-2 text-sm">
                    Bluesky gir brukere kontroll over sine egne data og lar dem
                    velge hvordan deres opplevelse skal være.
                  </p>
                  <div className="border-t border-gray-100 pt-3 mt-3">
                    <h4 className="font-medium text-gray-900 mb-2 text-sm">
                      Funksjoner:
                    </h4>
                    <ul className="space-y-1.5 text-xs">
                      <li className="flex items-start">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 text-sky-500 mr-1.5 flex-shrink-0"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Se på innlegg i feeden
                      </li>
                      <li className="flex items-start">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 text-sky-500 mr-1.5 flex-shrink-0"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Publisere nye innlegg
                      </li>
                      <li className="flex items-start">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 text-sky-500 mr-1.5 flex-shrink-0"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Utforske profiler
                      </li>
                      <li className="flex items-start">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 text-sky-500 mr-1.5 flex-shrink-0"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Følge andre brukere
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {status.message && (
          <div
            className={`fixed bottom-4 right-4 p-3 rounded-lg shadow-md max-w-xs animate-fade-in text-sm ${
              status.type === "success"
                ? "bg-green-50 text-green-800 border border-green-100"
                : "bg-red-50 text-red-800 border border-red-100"
            }`}
          >
            <div className="flex items-center">
              {status.type === "success" ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-green-500 mr-1.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-red-500 mr-1.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
              {status.message}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
