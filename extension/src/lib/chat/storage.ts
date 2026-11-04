import type { ChatContext, ChatSession } from './types';

/**
 * Pending context sent from a page ("Ask about this sentence"). Lives in storage.session:
 * written by the background script, read by the side panel, gone when the browser closes.
 */
const CONTEXT_KEY = 'chatContext';
/** Saved conversations for "Chat history" (storage.local, newest first). */
const SESSIONS_KEY = 'chatSessions';
const MAX_SESSIONS = 30;

export interface PendingChatContext extends ChatContext {
  tabId: number | null;
  /** Changes on every send, so the panel notices the same sentence sent twice. */
  sentAt: number;
}

export async function setPendingContext(context: PendingChatContext): Promise<void> {
  await browser.storage.session.set({ [CONTEXT_KEY]: context });
}

export async function getPendingContext(): Promise<PendingChatContext | null> {
  const value = (await browser.storage.session.get(CONTEXT_KEY))[CONTEXT_KEY];
  return (value as PendingChatContext | undefined) ?? null;
}

export function watchPendingContext(callback: (value: PendingChatContext | null) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area === 'session' && changes[CONTEXT_KEY]) {
      callback((changes[CONTEXT_KEY].newValue as PendingChatContext | undefined) ?? null);
    }
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

export async function getChatSessions(): Promise<ChatSession[]> {
  const value = (await browser.storage.local.get(SESSIONS_KEY))[SESSIONS_KEY];
  return Array.isArray(value) ? (value as ChatSession[]) : [];
}

/** Inserts or replaces a session; empty sessions are not stored. */
export async function saveChatSession(session: ChatSession): Promise<void> {
  if (session.messages.length === 0) return;
  const others = (await getChatSessions()).filter((s) => s.id !== session.id);
  await browser.storage.local.set({ [SESSIONS_KEY]: [session, ...others].slice(0, MAX_SESSIONS) });
}

export async function deleteChatSession(id: string): Promise<void> {
  const sessions = await getChatSessions();
  await browser.storage.local.set({ [SESSIONS_KEY]: sessions.filter((s) => s.id !== id) });
}
