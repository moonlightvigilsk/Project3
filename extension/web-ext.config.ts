import fs from 'node:fs';
import path from 'node:path';
import { defineWebExtConfig } from 'wxt';

/**
 * Chromium binary used by `npm run dev`.
 *
 * WXT's launcher only looks for Chrome/Chromium. When the developer uses Brave,
 * Edge or a Chromium installed outside the usual paths, dev mode fails with
 * "The CHROME_PATH environment variable must be set...". Detect those here so
 * `npm run dev` works out of the box; `CHROME_PATH` still wins when set.
 */
const candidates = [
  process.env.CHROME_PATH,
  process.env.BRAVE_PATH,
  // Windows
  process.env.PROGRAMFILES &&
    path.join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
  process.env['PROGRAMFILES(X86)'] &&
    path.join(process.env['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe'),
  process.env.LOCALAPPDATA &&
    path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
  process.env.PROGRAMFILES &&
    path.join(process.env.PROGRAMFILES, 'BraveSoftware/Brave-Browser/Application/brave.exe'),
  process.env['PROGRAMFILES(X86)'] &&
    path.join(process.env['PROGRAMFILES(X86)'], 'BraveSoftware/Brave-Browser/Application/brave.exe'),
  process.env.LOCALAPPDATA &&
    path.join(process.env.LOCALAPPDATA, 'BraveSoftware/Brave-Browser/Application/brave.exe'),
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  // Linux
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
].filter((candidate): candidate is string => Boolean(candidate));

const chromium = candidates.find((candidate) => {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
});

export default defineWebExtConfig({
  // WXT reads the binary for the target passed with `--browser`. All Chromium
  // targets can share the same binary.
  ...(chromium ? { binaries: { chrome: chromium, edge: chromium, opera: chromium } } : {}),
});
