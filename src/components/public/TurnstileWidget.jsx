import { useEffect, useRef } from "react";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
// Cloudflare's documented always-pass test key, used only in local development.
const DEV_TEST_SITE_KEY = "1x00000000000000000000AA";

let scriptPromise = null;
const loadTurnstile = () => {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve(window.turnstile);
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error("turnstile-load-failed"));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
};

const turnstileSiteKey =
  import.meta.env.VITE_TURNSTILE_SITE_KEY || (import.meta.env.DEV ? DEV_TEST_SITE_KEY : "");

/**
 * Cloudflare Turnstile. Tokens are single use: bump `resetKey` after every submit attempt.
 */
const TurnstileWidget = ({ onToken, onError, resetKey = 0, language = "en" }) => {
  const containerRef = useRef(null);
  const widgetId = useRef(null);
  const callbacks = useRef({ onToken, onError });

  useEffect(() => {
    callbacks.current = { onToken, onError };
  }, [onToken, onError]);

  useEffect(() => {
    if (!turnstileSiteKey) {
      callbacks.current.onError?.();
      return undefined;
    }
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return;
        widgetId.current = turnstile.render(containerRef.current, {
          sitekey: turnstileSiteKey,
          language,
          callback: (token) => callbacks.current.onToken(token),
          "expired-callback": () => callbacks.current.onToken(""),
          "error-callback": () => callbacks.current.onError?.(),
        });
      })
      .catch(() => callbacks.current.onError?.());

    return () => {
      cancelled = true;
      if (widgetId.current !== null && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [language]);

  useEffect(() => {
    if (resetKey > 0 && widgetId.current !== null && window.turnstile) {
      window.turnstile.reset(widgetId.current);
    }
  }, [resetKey]);

  return <div ref={containerRef} className="min-h-[65px]" />;
};

export default TurnstileWidget;
