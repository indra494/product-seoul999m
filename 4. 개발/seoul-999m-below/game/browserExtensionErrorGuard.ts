/**
 * Browser extensions can inject page-world scripts before the game starts.
 * Vinext's development overlay listens to every global rejection, including
 * failures whose entire stack belongs to an extension. Install this guard in
 * <head> before the development runtime so unrelated extension failures do not
 * cover the game while genuine application errors still reach the overlay.
 */
export const BROWSER_EXTENSION_ERROR_GUARD_SCRIPT = String.raw`
(() => {
  const installedKey = "__seoul999mBrowserExtensionErrorGuardInstalled";
  if (window[installedKey]) return;
  window[installedKey] = true;

  const describe = (value) => {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return String(value ?? "");
    return [value.name, value.message, value.stack]
      .filter((part) => typeof part === "string")
      .join("\n");
  };
  const comesFromBrowserExtension = (value, filename = "") => {
    const detail = filename + "\n" + describe(value);
    return /(?:chrome|moz|safari-web)-extension:\/\//i.test(detail) ||
      /failed to connect to metamask/i.test(detail);
  };
  const ignoreExternalFailure = (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  window.addEventListener("unhandledrejection", (event) => {
    if (comesFromBrowserExtension(event.reason)) ignoreExternalFailure(event);
  }, true);
  window.addEventListener("error", (event) => {
    if (comesFromBrowserExtension(event.error ?? event.message, event.filename))
      ignoreExternalFailure(event);
  }, true);
})();
`;
