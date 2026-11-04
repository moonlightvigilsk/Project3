// Renders public/icon.svg to the PNG sizes the stores and the manifest need (US-14):
// public/icon/{16,32,48,128}.png (WXT adds them to manifest.icons). Uses the local Chrome.
//   node scripts/render-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { findChrome } from '../e2e/helpers.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = fs.readFileSync(path.join(root, 'public', 'icon.svg'), 'utf8');
const outDir = path.join(root, 'public', 'icon');
fs.mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, pipe: true });
const page = await browser.newPage();
// Chrome Web Store: the 128px icon is 96px of artwork with 16px of transparent padding.
const PADDING = { 16: 0, 32: 0, 48: 0, 128: 16 };
for (const size of [16, 32, 48, 128]) {
  const art = size - 2 * PADDING[size];
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent;padding:${PADDING[size]}px">${svg.replace('<svg ', `<svg style="display:block" width="${art}" height="${art}" `)}</body></html>`
  );
  await page.screenshot({ path: path.join(outDir, `${size}.png`), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log(`public/icon/${size}.png`);
}
await browser.close();
