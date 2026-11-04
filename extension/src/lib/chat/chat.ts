import { generateText } from 'ai';
import { getModel } from '@/lib/ai/providers';
import type { AIProvider } from '@/types';
import { chatSystemPrompt, explainCardInstruction, parseGrammarCard } from './prompts';
import type { ChatReply, ChatRequest } from './types';

/** Keeps the request small: only the last turns matter for a short tutoring exchange. */
const MAX_TURNS = 12;

export interface ChatModelOptions {
  provider: AIProvider;
  model: string;
  apiKey: string;
}

/** Runs one chat turn against the configured AI provider (background script only). */
export async function runChat(request: ChatRequest, options: ChatModelOptions): Promise<ChatReply> {
  const model = getModel(options.provider, options.model, options.apiKey);
  const explain = request.action === 'explain';
  const system = explain
    ? `${chatSystemPrompt(request.uiLanguage, request.context)}\n\n${explainCardInstruction(request.uiLanguage)}`
    : chatSystemPrompt(request.uiLanguage, request.context);

  const { text } = await generateText({
    model,
    system,
    messages: request.messages.slice(-MAX_TURNS),
    temperature: explain ? 0.2 : 0.5,
  });

  if (explain) {
    const card = parseGrammarCard(text);
    if (card) return { status: 'ok', text: '', card };
  }
  return { status: 'ok', text: text.trim() };
}
