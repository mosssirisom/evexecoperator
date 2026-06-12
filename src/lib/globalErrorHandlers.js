import { logError } from "./errorLog";

export function installGlobalErrorHandlers() {
  window.addEventListener("error", (event) => {
    const error = event.error;
    logError({
      message: error?.message ?? event.message ?? "Unknown error",
      stack: error?.stack ?? null,
      context: { type: "window.onerror" },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const error = reason instanceof Error ? reason : null;
    logError({
      message: error?.message ?? String(reason),
      stack: error?.stack ?? null,
      context: { type: "unhandledrejection" },
    });
  });
}
