import type { UILanguage } from '@/types';

/** Quick actions offered at the top of the chat panel. */
export type ChatAction = 'examples' | 'practice' | 'explain';

/** Sentence the learner sent from the page ("Ask about this sentence"). */
export interface ChatContext {
  sentence: string;
  url: string;
  title: string;
}

/** Short grammar sheet: rendered as a card in the chat (docs/design/grammar-card-source-preview.png). */
export interface GrammarCard {
  /** Slug shown in the card's top bar: "grammar/futur_proche". */
  id: string;
  title: string;
  form: string;
  patterns: string[];
  uses: string[];
  examples: string[];
  source: { title: string; url: string } | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  card?: GrammarCard;
  /** Assistant notices (AI off, missing key, errors) are shown muted and not sent back to the model. */
  notice?: boolean;
  createdAt: number;
}

export interface ChatSession {
  id: string;
  context: ChatContext | null;
  messages: ChatMessage[];
  updatedAt: number;
}

export interface ChatRequest {
  /** Conversation so far, oldest first, notices excluded. */
  messages: { role: 'user' | 'assistant'; content: string }[];
  context: ChatContext | null;
  action?: ChatAction;
  uiLanguage: UILanguage;
}

export type ChatReply =
  | { status: 'ok'; text: string; card?: GrammarCard }
  | { status: 'ai_disabled' }
  | { status: 'no_api_key'; provider: string }
  | { status: 'error'; message: string };
