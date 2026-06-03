"use client";

import { useEffect } from "react";

// Silences "chrome-extension://..." errors injected by browser extensions
// (e.g. MetaMask's inpage.js) so they don't trip Next.js's dev error overlay.
// These errors do not affect the app — they're the extension talking to itself.
export default function SuppressExtensionErrors() {
  useEffect(() => {
    const looksLikeExtensionNoise = (msg?: string, file?: string) => {
      const m = (msg || "").toLowerCase();
      const f = (file || "").toLowerCase();
      return (
        f.startsWith("chrome-extension://") ||
        f.startsWith("moz-extension://") ||
        m.includes("metamask") ||
        m.includes("inpage.js")
      );
    };

    const onError = (event: ErrorEvent) => {
      if (looksLikeExtensionNoise(event.message, event.filename)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as unknown;
      const msg =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "";
      const stack = reason instanceof Error ? reason.stack || "" : "";
      if (looksLikeExtensionNoise(msg, stack)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection, true);
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection, true);
    };
  }, []);

  return null;
}
