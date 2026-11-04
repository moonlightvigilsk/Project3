import { describe, expect, it } from 'vitest';
import { parseHTML } from 'linkedom';
import { buildTextModel, isBlockElement, offsetOfPosition, positionAt, type TextModel } from '../editable-text';

function model(html: string): { root: Element; m: TextModel } {
  const { document } = parseHTML(`<!doctype html><html><body><div id="root">${html}</div></body></html>`);
  const root = document.getElementById('root')!;
  return { root, m: buildTextModel(root, isBlockElement) };
}

/** Text covered by model offsets [start, end), read back from the DOM positions. */
function domText(m: TextModel, start: number, end: number): string {
  const from = positionAt(m, start, 'start')!;
  const to = positionAt(m, end, 'end')!;
  let out = '';
  let inside = false;
  let prevEnd = -1;
  for (const s of m.segments) {
    if (s.node === from.node) inside = true;
    if (!inside) {
      continue;
    }
    const a = s.node === from.node ? from.offset : 0;
    const b = s.node === to.node ? to.offset : s.node.length;
    // A virtual "\n" sits between two nodes only when the model has a gap there.
    if (s.node !== from.node && s.start > prevEnd) out += '\n';
    prevEnd = s.start + s.node.length;
    out += s.node.data.slice(a, b);
    if (s.node === to.node) break;
  }
  return out;
}

describe('buildTextModel', () => {
  it('separates paragraphs with one newline (Lexical / Gmail / Draft markup)', () => {
    const { m } = model(
      '<p dir="ltr"><span data-lexical-text="true">Bonjour à tous.</span></p>' +
        '<p dir="ltr"><span data-lexical-text="true">Hier tu as </span><b><span>fais</span></b><span> une remarque.</span></p>'
    );
    expect(m.text).toBe('Bonjour à tous.\nHier tu as fais une remarque.');
  });

  it('counts <br> as a newline and does not double it at a paragraph end', () => {
    expect(model('Voici l ami.<br>D accord.').m.text).toBe('Voici l ami.\nD accord.');
    expect(model('<p>a<br></p><p>b</p>').m.text).toBe('a\nb');
    // Empty paragraph (Lexical/Chrome: <p><br></p>) keeps its blank line.
    expect(model('<p>a</p><p><br></p><p>b</p>').m.text).toBe('a\n\nb');
  });

  it('closes nested blocks and lists', () => {
    expect(model('<div>avant<div>milieu</div>après</div>').m.text).toBe('avant\nmilieu\naprès');
    expect(model('<ul><li>un</li><li>deux</li></ul>fin').m.text).toBe('un\ndeux\nfin');
  });

  it('ignores HTML indentation between blocks but keeps spaces inside a line', () => {
    const { m } = model('\n  <p>Il <b>est</b> <i>là</i>.</p>\n  <p>Fin.</p>\n');
    expect(m.text).toBe('Il est là.\nFin.');
  });

  it('keeps non-breaking spaces and skips script/style', () => {
    expect(model('<p>Oui !</p><style>p{}</style><script>x()</script>').m.text).toBe('Oui !');
  });
});

describe('positionAt / offsets', () => {
  it('maps every word of a later paragraph to the right text node (no drift)', () => {
    const { m } = model('<p>Première ligne.</p><p>Deuxième ligne.</p><p>Hier tu as fais une remarque.</p>');
    for (const word of ['Première', 'Deuxième', 'fais', 'remarque']) {
      const start = m.text.indexOf(word);
      expect(domText(m, start, start + word.length)).toBe(word);
    }
  });

  it('a start on a virtual newline moves to the next node; an end there stays on the previous one', () => {
    const { m } = model('<p>ab</p><p>cd</p>');
    expect(m.text).toBe('ab\ncd');
    const start = positionAt(m, 2, 'start')!; // the "\n"
    expect([start.node.data, start.offset]).toEqual(['cd', 0]);
    const end = positionAt(m, 2, 'end')!;
    expect([end.node.data, end.offset]).toEqual(['ab', 2]);
    expect(domText(m, 1, 4)).toBe('b\nc');
  });

  it('spans formatted runs inside a paragraph', () => {
    const { m } = model('<p>tu <b>as</b> fais</p>');
    expect(domText(m, 0, m.text.length)).toBe('tu as fais');
    expect(m.segments.map((s) => s.start)).toEqual([0, 3, 5]);
  });
});

describe('offsetOfPosition (caret -> model offset, US-16)', () => {
  it('maps a caret in a text node, across paragraphs', () => {
    const { root, m } = model('<p>Bonjour.</p><p>Tu as <b>fais</b> ça.</p>');
    expect(m.text).toBe('Bonjour.\nTu as fais ça.');
    const fais = root.querySelector('b')!.firstChild!;
    expect(offsetOfPosition(m, fais, 2)).toBe(m.text.indexOf('fais') + 2);
    const first = root.querySelector('p')!.firstChild!;
    expect(offsetOfPosition(m, first, 0)).toBe(0);
  });

  it('maps an element position to the next text node', () => {
    const { root, m } = model('<p>Un.</p><p>Deux <b>trois</b></p>');
    const second = root.querySelectorAll('p')[1];
    expect(offsetOfPosition(m, second, 1)).toBe(m.text.indexOf('trois'));
    expect(offsetOfPosition(m, root, 1)).toBe(m.text.indexOf('Deux'));
  });

  it('returns the end for a position after all text, null for text outside the model', () => {
    const { root, m } = model('<p>Un.</p>');
    expect(offsetOfPosition(m, root, 1)).toBe(m.text.length);
    const { document } = parseHTML('<p>ailleurs</p>');
    expect(offsetOfPosition(m, document.querySelector('p')!.firstChild!, 0)).toBeNull();
  });
});
