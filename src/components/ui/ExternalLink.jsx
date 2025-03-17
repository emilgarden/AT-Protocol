import React, { useState, useEffect, useCallback } from "react";
import PropTypes from "prop-types";
import { debugError, debugLog } from "../../utils/debug";
import SafeImage from "./SafeImage";

/**
 * ExternalLink-komponent med sikkerhetsfunksjoner for eksterne lenker
 *
 * @component
 * @param {Object} props
 * @param {string} props.href - URL for lenken
 * @param {React.ReactNode} props.children - Innhold som skal vises i lenken
 * @param {string} [props.className=''] - CSS-klasser for lenken
 * @param {boolean} [props.openInNewTab=true] - Om lenken skal åpnes i ny fane
 * @param {boolean} [props.noReferrer=true] - Om lenken skal ha rel="noopener noreferrer"
 * @param {Function} [props.onClick] - Click handler for lenken
 * @param {Object} [props.linkProps={}] - Andre props for a-elementet
 */
const ExternalLink = React.memo(
  ({
    href,
    children,
    className = "",
    openInNewTab = true,
    noReferrer = true,
    onClick,
    linkProps = {},
    ...rest
  }) => {
    const handleClick = useCallback(
      (e) => {
        if (!href) {
          debugError("ExternalLink ble klikket uten href-attributt");
          e.preventDefault();
          return;
        }

        try {
          // Logg klikkaktivitet
          debugLog("ExternalLink klikket:", href);

          // Kall custom onClick-handler hvis den finnes
          if (onClick) {
            onClick(e);
          }
        } catch (error) {
          debugError("Feil i ExternalLink onClick-handler:", error);
        }
      },
      [href, onClick],
    );

    const renderLink = () => {
      // Ikke render noe hvis vi ikke har en gyldig href
      if (!href) {
        debugError("ExternalLink ble rendret uten gyldig href", { children });
        return <span className={className}>{children}</span>;
      }

      // Bestem rel-attributt basert på props
      const rel = noReferrer ? "noopener noreferrer" : undefined;

      // Bestem target-attributt basert på props
      const target = openInNewTab ? "_blank" : undefined;

      // Returner lenken med de riktige attributtene
      return (
        <a
          href={href}
          className={className}
          target={target}
          rel={rel}
          onClick={handleClick}
          {...linkProps}
          {...rest}
        >
          {children}
        </a>
      );
    };

    return renderLink();
  },
);

// PropTypes-definisjon for ExternalLink
ExternalLink.propTypes = {
  href: PropTypes.string,
  children: PropTypes.node.isRequired,
  className: PropTypes.string,
  openInNewTab: PropTypes.bool,
  noReferrer: PropTypes.bool,
  onClick: PropTypes.func,
  linkProps: PropTypes.object,
};

export default ExternalLink;
