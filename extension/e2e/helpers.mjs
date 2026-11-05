// Shared helpers for the end-to-end tests (US-13).
// The tests load the built extension (.output/chrome-mv3) into the Chrome installed on
// the machine with puppeteer-core, and drive real pages served from e2e/pages.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = path.dirname(fileURLToPath(import.meta.url));
export const EXTENSION_DIR = path.resolve(here, '..');
export const BUILD_DIR = path.join(EXTENSION_DIR, '.output', 'chrome-mv3');
export const PAGES_DIR = path.join(here, 'pages');

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Chrome or Chromium on this machine (CHROME_PATH wins). */
export function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
    'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe',
    'C:/Program Files (x86)/BraveSoftware/Brave-Browser/Application/brave.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'BraveSoftware/Brave-Browser/Application/brave.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/brave-browser',
    '/usr/bin/brave',
    '/opt/google/chrome/chrome',
    '/opt/chromium/chrome',
    '/opt/brave.com/brave/brave',
    '/opt/brave-bin/brave',
    '/snap/bin/chromium',
    '/snap/bin/brave',
    '/var/lib/flatpak/exports/bin/com.brave.Browser',
    '/var/lib/flatpak/exports/bin/org.chromium.Chromium',
  ].filter(Boolean);
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) throw new Error('Chrome not found: set CHROME_PATH to the Chrome/Chromium executable.');
  return found;
}

/**
 * Starts Chrome with the built extension. Headless by default; E2E_HEADFUL=1 shows the
 * window (useful to watch a failing test).
 */
export async function launch() {
  if (!fs.existsSync(path.join(BUILD_DIR, 'manifest.json'))) {
    throw new Error(`No build in ${BUILD_DIR}: run "npm run build" first (npm run e2e does it).`);
  }
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: process.env.E2E_HEADFUL ? false : true,
    pipe: true,
    enableExtensions: [BUILD_DIR],
    defaultViewport: { width: 1100, height: 800 },
    args: ['--no-first-run', '--lang=vi'],
  });
  const target = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().endsWith('/background.js'));
  const worker = await target.worker();
  const extensionId = new URL(target.url()).host;
  return { browser, worker, extensionId, extUrl: (p) => `chrome-extension://${extensionId}/${p}` };
}

/** Serves e2e/pages and the manual test page (test/index.html) on a free port. */
export async function servePages() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const file =
      url.pathname === '/test-page'
        ? path.join(EXTENSION_DIR, 'test', 'index.html')
        : path.join(PAGES_DIR, path.normalize(url.pathname).replace(/^([/\\])+/, ''));
    if (!file.startsWith(PAGES_DIR) && !file.endsWith(path.join('test', 'index.html'))) {
      res.writeHead(403).end();
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) return res.writeHead(404).end();
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(data);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  return { url: (p) => `http://127.0.0.1:${port}/${p.replace(/^\//, '')}`, close: () => server.close() };
}

// --- extension UI in the page (shadow DOM overlay) --------------------------------

export const SHADOW = `document.querySelector('#textchecker-overlay').shadowRoot`;

/** Viewport rects of the grammar underlines. */
export const underlines = (page) =>
  page.evaluate(`(() => { const s = ${SHADOW.replace('.shadowRoot', '?.shadowRoot')}; return s ? [...s.querySelectorAll('.tc-underline')].map((u) => { const r = u.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width }; }) : []; })()`);

/** Viewport rect of the first occurrence of `word` in the text of `selector`. */
export const wordRect = (page, selector, word) =>
  page.evaluate(
    (selector, word) => {
      const root = document.querySelector(selector);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const i = n.data.indexOf(word);
        if (i < 0) continue;
        const range = document.createRange();
        range.setStart(n, i);
        range.setEnd(n, i + word.length);
        const b = range.getClientRects()[0];
        return { x: b.left, y: b.bottom, w: b.width };
      }
      return null;
    },
    selector,
    word
  );

/** An underline is drawn exactly under the word (left, width, baseline). */
export const isUnderlined = (lines, rect) =>
  !!rect && lines.some((u) => Math.abs(u.x - rect.x) < 1.5 && Math.abs(u.w - Math.max(rect.w, 4)) < 1.5 && Math.abs(u.y - (rect.y - 2)) < 3);

/** Waits until at least `count` underlines are drawn. */
export const waitForUnderlines = (page, count = 1, timeout = 8000) =>
  page.waitForFunction(
    (sel, count) => {
      const s = document.querySelector('#textchecker-overlay')?.shadowRoot;
      return !!s && s.querySelectorAll(sel).length >= count;
    },
    { timeout },
    '.tc-underline',
    count
  );

/** Text of an input/textarea, or the visible text of an editor. */
export const fieldText = (page, selector) =>
  page.$eval(selector, (e) => ('value' in e && e.tagName !== 'DIV' ? e.value : e.innerText));

/**
 * Clicks the underline under `word` (or the first underline when `word` is null, e.g. in
 * an <input> whose text is not in text nodes), then "Apply" in the popover.
 * Returns the popover text.
 */
export async function applyFromPopover(page, selector, word) {
  const lines = await underlines(page);
  let line = lines[0];
  if (word !== null) {
    const rect = await wordRect(page, selector, word);
    line = rect && lines.find((u) => Math.abs(u.x - rect.x) < 1.5);
  }
  if (!line) throw new Error(`No underline under "${word}"`);
  await page.mouse.click(line.x + line.w / 2, line.y + 1);
  await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-popover [data-action=apply]')`, { timeout: 4000 });
  const popover = await page.evaluate(`${SHADOW}.querySelector('.tc-popover').innerText`);
  await page.evaluate(`${SHADOW}.querySelector('.tc-popover [data-action=apply]').click()`);
  return popover;
}

/** Opens the panel from the status button and applies its first suggestion. */
export async function applyFromPanel(page) {
  const btn = await page.evaluate(`(() => { const r = ${SHADOW}.querySelector('.tc-status-btn').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  await page.mouse.click(btn.x, btn.y);
  await page.waitForFunction(`!!${SHADOW}.querySelector('.tc-suggestion-card [data-action=apply]')`, { timeout: 4000 });
  const card = await page.evaluate(`${SHADOW}.querySelector('.tc-suggestion-card').innerText`);
  const apply = await page.evaluate(`(() => { const r = ${SHADOW}.querySelector('.tc-suggestion-card [data-action=apply]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  await page.mouse.click(apply.x, apply.y);
  return card;
}

/** Selects `word` in `selector` like a user would (selection + mouseup). */
export async function selectWord(page, selector, word) {
  await page.mouse.click(2, 2);
  await page.evaluate(
    (selector, word) => {
      const root = document.querySelector(selector);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const i = n.data.indexOf(word);
        if (i < 0) continue;
        const range = document.createRange();
        range.setStart(n, i);
        range.setEnd(n, i + word.length);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
        return;
      }
      throw new Error(`"${word}" not found`);
    },
    selector,
    word
  );
  await sleep(200);
}

/** Clicks a shadow-DOM element by selector. */
export async function clickShadow(page, selector) {
  const p = await page.evaluate(`(() => { const e = ${SHADOW}.querySelector('${selector}'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  if (!p) throw new Error(`${selector} not shown`);
  await page.mouse.click(p.x, p.y);
}

// --- storage ---------------------------------------------------------------------

export const localGet = (worker, key) => worker.evaluate(async (k) => (await chrome.storage.local.get(k))[k], key);

/** Puts a dictionary result in the lookup cache, so lookups do not depend on Wiktionary. */
export const seedLookup = (worker, word, result) =>
  worker.evaluate(
    async (word, result) => {
      await chrome.storage.local.set({ [`lookup:${word}`]: { response: { status: 'ok', result }, storedAt: Date.now() } });
    },
    word,
    result
  );

/** Replaces the vocabulary notebook (storage layout version 2). */
export const seedVocabulary = (worker, entries) =>
  worker.evaluate(async (entries) => {
    const base = { pos: null, gender: null, ipa: null, definitions: [], note: '', contextSentence: null, sourceUrl: null, sourceTitle: null, status: 'new', saved: true, ignoreSpelling: false, createdAt: 1, updatedAt: 1, reviewCount: 0, dueAt: 0, ease: 2.5, intervalDays: 0 };
    const items = {};
    const index = {};
    for (const e of entries) {
      const entry = { ...base, word: e.lemma, ...e, id: e.lemma.toLowerCase() };
      items[`vocab:${entry.id}`] = entry;
      index[entry.id] = entry.updatedAt;
    }
    const meta = (await chrome.storage.local.get('vocabulary')).vocabulary;
    await chrome.storage.local.set({ ...items, vocabulary: { version: 2, index, importedLegacy: [], rev: (meta?.rev ?? 0) + 1000 } });
  }, entries);

/** Sets settings fields (storage.sync `settings`). */
export const setSettings = (worker, patch) =>
  worker.evaluate(async (patch) => {
    const current = (await chrome.storage.sync.get('settings')).settings ?? {};
    await chrome.storage.sync.set({ settings: { ...current, ...patch } });
  }, patch);

/** Folder for downloads of one test. */
export function downloadDir(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `tc-e2e-${name}-`));
  return dir;
}

/** Waits for a new file with `extension` in `dir`. */
export async function waitForDownload(dir, extension, before = new Set()) {
  for (let i = 0; i < 100; i++) {
    const name = fs.readdirSync(dir).find((n) => !before.has(n) && n.endsWith(extension));
    if (name) {
      await sleep(200);
      return { name, text: fs.readFileSync(path.join(dir, name), 'utf8') };
    }
    await sleep(100);
  }
  throw new Error(`No ${extension} download in ${dir}`);
}
