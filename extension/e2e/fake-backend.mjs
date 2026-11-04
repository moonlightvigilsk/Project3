// Fake grammar backend shared by the e2e tests (US-17/18/19) and the store screenshots
// (US-14). Answers like backend/app/api/routes/grammar.py and practice.py with the mock LLM.
import http from 'node:http';

export const RULES = [
  { id: 'passe_compose', name: 'Passé composé (avoir/être + participe passé)', level: 'A2' },
  { id: 'negation', name: 'Négation (ne ... pas / jamais / rien / plus)', level: 'A1-A2' },
];

/** GET /api/grammar/rules/passe_compose, shaped like the built-in catalog (US-18). */
export const PASSE_COMPOSE = {
  id: 'passe_compose',
  name: 'Passé composé (avoir/être + participe passé)',
  category: 'Temps du verbe',
  level: 'A2',
  formula: 'Sujet + auxiliaire (avoir / être au présent) + participe passé',
  description: 'Exprime une action passée, achevée et ponctuelle dans le temps.',
  description_vi: 'Diễn tả một hành động đã hoàn tất trong quá khứ.',
  description_en: 'Expresses a completed action in the past.',
  key_points: ["La plupart des verbes utilisent l'auxiliaire 'avoir'."],
  conjugation_table: { avoir: 'ai, as, a, avons, avez, ont', être: 'suis, es, est, sommes, êtes, sont' },
  examples: [
    "J'ai terminé la lecture de ce livre hier soir.",
    'Elle est allée à la bibliothèque ce matin.',
    'Nous avons beaucoup apprécié cette histoire.',
    'Ils sont partis avant le coucher du soleil.',
    'Tu as fini tes devoirs.',
  ],
  examples_correct: [],
  links: [{ title: 'Wiktionnaire : passé composé', url: 'https://fr.wiktionary.org/wiki/pass%C3%A9_compos%C3%A9' }],
};

/**
 * POST /api/practice/submit like backend/app/api/routes/practice.py with the mock LLM:
 * "Je avons ..." -> conjugation error, no "avons/ai/est" -> structure missing, else correct.
 */
function gradePractice({ user_sentence: s, target_rule_id }) {
  const base = { score: 0, diff_tokens: [], llm_unavailable: false, llm_provider: 'mock', created_at: null };
  const check = { target_rule_id, target_rule_name: 'Passé composé', pattern_matched: true, auxiliary_correct: true, main_verb_infinitive: true };
  if (/^Je avons\b/.test(s)) {
    return {
      ...base,
      is_correct: false,
      uses_target_construct: true,
      status: 'minor_issues',
      errors: [{ span: 'avons', type: 'conjugation', explanation_vi: "Trợ động từ 'avoir' chia sai với 'je'.", suggestion: 'ai' }],
      corrected_sentence: s.replace(/^Je avons/, "J'ai"),
      short_comment: 'Cần chia lại trợ động từ.',
      rule_check: check,
    };
  }
  if (!/\b(avons|ai|est|ont)\b/.test(s)) {
    return {
      ...base,
      is_correct: false,
      uses_target_construct: false,
      status: 'incorrect',
      errors: [{ span: s, type: 'missing_construct', explanation_vi: 'Không tìm thấy cấu trúc.', suggestion: 'Passé composé' }],
      corrected_sentence: null,
      short_comment: 'Câu chưa sử dụng cấu trúc Passé composé.',
      rule_check: { ...check, pattern_matched: false },
    };
  }
  return { ...base, is_correct: true, uses_target_construct: true, status: 'correct', errors: [], corrected_sentence: s, short_comment: 'Xuất sắc!', rule_check: check };
}

/** Switches of the fake backend. */
export const state = { missingRule: false };

/** Fake grammar backend: passé composé on "avons parlé" / "est venu", counts requests. */
export async function fakeBackend() {
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      requests.push({ method: req.method, url: req.url, origin: req.headers.origin ?? null, body });
      res.setHeader('content-type', 'application/json');
      if (req.url === '/api/grammar/rules') return res.end(JSON.stringify(RULES));
      if (req.url === '/api/grammar/rules/passe_compose' && !state.missingRule) return res.end(JSON.stringify(PASSE_COMPOSE));
      if (req.url === '/api/practice/submit' && req.method === 'POST') return res.end(JSON.stringify(gradePractice(JSON.parse(body))));
      if (req.url === '/api/grammar/analyze' && req.method === 'POST') {
        const { sentence } = JSON.parse(body);
        const matches = [];
        for (const text of ['avons parlé', 'est venu', 'avons visité']) {
          const i = sentence.indexOf(text);
          if (i >= 0) matches.push({ rule_id: 'passe_compose', rule_name: 'Passé composé', matched_text: text, start_char: i, end_char: i + text.length, matched_token_indices: [] });
        }
        // Negation "ne/n' ... pas" (used by the store screenshots).
        const neg = /\bn(?:e |')\S+ pas\b/.exec(sentence);
        if (neg) matches.push({ rule_id: 'negation', rule_name: 'Négation', matched_text: neg[0], start_char: neg.index, end_char: neg.index + neg[0].length, matched_token_indices: [] });
        return res.end(JSON.stringify({ text: sentence, tokens: [], matches, matched_rule_ids: matches.length ? ['passe_compose'] : [] }));
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ detail: 'Not Found' }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}`, requests, close: () => server.close() };
}
