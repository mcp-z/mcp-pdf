import assert from 'assert';
import PDFDocument from 'pdfkit';
import { standardFonts } from '../../../../src/lib/fonts.ts';
import { DEFAULT_FIELD_TEMPLATES } from '../../../../src/lib/formatting.ts';
import type { LayoutElement } from '../../../../src/lib/ir/types.ts';
import { DEFAULT_TYPOGRAPHY } from '../../../../src/lib/types/typography.ts';
import { buildBlock } from '../../../../src/lib/yoga-resume/blocks.ts';
import type { RenderContext } from '../../../../src/lib/yoga-resume/types.ts';
import { textRuns } from '../../../lib/fixture-fonts.ts';

const para = 'Built **systems** that scaled to millions of users while mentoring engineers and shipping on schedule. ';
const elements: Array<[string, LayoutElement]> = [
  ['text', { type: 'text', content: `${para.repeat(3)}\n\n${para}` }],
  ['section-title', { type: 'section-title', title: 'Experience' }],
  ['header', { type: 'header', name: 'Ada Lovelace', contactItems: [{ text: 'ada@example.com' }, { text: 'site', url: 'https://example.com' }] }],
  ['divider', { type: 'divider' }],
  [
    'keyword-list',
    {
      type: 'keyword-list',
      items: [
        { name: 'Languages', level: 'Expert', keywords: ['TypeScript', 'Go'] },
        { name: 'Tools', keywords: ['Git'] },
      ],
    },
  ],
  ['language-list', { type: 'language-list', items: [{ language: 'English', fluency: 'Native' }, { language: 'French' }] }],
  ['credential-list', { type: 'credential-list', items: [{ title: 'Prize', awarder: 'Society', summary: para.repeat(2) }] }],
  ['reference-list', { type: 'reference-list', items: [{ name: 'Babbage', reference: para.repeat(2) }] }],
  ['entry-header work', { type: 'entry-header', variant: 'work', entry: { name: 'Engines Ltd', position: 'Lead', location: 'London', startDate: '2020-01' }, marginTop: 0 }],
  ['entry-header education', { type: 'entry-header', variant: 'education', entry: { institution: 'Uni', studyType: 'BSc', area: 'Math', score: '4.0', startDate: '2010-01', endDate: '2014-01' } }],
  ['structured-content', { type: 'structured-content', summary: [para.repeat(2)], bullets: [para, 'Short'] }],
  ['template', { type: 'template', template: '{{ name }} builds engines', data: { name: 'Ada' } }],
];

async function drawn(element: LayoutElement, top: number): Promise<{ height: number; baselines: number[] }> {
  const doc = new PDFDocument();
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  const ctx: RenderContext = { doc, typography: { ...DEFAULT_TYPOGRAPHY, fonts: standardFonts('Helvetica') }, fieldTemplates: DEFAULT_FIELD_TEMPLATES, emojiAvailable: false, fonts: standardFonts('Helvetica'), parseMarkdown: true, hyperlinkColor: '#0066CC' };
  const block = buildBlock(ctx, element, 400);
  for (const line of block.lines) line.draw(50, top + line.top);
  doc.end();
  // Baselines in page coordinates measured from the top, as the block was laid out
  return { height: block.height, baselines: textRuns(await done).map((r) => 792 - r.y) };
}

describe('yoga-resume/blocks', () => {
  for (const [name, element] of elements) {
    it(`draws ${name} within the height it reports`, async () => {
      const { height, baselines } = await drawn(element, 100);
      assert.ok(height > 0, 'has height');
      if (name !== 'divider') assert.ok(baselines.length > 0, 'draws text');
      for (const baseline of baselines) assert.ok(baseline > 100 && baseline <= 100 + height, `baseline ${baseline} outside 100..${100 + height}`);
    });
  }

  it('reports lines in order, each within the block', () => {
    const doc = new PDFDocument();
    const ctx: RenderContext = { doc, typography: { ...DEFAULT_TYPOGRAPHY, fonts: standardFonts('Helvetica') }, fieldTemplates: DEFAULT_FIELD_TEMPLATES, emojiAvailable: false, fonts: standardFonts('Helvetica'), parseMarkdown: true, hyperlinkColor: '#0066CC' };
    for (const [, element] of elements) {
      const block = buildBlock(ctx, element, 400);
      block.lines.forEach((line, i) => {
        assert.ok(line.top >= (block.lines[i - 1]?.top ?? 0));
        assert.ok(line.top + line.height <= block.height + 1e-6);
      });
    }
  });

  it('keeps titles and entry headers with the next block and breaks text between lines', () => {
    const doc = new PDFDocument();
    const ctx: RenderContext = { doc, typography: { ...DEFAULT_TYPOGRAPHY, fonts: standardFonts('Helvetica') }, fieldTemplates: DEFAULT_FIELD_TEMPLATES, emojiAvailable: false, fonts: standardFonts('Helvetica'), parseMarkdown: true, hyperlinkColor: '#0066CC' };
    const byName = new Map(elements);
    for (const name of ['section-title', 'entry-header work', 'entry-header education']) {
      const block = buildBlock(ctx, byName.get(name) as LayoutElement, 400);
      assert.strictEqual(block.keepWithNext, true, name);
      assert.ok(
        block.lines.slice(0, -1).every((l) => l.keepWithNext),
        `${name} is unbreakable`
      );
    }
    const text = buildBlock(ctx, byName.get('text') as LayoutElement, 400);
    assert.strictEqual(text.keepWithNext, false);
    assert.ok(text.lines.length > 2 && text.lines.every((l) => !l.keepWithNext));
  });
});
