/**
 * Opens the assistant panel: Chrome/Edge side panel, or Firefox's sidebar (WXT builds the
 * `sidepanel` entrypoint as `sidebar_action` there). Both need the user gesture of the
 * click or shortcut being handled, so call this before any `await`.
 * Resolves false when the browser has neither (or refused).
 */
export function openAssistantPanel(target: { tabId?: number; windowId?: number }): Promise<boolean> {
  const api = browser as unknown as {
    sidePanel?: { open: (o: { tabId?: number; windowId?: number }) => Promise<void> };
    sidebarAction?: { open: () => Promise<void> };
  };
  try {
    if (api.sidePanel?.open) {
      const options = target.tabId !== undefined ? { tabId: target.tabId } : { windowId: target.windowId };
      return api.sidePanel.open(options).then(
        () => true,
        (error: unknown) => {
          console.warn('TextChecker: could not open the side panel', error);
          return false;
        }
      );
    }
    if (api.sidebarAction?.open) {
      return api.sidebarAction.open().then(
        () => true,
        () => false
      );
    }
  } catch (error) {
    console.warn('TextChecker: could not open the side panel', error);
  }
  return Promise.resolve(false);
}
