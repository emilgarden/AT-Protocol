import React, { useCallback } from "react";
import PropTypes from "prop-types";

/**
 * ErrorFallback-komponent - Standard UI for feilmeldinger
 *
 * @component
 * @param {Object} props - Komponent-props
 * @param {Error} props.error - Feilobjekt
 * @param {Object} props.errorInfo - React feilinformasjon
 * @param {Function} props.resetError - Funksjon for å tilbakestille feilen
 * @param {string} props.title - Overskrift for feilmeldingen
 * @param {string} props.message - Melding til brukeren
 * @param {string} props.buttonText - Tekst på tilbakestill-knappen
 * @param {string} props.className - Ekstra CSS-klasser
 * @param {boolean} props.showDetails - Om feildetaljer skal vises (default: false i produksjon, true i utvikling)
 * @param {Function} props.onRetry - Callback som kjøres når brukeren klikker retry-knappen
 */
const ErrorFallback = React.memo(
  ({
    error,
    errorInfo,
    resetError,
    title = "Noe gikk galt",
    message = "Det oppstod en feil. Vi beklager ulempene dette medfører.",
    buttonText = "Prøv igjen",
    className = "",
    showDetails = process.env.NODE_ENV !== "production",
    onRetry,
    resetErrorBoundary,
  }) => {
    // Håndter klikk på retry-knappen
    const handleRetry = useCallback(() => {
      // Tilbakestill feilen i ErrorBoundary (støtter både resetError og resetErrorBoundary)
      if (resetErrorBoundary) {
        resetErrorBoundary();
      } else if (resetError) {
        resetError();
      }

      // Kjør eventuell retry-logikk
      if (onRetry) {
        onRetry();
      }
    }, [resetError, resetErrorBoundary, onRetry]);

    return (
      <div
        className={`bg-white rounded-lg shadow-md p-6 my-4 mx-auto max-w-md ${className}`}
      >
        <div className="flex flex-col items-center text-center">
          <div className="text-3xl text-amber-500 mb-4">⚠️</div>

          <h2 className="text-xl font-bold text-gray-800 mb-2">{title}</h2>

          <p className="text-gray-600 mb-4">{message}</p>

          <button
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            onClick={handleRetry}
          >
            {buttonText}
          </button>

          {/* Vis tekniske detaljer hvis showDetails er true */}
          {showDetails && error && (
            <details className="mt-4 text-left w-full">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                Tekniske detaljer
              </summary>
              <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded text-sm">
                <p className="font-mono mb-2">
                  {error?.name || "Error"}: {error?.message || "Ukjent feil"}
                </p>
                {error?.stack && (
                  <pre className="overflow-x-auto text-xs bg-gray-100 p-2 mt-2 rounded">
                    {error.stack}
                  </pre>
                )}
                {errorInfo?.componentStack && (
                  <div className="mt-3">
                    <h4 className="font-medium text-sm">Komponentstakk:</h4>
                    <pre className="overflow-x-auto text-xs bg-gray-100 p-2 mt-1 rounded">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    );
  },
);

// PropTypes-definisjon for ErrorFallback-komponenten
ErrorFallback.propTypes = {
  error: PropTypes.object,
  errorInfo: PropTypes.object,
  resetError: PropTypes.func,
  resetErrorBoundary: PropTypes.func,
  title: PropTypes.string,
  message: PropTypes.string,
  buttonText: PropTypes.string,
  className: PropTypes.string,
  showDetails: PropTypes.bool,
  onRetry: PropTypes.func,
};

export default ErrorFallback;
