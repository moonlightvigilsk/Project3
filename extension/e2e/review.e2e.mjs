// Flashcards and notebook management: due-word badge → review in the popup → schedule
// saved; notebook table in the options page (search, status); JSON backup re-import.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { downloadDir, launch, localGet, seedVocabulary, sleep, waitForDownload } from './helpers.mjs';

const DAY = 86_400_000;

describe('flashcards and notebook pages', () => {
  let ctx;
  const badge = () => ctx.worker.evaluate(() => chrome.action.getBadgeText({}));

  before(async () => {
    ctx = await launch();
    await sleep(500);
    await seedVocabulary(ctx.worker, [
      { lemma: 'maison', definitions: ['Bâtiment d’habitation.'], contextSentence: 'Ma maison est grande.', createdAt: 1 },
      { lemma: 'école', definitions: ['Établissement d’enseignement.'], createdAt: 2 },
      { lemma: 'arbre', status: 'learning', dueAt: Date.now() + 2 * DAY, intervalDays: 6, createdAt: 3 },
      { lemma: 'ami', status: 'known', createdAt: 4 },
    ]);
    await sleep(800);
  });
  after(async () => ctx?.browser.close());

  test('the toolbar badge counts the words due (not the known or later ones)', async () => {
    assert.equal(await badge(), '2');
  });

  test('popup review: sentence on the front, Space shows the meaning, "Nhớ" schedules 1 day', async () => {
    const popup = await ctx.browser.newPage();
    await popup.setViewport({ width: 340, height: 600 });
    await popup.goto(ctx.extUrl('popup.html'));
    await popup.waitForSelector('[role=tab]');
    await popup.evaluate(() => [...document.querySelectorAll('[role=tab]')][2].click());
    await popup.waitForSelector('[data-testid=review-card]');
    assert.equal(await popup.$eval('[data-testid=review-word]', (e) => e.textContent), 'maison');
    assert.match(await popup.$eval('[data-testid=review-context]', (e) => e.textContent), /Ma maison est grande/);
    await popup.keyboard.press('Space');
    await popup.waitForSelector('[data-testid=review-back]');
    assert.match(await popup.$eval('[data-testid=review-back]', (e) => e.textContent), /Bâtiment d’habitation/);
    await popup.keyboard.press('2');
    await sleep(600);
    const maison = await localGet(ctx.worker, 'vocab:maison');
    assert.equal(maison.intervalDays, 1);
    assert.equal(maison.status, 'learning');
    assert.ok(Math.abs(maison.dueAt - (Date.now() + DAY)) < 60_000);
    assert.equal(await badge(), '1');
    assert.equal(await popup.$eval('[data-testid=review-word]', (e) => e.textContent), 'école');
    await popup.close();
  });

  test('options table: accent-insensitive search and status change', async () => {
    const options = await ctx.browser.newPage();
    await options.goto(ctx.extUrl('options.html#vocabulary'));
    await options.waitForSelector('[data-testid=vocab-tab] tbody tr');
    await options.type('[data-testid=vocab-tab] input[type=search]', 'ecole');
    await sleep(200);
    const rows = await options.$$eval('[data-testid=vocab-tab] tbody tr', (trs) => trs.map((tr) => tr.dataset.vocabId));
    assert.deepEqual(rows, ['école']);
    await options.select('tr[data-vocab-id="école"] select', 'known');
    await sleep(600);
    assert.equal((await localGet(ctx.worker, 'vocab:école')).status, 'known');
    assert.equal(await badge(), '', 'a known word is no longer due');
    await options.close();
  });

  test('JSON backup restores the notebook after it is cleared', async () => {
    const dir = downloadDir('json');
    const options = await ctx.browser.newPage();
    const cdp = await options.createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });
    await options.goto(ctx.extUrl('options.html#vocabulary'));
    await options.waitForSelector('[data-testid=vocab-transfer] button');
    const backupButton = await options.evaluateHandle(() =>
      [...document.querySelectorAll('[data-testid=vocab-transfer] button')].find((b) => b.textContent.includes('JSON') && !b.textContent.includes('Nhập'))
    );
    await backupButton.click();
    const backup = await waitForDownload(dir, '.json');
    assert.equal(JSON.parse(backup.text).entries.length, 4);

    await ctx.worker.evaluate(() => chrome.storage.local.clear());
    await sleep(500);
    const input = await options.$('[data-testid=vocab-import-input]');
    await input.uploadFile(path.join(dir, backup.name));
    await options.waitForFunction(() => /Đã nhập/.test(document.querySelector('[data-testid=vocab-transfer] [role=status]')?.textContent ?? ''));
    const maison = await localGet(ctx.worker, 'vocab:maison');
    assert.equal(maison.intervalDays, 1, 'learning data restored');
    assert.equal(maison.contextSentence, 'Ma maison est grande.');
    assert.equal(Object.keys((await localGet(ctx.worker, 'vocabulary')).index).length, 4);
    fs.rmSync(dir, { recursive: true, force: true });
    await options.close();
  });
});
