// Word lookup and notebook: select a word → lookup card (lemma, IPA) → ☆ save with the
// sentence → the popup lists it → CSV export has its row. Also in a textarea, and with
// the page highlighting saved words.
// Lookups use a seeded cache by default (no Wiktionary call); E2E_NETWORK=1 uses Wiktionary.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHADOW,
  clickShadow,
  downloadDir,
  launch,
  localGet,
  seedLookup,
  selectWord,
  servePages,
  setSettings,
  sleep,
  waitForDownload,
} from './helpers.mjs';

const AMI = {
  word: 'ami',
  lemma: 'ami',
  ipa: 'a.mi',
  formOf: null,
  entries: [
    {
      pos: 'nom',
      isInflection: false,
      gender: 'm',
      ipa: 'a.mi',
      senses: [{ definition: 'Personne avec qui l’on est lié d’amitié.', example: 'C’est un ami d’enfance.' }],
    },
  ],
  english: [{ pos: 'Noun', definitions: ['friend'] }],
  audio: null,
  sourceUrl: 'https://fr.wiktionary.org/wiki/ami',
  parserVersion: 2,
};

describe('lookup card and vocabulary notebook', () => {
  let ctx;
  let pages;

  before(async () => {
    ctx = await launch();
    pages = await servePages();
    if (!process.env.E2E_NETWORK) await seedLookup(ctx.worker, 'ami', AMI);
  });
  after(async () => {
    await ctx?.browser.close();
    pages?.close();
  });

  async function openCard(page) {
    await clickShadow(page, '.tc-lookup-btn');
    await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-lookup-card') && !${SHADOW}.querySelector('.tc-lookup-card .tc-spinner')`, { timeout: 15000 });
    return page.evaluate(`${SHADOW}.querySelector('.tc-lookup-card').innerText`);
  }

  test('select "ami" → card with lemma and IPA → ☆ saves it with its sentence and page', async () => {
    const page = await ctx.browser.newPage();
    await page.goto(pages.url('reading.html'));
    await sleep(800);
    await selectWord(page, '#text', 'ami');
    const card = await openCard(page);
    assert.match(card, /\bami\b/);
    assert.match(card, /\/a\.mi\//);

    await page.waitForFunction(`!${SHADOW}.querySelector('.tc-card-star').hidden`);
    await clickShadow(page, '.tc-card-star');
    await sleep(700);
    const entry = await localGet(ctx.worker, 'vocab:ami');
    assert.equal(entry?.saved, true);
    assert.equal(entry.contextSentence, 'Hier, mon ami est venu à la maison.');
    assert.equal(entry.sourceUrl, pages.url('reading.html'));
    assert.equal(entry.sourceTitle, 'Lecture');
    assert.match(await page.evaluate(`${SHADOW}.querySelector('.tc-card-star').innerText`), /Đã lưu/);
    await page.keyboard.press('Escape');
    await page.close();
  });

  test('the popup "Vocabulary" tab lists the saved word', async () => {
    const popup = await ctx.browser.newPage();
    await popup.setViewport({ width: 340, height: 600 });
    await popup.goto(ctx.extUrl('popup.html'));
    await popup.waitForSelector('[role=tab]');
    await popup.evaluate(() => [...document.querySelectorAll('[role=tab]')][1].click());
    await popup.waitForSelector('[data-testid=popup-vocab] li');
    const words = await popup.$$eval('[data-testid=popup-vocab] li .font-serif', (els) => els.map((e) => e.textContent));
    assert.deepEqual(words, ['ami']);
    await popup.close();
  });

  test('CSV export from the options page has the backend columns and the "ami" row', async () => {
    const dir = downloadDir('csv');
    const options = await ctx.browser.newPage();
    const cdp = await options.createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });
    await options.goto(ctx.extUrl('options.html#vocabulary'));
    await options.waitForSelector('[data-testid=vocab-transfer] button');
    const csvButton = await options.evaluateHandle(() =>
      [...document.querySelectorAll('[data-testid=vocab-transfer] button')].find((b) => b.textContent.trim() === 'CSV')
    );
    await csvButton.click();
    const csv = await waitForDownload(dir, '.csv');
    const lines = csv.text.replace(/^﻿/, '').split('\r\n');
    assert.equal(lines[0], '"Lemma","Từ gốc","Loại từ (POS)","Trạng thái","Số lần gặp","Nghĩa tiếng Pháp","Nghĩa tiếng Việt","Câu ngữ cảnh","Ngày thêm"');
    // Meaning column: the seeded definition, or whatever Wiktionary says with E2E_NETWORK=1.
    assert.match(lines[1], /^"ami","ami","[^"]+","new","1","[^"]+","","Hier, mon ami est venu à la maison\.","\d{4}-\d\d-\d\d \d\d:\d\d"$/);
    if (!process.env.E2E_NETWORK) assert.ok(lines[1].startsWith('"ami","ami","nom","new","1","Personne avec qui l’on est lié d’amitié."'));
    await options.close();
  });

  test('lookup also works on a word selected in a textarea', async () => {
    const page = await ctx.browser.newPage();
    await page.goto(pages.url('editors.html'));
    await sleep(800);
    await page.click('#textarea');
    await page.keyboard.type('Mon ami arrive.', { delay: 5 });
    await page.evaluate(() => {
      const ta = document.getElementById('textarea');
      ta.setSelectionRange(4, 7);
      ta.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
    });
    await sleep(300);
    assert.match(await openCard(page), /\/a\.mi\//);
    await page.close();
  });

  test('saved words are highlighted on pages once the option is on (CSS highlights, DOM unchanged)', async () => {
    const page = await ctx.browser.newPage();
    await page.goto(pages.url('reading.html'));
    await sleep(800);
    const highlighted = () =>
      page.evaluate(() => {
        const h = CSS.highlights.get('textchecker-vocab-new');
        return h ? [...h].map((r) => r.toString()) : [];
      });
    assert.deepEqual(await highlighted(), [], 'off by default');
    await setSettings(ctx.worker, { vocabHighlight: true });
    await page.waitForFunction(() => CSS.highlights.get('textchecker-vocab-new')?.size > 0, { timeout: 5000 });
    assert.deepEqual(await highlighted(), ['ami']);
    assert.equal(await page.$eval('#text', (e) => e.innerHTML), 'Hier, mon ami est venu à la maison. Nous avons parlé longtemps.');
    await page.close();
  });
});
