/**
 * Offscreen document (Chrome) that plays pronunciation recordings (US-04).
 * Audio started from a content script is subject to the page's Content-Security-Policy
 * (media-src), which many sites restrict; this extension page is not.
 */
import { OFFSCREEN_PLAY_AUDIO } from '@/lib/audio-messages';

/** Longest a recording may play before the request is answered anyway. */
const MAX_PLAY_MS = 15000;

let current: HTMLAudioElement | null = null;

function play(url: string): Promise<void> {
  current?.pause();
  const audio = new Audio(url);
  current = audio;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, MAX_PLAY_MS);
    const finish = (error?: Error) => {
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };
    audio.addEventListener('ended', () => finish());
    audio.addEventListener('pause', () => finish()); // replaced by a newer request
    audio.addEventListener('error', () => finish(new Error(audio.error?.message || 'audio error')));
    audio.play().catch((e: unknown) => finish(e instanceof Error ? e : new Error(String(e))));
  });
}

browser.runtime.onMessage.addListener((message: { type?: string; url?: string }, _sender, sendResponse) => {
  if (message?.type !== OFFSCREEN_PLAY_AUDIO || !message.url) return; // not for us
  play(message.url).then(
    () => sendResponse({ success: true }),
    (e: Error) => sendResponse({ success: false, error: e.message })
  );
  return true;
});
