/**
 * Reaches cdn.jsdelivr.net, github.com and raw.githubusercontent.com for the download and cache specs.
 */
import assert from 'assert';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { safeRmSync } from 'fs-remove-compat';
import { join } from 'path';
import { Readable } from 'stream';
import { downloadFile, isPublicAddress, MAX_DOWNLOAD_BYTES, readWithLimit } from '../../../src/lib/download.ts';

const DEJAVU_URL = 'https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf';
const REDIRECTING_URL = 'https://github.com/senotrusov/dejavu-fonts-ttf/raw/master/ttf/DejaVuSans.ttf';
const DEJAVU = readFileSync(join(process.cwd(), 'node_modules', 'dejavu-fonts-ttf', 'ttf', 'DejaVuSans.ttf'));

describe('isPublicAddress', () => {
  it('accepts public addresses', () => {
    for (const address of ['1.1.1.1', '151.101.1.229', '2606:4700:4700::1111']) assert.strictEqual(isPublicAddress(address), true, address);
  });

  it('rejects loopback, private, link-local, shared, unspecified and multicast addresses, in any notation', () => {
    for (const address of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a00:1']) {
      assert.strictEqual(isPublicAddress(address), false, address);
    }
  });
});

describe('readWithLimit', () => {
  it('returns content up to the limit', async () => {
    assert.deepStrictEqual(await readWithLimit(Readable.from([Buffer.from('ab'), Buffer.from('cd')]), 4), Buffer.from('abcd'));
  });

  it('stops reading past the limit', async () => {
    await assert.rejects(readWithLimit(Readable.from([Buffer.from('ab'), Buffer.from('cde')]), 4), /larger than 4 bytes/);
  });
});

describe('downloadFile', () => {
  const cacheDir = join(process.cwd(), '.tmp', 'download-tests');
  afterEach(() => safeRmSync(cacheDir, { recursive: true, force: true }));

  it('refuses non-https URLs', async () => {
    await assert.rejects(downloadFile('http://cdn.jsdelivr.net/font.ttf', cacheDir), /https/);
  });

  it('refuses hosts that are or resolve to non-public addresses before connecting', async () => {
    for (const url of ['https://127.0.0.1/font.ttf', 'https://[::1]/font.ttf', 'https://169.254.169.254/font.ttf', 'https://localhost/font.ttf']) {
      await assert.rejects(downloadFile(url, cacheDir), /not a public address/, url);
    }
  });

  it('downloads into the cache and reuses the cached file', async () => {
    const first = await downloadFile(DEJAVU_URL, cacheDir);
    assert.ok(first.startsWith(cacheDir));
    assert.ok(readFileSync(first).equals(DEJAVU));
    const written = statSync(first).mtimeMs;
    const second = await downloadFile(DEJAVU_URL, cacheDir);
    assert.strictEqual(second, first);
    assert.strictEqual(statSync(second).mtimeMs, written, 'served from the cache');
    assert.deepStrictEqual(
      readdirSync(cacheDir).filter((name) => name.endsWith('.tmp')),
      [],
      'no staging files left behind'
    );
  });

  it('keeps different URLs apart even when their file names match', async () => {
    const plain = await downloadFile(DEJAVU_URL, cacheDir);
    const withQuery = await downloadFile(`${DEJAVU_URL}?v=2`, cacheDir);
    assert.notStrictEqual(withQuery, plain);
  });

  it('follows https redirects to public hosts', async () => {
    const path = await downloadFile(REDIRECTING_URL, cacheDir);
    assert.ok(existsSync(path));
    assert.ok(readFileSync(path).equals(DEJAVU));
  });

  it('caps downloads at MAX_DOWNLOAD_BYTES', () => {
    assert.strictEqual(MAX_DOWNLOAD_BYTES, 20 * 1024 * 1024);
  });
});
