import { describe, expect, it } from 'vitest';
import { parseHTML } from 'linkedom';
import { PREVIEW_MAX_BLOCKS, detectCharset, extractPreview, loadSourcePreview } from '../source-preview';

function doc(html: string): Document {
  return parseHTML(`<!doctype html><html>${html}</html>`).document as unknown as Document;
}

const filler = 'Le futur proche exprime une action qui va se passer bientôt. '.repeat(5);

describe('extractPreview', () => {
  it('keeps headings, paragraphs and list items of the main content, in order', () => {
    const d = doc(`<head><title>Futur proche – Lawless French</title></head><body>
      <nav><p>Menu link</p></nav>
      <header><h1>Site name</h1></header>
      <article>
        <h1>Futur proche</h1>
        <p>${filler}</p>
        <h2>Formation</h2>
        <ul><li>Je <strong>vais</strong> manger</li><li>Tu <b>vas</b> partir</li></ul>
        <script>alert(1)</script>
      </article>
      <aside><p>Related posts</p></aside>
      <footer><p>© 2026</p></footer>
    </body>`);
    const p = extractPreview(d, 'https://www.lawlessfrench.com/grammar/futur-proche/');
    expect(p.title).toBe('Futur proche – Lawless French');
    expect(p.blocks.map((b) => b.kind)).toEqual(['h1', 'p', 'h2', 'li', 'li']);
    expect(p.blocks[0].spans).toEqual([{ text: 'Futur proche' }]);
    expect(p.blocks[3].spans).toEqual([{ text: 'Je ' }, { text: 'vais', strong: true }, { text: ' manger' }]);
    const all = JSON.stringify(p.blocks);
    expect(all).not.toContain('Menu link');
    expect(all).not.toContain('Related posts');
    expect(all).not.toContain('alert');
    expect(p.truncated).toBe(false);
  });

  it('collapses whitespace and drops empty blocks', () => {
    const d = doc(`<body><main><p>  Nous   allons\n  visiter <br> Hanoi. </p><p> </p><p>·</p><p>${filler}</p></main></body>`);
    const p = extractPreview(d, 'https://example.org');
    expect(p.blocks[0].spans).toEqual([{ text: 'Nous allons visiter Hanoi.' }]);
    expect(p.blocks).toHaveLength(2);
  });

  it('does not repeat nested blocks inside list items', () => {
    const d = doc(`<body><main><ul><li><p>Premier point</p></li></ul><p>${filler}</p></main></body>`);
    const texts = extractPreview(d, 'https://example.org').blocks.map((b) => b.spans.map((s) => s.text).join(''));
    expect(texts.filter((t) => t === 'Premier point')).toHaveLength(1);
  });

  it('falls back to the body and to the URL as title', () => {
    const d = doc(`<body><div><p>Texte court.</p></div></body>`);
    const p = extractPreview(d, 'https://example.org/x');
    expect(p.title).toBe('https://example.org/x');
    expect(p.blocks).toHaveLength(1);
  });

  it('stops at the block limit and marks the preview as truncated', () => {
    const many = Array.from({ length: PREVIEW_MAX_BLOCKS + 10 }, (_, i) => `<p>Paragraphe ${i}</p>`).join('');
    const p = extractPreview(doc(`<body><main>${many}</main></body>`), 'https://example.org');
    expect(p.blocks).toHaveLength(PREVIEW_MAX_BLOCKS);
    expect(p.truncated).toBe(true);
  });
});

describe('detectCharset', () => {
  it('reads the header, then the meta tag, defaulting to UTF-8', () => {
    expect(detectCharset('text/html; charset=ISO-8859-1', '')).toBe('iso-8859-1');
    expect(detectCharset('text/html', '<meta charset="windows-1252">')).toBe('windows-1252');
    expect(detectCharset(null, '<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-15">')).toBe('iso-8859-15');
    expect(detectCharset(null, '')).toBe('utf-8');
    expect(detectCharset('text/html; charset=bogus-charset', '')).toBe('utf-8');
  });
});

describe('loadSourcePreview', () => {
  it('refuses pages outside the trusted study sites', async () => {
    await expect(loadSourcePreview('https://evil.example.com/page')).rejects.toThrow('untrusted');
  });
});
