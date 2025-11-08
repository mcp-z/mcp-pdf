import { extractOriginalFilename, writeFileWithUUID } from '@mcpeasy/server';
import assert from 'assert/strict';
import { existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('output-handler', () => {
  describe('writeFileWithUUID', () => {
    let testDir: string;

    beforeEach(() => {
      // Create a test directory
      testDir = join(tmpdir(), `mcp-pdf-test-${Date.now()}`);
    });

    it('writes PDF to specified directory with UUID prefix', async () => {
      const buffer = Buffer.from('test pdf content');
      const result = await writeFileWithUUID(buffer, 'test.pdf', testDir);

      assert.ok(existsSync(result.fullPath));
      assert.ok(result.fullPath.startsWith(testDir));
      assert.ok(result.storedName.endsWith('-test.pdf'));
      // Verify UUID prefix format (36 chars + hyphen)
      assert.ok(result.storedName.match(/^[0-9a-f-]{36}-test\.pdf$/));

      // Clean up
      rmSync(testDir, { recursive: true, force: true });
    });

    it('generates unique UUID for each file', async () => {
      const buffer = Buffer.from('test pdf content');
      const result1 = await writeFileWithUUID(buffer, 'test.pdf', testDir);
      const result2 = await writeFileWithUUID(buffer, 'test.pdf', testDir);

      // Should have different UUIDs
      assert.notStrictEqual(result1.storedName, result2.storedName);
      assert.ok(existsSync(result1.fullPath));
      assert.ok(existsSync(result2.fullPath));

      // Clean up
      rmSync(testDir, { recursive: true, force: true });
    });

    it('creates directory if it does not exist', async () => {
      const newDir = join(tmpdir(), `mcp-pdf-new-${Date.now()}`);

      const buffer = Buffer.from('test pdf content');
      const result = await writeFileWithUUID(buffer, 'test.pdf', newDir);

      assert.ok(existsSync(newDir));
      assert.ok(existsSync(result.fullPath));

      // Clean up
      rmSync(newDir, { recursive: true, force: true });
    });
  });

  describe('extractOriginalFilename', () => {
    it('extracts filename from UUID-prefixed format', () => {
      const stored = 'abc12345-1234-5678-9abc-def123456789-invoice.pdf';
      const result = extractOriginalFilename(stored);
      assert.strictEqual(result, 'invoice.pdf');
    });

    it('handles filenames with hyphens', () => {
      const stored = 'abc12345-1234-5678-9abc-def123456789-my-document-v2.pdf';
      const result = extractOriginalFilename(stored);
      assert.strictEqual(result, 'my-document-v2.pdf');
    });

    it('handles simple filenames', () => {
      const stored = 'abc12345-1234-5678-9abc-def123456789-resume.pdf';
      const result = extractOriginalFilename(stored);
      assert.strictEqual(result, 'resume.pdf');
    });

    it('handles filenames with spaces', () => {
      const stored = 'abc12345-1234-5678-9abc-def123456789-project plan.pdf';
      const result = extractOriginalFilename(stored);
      assert.strictEqual(result, 'project plan.pdf');
    });

    it('returns original if format does not match', () => {
      const stored = 'invalid-format.pdf';
      const result = extractOriginalFilename(stored);
      assert.strictEqual(result, 'invalid-format.pdf');
    });

    it('handles UUID without trailing filename', () => {
      const stored = 'abc12345-1234-5678-9abc-def123456789';
      const result = extractOriginalFilename(stored);
      // Should return the original since there's no filename after UUID
      assert.strictEqual(result, stored);
    });
  });
});
