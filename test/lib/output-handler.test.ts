import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, test } from 'node:test';
import {
  generateUniqueFilename,
  getOutputDirectory,
  sanitizeFilename,
  writePdfToFile,
} from '../../src/lib/output-handler.ts';

describe('output-handler', () => {
  describe('sanitizeFilename', () => {
    test('removes path separators', () => {
      assert.equal(sanitizeFilename('path/to/file.pdf'), 'path_to_file.pdf');
      assert.equal(sanitizeFilename('path\\to\\file.pdf'), 'path_to_file.pdf');
    });

    test('blocks path traversal attempts', () => {
      // Each '../' becomes '__' (.. → _, / → _)
      assert.equal(sanitizeFilename('../../../etc/passwd'), '______etc_passwd');
      // '..' at start becomes single '_'
      assert.equal(sanitizeFilename('..file.pdf'), '_file.pdf');
    });

    test('removes unsafe characters', () => {
      assert.equal(sanitizeFilename('file<>:"|?*.pdf'), 'file_______.pdf');
      assert.equal(sanitizeFilename('file\x00null.pdf'), 'file_null.pdf');
    });

    test('prevents hidden files', () => {
      assert.equal(sanitizeFilename('.hidden.pdf'), '_hidden.pdf');
    });

    test('allows safe characters', () => {
      assert.equal(sanitizeFilename('my-document_v2.1.pdf'), 'my-document_v2.1.pdf');
      assert.equal(sanitizeFilename('Report 2024.pdf'), 'Report 2024.pdf');
    });

    test('limits length to 200 characters', () => {
      const longName = 'a'.repeat(300) + '.pdf';
      const sanitized = sanitizeFilename(longName);
      assert.equal(sanitized.length, 200);
    });

    test('trims whitespace', () => {
      assert.equal(sanitizeFilename('  file.pdf  '), 'file.pdf');
    });
  });

  describe('getOutputDirectory', () => {
    let originalEnv: string | undefined;

    beforeEach(() => {
      originalEnv = process.env.PDF_OUTPUT_DIR;
    });

    test('uses PDF_OUTPUT_DIR if set', () => {
      process.env.PDF_OUTPUT_DIR = '/custom/path';
      const dir = getOutputDirectory();
      assert.equal(dir, '/custom/path');
      process.env.PDF_OUTPUT_DIR = originalEnv;
    });

    test('defaults to ~/.mcp-pdf/', () => {
      delete process.env.PDF_OUTPUT_DIR;
      const dir = getOutputDirectory();
      assert.ok(dir.endsWith('.mcp-pdf'));
    });
  });

  describe('generateUniqueFilename', () => {
    let testDir: string;

    beforeEach(() => {
      // Create a temporary test directory
      testDir = join(tmpdir(), `mcp-pdf-test-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
    });

    test('returns sanitized filename if file does not exist', () => {
      const filename = generateUniqueFilename(testDir, 'test.pdf');
      assert.equal(filename, 'test.pdf');
    });

    test('appends timestamp if file exists', () => {
      // Create a file
      const existingFile = join(testDir, 'test.pdf');
      writeFileSync(existingFile, 'existing');

      const filename = generateUniqueFilename(testDir, 'test.pdf');
      assert.notEqual(filename, 'test.pdf');
      assert.ok(filename.startsWith('test-'));
      assert.ok(filename.endsWith('.pdf'));

      // Clean up
      rmSync(testDir, { recursive: true, force: true });
    });

    test('handles filenames without extension', () => {
      // Create a file
      const existingFile = join(testDir, 'noext');
      writeFileSync(existingFile, 'existing');

      const filename = generateUniqueFilename(testDir, 'noext');
      assert.notEqual(filename, 'noext');
      assert.ok(filename.startsWith('noext-'));

      // Clean up
      rmSync(testDir, { recursive: true, force: true });
    });
  });

  describe('writePdfToFile', () => {
    let testDir: string;
    let originalEnv: string | undefined;

    beforeEach(() => {
      // Set a test directory
      testDir = join(tmpdir(), `mcp-pdf-test-${Date.now()}`);
      originalEnv = process.env.PDF_OUTPUT_DIR;
      process.env.PDF_OUTPUT_DIR = testDir;
    });

    test('writes PDF to sandboxed directory', () => {
      const buffer = Buffer.from('test pdf content');
      const outputPath = writePdfToFile(buffer, 'test.pdf');

      assert.ok(existsSync(outputPath));
      assert.ok(outputPath.startsWith(testDir));
      assert.ok(outputPath.endsWith('test.pdf'));

      // Clean up
      process.env.PDF_OUTPUT_DIR = originalEnv;
      rmSync(testDir, { recursive: true, force: true });
    });

    test('sanitizes filename when writing', () => {
      const buffer = Buffer.from('test pdf content');
      const outputPath = writePdfToFile(buffer, '../../../evil.pdf');

      assert.ok(existsSync(outputPath));
      assert.ok(outputPath.startsWith(testDir));
      assert.ok(outputPath.endsWith('___evil.pdf'));
      assert.equal(outputPath.includes('..'), false);

      // Clean up
      process.env.PDF_OUTPUT_DIR = originalEnv;
      rmSync(testDir, { recursive: true, force: true });
    });

    test('creates directory if it does not exist', () => {
      const newDir = join(tmpdir(), `mcp-pdf-new-${Date.now()}`);
      process.env.PDF_OUTPUT_DIR = newDir;

      const buffer = Buffer.from('test pdf content');
      const outputPath = writePdfToFile(buffer, 'test.pdf');

      assert.ok(existsSync(newDir));
      assert.ok(existsSync(outputPath));

      // Clean up
      process.env.PDF_OUTPUT_DIR = originalEnv;
      rmSync(newDir, { recursive: true, force: true });
    });
  });
});
