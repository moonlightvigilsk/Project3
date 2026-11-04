/**
 * US-04: pronunciation for the lookup card.
 * A Wiktionary/Commons recording is preferred; the browser's French speech synthesis
 * voice is the fallback. The 🔊 button is hidden when neither is available.
 */

/** Minimal slice of the Web Speech API, so the logic can be tested without a browser. */
export interface SpeechLike {
  getVoices(): SpeechSynthesisVoice[];
  speak(utterance: SpeechSynthesisUtterance): void;
  cancel(): void;
  addEventListener(type: 'voiceschanged', listener: () => void): void;
  removeEventListener(type: 'voiceschanged', listener: () => void): void;
}

type VoiceInfo = Pick<SpeechSynthesisVoice, 'lang' | 'name' | 'localService' | 'default'>;

/**
 * Best French voice: fr-FR over other French variants (fr-CA, fr-BE...), then the
 * higher-quality network voices (e.g. "Google français"), then the system default.
 */
export function pickFrenchVoice<V extends VoiceInfo>(voices: readonly V[]): V | null {
  const lang = (v: VoiceInfo) => v.lang.toLowerCase().replace('_', '-');
  const french = voices.filter((v) => lang(v) === 'fr' || lang(v).startsWith('fr-'));
  if (french.length === 0) return null;
  const score = (v: VoiceInfo) =>
    (lang(v) === 'fr-fr' ? 4 : 0) + (!v.localService ? 2 : 0) + (v.default ? 1 : 0);
  return french.slice().sort((a, b) => score(b) - score(a))[0];
}

function defaultSpeech(): SpeechLike | null {
  return typeof speechSynthesis !== 'undefined' ? (speechSynthesis as unknown as SpeechLike) : null;
}

/**
 * Resolves the French voice. Chrome fills the voice list asynchronously, so an empty
 * list is given `timeoutMs` to load (the `voiceschanged` event) before giving up.
 */
export function findFrenchVoice(
  speech: SpeechLike | null = defaultSpeech(),
  timeoutMs = 1500
): Promise<SpeechSynthesisVoice | null> {
  if (!speech) return Promise.resolve(null);
  const now = pickFrenchVoice(speech.getVoices());
  if (now || speech.getVoices().length > 0) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      speech.removeEventListener('voiceschanged', done);
      resolve(pickFrenchVoice(speech.getVoices()));
    };
    const timer = setTimeout(done, timeoutMs);
    speech.addEventListener('voiceschanged', done);
  });
}

/**
 * Voice lookup for repeated use: only the first call waits for the voice list to load;
 * later calls answer at once, so a browser without French voices does not delay every card.
 */
export function createVoiceFinder(
  speech: SpeechLike | null = defaultSpeech(),
  timeoutMs = 1500
): () => Promise<SpeechSynthesisVoice | null> {
  let first: Promise<SpeechSynthesisVoice | null> | null = null;
  let settled = false;
  return () => {
    if (!first) {
      first = findFrenchVoice(speech, timeoutMs).finally(() => {
        settled = true;
      });
      return first;
    }
    if (!settled) return first;
    // Voices may have been installed or loaded since: re-read them without waiting.
    return Promise.resolve(speech ? pickFrenchVoice(speech.getVoices()) : null);
  };
}

/** Utterance started by the extension and still playing, so closing a card only stops ours. */
let ownUtterance: SpeechSynthesisUtterance | null = null;

/** Speaks `text` with a French voice; resolves when speech ends, rejects on error. */
export function speakFrench(
  text: string,
  voice: SpeechSynthesisVoice,
  speech: SpeechLike | null = defaultSpeech()
): Promise<void> {
  if (!speech) return Promise.reject(new Error('speechSynthesis unavailable'));
  return new Promise((resolve, reject) => {
    if (ownUtterance) speech.cancel(); // replace our previous word, not the page's speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 0.9; // slightly slower than default, for learners
    const done = () => {
      if (ownUtterance === utterance) ownUtterance = null;
    };
    utterance.onend = () => {
      done();
      resolve();
    };
    utterance.onerror = (e) => {
      done();
      if (e.error === 'interrupted' || e.error === 'canceled') resolve();
      else reject(new Error(e.error));
    };
    ownUtterance = utterance;
    speech.speak(utterance);
  });
}

/** Stops speech started by `speakFrench`; speech started by the page itself is left alone. */
export function stopOwnSpeech(speech: SpeechLike | null = defaultSpeech()) {
  if (!ownUtterance || !speech) return;
  ownUtterance = null;
  speech.cancel();
}

/** True while speech started by `speakFrench` is playing (for tests and UI state). */
export function isSpeakingOwn(): boolean {
  return ownUtterance !== null;
}

export interface PronunciationSource {
  text: string;
  /** Recording URL (Commons), if any. */
  audioUrl: string | null;
}

export interface PronunciationDeps {
  /** Plays a recording; rejects when it cannot be played (blocked, offline...). */
  playAudio: (url: string) => Promise<void>;
  /** Speaks with speech synthesis; rejects when unavailable. */
  speak: (text: string) => Promise<void>;
}

/** Plays the recording, falling back to speech synthesis. Returns what was used. */
export async function pronounce(
  source: PronunciationSource,
  deps: PronunciationDeps
): Promise<'audio' | 'speech'> {
  if (source.audioUrl) {
    try {
      await deps.playAudio(source.audioUrl);
      return 'audio';
    } catch {
      // Fall through to speech synthesis.
    }
  }
  await deps.speak(source.text);
  return 'speech';
}
