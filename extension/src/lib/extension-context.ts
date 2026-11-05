/**
 * A content script loaded before an extension update/reload keeps running in the page,
 * but its `browser.runtime` port is closed: every message then rejects with
 * "Extension context invalidated." Nothing can reconnect from the stale script, so the
 * only fix is reloading the page. The UI recognises that error and offers the reload
 * instead of showing it as a backend failure.
 */
const INVALIDATED = /extension context invalidated/i;

export function isExtensionContextInvalidated(error: unknown): boolean {
  const message =
    typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
        ? error.message
        : '';
  return INVALIDATED.test(message);
}

/** Reloads the page that hosts the stale content script. */
export function reloadHostPage(): void {
  window.location.reload();
}
