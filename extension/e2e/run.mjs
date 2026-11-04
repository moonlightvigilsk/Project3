// Runs the end-to-end tests one file after the other (each file starts its own Chrome).
//   npm run e2e                 build, then all tests
//   npm run e2e -- lookup       only files whose name contains "lookup"
//   E2E_HEADFUL=1 npm run e2e   show the browser
//   CHROME_PATH=... npm run e2e use another Chrome/Chromium
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const filters = process.argv.slice(2);
const files = fs
  .readdirSync(here)
  .filter((f) => f.endsWith('.e2e.mjs'))
  .filter((f) => filters.length === 0 || filters.some((x) => f.includes(x)))
  .sort();

if (files.length === 0) {
  console.error(`No e2e test matches ${filters.join(', ')}`);
  process.exit(1);
}
// node:test runs the tests of the imported files in import order, one at a time.
for (const f of files) await import(pathToFileURL(path.join(here, f)).href);
