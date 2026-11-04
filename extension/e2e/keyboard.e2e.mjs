// Keyboard use (US-16): shortcuts reach the focused page, cards take focus, Tab stays in
// them, Esc closes and gives focus back; options list the shortcuts; side panel Alt+keys.
// Browser shortcuts cannot be pressed from puppeteer, so the tests send the background's
// RUN_COMMAND message to the tab, like the command listener does.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { SHADOW, launch, seedLookup, selectWord, servePages, sleep } from './helpers.mjs';

const AMI = {
  word: 'ami',
  lemma: 'ami',
  ipa: 'a.mi',
  formOf: null,
  entries: [
    { pos: 'nom', isInflection: false, gender: 'm', ipa: 'a.mi', senses: [{ definition: 'Personne avec qui l’on est lié d’amitié.' }] },
  ],
  english: [],
  audio: null,
  sourceUrl: 'https://fr.wiktionary.org/wiki/ami',
  parserVersion: 2,
};

/** Description of the focused element, following our shadow root. */
const focused = (page) =>
  page.evaluate(() => {
    const host = document.querySelector('#textchecker-overlay');
    const inner = host?.shadowRoot?.activeElement;
    if (document.activeElement === host && inner) {
      const box = inner.closest('.tc-lookup-card, .tc-popover, .tc-panel');
      return { inOverlay: true, box: box?.className ?? null, tag: inner.tagName, cls: inner.className, action: inner.dataset?.action ?? null };
    }
    const a = document.activeElement;
    return { inOverlay: false, id: a?.id ?? null, tag: a?.tagName ?? null };
  });

describe('keyboard', () => {
  let ctx;
  let pages;

  before(async () => {
    ctx = await launch();
    pages = await servePages();
    await seedLookup(ctx.worker, 'ami', AMI);
  });
  after(async () => {
    await ctx?.browser.close();
    pages?.close();
  });

  async function open(path) {
    const page = await ctx.browser.newPage();
    await page.goto(pages.url(path));
    await page.bringToFront();
    await sleep(800);
    return page;
  }

  /** What the background does on a shortcut: RUN_COMMAND to the page's tab. */
  const command = (page, name) =>
    ctx.worker.evaluate(
      async (url, name) => {
        const [tab] = await chrome.tabs.query({ url });
        return chrome.tabs.sendMessage(tab.id, { type: 'RUN_COMMAND', payload: { command: name } }).catch((e) => String(e));
      },
      page.url(),
      name
    );

  test('lookup shortcut: the card takes focus, Tab stays inside, Esc gives focus and selection back', async () => {
    const page = await open('reading.html');
    await selectWord(page, '#text', 'ami');
    await command(page, 'lookup-selection');
    await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-lookup-card') && !${SHADOW}.querySelector('.tc-lookup-card .tc-spinner')`, { timeout: 10000 });
    let f = await focused(page);
    assert.equal(f.inOverlay, true);
    assert.match(f.cls, /tc-lookup-card/);

    // Tab goes through the card's controls and wraps around without leaving it.
    const seen = new Set();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      f = await focused(page);
      assert.equal(f.inOverlay, true, 'focus left the card');
      assert.match(f.box ?? '', /tc-lookup-card/);
      seen.add(`${f.tag}.${f.cls}`);
    }
    assert.ok(seen.size >= 3, `expected several controls, got ${[...seen].join(', ')}`);
    await page.keyboard.down('Shift');
    await page.keyboard.press('Tab');
    await page.keyboard.up('Shift');
    assert.equal((await focused(page)).inOverlay, true);

    await page.keyboard.press('Escape');
    await sleep(100);
    assert.equal(await page.evaluate(`!!${SHADOW}.querySelector('.tc-lookup-card')`), false);
    assert.equal((await focused(page)).inOverlay, false);
    assert.equal(await page.evaluate(() => getSelection().toString()), 'ami');
    await page.close();
  });

  test('lookup shortcut without a selection explains what to do', async () => {
    const page = await open('reading.html');
    await page.mouse.click(2, 2);
    await command(page, 'lookup-selection');
    await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-lookup-card')`);
    const text = await page.evaluate(`${SHADOW}.querySelector('.tc-lookup-card').innerText`);
    assert.match(text, /Bôi đen một từ/);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(`!!${SHADOW}.querySelector('.tc-lookup-card')`), false);
    await page.close();
  });

  test('grammar shortcut in a text field: error at the caret, next error, Esc back to the caret, Enter applies', async () => {
    const page = await open('editors.html');
    await page.click('#textarea');
    await page.keyboard.type('Tu as fais une remarque. Demain nous allons mangé ensemble.', { delay: 2 });
    await sleep(1200);
    // Caret inside "mangé": the second error opens first.
    await page.evaluate(() => {
      const ta = document.querySelector('#textarea');
      const i = ta.value.indexOf('mangé') + 2;
      ta.setSelectionRange(i, i);
    });
    await command(page, 'check-grammar');
    await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-popover')`, { timeout: 8000 });
    let f = await focused(page);
    assert.equal(f.action, 'apply');
    assert.match(await page.evaluate(`${SHADOW}.querySelector('.tc-popover').innerText`), /manger/);

    // Tab cycles through the popover's buttons only.
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      f = await focused(page);
      assert.equal(f.inOverlay, true);
      assert.match(f.box ?? '', /tc-popover/);
    }

    // Pressing the shortcut again: next error (wraps to the first one).
    await command(page, 'check-grammar');
    await sleep(150);
    assert.match(await page.evaluate(`${SHADOW}.querySelector('.tc-popover').innerText`), /fait/);
    assert.equal((await focused(page)).action, 'apply');

    // Esc: popover closed, focus back in the textarea with the caret where it was.
    await page.keyboard.press('Escape');
    await sleep(100);
    assert.equal(await page.evaluate(`!!${SHADOW}.querySelector('.tc-popover')`), false);
    f = await focused(page);
    assert.equal(f.id, 'textarea');
    const caret = await page.evaluate(() => {
      const ta = document.querySelector('#textarea');
      return [ta.selectionStart, ta.value.indexOf('mangé') + 2];
    });
    assert.equal(caret[0], caret[1]);

    // Enter on "Apply" fixes the error and returns to the field.
    await command(page, 'check-grammar');
    await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-popover')`, { timeout: 8000 });
    await page.keyboard.press('Enter');
    await sleep(600);
    assert.match(await page.$eval('#textarea', (t) => t.value), /allons manger ensemble/);
    assert.equal((await focused(page)).id, 'textarea');
    await page.close();
  });

  test('Esc closes a popover opened with the mouse', async () => {
    const page = await open('editors.html');
    await page.click('#input');
    await page.keyboard.type('Tu as fais une remarque.', { delay: 5 });
    await page.waitForFunction(`!!document.querySelector('#textchecker-overlay')?.shadowRoot?.querySelector('.tc-underline')`, { timeout: 8000, polling: 100 });
    const p = await page.evaluate(`(() => { const r = ${SHADOW}.querySelector('.tc-underline').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    await page.mouse.click(p.x, p.y);
    await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-popover')`);
    await page.keyboard.press('Escape');
    await sleep(100);
    assert.equal(await page.evaluate(`!!${SHADOW}.querySelector('.tc-popover')`), false);
    assert.equal((await focused(page)).id, 'input');
    await page.close();
  });

  test('grammar shortcut on a page selection opens the grammar analysis with focus (US-17)', async () => {
    const page = await open('reading.html');
    await page.evaluate(() => {
      const p = document.querySelector('#text');
      const range = document.createRange();
      range.selectNodeContents(p);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
    });
    await command(page, 'check-grammar');
    await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-analysis-card')`);
    const f = await focused(page);
    assert.equal(f.inOverlay, true);
    assert.match(f.cls, /tc-analysis-card/);
    await page.keyboard.press('Escape');
    await sleep(100);
    assert.equal((await focused(page)).inOverlay, false);
    assert.equal(await page.evaluate(`!!${SHADOW}.querySelector('.tc-analysis-card')`), false);
    assert.match(await page.evaluate(() => getSelection().toString()), /Nous avons parlé/);
    await page.close();
  });

  test('assistant shortcut returns the selected sentence', async () => {
    const page = await open('reading.html');
    await selectWord(page, '#text', 'ami');
    const reply = await command(page, 'open-assistant');
    assert.equal(reply.handled, true);
    assert.equal(reply.context.sentence, 'Hier, mon ami est venu à la maison.');
    await page.close();
  });

  test('options list the shortcuts with their keys', async () => {
    const page = await ctx.browser.newPage();
    await page.goto(ctx.extUrl('options.html#settings'));
    await page.waitForFunction(() => document.body.textContent.includes('Phím tắt'));
    const text = await page.evaluate(() => document.body.textContent);
    for (const key of ['Alt+Shift+D', 'Alt+Shift+G', 'Alt+Shift+K', 'Alt+Shift+V']) assert.ok(text.includes(key), key);
    assert.match(text, /Đổi phím tắt/);
    await page.close();
  });

  test('side panel: Alt+letter opens menu views, Esc on the menu returns focus to its button', async () => {
    const page = await ctx.browser.newPage();
    await page.goto(ctx.extUrl('sidepanel.html'));
    await sleep(400);
    const title = () => page.$eval('header button[aria-haspopup=menu]', (b) => b.textContent.trim());
    await page.keyboard.down('Alt');
    await page.keyboard.press('KeyH');
    await page.keyboard.up('Alt');
    await sleep(100);
    assert.match(await title(), /Lịch sử/);
    await page.keyboard.press('Escape'); // back to the chat
    await sleep(100);
    assert.match(await title(), /Trò chuyện|Chat/);

    await page.click('header button[aria-haspopup=menu]');
    await page.waitForSelector('[role=menuitem]');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('role')), 'menuitem');
    const hint = await page.$eval('[role=menuitem] kbd', (k) => k.textContent);
    assert.match(hint, /Alt\+B|⌥B/);
    await page.keyboard.press('Escape');
    await sleep(100);
    assert.equal(await page.$('[role=menu]'), null);
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-haspopup')), 'menu');

    await page.keyboard.press('/');
    await sleep(100);
    assert.equal(await page.evaluate(() => document.activeElement.tagName), 'TEXTAREA');
    await page.close();
  });
});
