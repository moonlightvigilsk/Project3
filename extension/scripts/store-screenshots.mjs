// Store screenshots (US-14): 1280x800 PNGs of the main features, in English and Vietnamese,
// written to store/screenshots/<lang>/. Uses the built extension (.output/chrome-mv3),
// the local Chrome, a demo page and the fake grammar backend of the e2e tests.
//   npm run build && node scripts/store-screenshots.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHADOW, clickShadow, launch, seedLookup, servePages, setSettings, sleep } from '../e2e/helpers.mjs';
import { fakeBackend } from '../e2e/fake-backend.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIDTH = 1280;
const HEIGHT = 800;

const VOYAGE = {
  word: 'voyage',
  lemma: 'voyage',
  ipa: 'vwa.jaʒ',
  formOf: null,
  entries: [
    {
      pos: 'nom',
      isInflection: false,
      gender: 'm',
      ipa: 'vwa.jaʒ',
      senses: [
        { definition: 'Action de se rendre dans un lieu assez éloigné.', example: 'Faire un long voyage en Bretagne.' },
        { definition: 'Séjour fait dans un pays, une région.' },
      ],
    },
  ],
  english: [{ pos: 'Noun', definitions: ['journey, trip, travel'] }],
  etymology: 'Du latin viaticum (« provisions de route »).',
  audio: null,
  sourceUrl: 'https://fr.wiktionary.org/wiki/voyage',
  parserVersion: 2,
};

/** Frames an extension page (popup, side panel) in the middle of a 1280x800 shot. */
async function framed(page, width, height = null) {
  await page.addStyleTag({
    content: `html { background: #e9e7e2 !important; min-height: 100vh; } html[data-theme="dark"] { background: #111113 !important; }
      body { width: ${width}px !important; min-width: 0 !important; max-width: none !important; margin: 48px auto !important;
        border-radius: 14px; overflow: hidden; ${height ? `height: ${height}px !important;` : ''} box-shadow: 0 20px 50px rgba(0,0,0,.18), 0 2px 6px rgba(0,0,0,.08); }`,
  });
}

/** Selects text in an element of the demo page like a user (selection + mouse-up). */
async function select(page, selector, from, to) {
  await page.evaluate(
    (selector, from, to) => {
      const node = document.querySelector(selector).firstChild;
      const start = node.data.indexOf(from);
      const end = to ? node.data.indexOf(to, start) + to.length : start + from.length;
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
    },
    selector,
    from,
    to
  );
  await sleep(300);
}

async function shoot(lang) {
  const outDir = path.join(root, 'store', 'screenshots', lang);
  fs.mkdirSync(outDir, { recursive: true });
  const ctx = await launch();
  const pages = await servePages();
  const backend = await fakeBackend();
  await setSettings(ctx.worker, { backendUrl: backend.url, uiLanguage: lang, theme: 'light' });
  await seedLookup(ctx.worker, 'voyage', VOYAGE);
  const out = (name) => path.join(outDir, `${name}.png`);

  const page = await ctx.browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT });
  await page.goto(pages.url('store-demo.html'));
  await page.bringToFront();
  await sleep(800);

  // 1. Word card.
  await select(page, '#intro', 'voyage');
  await clickShadow(page, '.tc-lookup-btn');
  await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-lookup-card') && !${SHADOW}.querySelector('.tc-lookup-card .tc-spinner')`);
  await sleep(400);
  await page.screenshot({ path: out('1-word-card') });
  await page.keyboard.press('Escape');

  // 2. Grammar analysis of a sentence.
  await select(page, '#text', 'L’été dernier', 'seul jour.');
  await clickShadow(page, '.tc-lookup-btn');
  await page.waitForFunction(`${SHADOW}.querySelectorAll('.tc-structure').length >= 2`);
  await page.evaluate(() => getSelection().removeAllRanges());
  await sleep(400);
  await page.screenshot({ path: out('2-grammar-analysis') });

  // 3. Grammar card of the passé composé.
  await page.evaluate(`[...${SHADOW}.querySelectorAll('.tc-structure')].find((b) => b.dataset.rule === 'passe_compose').click()`);
  await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-rule-card .tc-rule-form')`);
  await page.evaluate(`${SHADOW}.querySelector('.tc-rule-card .tc-card-star').click()`); // saved for shot 6
  await sleep(400);
  await page.screenshot({ path: out('3-grammar-card') });

  // 4. Writing a sentence with the structure, and the feedback.
  await page.evaluate(`${SHADOW}.querySelector('.tc-rule-practice').click()`);
  await page.keyboard.type('Je avons visité Saint-Malo avec ma sœur.');
  await page.keyboard.press('Enter');
  await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-practice-verdict')`);
  await page.evaluate(`${SHADOW}.querySelector('.tc-practice-result').scrollIntoView({ block: 'end' })`);
  await sleep(400);
  await page.screenshot({ path: out('4-practice') });
  // A second, correct attempt for the history.
  await page.evaluate(`${SHADOW}.querySelector('.tc-practice-retry').click()`);
  await page.evaluate(`${SHADOW}.querySelector('.tc-practice-input').select()`);
  await page.keyboard.type("J'ai visité Saint-Malo avec ma sœur.");
  await page.keyboard.press('Enter');
  await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-practice-verdict.tc-ok')`);
  await page.keyboard.press('Escape');

  // 5. Popup: practice history.
  const popup = await ctx.browser.newPage();
  await popup.setViewport({ width: WIDTH, height: HEIGHT });
  await popup.goto(ctx.extUrl('popup.html'));
  await framed(popup, 320);
  await popup.waitForSelector('[role=tab]');
  await (await popup.$$('[role=tab]'))[3].click();
  await popup.waitForSelector('[data-testid=popup-practice] li');
  await sleep(300);
  await popup.screenshot({ path: out('5-practice-history') });
  await popup.close();

  // 6. Side panel: saved grammar card.
  const panel = await ctx.browser.newPage();
  await panel.setViewport({ width: WIDTH, height: HEIGHT });
  await panel.goto(ctx.extUrl('sidepanel.html'));
  await framed(panel, 412, 704);
  await sleep(400);
  await panel.keyboard.down('Alt');
  await panel.keyboard.press('KeyB');
  await panel.keyboard.up('Alt');
  await sleep(300);
  // Open the saved card (click on its title).
  await panel.evaluate(() => {
    const title = [...document.querySelectorAll('button, [role=button]')].find((b) => b.textContent.includes('Passé composé'));
    title?.click();
  });
  await sleep(500);
  await panel.screenshot({ path: out('6-side-panel') });
  await panel.close();

  await ctx.browser.close();
  pages.close();
  backend.close();
  console.log(`store/screenshots/${lang}: ${fs.readdirSync(outDir).join(', ')}`);
}

for (const lang of process.argv.slice(2).length ? process.argv.slice(2) : ['en', 'vi']) await shoot(lang);
