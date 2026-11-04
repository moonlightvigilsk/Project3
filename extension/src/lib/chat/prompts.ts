import type { UILanguage } from '@/types';
import type { ChatAction, ChatContext, GrammarCard } from './types';

const LANGUAGE_NAMES: Record<UILanguage, string> = {
  vi: 'Vietnamese',
  en: 'English',
  fr: 'French',
};

/**
 * Sites the grammar card may link to. The model is asked to pick one of them;
 * any other URL is replaced by a search link so the card never shows an invented page.
 */
export const TRUSTED_SOURCE_HOSTS = [
  'lawlessfrench.com',
  'francaisfacile.com',
  'bonjourdefrance.com',
  'lepointdufle.net',
  'fr.wiktionary.org',
  'en.wiktionary.org',
  'cnrtl.fr',
  'larousse.fr',
  'bescherelle.com',
  'leconjugueur.lefigaro.fr',
  'tv5monde.com',
];

export function chatSystemPrompt(uiLanguage: UILanguage, context: ChatContext | null): string {
  const lang = LANGUAGE_NAMES[uiLanguage];
  const contextBlock = context
    ? `\nThe learner is reading this sentence on "${context.title}" (${context.url}):\n"""${context.sentence}"""\nWhen they say "this sentence" or "this grammar concept", they mean the main grammar construct used in it.`
    : '';
  return `You are a calm, precise French grammar tutor inside a browser extension.
The learner reads authentic French texts and wants to understand and practise the grammar they meet.
Write explanations in ${lang}. Write every example sentence in French, followed by a short ${lang} translation in parentheses.
Be brief: short paragraphs or bullet lists, no greetings, no emojis, no scores or gamification.
When the learner writes a French sentence for practice, say whether it uses the target construct, list each error with its correction, then give the corrected sentence.${contextBlock}`;
}

/** Text sent as the learner's message when a quick action is clicked. */
export function actionPrompt(action: ChatAction, concept: string | null): string {
  const target = concept ? `"${concept}"` : 'the main grammar construct of the sentence I am reading';
  switch (action) {
    case 'examples':
      return `Give 4 short example sentences that use ${target}. Name the construct first.`;
    case 'practice':
      return `Let me practise ${target}: name the construct, give one short task asking me to write a French sentence with it, then wait for my answer.`;
    case 'explain':
      return `Give a short explanation of ${target} and a study resource.`;
  }
}

export function explainCardInstruction(uiLanguage: UILanguage): string {
  const lang = LANGUAGE_NAMES[uiLanguage];
  return `Answer ONLY with JSON, no markdown fence, in this exact shape:
{
  "id": "snake_case_slug_of_the_construct, e.g. futur_proche",
  "title": "French name of the construct, e.g. Futur proche",
  "form": "formula, e.g. aller (présent) + infinitif",
  "patterns": ["affirmative pattern", "negative pattern", "question pattern"],
  "uses": ["use 1 in ${lang}", "use 2 in ${lang}"],
  "examples": ["French example (${lang} translation)", "French example (${lang} translation)"],
  "source": { "title": "page title", "url": "https://..." }
}
"patterns": 2-4 items. "uses": 2-4 items. "examples": 2-3 items.
"source.url" must be a real page on one of: ${TRUSTED_SOURCE_HOSTS.join(', ')}. Use null if you are not sure such a page exists.`;
}

function stringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, max);
}

function slug(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'grammar'
  );
}

export function isTrustedSourceUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.replace(/^www\./, '');
    return TRUSTED_SOURCE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** Search page used when the model gives no trusted source. */
export function fallbackSourceUrl(title: string): string {
  return `https://www.lawlessfrench.com/?s=${encodeURIComponent(title)}`;
}

/** Parses and sanitizes the model's JSON answer for the "explain" action. Returns null when unusable. */
export function parseGrammarCard(responseText: string): GrammarCard | null {
  const match = responseText.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) return null;

  let source: GrammarCard['source'] = null;
  const rawSource = raw.source as { title?: unknown; url?: unknown } | null | undefined;
  if (rawSource && typeof rawSource.url === 'string' && isTrustedSourceUrl(rawSource.url)) {
    source = {
      url: rawSource.url,
      title: typeof rawSource.title === 'string' && rawSource.title.trim() ? rawSource.title.trim() : rawSource.url,
    };
  } else {
    source = { url: fallbackSourceUrl(title), title: `lawlessfrench.com — ${title}` };
  }

  return {
    id: slug(typeof raw.id === 'string' && raw.id.trim() ? raw.id : title),
    title,
    form: typeof raw.form === 'string' ? raw.form.trim() : '',
    patterns: stringList(raw.patterns, 4),
    uses: stringList(raw.uses, 4),
    examples: stringList(raw.examples, 3),
    source,
  };
}
