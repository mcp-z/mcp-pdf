import assert from 'assert';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import createPdfCreateSimple, { type Input, type Output } from '../../../../src/mcp/tools/pdf-create-simple.ts';
import type { ServerConfig } from '../../../../src/types.ts';

// Use .tmp/ in package root per QUALITY.md rule T8
const testOutputDir = join(process.cwd(), '.tmp', 'pdf-create-simple-tests');
const testStorageDir = join(testOutputDir, 'storage');

/**
 * Create test server config for PDF tools
 */
function createTestConfig(): ServerConfig {
  return {
    name: 'server-pdf-test',
    version: '1.0.0',
    logLevel: 'silent',
    baseDir: testOutputDir,
    storageDir: testStorageDir,
    transport: {
      type: 'stdio',
    },
  };
}

describe('pdf-create-simple tool', () => {
  before(() => {
    mkdirSync(testStorageDir, { recursive: true });
  });

  after(() => {
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  it('creates simple PDF with text', async () => {
    const config = createTestConfig();
    const tool = createPdfCreateSimple({ serverConfig: config });

    assert.equal(tool.name, 'pdf-create-simple', 'tool name should match');

    const input: Input = {
      filename: 'simple.pdf',
      text: 'This is a simple PDF document with just text content.',
      title: 'Simple Test',
    };

    const result = await tool.handler(input);

    assert.ok(result.structuredContent, 'should have structuredContent');
    const output = result.structuredContent?.result as Output;
    assert.ok(output.documentId, 'should have documentId');
    assert.ok(output.sizeBytes > 0, 'should have non-zero size');
  });

  it('handles multiline text', async () => {
    const config = createTestConfig();
    const tool = createPdfCreateSimple({ serverConfig: config });

    const input: Input = {
      text: 'Line 1\nLine 2\nLine 3\n\nParagraph break here.',
    };

    const result = await tool.handler(input);

    assert.ok(result.structuredContent, 'should have structuredContent');
  });
});
