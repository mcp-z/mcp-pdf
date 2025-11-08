import assert from 'assert/strict';
import { existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { extractOriginalFilename, writePdfToFile } from '../../src/lib/output-handler.ts';

describe('output-handler', () => {
  // Filename sanitization and uniqueness are handled externally (UUIDs).

  describe('writePdfToFile', () => {
    let testDir: string;

    beforeEach(() => {
      // Create a test directory
      testDir = join(tmpdir(), `mcp-pdf-test-${Date.now()}`);
    });

    it('writes PDF to specified directory', async () => {
      const buffer = Buffer.from('test pdf content');
      const result = await writePdfToFile(buffer, 'test.pdf', testDir);

      assert.ok(existsSync(result.fullPath));
      assert.ok(result.fullPath.startsWith(testDir));
      assert.ok(result.fullPath.endsWith('test.pdf'));

      // Clean up
      rmSync(testDir, { recursive: true, force: true });
    });

    it('writes UUID-based filename (no sanitization needed)', async () => {
      const buffer = Buffer.from('test pdf content');
      // In production, tools generate UUIDs which are already safe
      const safeUuid = 'abc123-def456.pdf';
      const result = await writePdfToFile(buffer, safeUuid, testDir);

      assert.ok(existsSync(result.fullPath));
      assert.ok(result.fullPath.startsWith(testDir));
      assert.ok(result.fullPath.endsWith(safeUuid));

      // Clean up
      rmSync(testDir, { recursive: true, force: true });
    });

    it('creates directory if it does not exist', async () => {
      const newDir = join(tmpdir(), `mcp-pdf-new-${Date.now()}`);

      const buffer = Buffer.from('test pdf content');
      const result = await writePdfToFile(buffer, 'test.pdf', newDir);

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
