import assert from 'assert';
import PDFDocument from 'pdfkit';
import { setupFonts, standardFonts } from '../../../src/lib/fonts.ts';
import { layoutText } from '../../../src/lib/text-layout.ts';
import { DEJAVU_SANS, pageContents, textRuns } from '../../lib/fixture-fonts.ts';

const helvetica = standardFonts('Helvetica');
const paint = { fonts: helvetica, style: {}, fontSize: 12, color: 'black' };
const words = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon';

async function draw(fn: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  const doc = new PDFDocument();
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  fn(doc);
  doc.end();
  return done;
}

// x of each text-showing operation, from the text matrix
function runXs(pdf: Buffer): number[] {
  return pageContents(pdf).flatMap((c) => Array.from(c.matchAll(/1 0 0 1 (\S+) \S+ Tm/g), (m) => Number(m[1])));
}

describe('layoutText', () => {
  it('reports one line per wrapped line and a height of lines times line height', () => {
    const doc = new PDFDocument();
    const block = layoutText(doc, words, paint, { width: 150 });
    const lineHeight = doc.font('Helvetica').fontSize(12).currentLineHeight(true);
    assert.ok(block.lines.length > 2);
    assert.strictEqual(block.height, block.lines.length * lineHeight);
    assert.deepStrictEqual(
      block.lines.map((l) => l.top),
      block.lines.map((_, i) => i * lineHeight)
    );
  });

  // The lines PDFKit's own wrapper produces for `text` at `width`
  function pdfkitLines(font: string, text: string, width: number): string[] {
    const doc = new PDFDocument();
    const lines: string[] = [];
    doc.font(font).fontSize(12);
    const fragment = (doc as unknown as { _fragment: (text: string, ...rest: unknown[]) => unknown })._fragment.bind(doc);
    (doc as unknown as { _fragment: (text: string, ...rest: unknown[]) => unknown })._fragment = (line: string, ...rest: unknown[]) => {
      lines.push(line.replace(/\s+$/, ''));
      return fragment(line, ...rest);
    };
    doc.text(text, 0, 0, { width });
    return lines;
  }

  function ourLines(doc: PDFKit.PDFDocument, fonts: typeof helvetica, text: string, width: number): Promise<string[]> {
    return draw((target) => {
      const block = layoutText(target, text, { ...paint, fonts }, { width });
      for (const line of block.lines) line.draw(0, 100 + line.top);
      assert.strictEqual(block.lines.length, layoutText(doc, text, { ...paint, fonts }, { width }).lines.length);
    }).then((pdf) => {
      const byLine = new Map<number, string>();
      for (const run of textRuns(pdf)) byLine.set(run.y, (byLine.get(run.y) ?? '') + run.text);
      return [...byLine.values()];
    });
  }

  it('wraps text where PDFKit wraps it', async () => {
    const paragraph = 'Built systems that scaled to millions of users while mentoring engineers and shipping on schedule. '.repeat(4);
    for (const width of [80, 150, 233, 400, 468]) {
      assert.deepStrictEqual(await ourLines(new PDFDocument(), helvetica, paragraph, width), pdfkitLines('Helvetica', paragraph, width), `width ${width}`);
    }
  });

  it('breaks after hyphens and splits a word longer than the line', async () => {
    for (const text of ['a well-known state-of-the-art approach to cross-platform work', 'Supercalifragilisticexpialidocious and more']) {
      assert.deepStrictEqual(await ourLines(new PDFDocument(), helvetica, text, 60), pdfkitLines('Helvetica', text, 60), text);
    }
  });

  it('wraps text without spaces, such as Chinese', async () => {
    const doc = new PDFDocument();
    const cjk = '很久很久以前在一个遥远的星系里有一位勇敢的工程师他建造了能够计算的机器';
    // DejaVu has no CJK glyphs, but measures them with real (fallback) widths, unlike the built-in fonts
    const block = layoutText(doc, cjk, { ...paint, fonts: await setupFonts(doc, DEJAVU_SANS) }, { width: 100 });
    assert.ok(block.lines.length > 1, 'wrapped');
    assert.ok(
      block.lines.every((l) => l.width <= 100 + 1e-6),
      `widths: ${block.lines.map((l) => l.width).join(', ')}`
    );
  });

  it('draws exactly the lines it measured, at their tops', async () => {
    const doc0 = new PDFDocument();
    const block = layoutText(doc0, `${words}\n\nsecond paragraph`, paint, { width: 150 });
    const pdf = await draw((doc) => {
      const fresh = layoutText(doc, `${words}\n\nsecond paragraph`, paint, { width: 150 });
      for (const line of fresh.lines) line.draw(50, 100 + line.top);
    });
    const drawnYs = [...new Set(textRuns(pdf).map((r) => Number(r.y.toFixed(3))))];
    assert.strictEqual(drawnYs.length, block.lines.filter((l) => !l.empty).length);
  });

  it('starts continuation lines at the left edge, without a leading space', async () => {
    const pdf = await draw((doc) => {
      for (const line of layoutText(doc, words, paint, { width: 150 }).lines) line.draw(50, 100 + line.top);
    });
    assert.ok(
      runXs(pdf).every((x) => x === 50),
      `xs: ${runXs(pdf).join(', ')}`
    );
    assert.ok(textRuns(pdf).every((r) => !r.text.startsWith(' ')));
  });

  it('justifies every line but the last to the full width', () => {
    const doc = new PDFDocument();
    const block = layoutText(doc, words, paint, { width: 150, align: 'justify' });
    const widths = block.lines.map((l) => l.width);
    for (const w of widths.slice(0, -1)) assert.ok(Math.abs(w - 150) < 0.001, `justified width ${w}`);
    assert.ok((widths[widths.length - 1] ?? 0) < 150);
  });

  it('includes character spacing in widths', () => {
    const doc = new PDFDocument();
    const plain = layoutText(doc, 'SPACED', paint, { width: 400 }).lines[0]?.width ?? 0;
    const spaced = layoutText(doc, 'SPACED', paint, { width: 400, characterSpacing: 2 }).lines[0]?.width ?? 0;
    assert.strictEqual(spaced - plain, 2 * 'SPACED'.length);
  });
});
