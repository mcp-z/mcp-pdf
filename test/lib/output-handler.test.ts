import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, test } from 'node:test';
import { writePdfToFile } from '../../src/lib/output-handler.ts';

describe('output-handler', () => {
  // Filename sanitization and uniqueness are handled externally (UUIDs).

  describe('writePdfToFile', () => {
    let testDir: string;

    beforeEach(() => {
      // Create a test directory
      testDir = join(tmpdir(), `mcp-pdf-test-${Date.now()}`);
    });

    test('writes PDF to specified directory', async () => {
      const buffer = Buffer.from('test pdf content');
      const result = await writePdfToFile(buffer, 'test.pdf', testDir);

      assert.ok(existsSync(result.fullPath));
      assert.ok(result.fullPath.startsWith(testDir));
      assert.ok(result.fullPath.endsWith('test.pdf'));

      // Clean up
      rmSync(testDir, { recursive: true, force: true });
    });

    test('writes UUID-based filename (no sanitization needed)', async () => {
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

    test('creates directory if it does not exist', async () => {
      const newDir = join(tmpdir(), `mcp-pdf-new-${Date.now()}`);

      const buffer = Buffer.from('test pdf content');
      const result = await writePdfToFile(buffer, 'test.pdf', newDir);

      assert.ok(existsSync(newDir));
      assert.ok(existsSync(result.fullPath));

      // Clean up
      rmSync(newDir, { recursive: true, force: true });
    });
  });
});
