import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  BookOpen,
  Bookmark as BookmarkIcon,
  ChevronDown,
  ChevronLeft,
  History,
  Library,
  MessageSquarePlus,
  Settings as SettingsIcon,
  Trash2,
  X,
} from 'lucide-react';
import { getT, type Translations } from '@/lib/i18n';
import { settingsStorage } from '@/lib/storage';
import { DEFAULT_SETTINGS, type Settings } from '@/types';
import { actionPrompt } from '@/lib/chat/prompts';
import {
  deleteChatSession,
  getChatSessions,
  getPendingContext,
  saveChatSession,
  watchPendingContext,
  type PendingChatContext,
} from '@/lib/chat/storage';
import type { ChatAction, ChatMessage, ChatReply, ChatRequest, ChatSession, GrammarCard } from '@/lib/chat/types';
import {
  bookmarkId,
  getBookmarks,
  removeBookmark,
  toggleBookmark,
  watchBookmarks,
  type Bookmark,
} from '@/lib/bookmarks';
import { getVocabulary, unsaveWord, watchVocabulary } from '@/lib/vocabulary/client';
import { savedEntries } from '@/lib/vocabulary/model';
import { wiktionaryPageUrl } from '@/lib/dictionary/wiktionary';
import type { VocabEntry } from '@/types';
import { GrammarCardView } from './GrammarCardView';
import { isMacPlatform, panelKeyLabel, panelMenuItemForKey, type PanelMenuItem } from '@/lib/commands';
import { SourcePreviewView } from './SourcePreviewView';
import { isTrustedSourceUrl } from '@/lib/chat/prompts';

type View = 'chat' | 'bookmarks' | 'history' | 'vocab' | 'resources';

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptySession(context: ChatSession['context'] = null): ChatSession {
  return { id: newId(), context, messages: [], updatedAt: Date.now() };
}

/** Plain-text version of a grammar card, so the model sees what it answered earlier. */
function cardToText(card: GrammarCard): string {
  return [
    `${card.title} — ${card.form}`,
    ...card.patterns,
    ...card.uses.map((u) => `- ${u}`),
    ...card.examples,
    card.source ? `Source: ${card.source.url}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function replyToMessage(reply: ChatReply, t: Translations): ChatMessage {
  const base = { id: newId(), role: 'assistant' as const, createdAt: Date.now() };
  switch (reply.status) {
    case 'ok':
      return { ...base, text: reply.text, card: reply.card };
    case 'ai_disabled':
      return { ...base, text: t.chatAiDisabled, notice: true };
    case 'no_api_key':
      return { ...base, text: t.chatNoApiKey(reply.provider), notice: true };
    case 'error':
      return { ...base, text: t.chatError(reply.message), notice: true };
  }
}

/** Renders **bold** and line breaks from the model's plain-text answers. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part
      )}
    </span>
  );
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const t = getT(settings.uiLanguage || 'vi');
  const [view, setView] = useState<View>('chat');
  const [menuOpen, setMenuOpen] = useState(false);
  const [session, setSession] = useState<ChatSession>(() => emptySession());
  const [contextTabId, setContextTabId] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [input, setInput] = useState('');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  /** Saved words of the vocabulary notebook (US-05). */
  const [vocab, setVocab] = useState<VocabEntry[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const consumedContext = useRef<number>(0);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // --- data ------------------------------------------------------------------

  useEffect(() => {
    void settingsStorage.getValue().then(setSettings);
    void getBookmarks().then(setBookmarks);
    void getVocabulary().then((state) => setVocab(savedEntries(state)));
    const unwatchSettings = settingsStorage.watch(setSettings);
    const unwatchBookmarks = watchBookmarks(setBookmarks);
    const unwatchVocab = watchVocabulary((state) => setVocab(savedEntries(state)));
    return () => {
      unwatchSettings();
      unwatchBookmarks();
      unwatchVocab();
    };
  }, []);

  const startWithContext = useCallback((pendingContext: PendingChatContext | null) => {
    if (!pendingContext || pendingContext.sentAt <= consumedContext.current) return;
    consumedContext.current = pendingContext.sentAt;
    const { sentence, url, title, tabId } = pendingContext;
    void saveChatSession(sessionRef.current);
    setSession(emptySession({ sentence, url, title }));
    setContextTabId(tabId);
    setView('chat');
    setMenuOpen(false);
  }, []);

  useEffect(() => {
    void getPendingContext().then(startWithContext);
    return watchPendingContext(startWithContext);
  }, [startWithContext]);

  useEffect(() => {
    if (view === 'history') void getChatSessions().then(setSessions);
  }, [view]);

  const savedIds = useMemo(() => new Set(bookmarks.map((b) => b.id)), [bookmarks]);
  const lastCard = [...session.messages].reverse().find((m) => m.card)?.card ?? null;
  const concept = lastCard?.title ?? null;
  const conceptLabel = concept ? `"${concept}"` : t.chatConceptFallback;

  // --- chat ------------------------------------------------------------------

  /**
   * Sends one learner turn. `display` is what the thread shows (a chip label or the typed text);
   * `prompt` is what the model receives (the precise instruction for quick actions).
   */
  async function sendTurn(display: string, prompt: string, action?: ChatAction) {
    const shown = display.trim();
    if (!shown || pending) return;
    const current = sessionRef.current;
    const userMessage: ChatMessage = { id: newId(), role: 'user', text: shown, createdAt: Date.now() };
    const withUser: ChatSession = { ...current, messages: [...current.messages, userMessage], updatedAt: Date.now() };
    setSession(withUser);
    setPending(true);

    const history = current.messages
      .filter((m) => !m.notice)
      .map((m) => ({ role: m.role, content: m.card ? cardToText(m.card) : m.text }));
    const request: ChatRequest = {
      messages: [...history, { role: 'user', content: prompt.trim() }],
      context: withUser.context,
      action,
      uiLanguage: settings.uiLanguage || 'vi',
    };

    let reply: ChatReply;
    try {
      const response = await browser.runtime.sendMessage({ type: 'CHAT_SEND', payload: request });
      reply = response?.success ? (response.reply as ChatReply) : { status: 'error', message: response?.error ?? '?' };
    } catch (error) {
      reply = { status: 'error', message: error instanceof Error ? error.message : String(error) };
    }

    setPending(false);
    const finished: ChatSession = {
      ...withUser,
      messages: [...withUser.messages, replyToMessage(reply, t)],
      updatedAt: Date.now(),
    };
    void saveChatSession(finished);
    // A new sentence may have been sent from the page meanwhile: the reply stays with its own session.
    if (sessionRef.current.id === finished.id) setSession(finished);
  }

  function sendInput() {
    const text = input;
    if (!text.trim() || pending) return;
    setInput('');
    void sendTurn(text, text);
  }

  function runAction(action: ChatAction) {
    const labels: Record<ChatAction, string> = {
      examples: t.chatActionExamples(conceptLabel),
      practice: t.chatActionPractice(conceptLabel),
      explain: t.chatActionExplain(conceptLabel),
    };
    void sendTurn(labels[action], actionPrompt(action, concept), action);
  }

  function clearContext() {
    setSession((s) => ({ ...s, context: null }));
    if (contextTabId !== null) {
      void browser.tabs.sendMessage(contextTabId, { type: 'CLEAR_CHAT_HIGHLIGHT' }).catch(() => undefined);
    }
  }

  function newChat() {
    void saveChatSession(sessionRef.current);
    setSession(emptySession());
    setView('chat');
  }

  function openSession(saved: ChatSession) {
    void saveChatSession(sessionRef.current);
    setSession(saved);
    setView('chat');
  }

  function toggleCardSave(card: GrammarCard) {
    void toggleBookmark({
      id: bookmarkId('grammar', card.id),
      kind: 'grammar',
      title: card.title,
      subtitle: card.form,
      url: card.source?.url,
      card,
    });
  }

  function toggleSourceSave(card: GrammarCard) {
    if (!card.source) return;
    void toggleBookmark({
      id: bookmarkId('resource', card.source.url),
      kind: 'resource',
      title: card.source.title,
      subtitle: card.title,
      url: card.source.url,
    });
  }

  // --- keyboard (US-16) ---------------------------------------------------------

  function selectMenuItem(item: MenuItem) {
    setMenuOpen(false);
    if (item === 'settings') void browser.runtime.openOptionsPage();
    else if (item === 'new') newChat();
    else setView(item);
  }

  function closeMenu(returnFocus: boolean) {
    setMenuOpen(false);
    if (returnFocus) menuButtonRef.current?.focus();
  }

  const canAct = (!!session.context || session.messages.some((m) => m.card)) && !pending;
  // The listener reads the latest state through a ref (it is registered once).
  const keyState = useRef({ view, canAct, runAction, selectMenuItem });
  keyState.current = { view, canAct, runAction, selectMenuItem };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const state = keyState.current;
      const item = panelMenuItemForKey(e);
      if (item) {
        e.preventDefault();
        state.selectMenuItem(item);
        return;
      }
      // Alt+1/2/3: the quick actions.
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && /^Digit[123]$/.test(e.code)) {
        e.preventDefault();
        if (state.view === 'chat' && state.canAct) {
          state.runAction((['examples', 'practice', 'explain'] as const)[Number(e.code.slice(5)) - 1]);
        }
        return;
      }
      const target = e.target as HTMLElement | null;
      const typing = !!target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable);
      if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (state.view !== 'chat') setView('chat');
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }
      // Esc in a saved list goes back to the chat (menus and previews handle their own Esc).
      if (e.key === 'Escape' && !e.defaultPrevented && state.view !== 'chat') {
        e.preventDefault();
        setView('chat');
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // --- render ----------------------------------------------------------------

  const viewTitle: Record<View, string> = {
    chat: t.chatTitle,
    bookmarks: t.menuBookmarks,
    history: t.menuChatHistory,
    vocab: t.menuSavedVocab,
    resources: t.menuSavedResources,
  };

  return (
    <div className="mx-auto flex h-screen w-full max-w-[412px] flex-col bg-chat-bg text-ink-900">
      <header className="relative flex h-12 shrink-0 items-center justify-center px-3">
        {view !== 'chat' && (
          <button
            type="button"
            onClick={() => setView('chat')}
            className="absolute left-2 flex h-8 w-8 items-center justify-center rounded-lg text-ink-600 hover:bg-white/60 hover:text-ink-900"
            aria-label={t.chatTitle}
            title={t.chatTitle}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title={t.chatMenu}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-base font-semibold text-ink-900 hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-accent"
        >
          {viewTitle[view]}
          <ChevronDown className={`h-4 w-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
        </button>
        {menuOpen && (
          <Menu t={t} current={view} onClose={closeMenu} onSelect={selectMenuItem} />
        )}
      </header>

      {view === 'chat' && (
        <ChatView
          t={t}
          session={session}
          pending={pending}
          input={input}
          conceptLabel={conceptLabel}
          savedIds={savedIds}
          onInput={setInput}
          onSend={sendInput}
          onAction={runAction}
          onClearContext={clearContext}
          inputRef={inputRef}
          onToggleCardSave={toggleCardSave}
          onToggleSourceSave={toggleSourceSave}
        />
      )}

      {view === 'bookmarks' && (
        // Everything saved: notebook words (US-05) and bookmarked cards/resources, newest first.
        <BookmarkList
          t={t}
          items={[...vocab.map(vocabAsBookmark), ...bookmarks].sort((a, b) => b.createdAt - a.createdAt)}
          empty={t.emptyBookmarks}
          savedIds={savedIds}
          onToggleCardSave={toggleCardSave}
          onToggleSourceSave={toggleSourceSave}
          onRemove={(id) => void (vocab.some((v) => v.id === id) ? unsaveWord(id) : removeBookmark(id))}
        />
      )}
      {view === 'vocab' && (
        <BookmarkList
          t={t}
          items={vocab.map(vocabAsBookmark)}
          empty={t.emptyVocab}
          savedIds={savedIds}
          onToggleCardSave={toggleCardSave}
          onToggleSourceSave={toggleSourceSave}
          onRemove={(id) => void unsaveWord(id)}
        />
      )}
      {view === 'resources' && (
        <BookmarkList t={t} items={bookmarks.filter((b) => b.kind === 'resource')} empty={t.emptyResources} savedIds={savedIds} onToggleCardSave={toggleCardSave} onToggleSourceSave={toggleSourceSave} />
      )}
      {view === 'history' && (
        <HistoryList
          t={t}
          sessions={sessions}
          onOpen={openSession}
          onDelete={(id) => {
            void deleteChatSession(id).then(() => getChatSessions().then(setSessions));
          }}
        />
      )}
    </div>
  );
}

// --- menu ----------------------------------------------------------------------

type MenuItem = PanelMenuItem;

function Menu({
  t,
  current,
  onSelect,
  onClose,
}: {
  t: Translations;
  current: View;
  onSelect: (item: MenuItem) => void;
  /** `returnFocus`: closed from the keyboard (Esc), focus goes back to the menu button. */
  onClose: (returnFocus: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isMac = isMacPlatform();
  const groups: { id: MenuItem; label: string; icon: React.ReactNode }[][] = [
    [
      { id: 'bookmarks', label: t.menuBookmarks, icon: <BookmarkIcon className="h-5 w-5" /> },
      { id: 'history', label: t.menuChatHistory, icon: <History className="h-5 w-5" /> },
    ],
    [
      { id: 'vocab', label: t.menuSavedVocab, icon: <BookOpen className="h-5 w-5" /> },
      { id: 'resources', label: t.menuSavedResources, icon: <Library className="h-5 w-5" /> },
    ],
    [{ id: 'new', label: t.menuNewChat, icon: <MessageSquarePlus className="h-5 w-5" /> }],
    [{ id: 'settings', label: t.menuSettings, icon: <SettingsIcon className="h-5 w-5" /> }],
  ];

  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [onClose]);

  function onKeyDown(e: React.KeyboardEvent) {
    const items = [...(ref.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose(true);
    } else if (e.key === 'Tab') {
      // Tab leaves the menu: close it like a native menu.
      onClose(false);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      (e.key === 'Home' ? items[0] : items[items.length - 1])?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    }
  }

  return (
    <div
      ref={ref}
      role="menu"
      onKeyDown={onKeyDown}
      className="absolute left-1/2 top-3 z-20 max-h-[calc(100vh-24px)] w-[calc(100%-2rem)] max-w-[370px] -translate-x-1/2 overflow-y-auto overscroll-contain rounded-[22px] border border-white/50 bg-parchment-100/80 p-[9px] shadow-[0_0_3px_rgba(0,0,0,0.10),0_0_43px_rgba(0,0,0,0.16)] backdrop-blur-2xl"
    >
      {groups.map((group, gi) => (
        <div key={gi} className={gi > 0 ? 'mt-[14px] border-t border-stone-border/70 pt-[14px]' : ''}>
          {group.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => onSelect(item.id)}
              aria-keyshortcuts={`Alt+${panelKeyLabel(item.id, false).slice(4)}`}
              className={`group flex h-[41px] w-full items-center gap-[14px] rounded-[14px] px-[10px] text-left text-[22px] font-medium leading-[27px] outline-none transition-colors hover:bg-chat-selected hover:text-white focus:bg-chat-selected focus:text-white ${
                current === item.id ? 'bg-chat-selected text-white' : 'text-ink-900'
              }`}
            >
              {item.icon}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <kbd className="shrink-0 font-sans text-[22px] font-medium leading-[27px] text-ink-400 group-hover:text-white/80 group-focus:text-white/80">
                {panelKeyLabel(item.id, isMac)}
              </kbd>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// --- chat view -------------------------------------------------------------------

function ChatView({
  t,
  session,
  pending,
  input,
  conceptLabel,
  savedIds,
  onInput,
  onSend,
  onAction,
  onClearContext,
  inputRef,
  onToggleCardSave,
  onToggleSourceSave,
}: {
  t: Translations;
  session: ChatSession;
  pending: boolean;
  input: string;
  conceptLabel: string;
  savedIds: Set<string>;
  onInput: (value: string) => void;
  onSend: () => void;
  onAction: (action: ChatAction) => void;
  onClearContext: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onToggleCardSave: (card: GrammarCard) => void;
  onToggleSourceSave: (card: GrammarCard) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasContext = !!session.context;
  const canAct = (hasContext || session.messages.some((m) => m.card)) && !pending;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [session.messages.length, pending]);

  const actions: { id: ChatAction; label: string }[] = [
    { id: 'examples', label: t.chatActionExamples(conceptLabel) },
    { id: 'practice', label: t.chatActionPractice(conceptLabel) },
    { id: 'explain', label: t.chatActionExplain(conceptLabel) },
  ];

  return (
    <>
      <div className="flex-1 overflow-y-auto px-[22px] pb-3">
        {session.context && (
          <div className="mb-3 flex items-start gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">{t.chatContextLabel}</div>
              <p className="mt-0.5 border-l-2 border-context pl-2 leading-snug text-ink-800">{session.context.sentence}</p>
              <p className="mt-1 truncate text-[11px] text-ink-400" title={session.context.url}>
                {session.context.title || session.context.url}
              </p>
            </div>
            <button
              type="button"
              onClick={onClearContext}
              className="rounded-md p-1 text-ink-400 hover:bg-white/60 hover:text-ink-900"
              aria-label={t.chatClearContext}
              title={t.chatClearContext}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {actions.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-keyshortcuts={`Alt+${actions.indexOf(a) + 1}`}
              title={`Alt+${actions.indexOf(a) + 1}`}
              disabled={!canAct}
              onClick={() => onAction(a.id)}
              className="rounded-lg border border-white/60 bg-white px-4 py-3 text-left text-base leading-[1.4] text-ink-900 shadow-sm transition hover:border-white hover:shadow focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:shadow-sm"
            >
              {a.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-2.5">
          {session.messages.length === 0 && (
            <Bubble role="assistant">{hasContext ? t.chatGreeting : t.chatNeedContext}</Bubble>
          )}
          {session.messages.map((m) =>
            m.card ? (
              <GrammarCardView
                key={m.id}
                card={m.card}
                t={t}
                saved={savedIds.has(bookmarkId('grammar', m.card.id))}
                sourceSaved={!!m.card.source && savedIds.has(bookmarkId('resource', m.card.source.url))}
                onToggleSave={() => onToggleCardSave(m.card!)}
                onToggleSourceSave={() => onToggleSourceSave(m.card!)}
              />
            ) : (
              <Bubble key={m.id} role={m.role} notice={m.notice}>
                <RichText text={m.text} />
              </Bubble>
            )
          )}
          {pending && (
            <Bubble role="assistant" notice>
              {t.chatThinking}
            </Bubble>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      <form
        className="shrink-0 px-[22px] pb-[22px]"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
      >
        <div className="flex min-h-20 items-end gap-2 rounded-2xl border border-chat-line/40 bg-white p-4 shadow-sm focus-within:border-ink-400">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                onSend();
              }
            }}
            rows={2}
            placeholder={t.chatPlaceholder}
            aria-label={t.chatPlaceholder}
            className="max-h-32 min-h-[22px] flex-1 resize-none bg-transparent text-base leading-[1.4] text-ink-900 outline-none placeholder:text-chat-placeholder"
          />
          <button
            type="submit"
            disabled={!input.trim() || pending}
            aria-label={t.chatSend}
            title={t.chatSend}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${
              input.trim() && !pending
                ? 'border-ink-900 bg-ink-900 text-white'
                : 'border-chat-button bg-chat-button text-chat-placeholder'
            }`}
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
      </form>
    </>
  );
}

function Bubble({
  role,
  notice,
  children,
}: {
  role: 'user' | 'assistant';
  notice?: boolean;
  children: React.ReactNode;
}) {
  if (role === 'user') {
    return (
      <div className="ml-auto max-w-full rounded-lg border-r border-b border-chat-line/40 bg-parchment-100 px-2 py-1.5 text-base leading-[1.4] text-ink-900">
        {children}
      </div>
    );
  }
  return (
    <div
      className={`mr-auto max-w-[90%] rounded-[16px] rounded-bl-none bg-white px-4 py-4 text-base leading-[1.4] shadow-sm ${
        notice ? 'text-ink-500' : 'text-ink-900'
      }`}
    >
      {children}
    </div>
  );
}

// --- saved lists -------------------------------------------------------------------

function EmptyState({ text }: { text: string }) {
  return <p className="px-6 py-10 text-center text-[13px] leading-relaxed text-ink-500">{text}</p>;
}

/** Shows a vocabulary entry with the bookmark row layout. */
function vocabAsBookmark(entry: VocabEntry): Bookmark {
  const subtitle = [entry.pos, entry.ipa ? `/${entry.ipa}/` : null, entry.definitions[0]].filter(Boolean).join(' · ');
  return {
    id: entry.id,
    kind: 'word',
    title: entry.lemma,
    subtitle: subtitle || undefined,
    url: wiktionaryPageUrl(entry.lemma),
    createdAt: entry.createdAt,
  };
}

function BookmarkList({
  t,
  items,
  empty,
  savedIds,
  onToggleCardSave,
  onToggleSourceSave,
  onRemove = (id) => void removeBookmark(id),
}: {
  t: Translations;
  items: Bookmark[];
  empty: string;
  savedIds: Set<string>;
  onToggleCardSave: (card: GrammarCard) => void;
  onToggleSourceSave: (card: GrammarCard) => void;
  onRemove?: (id: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (items.length === 0) return <EmptyState text={empty} />;
  return (
    <ul className="flex-1 space-y-2 overflow-y-auto px-3.5 pb-4">
      {items.map((b) => (
        <li key={b.id}>
          {openId === b.id && b.card ? (
            <div onDoubleClick={() => setOpenId(null)}>
              <GrammarCardView
                card={b.card}
                t={t}
                saved={savedIds.has(b.id)}
                sourceSaved={!!b.card.source && savedIds.has(bookmarkId('resource', b.card.source.url))}
                onToggleSave={() => onToggleCardSave(b.card!)}
                onToggleSourceSave={() => onToggleSourceSave(b.card!)}
              />
            </div>
          ) : openId === b.id && b.kind === 'resource' && b.url ? (
            <SourcePreviewView
              url={b.url}
              t={t}
              saved={savedIds.has(b.id)}
              onToggleSave={() => onRemove(b.id)}
              onClose={() => setOpenId(null)}
            />
          ) : (
            <div className="flex items-start gap-2 rounded-xl border border-stone-border bg-white px-3 py-2.5 shadow-sm">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => {
                  // Grammar cards open in place; trusted study pages open as a preview (US-15).
                  if (b.card || (b.kind === 'resource' && b.url && isTrustedSourceUrl(b.url))) setOpenId(b.id);
                  else if (b.url) void browser.tabs.create({ url: b.url });
                }}
              >
                <div className="truncate text-[14px] font-semibold text-ink-900">{b.title}</div>
                {b.subtitle && <div className="mt-0.5 line-clamp-2 text-[12px] text-ink-500">{b.subtitle}</div>}
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-ink-400">
                  {b.kind === 'word' ? 'Wiktionary' : b.kind === 'grammar' ? 'grammar' : b.url?.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                </div>
              </button>
              <button
                type="button"
                onClick={() => onRemove(b.id)}
                className="rounded-md p-1 text-ink-400 hover:bg-parchment-200 hover:text-ink-900"
                aria-label={t.remove}
                title={t.remove}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function HistoryList({
  t,
  sessions,
  onOpen,
  onDelete,
}: {
  t: Translations;
  sessions: ChatSession[];
  onOpen: (session: ChatSession) => void;
  onDelete: (id: string) => void;
}) {
  if (sessions.length === 0) return <EmptyState text={t.emptyHistory} />;
  return (
    <ul className="flex-1 space-y-2 overflow-y-auto px-3.5 pb-4">
      {sessions.map((s) => {
        const title = s.context?.sentence ?? s.messages.find((m) => m.role === 'user')?.text ?? '…';
        return (
          <li key={s.id} className="flex items-start gap-2 rounded-xl border border-stone-border bg-white px-3 py-2.5 shadow-sm">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(s)}>
              <div className="line-clamp-2 text-[13px] text-ink-900">{title}</div>
              <div className="mt-0.5 text-[11px] text-ink-400">
                {new Date(s.updatedAt).toLocaleString()} · {s.messages.length}
              </div>
            </button>
            <button
              type="button"
              onClick={() => onDelete(s.id)}
              className="rounded-md p-1 text-ink-400 hover:bg-parchment-200 hover:text-ink-900"
              aria-label={t.remove}
              title={t.remove}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
