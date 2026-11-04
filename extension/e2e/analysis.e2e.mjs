// Grammar analysis of a sentence (US-17). The backend is replaced by a small server that
// answers /api/grammar/analyze and /api/grammar/rules like backend/app/api/routes/grammar.py.
import http from 'node:http';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { SHADOW, clickShadow, launch, servePages, setSettings, sleep } from './helpers.mjs';
import { fakeBackend, state } from './fake-backend.mjs';


/** A port nothing listens on. */
async function deadUrl() {
  const s = http.createServer();
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const port = s.address().port;
  await new Promise((r) => s.close(r));
  return `http://127.0.0.1:${port}`;
}

const cardText = (page) => page.evaluate(`${SHADOW}.querySelector('.tc-analysis-card')?.innerText ?? null`);

/** Texts of the page ranges highlighted as grammar (CSS Custom Highlight API). */
const highlighted = (page) =>
  page.evaluate(() => {
    const h = CSS.highlights.get('tc-grammar');
    return h ? [...h].map((r) => r.toString()) : [];
  });

describe('grammar analysis', () => {
  let ctx;
  let pages;
  let backend;

  before(async () => {
    ctx = await launch();
    pages = await servePages();
    backend = await fakeBackend();
    await setSettings(ctx.worker, { backendUrl: backend.url });
  });
  after(async () => {
    await ctx?.browser.close();
    pages?.close();
    backend?.close();
  });

  async function open(path) {
    const page = await ctx.browser.newPage();
    await page.goto(pages.url(path));
    await page.bringToFront();
    await page.mouse.click(2, 2); // the page must have focus for RUN_COMMAND
    await sleep(800);
    return page;
  }

  const command = (page, name) =>
    ctx.worker.evaluate(
      async (url, name) => {
        const [tab] = await chrome.tabs.query({ url });
        return chrome.tabs.sendMessage(tab.id, { type: 'RUN_COMMAND', payload: { command: name } }).catch((e) => String(e));
      },
      page.url(),
      name
    );

  /** Selects the whole second sentence of #text with the mouse-up the controller listens to. */
  async function selectSecondSentence(page) {
    await page.evaluate(() => {
      const node = document.querySelector('#text').firstChild;
      const i = node.data.indexOf('Nous');
      const range = document.createRange();
      range.setStart(node, i);
      range.setEnd(node, node.data.length);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
    });
    await sleep(200);
  }

  test('a selected sentence gets "Analyze grammar": structures, level, words highlighted in the card and the page', async () => {
    const page = await open('analysis.html');
    await selectSecondSentence(page);
    const title = await page.evaluate(`${SHADOW}.querySelector('.tc-lookup-btn')?.getAttribute('aria-label')`);
    assert.equal(title, 'Phân tích ngữ pháp');
    await clickShadow(page, '.tc-lookup-btn');
    await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-analysis-card .tc-structure')`, { timeout: 8000 });

    const text = await cardText(page);
    assert.match(text, /Passé composé \(avoir\/être \+ participe passé\)/);
    assert.match(text, /A2/);
    assert.match(text, /« avons parlé »/);
    const marks = await page.evaluate(`[...${SHADOW}.querySelectorAll('.tc-analysis-sentence mark')].map((m) => m.textContent)`);
    assert.deepEqual(marks, ['avons parlé']);
    assert.deepEqual(await highlighted(page), ['avons parlé']);

    const analyze = backend.requests.filter((r) => r.url === '/api/grammar/analyze');
    assert.equal(JSON.parse(analyze.at(-1).body).sentence, 'Nous avons parlé longtemps de nos vacances.');

    // Closing the card removes the page highlight.
    await page.keyboard.press('Escape');
    await sleep(100);
    assert.equal(await cardText(page), null);
    assert.deepEqual(await highlighted(page), []);
    await page.close();
  });

  test('the same sentence again comes from the cache', async () => {
    const page = await open('analysis.html');
    const before = backend.requests.filter((r) => r.url === '/api/grammar/analyze').length;
    await selectSecondSentence(page);
    await clickShadow(page, '.tc-lookup-btn');
    await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-analysis-card .tc-structure')`, { timeout: 8000 });
    assert.equal(backend.requests.filter((r) => r.url === '/api/grammar/analyze').length, before);
    await page.close();
  });

  test('shortcut with only a caret: the sentence around it, card focused, Tab inside, Esc gives focus back', async () => {
    const page = await open('analysis.html');
    // Caret inside "venu" (collapsed selection, as after a click in the text).
    await page.evaluate(() => {
      const node = document.querySelector('#text').firstChild;
      const i = node.data.indexOf('venu') + 2;
      getSelection().collapse(node, i);
    });
    await command(page, 'check-grammar');
    await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-analysis-card .tc-structure')`, { timeout: 8000 });
    const sentence = await page.evaluate(`${SHADOW}.querySelector('.tc-analysis-sentence').textContent`);
    assert.equal(sentence, 'Hier soir, mon ami est venu à la maison avec sa sœur.');
    assert.deepEqual(await highlighted(page), ['est venu']);
    assert.equal(await page.evaluate(`${SHADOW}.activeElement?.classList.contains('tc-analysis-card')`), true);

    // Tab reaches the structure (highlighting it) and stays in the card.
    const seen = new Set();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const cls = await page.evaluate(`${SHADOW}.activeElement?.closest('.tc-analysis-card') ? ${SHADOW}.activeElement.className : null`);
      assert.ok(cls, 'focus left the card');
      seen.add(cls);
    }
    assert.ok([...seen].some((c) => c.includes('tc-structure')), [...seen].join(', '));
    assert.ok([...seen].some((c) => c.includes('tc-analysis-ask')));

    await page.keyboard.press('Escape');
    await sleep(100);
    assert.equal(await cardText(page), null);
    const caret = await page.evaluate(() => {
      const s = getSelection();
      return { collapsed: s.isCollapsed, offset: s.anchorOffset, at: s.anchorNode.data.indexOf('venu') + 2 };
    });
    assert.equal(caret.collapsed, true);
    assert.equal(caret.offset, caret.at);
    await page.close();
  });

  test('shortcut without any selection or caret explains what to do', async () => {
    const page = await open('analysis.html');
    await page.evaluate(() => getSelection().removeAllRanges());
    await command(page, 'check-grammar');
    await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-analysis-card')`);
    assert.match(await cardText(page), /Bôi đen một câu tiếng Pháp/);
    await page.close();
  });

  test('backend not running: clear message with the command to start it, Retry works once it runs', async () => {
    await setSettings(ctx.worker, { backendUrl: await deadUrl() });
    const page = await open('analysis.html');
    await selectSecondSentence(page);
    await clickShadow(page, '.tc-lookup-btn');
    try {
      await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-analysis-card .tc-analysis-retry')`, { timeout: 8000 });
    } finally {
      if (!(await page.evaluate(`!!${SHADOW}.querySelector('.tc-analysis-retry')`))) await setSettings(ctx.worker, { backendUrl: backend.url });
    }
    const text = await cardText(page);
    assert.match(text, /Không kết nối được backend ngữ pháp ở http:\/\/127\.0\.0\.1:\d+/);
    assert.match(text, /uvicorn app\.main:app --port 8000/);
    assert.match(text, /Đổi địa chỉ backend/);

    await setSettings(ctx.worker, { backendUrl: backend.url });
    await clickShadow(page, '.tc-analysis-retry');
    await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-analysis-card .tc-structure')`, { timeout: 8000 });
    await page.close();
  });

  test('context menu "Analyze grammar" on a single word analyzes its sentence', async () => {
    const page = await open('analysis.html');
    await page.evaluate(() => {
      const node = document.querySelector('#text').firstChild;
      const i = node.data.indexOf('longtemps');
      const range = document.createRange();
      range.setStart(node, i);
      range.setEnd(node, i + 'longtemps'.length);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
    });
    const reply = await ctx.worker.evaluate(async (url) => {
      const [tab] = await chrome.tabs.query({ url });
      return chrome.tabs.sendMessage(tab.id, { type: 'CONTEXT_MENU_ANALYZE', payload: { text: 'longtemps' } });
    }, page.url());
    assert.equal(reply.handled, true);
    await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-analysis-card .tc-structure')`, { timeout: 8000 });
    assert.equal(await page.evaluate(`${SHADOW}.querySelector('.tc-analysis-sentence').textContent`), 'Nous avons parlé longtemps de nos vacances.');
    await page.close();
  });

  test('"Ask the assistant" in the card sends the sentence to the side panel', async () => {
    const page = await open('analysis.html');
    await selectSecondSentence(page);
    await clickShadow(page, '.tc-lookup-btn');
    await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-analysis-card .tc-structure')`, { timeout: 8000 });
    await clickShadow(page, '.tc-analysis-ask');
    await sleep(500);
    assert.equal(await cardText(page), null);
    const pending = await ctx.worker.evaluate(async () => Object.values(await chrome.storage.session.get(null)).find((v) => v && v.sentence));
    assert.equal(pending?.sentence, 'Nous avons parlé longtemps de nos vacances.');
    await page.close();
  });

  // --- grammar card of a structure (US-18) ---------------------------------------

  /** Opens the analysis of the second sentence from the keyboard (shortcut on the selection). */
  async function analysisFromKeyboard() {
    const page = await open('analysis.html');
    await page.evaluate(() => {
      const node = document.querySelector('#text').firstChild;
      const range = document.createRange();
      range.setStart(node, node.data.indexOf('Nous'));
      range.setEnd(node, node.data.length);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
    });
    await command(page, 'check-grammar');
    await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-analysis-card .tc-structure')`, { timeout: 8000 });
    return page;
  }

  const active = (page) => page.evaluate(`(() => { const a = ${SHADOW}.activeElement; return a ? a.className : null; })()`);

  test('grammar card of a structure the catalog does not have: says so, keeps the page example', async () => {
    state.missingRule = true;
    try {
      const page = await analysisFromKeyboard();
      await clickShadow(page, '.tc-structure');
      await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-rule-card') && !${SHADOW}.querySelector('.tc-rule-card .tc-spinner')`, { timeout: 8000 });
      const text = await page.evaluate(`${SHADOW}.querySelector('.tc-rule-card').innerText`);
      assert.match(text, /Chưa có thẻ ngữ pháp cho cấu trúc này/);
      assert.match(text, /Nous avons parlé longtemps de nos vacances\./);
      await page.close();
    } finally {
      state.missingRule = false;
    }
  });

  test('grammar card: formula, explanation, examples (page sentence first), more examples, read more, ☆, back, Esc', async () => {
    const page = await analysisFromKeyboard();
    // Keyboard: Tab to the structure, Enter opens its card; focus follows.
    for (let i = 0; i < 6 && !String(await active(page)).includes('tc-structure'); i++) await page.keyboard.press('Tab');
    assert.match(String(await active(page)), /tc-structure/);
    await page.keyboard.press('Enter');
    await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-rule-card .tc-rule-form')`, { timeout: 8000 });
    assert.ok(await page.evaluate(`!!${SHADOW}.activeElement?.closest('.tc-rule-card')`), 'focus moved into the grammar card');

    const card = () => page.evaluate(`${SHADOW}.querySelector('.tc-rule-card').innerText`);
    const text = await card();
    assert.match(text, /grammar\/passe_compose/);
    assert.match(text, /Passé composé \(avoir\/être \+ participe passé\)/);
    assert.match(text, /A2 · Temps du verbe/);
    assert.match(text, /Công thức:\s*Sujet \+ auxiliaire/);
    assert.match(text, /Diễn tả một hành động đã hoàn tất trong quá khứ\./); // explanation in Vietnamese (uiLanguage vi)
    assert.match(text, /avoir : ai, as, a, avons, avez, ont/);
    assert.match(text, /La plupart des verbes/);

    // Examples: the page sentence first (structure underlined), then 3 from the catalog.
    const examples = () => page.evaluate(`[...${SHADOW}.querySelectorAll('.tc-rule-examples li .tc-rule-example-text')].map((e) => e.textContent)`);
    let list = await examples();
    assert.equal(list.length, 4);
    assert.equal(list[0], 'Nous avons parlé longtemps de nos vacances.');
    assert.deepEqual(await page.evaluate(`[...${SHADOW}.querySelectorAll('.tc-rule-context mark')].map((m) => m.textContent)`), ['avons parlé']);
    // Page highlight follows the structure of the card.
    assert.deepEqual(await page.evaluate(() => [...(CSS.highlights.get('tc-grammar') ?? [])].map((r) => r.toString())), ['avons parlé']);

    // The card body scrolls: bring the button into view before clicking it.
    await page.evaluate(`${SHADOW}.querySelector('.tc-rule-more-btn').scrollIntoView({ block: 'nearest' })`);
    await clickShadow(page, '.tc-rule-more-btn');
    list = await examples();
    assert.equal(list.length, 6);
    assert.equal(await page.evaluate(`!!${SHADOW}.querySelector('.tc-rule-more-btn')`), false, 'catalog used up');

    const link = await page.evaluate(`${SHADOW}.querySelector('.tc-rule-link').href`);
    assert.equal(link, 'https://fr.wiktionary.org/wiki/pass%C3%A9_compos%C3%A9');
    assert.match(await page.evaluate(`${SHADOW}.querySelector('.tc-rule-card').textContent`), /Đọc thêm/);

    // ☆ saves the card to the bookmarks (side panel list).
    await clickShadow(page, '.tc-rule-card .tc-card-star');
    await sleep(300);
    const bookmarks = await ctx.worker.evaluate(async () => (await chrome.storage.local.get('bookmarks')).bookmarks);
    const saved = bookmarks.find((b) => b.id === 'grammar:passe_compose');
    assert.equal(saved?.card.title, 'Passé composé (avoir/être + participe passé)');
    assert.equal(await page.evaluate(`${SHADOW}.querySelector('.tc-rule-card .tc-card-star').getAttribute('aria-pressed')`), 'true');

    // Back: the analysis again, focus on the structure it came from.
    await page.evaluate(`${SHADOW}.querySelector('.tc-rule-back').focus()`);
    await page.keyboard.press('Enter');
    await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-analysis-card .tc-structure') && !${SHADOW}.querySelector('.tc-rule-card')`);
    assert.match(String(await active(page)), /tc-structure/);

    // Into the card again (cached), then Esc closes everything and gives the selection back.
    await page.keyboard.press('Enter');
    await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-rule-card .tc-rule-form')`);
    await page.keyboard.press('Escape');
    await sleep(100);
    assert.equal(await page.evaluate(`!!${SHADOW}.querySelector('.tc-lookup-card')`), false);
    assert.match(await page.evaluate(() => getSelection().toString()), /Nous avons parlé/);
    assert.deepEqual(await page.evaluate(() => [...(CSS.highlights.get('tc-grammar') ?? [])].length), 0);
    await page.close();
  });

  // --- write a sentence (US-19) --------------------------------------------------

  test('write a sentence in the grammar card: Enter sends, errors underlined, Try again keeps it, Keep reading closes', async () => {
    const page = await analysisFromKeyboard();
    for (let i = 0; i < 6 && !String(await active(page)).includes('tc-structure'); i++) await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-rule-card .tc-rule-practice')`, { timeout: 8000 });
    await page.evaluate(`${SHADOW}.querySelector('.tc-rule-practice').focus()`);
    await page.keyboard.press('Enter');
    await page.waitForFunction(`${SHADOW}.activeElement?.classList.contains('tc-practice-input')`);
    assert.match(await page.evaluate(`${SHADOW}.querySelector('.tc-practice-input').placeholder`), /Passé composé/);

    // Typing in the field does not trigger page shortcuts; Enter sends.
    await page.keyboard.type('Je avons mangé une pomme.');
    await page.keyboard.press('Enter');
    await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-practice-verdict')`, { timeout: 8000 });
    const result = () => page.evaluate(`${SHADOW}.querySelector('.tc-practice-result').textContent`);
    let text = await result();
    assert.match(text, /Có dùng cấu trúc, nhưng còn lỗi/);
    assert.match(text, /Bản sửa: J'ai mangé une pomme\./);
    assert.match(text, /« avons » → ai/);
    assert.match(text, /chưa chia đúng/); // mock feedback: explained from the structure check
    assert.match(text, /Chưa có phản hồi AI/);
    const underline = await page.evaluate(`(() => { const e = ${SHADOW}.querySelector('.tc-practice-err'); return { text: e.textContent, color: getComputedStyle(e).textDecorationColor }; })()`);
    assert.equal(underline.text, 'avons');
    assert.equal(underline.color, 'rgb(133, 77, 14)'); // grammar colour of the grammar check underlines

    // Try again: same sentence, editable, focused.
    assert.match(String(await active(page)), /tc-practice-retry/);
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(`${SHADOW}.querySelector('.tc-practice-input').value`), 'Je avons mangé une pomme.');
    assert.match(String(await active(page)), /tc-practice-input/);
    await page.evaluate(`${SHADOW}.querySelector('.tc-practice-input').select()`);
    await page.keyboard.type("J'ai mangé une pomme.");
    await page.keyboard.press('Enter');
    await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-practice-verdict.tc-ok')`, { timeout: 8000 });
    text = await result();
    assert.match(text, /dùng đúng cấu trúc/);

    // Keep reading: the card closes, the page selection comes back.
    await page.evaluate(`${SHADOW}.querySelector('.tc-practice-done').focus()`);
    await page.keyboard.press('Enter');
    await sleep(100);
    assert.equal(await page.evaluate(`!!${SHADOW}.querySelector('.tc-lookup-card')`), false);
    assert.match(await page.evaluate(() => getSelection().toString()), /Nous avons parlé/);

    // Both attempts are kept with their rule and page.
    const history = await ctx.worker.evaluate(async () => (await chrome.storage.local.get('practiceHistory')).practiceHistory);
    assert.equal(history.length, 2);
    assert.equal(history[0].sentence, "J'ai mangé une pomme.");
    assert.equal(history[0].isCorrect, true);
    assert.equal(history[1].isCorrect, false);
    assert.equal(history[0].ruleId, 'passe_compose');
    assert.equal(history[0].sourceUrl, page.url());
    assert.equal(history[0].sourceTitle, 'Analyse');
    await page.close();
  });

  test('popup "Practice" tab: history newest first, filter by structure', async () => {
    // One more attempt on another structure, written straight into the history.
    await ctx.worker.evaluate(async () => {
      const h = (await chrome.storage.local.get('practiceHistory')).practiceHistory;
      h.unshift({ ...h[0], id: 'neg-1', ruleId: 'negation', ruleName: 'Négation', sentence: 'Je ne mange pas.', createdAt: Date.now() });
      await chrome.storage.local.set({ practiceHistory: h });
    });
    const page = await ctx.browser.newPage();
    await page.goto(ctx.extUrl('popup.html'));
    await page.waitForSelector('[role=tab]');
    const tabs = await page.$$('[role=tab]');
    await tabs[3].click();
    await page.waitForSelector('[data-testid=popup-practice] li');
    const sentences = () => page.$$eval('[data-testid=popup-practice] li', (lis) => lis.map((li) => li.querySelector('.text-xs').textContent));
    assert.deepEqual(await sentences(), ['Je ne mange pas.', "J'ai mangé une pomme.", 'Je avons mangé une pomme.']);
    const body = await page.$eval('[data-testid=popup-practice]', (e) => e.textContent);
    assert.match(body, /Đúng cấu trúc · Passé composé/);
    assert.match(body, /→ J'ai mangé une pomme\./);
    assert.match(body, /Khi đọc: Analyse/);
    assert.doesNotMatch(body, /điểm|score/i);
    await page.select('[data-testid=popup-practice] select', 'negation');
    assert.deepEqual(await sentences(), ['Je ne mange pas.']);
    await page.close();
  });

  test('options: backend address and connection test', async () => {
    const page = await ctx.browser.newPage();
    await page.goto(ctx.extUrl('options.html#settings'));
    await page.waitForSelector('#backend-url');
    assert.equal(await page.$eval('#backend-url', (i) => i.value), backend.url);
    await page.$eval('#backend-url', (i) => i.select());
    await page.keyboard.type(`${backend.url.replace('http://', '')}/api/`);
    await page.keyboard.press('Enter');
    await page
      .waitForFunction(() => document.body.textContent.includes('Đã kết nối'), { timeout: 8000 })
      .catch(async (e) => {
        const status = await page.evaluate(() => [document.querySelector('#backend-url').value, document.querySelector('[role=status]')?.textContent]);
        throw new Error(`${e.message}: ${JSON.stringify(status)}`);
      });
    assert.match(await page.evaluate(() => document.body.textContent), /backend có 2 cấu trúc/);
    // Saved normalized.
    assert.equal(await page.$eval('#backend-url', (i) => i.value), backend.url);
    const saved = await ctx.worker.evaluate(async () => (await chrome.storage.sync.get('settings')).settings.backendUrl);
    assert.equal(saved, backend.url);
    await page.close();
  });
});
