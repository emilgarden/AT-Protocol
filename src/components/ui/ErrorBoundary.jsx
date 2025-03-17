import React from "react";
import PropTypes from "prop-types";
import { debugError } from "../../utils/debug";
import ErrorFallback from "./ErrorFallback";

/**
 * ErrorBoundary-komponent som fanger JavaScript-feil i barnkomponenter
 * og viser et fallback-UI i stedet for å krasje applikasjonen
 *
 * @component
 * @example
 * <ErrorBoundary>
 *   <ComponentThatMightCrash />
 * </ErrorBoundary>
 *
 * @example
 * <ErrorBoundary FallbackComponent={CustomErrorUI}>
 *   <ComponentThatMightCrash />
 * </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  // Sett standardverdier for props
  static defaultProps = {
    FallbackComponent: ErrorFallback,
    fallbackProps: {},
    onError: null,
    onReset: null,
    resetOnUnmount: false,
  };

  static getDerivedStateFromError(error) {
    // Oppdater state for å vise fallback-UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    // Logger feilen til feilhåndteringssystem
    this.setState({ errorInfo });

    debugError("ErrorBoundary fanget en feil:", error, errorInfo);

    // Kjør custom error-handler om den finnes
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  // Tilbakestill feilstatus
  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Kjør onReset-callback om den finnes
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const {
      children,
      FallbackComponent,
      fallbackProps = {},
      resetOnUnmount = false,
    } = this.props;

    if (hasError) {
      const FallbackUI = FallbackComponent || ErrorFallback;

      return (
        <FallbackUI
          error={error}
          errorInfo={errorInfo}
          resetError={this.resetError}
          resetErrorBoundary={this.resetError}
          {...fallbackProps}
        />
      );
    }

    return children;
  }

  componentWillUnmount() {
    const { resetOnUnmount } = this.props;

    // Hvis resetOnUnmount er true, så nullstiller vi feiltilstanden
    // Dette er nyttig hvis ErrorBoundary er montert i en komponent som kan remonteres
    if (resetOnUnmount && this.state.hasError) {
      this.resetError();
    }
  }
}

// PropTypes-definisjon for ErrorBoundary
ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  FallbackComponent: PropTypes.elementType,
  fallbackProps: PropTypes.object,
  onError: PropTypes.func,
  onReset: PropTypes.func,
  resetOnUnmount: PropTypes.bool,
};

export default ErrorBoundary;
