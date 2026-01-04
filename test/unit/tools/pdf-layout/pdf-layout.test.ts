import assert from 'assert';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import createTool, { type Input, type Output } from '../../../../src/mcp/tools/pdf-layout.ts';
import type { ServerConfig } from '../../../../src/types.ts';
import { createExtra } from '../../../lib/create-extra.ts';

// Use .tmp/ in package root per QUALITY.md rule T8
const testOutputDir = join(process.cwd(), '.tmp', 'pdf-layout-tests');
const testStorageDir = join(testOutputDir, 'storage');

/**
 * Create test server config for PDF tools
 */
function createTestConfig(): ServerConfig {
  return {
    name: 'mcp-pdf-test',
    version: '1.0.0',
    logLevel: 'silent',
    baseDir: testOutputDir,
    resourceStoreUri: `file://${testStorageDir}`,
    transport: {
      type: 'stdio',
    },
  };
}

describe('pdf-layout tool', () => {
  before(() => {
    mkdirSync(testStorageDir, { recursive: true });
  });

  after(() => {
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  it('creates PDF with text content', async () => {
    const config = createTestConfig();
    const tool = createTool();
    const extra = createExtra(config);

    assert.equal(tool.name, 'pdf-layout', 'tool name should match');

    const input: Input = {
      filename: 'test-document.pdf',
      content: [
        { type: 'text', text: 'Hello World' },
        { type: 'heading', text: 'Test Heading' },
      ],
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
    const output = result.structuredContent?.result as Output;
    assert.ok(output.documentId, 'should have documentId');
    assert.ok(output.uri, 'should have uri');
    assert.ok(output.sizeBytes > 0, 'should have non-zero size');
    assert.equal(output.filename, 'test-document.pdf', 'should preserve filename');
  });

  it('creates PDF with shapes', async () => {
    const config = createTestConfig();
    const tool = createTool();
    const extra = createExtra(config);

    const input: Input = {
      filename: 'shapes.pdf',
      content: [
        { type: 'rect', left: 50, top: 50, width: 100, height: 100, fillColor: 'blue' },
        { type: 'circle', left: 200, top: 100, radius: 50, fillColor: 'red' },
        { type: 'line', x1: 50, y1: 200, x2: 250, y2: 200, strokeColor: 'green' },
      ],
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
    const output = result.structuredContent?.result as Output;
    assert.ok(output.sizeBytes > 0, 'should have non-zero size');
  });

  it('creates PDF with page setup', async () => {
    const config = createTestConfig();
    const tool = createTool();
    const extra = createExtra(config);

    const input: Input = {
      filename: 'custom-page.pdf',
      pageSetup: {
        margins: { top: 100, bottom: 100, left: 100, right: 100 },
        backgroundColor: '#f0f0f0',
      },
      content: [{ type: 'text', text: 'Custom page setup' }],
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
  });
});
