import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  createVoiceFinder,
  findFrenchVoice,
  isSpeakingOwn,
  pickFrenchVoice,
  pronounce,
  speakFrench,
  stopOwnSpeech,
  type SpeechLike,
} from '../pronunciation';
import {
  comparableIpa,
  extractFrenchSection,
  extractPronunciationAudio,
  parseFrenchWikitext,
} from '@/lib/dictionary/wikitext';
import { commonsFileUrl } from '@/lib/dictionary/wiktionary';

const fixture = (name: string) =>
  fs.readFileSync(path.join(__dirname, '../../dictionary/__tests__/fixtures', name), 'utf8');

describe('extractPronunciationAudio', () => {
  it('prefers a speaker from France', () => {
    expect(parseFrenchWikitext(fixture('alle.wikitext'))?.audio).toEqual({
      file: 'LL-Q150 (fra)-Pamputt-allé.wav',
      region: 'France (Brétigny-sur-Orge)',
    });
    // Region given before lang= ({{écouter|France||lang=fr|audio=...}}).
    expect(parseFrenchWikitext(fixture('Maison_capital.wikitext'))?.audio).toEqual({
      file: 'LL-Q150 (fra)-Adélaïde Calais WMFr-Maison.wav',
      region: 'France',
    });
    expect(parseFrenchWikitext(fixture('belle.wikitext'))?.audio?.region).toBe('France (Lyon)');
  });

  // Real fr.wiktionary pages (French section only) where the first French-region
  // recording is of another phrase or another pronunciation.
  it('skips recordings of another phrase (titre=)', () => {
    const est = parseFrenchWikitext(fixture('est.wikitext'));
    expect(est?.ipa).toBe('ɛst');
    expect(est?.audio?.file).not.toBe('Fr-est.ogg'); // "à l'est"
    expect(est?.audio?.file).toMatch(/-est\.wav$/);
    expect(est?.audio?.region).toMatch(/^France \(/);

    const plus = parseFrenchWikitext(fixture('plus.wikitext'));
    expect(plus?.audio?.file).not.toBe('Fr-plus.ogg'); // "en plus"
    // /ply/ is shown: the /plys/ recordings are skipped, the /ply/ one wins over unknown IPA.
    expect(plus?.ipa).toBe('ply');
    expect(plus?.audio?.file).toBe('LL-Q150 (fra)-DenisdeShawi-plus.wav');
  });

  it('skips recordings of another pronunciation and prefers a matching IPA', () => {
    const fils = parseFrenchWikitext(fixture('fils.wikitext'));
    expect(fils?.ipa).toBe('fis');
    // Not "fils (pluriel de fil)" /fil/; the /fis/ recording from France.
    expect(fils?.audio).toEqual({ file: 'Fr-fils.ogg', region: 'France' });
  });

  it('cleans wiki comments and templates out of the region', () => {
    expect(
      extractPronunciationAudio('* {{écouter|lang=fr|France <!-- précisez svp la ville -->|a|audio=A.ogg}}')
    ).toEqual({ file: 'A.ogg', region: 'France' });
    expect(extractPronunciationAudio('* {{écouter|lang=fr|Québec {{populaire|nocat=1}}|py|audio=Q.ogg}}')?.region).toBe(
      'Québec'
    );
  });

  it('compares IPA without dots, ties, stress, length and dental marks', () => {
    expect(comparableIpa('ɛst̪')).toBe(comparableIpa('ɛst'));
    expect(comparableIpa('a l̪‿ɛst̪')).toBe('alɛst');
    expect(comparableIpa('me.zɔ̃')).toBe('mezɔ̃');
    expect(comparableIpa('fis')).not.toBe(comparableIpa('fil'));
    expect(extractPronunciationAudio('* {{écouter|lang=fr|France|fil|audio=Fil.ogg}}', 'fis')).toBeNull();
    expect(extractPronunciationAudio('* {{écouter|lang=fr|France||audio=Any.ogg}}', 'fis')?.file).toBe('Any.ogg');
  });

  it('falls back to a recording without region, skips other languages and non-audio files', () => {
    expect(extractPronunciationAudio('* {{écouter|lang=fr||a.le|audio=Fr-a.ogg}}')).toEqual({
      file: 'Fr-a.ogg',
      region: null,
    });
    expect(extractPronunciationAudio('* {{écouter|lang=en|US|audio=En-a.ogg}}')).toBeNull();
    expect(extractPronunciationAudio('* {{écouter|lang=fr|France|audio=}}')).toBeNull();
    expect(extractPronunciationAudio('* {{écouter|lang=fr|France|audio=Image.png}}')).toBeNull();
    expect(extractPronunciationAudio('no recordings here')).toBeNull();
  });

  it('only reads the French section', () => {
    const page = [
      '== {{langue|fr}} ==',
      '=== {{S|nom|fr}} ===',
      "'''chat''' {{pron|ʃa|fr}} {{m}}",
      '# Petit félin domestique.',
      '== {{langue|en}} ==',
      '* {{écouter|lang=fr|France|audio=Not-this-one.ogg}}',
    ].join('\n');
    expect(extractFrenchSection(page)).not.toContain('Not-this-one');
    expect(parseFrenchWikitext(page)?.audio).toBeNull();
  });

  it('builds a Commons file URL', () => {
    expect(commonsFileUrl('LL-Q150 (fra)-Lyokoï-allé.wav')).toBe(
      'https://commons.wikimedia.org/wiki/Special:FilePath/LL-Q150_(fra)-Lyoko%C3%AF-all%C3%A9.wav'
    );
  });
});

const voice = (lang: string, name: string, localService = true, isDefault = false) =>
  ({ lang, name, localService, default: isDefault }) as SpeechSynthesisVoice;

describe('pickFrenchVoice', () => {
  it('prefers fr-FR, then network voices', () => {
    const voices = [
      voice('en-US', 'Google US English', false, true),
      voice('fr-CA', 'Microsoft Caroline'),
      voice('fr-FR', 'Microsoft Hortense'),
      voice('fr-FR', 'Google français', false),
    ];
    expect(pickFrenchVoice(voices)?.name).toBe('Google français');
    expect(pickFrenchVoice(voices.slice(0, 3))?.name).toBe('Microsoft Hortense');
    expect(pickFrenchVoice(voices.slice(0, 2))?.name).toBe('Microsoft Caroline');
    expect(pickFrenchVoice([voice('fr_FR', 'Android fr')])?.name).toBe('Android fr');
  });

  it('returns null without any French voice', () => {
    expect(pickFrenchVoice([voice('en-US', 'Google US English'), voice('vi-VN', 'Microsoft An')])).toBeNull();
  });
});

function fakeSpeech(initial: SpeechSynthesisVoice[]) {
  let voices = initial;
  const listeners = new Set<() => void>();
  const speech: SpeechLike = {
    getVoices: () => voices,
    speak: vi.fn(),
    cancel: vi.fn(),
    addEventListener: (_t, l) => listeners.add(l),
    removeEventListener: (_t, l) => listeners.delete(l),
  };
  return {
    speech,
    load(v: SpeechSynthesisVoice[]) {
      voices = v;
      listeners.forEach((l) => l());
    },
    listeners,
  };
}

describe('findFrenchVoice', () => {
  it('waits for voices that load asynchronously', async () => {
    const fake = fakeSpeech([]);
    const pending = findFrenchVoice(fake.speech, 5000);
    fake.load([voice('fr-FR', 'Microsoft Hortense')]);
    expect((await pending)?.name).toBe('Microsoft Hortense');
    expect(fake.listeners.size).toBe(0);
  });

  it('gives up after the timeout and when speech synthesis is missing', async () => {
    vi.useFakeTimers();
    const pending = findFrenchVoice(fakeSpeech([]).speech, 1000);
    vi.advanceTimersByTime(1000);
    expect(await pending).toBeNull();
    vi.useRealTimers();
    expect(await findFrenchVoice(null)).toBeNull();
  });

  it('answers at once when voices are already loaded', async () => {
    expect(await findFrenchVoice(fakeSpeech([voice('en-US', 'x')]).speech)).toBeNull();
  });
});

describe('createVoiceFinder', () => {
  it('waits only on the first call', async () => {
    vi.useFakeTimers();
    const fake = fakeSpeech([]);
    const find = createVoiceFinder(fake.speech, 1000);
    const first = find();
    vi.advanceTimersByTime(1000);
    expect(await first).toBeNull();
    // Later calls answer at once (no timer needed) and see voices loaded since.
    expect(await find()).toBeNull();
    fake.load([voice('fr-FR', 'Microsoft Hortense')]);
    expect((await find())?.name).toBe('Microsoft Hortense');
    vi.useRealTimers();
  });
});

describe('own speech', () => {
  class FakeUtterance {
    voice: unknown = null;
    lang = '';
    rate = 1;
    onend: (() => void) | null = null;
    onerror: ((e: { error: string }) => void) | null = null;
    constructor(public text: string) {}
  }

  it('only cancels speech the extension started', async () => {
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    const fake = fakeSpeech([]);
    // Nothing of ours is playing: the page's own speech is left alone.
    stopOwnSpeech(fake.speech);
    expect(fake.speech.cancel).not.toHaveBeenCalled();

    let utterance: FakeUtterance | null = null;
    (fake.speech.speak as ReturnType<typeof vi.fn>).mockImplementation((u: FakeUtterance) => {
      utterance = u;
    });
    const done = speakFrench('allé', voice('fr-FR', 'Hortense'), fake.speech);
    expect(isSpeakingOwn()).toBe(true);
    stopOwnSpeech(fake.speech);
    expect(fake.speech.cancel).toHaveBeenCalledTimes(1);
    utterance!.onerror?.({ error: 'interrupted' });
    await expect(done).resolves.toBeUndefined();
    expect(isSpeakingOwn()).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe('pronounce', () => {
  it('plays the recording when there is one', async () => {
    const deps = { playAudio: vi.fn(async () => {}), speak: vi.fn(async () => {}) };
    expect(await pronounce({ text: 'allé', audioUrl: 'https://x/a.wav' }, deps)).toBe('audio');
    expect(deps.speak).not.toHaveBeenCalled();
  });

  it('falls back to speech when the recording fails or is missing', async () => {
    const deps = {
      playAudio: vi.fn(async () => {
        throw new Error('blocked');
      }),
      speak: vi.fn(async () => {}),
    };
    expect(await pronounce({ text: 'allé', audioUrl: 'https://x/a.wav' }, deps)).toBe('speech');
    expect(deps.speak).toHaveBeenCalledWith('allé');
    expect(await pronounce({ text: 'maison', audioUrl: null }, deps)).toBe('speech');
  });

  it('rejects when nothing can be played', async () => {
    const deps = {
      playAudio: vi.fn(async () => {
        throw new Error('blocked');
      }),
      speak: vi.fn(async () => {
        throw new Error('no voice');
      }),
    };
    await expect(pronounce({ text: 'allé', audioUrl: 'https://x/a.wav' }, deps)).rejects.toThrow('no voice');
  });
});
