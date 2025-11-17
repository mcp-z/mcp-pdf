import { parseStoredName, writeFile } from '@mcpeasy/server';
import assert from 'assert';
import { existsSync, rmSync } from 'fs';
import { join, resolve } from 'path';

describe('output-handler', () => {
  describe('writeFile', () => {
    let testDir: string;

    beforeEach(() => {
      // Create a test directory
      testDir = join('.tmp', `server-pdf-test-${Date.now()}`);
    });

    it('writes PDF to specified directory with ID prefix', async () => {
      const buffer = Buffer.from('test pdf content');
      const result = await writeFile(buffer, 'test.pdf', { storageDir: testDir });

      assert.ok(existsSync(result.fullPath));
      assert.ok(result.fullPath.startsWith(resolve(testDir)));
      assert.ok(result.storedName.includes('test.pdf'));
      // Verify ID-prefixed format with tilde delimiter
      assert.ok(result.storedName.match(/^[0-9a-f-]+~test\.pdf$/));

      // Clean up
      rmSync(testDir, { recursive: true, force: true });
    });

    it('generates unique ID for each file', async () => {
      const buffer = Buffer.from('test pdf content');
      const result1 = await writeFile(buffer, 'test.pdf', { storageDir: testDir });
      const result2 = await writeFile(buffer, 'test.pdf', { storageDir: testDir });

      // Should have different IDs
      assert.notStrictEqual(result1.storedName, result2.storedName);
      assert.ok(existsSync(result1.fullPath));
      assert.ok(existsSync(result2.fullPath));

      // Clean up
      rmSync(testDir, { recursive: true, force: true });
    });

    it('creates directory if it does not exist', async () => {
      const newDir = join('.tmp', `server-pdf-new-${Date.now()}`);

      const buffer = Buffer.from('test pdf content');
      const result = await writeFile(buffer, 'test.pdf', { storageDir: newDir });

      assert.ok(existsSync(newDir));
      assert.ok(existsSync(result.fullPath));

      // Clean up
      rmSync(newDir, { recursive: true, force: true });
    });
  });

  describe('parseStoredName', () => {
    it('extracts filename from ID-prefixed format', () => {
      const stored = 'abc123~invoice.pdf';
      const result = parseStoredName(stored, '~');
      assert.strictEqual(result.id, 'abc123');
      assert.strictEqual(result.filename, 'invoice.pdf');
    });

    it('handles filenames with delimiter in them (parses by FIRST occurrence)', () => {
      const stored = 'abc123~my-document-v2.pdf';
      const result = parseStoredName(stored, '~');
      assert.strictEqual(result.id, 'abc123');
      assert.strictEqual(result.filename, 'my-document-v2.pdf');
    });

    it('handles simple filenames', () => {
      const stored = 'abc123~resume.pdf';
      const result = parseStoredName(stored, '~');
      assert.strictEqual(result.id, 'abc123');
      assert.strictEqual(result.filename, 'resume.pdf');
    });

    it('handles filenames with spaces', () => {
      const stored = 'abc123~project plan.pdf';
      const result = parseStoredName(stored, '~');
      assert.strictEqual(result.id, 'abc123');
      assert.strictEqual(result.filename, 'project plan.pdf');
    });

    it('returns original if format does not match', () => {
      const stored = 'invalid-format.pdf';
      const result = parseStoredName(stored, '~');
      assert.strictEqual(result.id, 'invalid-format.pdf');
      assert.strictEqual(result.filename, 'invalid-format.pdf');
    });

    it('handles ID without trailing filename', () => {
      const stored = 'abc123';
      const result = parseStoredName(stored, '~');
      // Should return the original since there's no delimiter
      assert.strictEqual(result.id, stored);
      assert.strictEqual(result.filename, stored);
    });
  });
});
