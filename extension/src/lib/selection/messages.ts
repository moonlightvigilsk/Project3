/**
 * Background -> content script: the user chose "Look up" or "Add to vocabulary" in the
 * context menu (US-06). Payload `{ text, save }`; the reply `{ handled: true }` tells the
 * background not to use its fallback.
 */
export const CONTEXT_MENU_LOOKUP = 'CONTEXT_MENU_LOOKUP';
