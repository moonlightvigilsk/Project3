// Grammar check: type an error → underline → Apply (popover or panel), in an input, a
// textarea, a multi-paragraph contenteditable, the manual test page and Lexical.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyFromPanel,
  applyFromPopover,
  fieldText,
  isUnderlined,
  launch,
  servePages,
  sleep,
  underlines,
  waitForUnderlines,
  wordRect,
} from './helpers.mjs';

describe('grammar check', () => {
  let ctx;
  let pages;

  before(async () => {
    ctx = await launch();
    pages = await servePages();
  });
  after(async () => {
    await ctx?.browser.close();
    pages?.close();
  });

  async function open(path) {
    const page = await ctx.browser.newPage();
    await page.goto(pages.url(path));
    await sleep(800); // content script ready (document_idle)
    return page;
  }

  test('input: error at the start of a sentence, Apply from the popover keeps the capital', async () => {
    const page = await open('editors.html');
    await page.click('#input');
    await page.keyboard.type('Tu as fais une remarque.', { delay: 5 });
    await waitForUnderlines(page, 1);
    // Text in an <input> is not in text nodes: the only underline is clicked.
    const popover = await applyFromPopover(page, '#input', null);
    assert.match(popover, /Tu as fait/);
    await sleep(600);
    assert.equal(await fieldText(page, '#input'), 'Tu as fait une remarque.');
    await page.close();
  });

  test('textarea: error on the second line, Apply from the suggestion panel', async () => {
    const page = await open('editors.html');
    await page.click('#textarea');
    await page.keyboard.type('Première ligne.', { delay: 5 });
    await page.keyboard.press('Enter');
    await page.keyboard.type('Demain nous allons mangé ensemble.', { delay: 5 });
    await waitForUnderlines(page, 1);
    const card = await applyFromPanel(page);
    assert.match(card, /manger/);
    await sleep(600);
    assert.equal(await fieldText(page, '#textarea'), 'Première ligne.\nDemain nous allons manger ensemble.');
  });

  test('contenteditable with paragraphs: underlines under the right words, Apply, the rest stays aligned', async () => {
    const page = await open('editors.html');
    await page.click('#rich');
    await page.evaluate(() => {
      const p = document.getElementById('last');
      getSelection().collapse(p, 0);
    });
    await page.keyboard.type('Hier tu as fais une remarque , merci.', { delay: 5 });
    await waitForUnderlines(page, 2);
    let lines = await underlines(page);
    assert.ok(isUnderlined(lines, await wordRect(page, '#rich', 'tu as fais')), 'underline under "tu as fais"');
    assert.ok(isUnderlined(lines, await wordRect(page, '#rich', ' ,')), 'underline under " ,"');

    await applyFromPopover(page, '#rich', 'tu as fais');
    await sleep(1200);
    assert.match(await fieldText(page, '#rich'), /Hier tu as fait une remarque , merci\./);
    lines = await underlines(page);
    assert.equal(lines.length, 1);
    assert.ok(isUnderlined(lines, await wordRect(page, '#rich', ' ,')), 'remaining underline still aligned');
  });

  test('manual test page (test/index.html): <br> lines, every error underlined, Apply on line 2', async () => {
    const page = await open('test-page');
    await page.click('#sample-editable');
    await page.keyboard.press('End');
    await page.keyboard.type(' ', { delay: 5 });
    await waitForUnderlines(page, 4);
    const lines = await underlines(page);
    for (const word of ['l ami', 'D accord', ' ,', 'mangé']) {
      assert.ok(isUnderlined(lines, await wordRect(page, '#sample-editable', word)), `underline under "${word}"`);
    }
    await applyFromPopover(page, '#sample-editable', 'mangé');
    await sleep(800);
    assert.match(await fieldText(page, '#sample-editable'), /nous allons manger ensemble/);
  });

  test('Lexical (3 paragraphs): underline aligned, Apply updates the editor state once', async (t) => {
    const page = await open('lexical.html');
    const ready = await page.waitForFunction('window.lexicalReady === true', { timeout: 15000 }).then(() => true, () => false);
    if (!ready) {
      t.skip('Lexical could not be loaded from esm.sh (offline?)');
      return;
    }
    await page.click('#editor');
    await page.keyboard.type('Bonjour à tous.', { delay: 5 });
    await page.keyboard.press('Enter');
    await page.keyboard.type('Le matin, nous allons au marché.', { delay: 5 });
    await page.keyboard.press('Enter');
    await page.keyboard.type('Hier tu as fais une remarque.', { delay: 5 });
    await waitForUnderlines(page, 1);
    assert.ok(isUnderlined(await underlines(page), await wordRect(page, '#editor', 'tu as fais')));
    await applyFromPopover(page, '#editor', 'tu as fais');
    await sleep(1200);
    const text = await page.evaluate(() => window.lexicalText());
    assert.match(text, /Hier tu as fait une remarque\.$/);
    assert.doesNotMatch(text, /fais|fait fait/);
  });
});
