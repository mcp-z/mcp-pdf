import { mcp } from '@mcp-z/mcp-pdf';
import assert from 'assert';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { safeRmSync } from 'fs-remove-compat';
import { join } from 'path';
import { fileURLToPath } from 'url';
import type { PDFOutput as Output } from '../../../../src/lib/pdf-core.ts';
import type { Input } from '../../../../src/mcp/tools/pdf-document.ts';
import { createExtra } from '../../../lib/create-extra.ts';
import { createTestConfig } from '../../../lib/create-test-config.ts';
import { DEJAVU_SANS, embeddedFontNames, pageContents, type TextRun, textRuns, writeDejaVuCollection } from '../../../lib/fixture-fonts.ts';

describe('pdf-document font option', () => {
  const testOutputDir = join(process.cwd(), '.tmp', 'pdf-document-tests');
  const testStorageDir = join(testOutputDir, 'storage');
  const tool = mcp.toolFactories.pdfDocument();
  const extra = createExtra(createTestConfig(testOutputDir, testStorageDir));

  before(() => mkdirSync(testStorageDir, { recursive: true }));
  after(() => {
    if (existsSync(testOutputDir)) safeRmSync(testOutputDir, { recursive: true, force: true });
  });

  async function run(input: Input): Promise<Output> {
    const result = await tool.handler(input, extra);
    return (result.structuredContent as { result: Output }).result;
  }

  it('renders with a font file and reports no warnings for covered text', async () => {
    const output = await run({ font: DEJAVU_SANS, markdown: true, content: [{ type: 'text', text: 'Привет **мир**' }] });
    assert.strictEqual(output.warnings, undefined);
    assert.deepStrictEqual([...new Set(embeddedFontNames(readFileSync(fileURLToPath(output.uri))))], ['DejaVuSans']);
  });

  it('warns about characters the font file lacks', async () => {
    const output = await run({ font: DEJAVU_SANS, content: [{ type: 'text', text: 'Hello 你好' }] });
    assert.ok(
      output.warnings?.some((w) => w.includes('"你"') && w.includes('DejaVuSans')),
      `warnings: ${JSON.stringify(output.warnings)}`
    );
  });

  it('refuses a font URL on a non-public address', async () => {
    await assert.rejects(tool.handler({ font: 'https://169.254.169.254/latest/font.ttf', content: [{ type: 'text', text: 'x' }] }, extra), /not a public address/);
  });

  it('warns that a standard font cannot render Cyrillic', async () => {
    const output = await run({ font: 'Helvetica', content: [{ type: 'text', text: 'Привет' }] });
    assert.ok(
      output.warnings?.some((w) => w.includes('Helvetica')),
      `warnings: ${JSON.stringify(output.warnings)}`
    );
  });
});

describe('pdf-document bold and italic', () => {
  const testOutputDir = join(process.cwd(), '.tmp', 'pdf-document-style-tests');
  const testStorageDir = join(testOutputDir, 'storage');
  const tool = mcp.toolFactories.pdfDocument();
  const extra = createExtra(createTestConfig(testOutputDir, testStorageDir));
  let collection: string;

  before(() => {
    mkdirSync(testStorageDir, { recursive: true });
    collection = writeDejaVuCollection(testOutputDir);
  });
  after(() => {
    if (existsSync(testOutputDir)) safeRmSync(testOutputDir, { recursive: true, force: true });
  });

  async function runs(input: Input): Promise<TextRun[]> {
    const result = await tool.handler(input, extra);
    return textRuns(readFileSync(fileURLToPath((result.structuredContent as { result: Output }).result.uri)));
  }

  it('fakes a bold heading and markdown styles with a one-style font', async () => {
    const drawn = await runs({
      font: DEJAVU_SANS,
      markdown: true,
      content: [
        { type: 'heading', text: 'Heading' },
        { type: 'text', text: 'plain **bold** *italic*' },
      ],
    });
    assert.deepStrictEqual(
      drawn.map(({ mode, oblique }) => ({ mode, oblique })),
      [
        { mode: 2, oblique: false },
        { mode: 0, oblique: false },
        { mode: 2, oblique: false },
        { mode: 0, oblique: false },
        { mode: 0, oblique: true },
      ]
    );
  });

  it('uses real faces from a collection', async () => {
    const drawn = await runs({
      font: collection,
      markdown: true,
      content: [
        { type: 'heading', text: 'Heading' },
        { type: 'text', text: 'plain **bold** *italic*' },
      ],
    });
    assert.deepStrictEqual(
      drawn.map((r) => r.font),
      ['DejaVuSans-Bold', 'DejaVuSans', 'DejaVuSans-Bold', 'DejaVuSans', 'DejaVuSans-Oblique']
    );
    assert.ok(drawn.every((r) => r.mode === 0 && !r.oblique));
  });
});

describe('pdf-document text options', () => {
  const testOutputDir = join(process.cwd(), '.tmp', 'pdf-document-option-tests');
  const testStorageDir = join(testOutputDir, 'storage');
  const tool = mcp.toolFactories.pdfDocument();
  const extra = createExtra(createTestConfig(testOutputDir, testStorageDir));

  before(() => mkdirSync(testStorageDir, { recursive: true }));
  after(() => {
    if (existsSync(testOutputDir)) safeRmSync(testOutputDir, { recursive: true, force: true });
  });

  async function pdfFor(input: Input): Promise<Buffer> {
    const result = await tool.handler(input, extra);
    return readFileSync(fileURLToPath((result.structuredContent as { result: Output }).result.uri));
  }

  it('parses markdown by default and draws it literally with markdown: false', async () => {
    const parsed = textRuns(await pdfFor({ font: 'Helvetica', content: [{ type: 'text', text: 'a **b**' }] }));
    assert.deepStrictEqual(
      parsed.map((r) => [r.font, r.text]),
      [
        ['Helvetica', 'a '],
        ['Helvetica-Bold', 'b'],
      ]
    );
    const literal = textRuns(await pdfFor({ font: 'Helvetica', markdown: false, content: [{ type: 'text', text: 'a **b**' }] }));
    assert.deepStrictEqual(
      literal.map((r) => [r.font, r.text]),
      [['Helvetica', 'a **b**']]
    );
  });

  it('applies color and oblique', async () => {
    const pdf = await pdfFor({ font: 'Helvetica', content: [{ type: 'text', text: 'Styled', color: '#ff0000', oblique: true }] });
    assert.deepStrictEqual(
      textRuns(pdf).map(({ fill, oblique }) => ({ fill, oblique })),
      [{ fill: '1 0 0', oblique: true }]
    );
  });

  it('applies underline and strike', async () => {
    for (const decoration of ['underline', 'strike'] as const) {
      const pdf = await pdfFor({ font: 'Helvetica', content: [{ type: 'text', text: 'Decorated', [decoration]: true }] });
      assert.match(pageContents(pdf).join('\n'), / l\nS\n/, `${decoration} line is stroked`);
    }
  });

  it('applies link', async () => {
    const pdf = await pdfFor({ font: 'Helvetica', content: [{ type: 'text', text: 'Site', link: 'https://example.com/' }] });
    assert.match(pdf.toString('latin1'), /\/URI \(https:\/\/example\.com\/\)/);
  });
});

describe('pdf-document images', () => {
  const testOutputDir = join(process.cwd(), '.tmp', 'pdf-document-image-tests');
  const testStorageDir = join(testOutputDir, 'storage');
  const tool = mcp.toolFactories.pdfDocument();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const localImage = join(testOutputDir, 'pixel.png');

  before(() => {
    mkdirSync(testStorageDir, { recursive: true });
    writeFileSync(localImage, png);
  });
  after(() => {
    if (existsSync(testOutputDir)) safeRmSync(testOutputDir, { recursive: true, force: true });
  });

  it('embeds a local image over stdio', async () => {
    const extra = createExtra(createTestConfig(testOutputDir, testStorageDir));
    const result = await tool.handler({ content: [{ type: 'image', imagePath: localImage, width: 20 }] }, extra);
    const pdf = readFileSync(fileURLToPath((result.structuredContent as { result: Output }).result.uri)).toString('latin1');
    assert.match(pdf, /\/Subtype \/Image/);
  });

  it('refuses a local image over http', async () => {
    const extra = createExtra(createTestConfig(testOutputDir, testStorageDir, { type: 'http', port: 1 }));
    await assert.rejects(tool.handler({ content: [{ type: 'image', imagePath: localImage, width: 20 }] }, extra), /only available when the server runs over stdio/);
  });
});
