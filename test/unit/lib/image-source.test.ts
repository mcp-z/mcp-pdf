/**
 * Reaches cdn.jsdelivr.net for the download specs.
 */
import assert from 'assert';
import { readFileSync } from 'fs';
import { safeRmSync } from 'fs-remove-compat';
import { join } from 'path';
import { resolveContentImages, resolveImageSource } from '../../../src/lib/image-source.ts';

const PNG_URL = 'https://cdn.jsdelivr.net/npm/zod-to-json-schema@3.25.2/.github/CR_logotype-full-color.png';
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

describe('resolveImageSource', () => {
  const imageCacheDir = join(process.cwd(), '.tmp', 'image-source-tests');
  afterEach(() => safeRmSync(imageCacheDir, { recursive: true, force: true }));

  it('uses a local path as given over stdio', async () => {
    assert.strictEqual(await resolveImageSource('/images/logo.png', 'stdio', { imageCacheDir }), '/images/logo.png');
  });

  it('refuses a local path over http', async () => {
    await assert.rejects(resolveImageSource('/images/logo.png', 'http', { imageCacheDir }), /only available when the server runs over stdio/);
  });

  it('downloads an https URL into the image cache over either transport', async () => {
    for (const transport of ['stdio', 'http'] as const) {
      const local = await resolveImageSource(PNG_URL, transport, { imageCacheDir });
      assert.ok(local.startsWith(imageCacheDir));
      assert.ok(readFileSync(local).subarray(0, 4).equals(PNG_SIGNATURE));
    }
  });

  it('refuses an http URL', async () => {
    await assert.rejects(resolveImageSource('http://cdn.jsdelivr.net/x.png', 'stdio', { imageCacheDir }), /https/);
  });
});

describe('resolveContentImages', () => {
  it('resolves images inside groups and leaves other items untouched', async () => {
    const content = [
      { type: 'text', text: 'a' },
      { type: 'group', children: [{ type: 'image', imagePath: '/images/logo.png', width: 10 }] },
    ];
    assert.deepStrictEqual(await resolveContentImages(content, 'stdio'), content);
    await assert.rejects(resolveContentImages(content, 'http'), /only available when the server runs over stdio/);
  });
});
