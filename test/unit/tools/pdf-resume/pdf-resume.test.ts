import assert from 'assert';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import createTool, { type Input, type Output } from '../../../../src/mcp/tools/pdf-resume.js';
import type { ServerConfig } from '../../../../src/types.js';
import { createStorageExtra } from '../../../lib/create-extra.js';

// Use .tmp/ in package root per QUALITY.md rule T8
const testOutputDir = join(process.cwd(), '.tmp', 'pdf-resume-tests');
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
    storageDir: testStorageDir,
    transport: {
      type: 'stdio',
    },
  };
}

describe('pdf-resume tool', () => {
  before(() => {
    mkdirSync(testStorageDir, { recursive: true });
  });

  after(() => {
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  it('creates resume PDF from JSON Resume format', async () => {
    const config = createTestConfig();
    const tool = createTool();
    const extra = createStorageExtra(config);

    assert.equal(tool.name, 'pdf-resume', 'tool name should match');

    const input: Input = {
      filename: 'resume.pdf',
      resume: {
        basics: {
          name: 'John Doe',
          label: 'Software Engineer',
          email: 'john@example.com',
          phone: '555-1234',
        },
        work: [
          {
            name: 'Tech Corp',
            position: 'Senior Engineer',
            startDate: '2020-01',
            highlights: ['Built scalable systems', 'Led team of 5'],
          },
        ],
        skills: [
          {
            name: 'Languages',
            keywords: ['TypeScript', 'Python', 'Go'],
          },
        ],
      },
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
    const output = result.structuredContent?.result as Output;
    assert.ok(output.documentId, 'should have documentId');
    assert.ok(output.sizeBytes > 0, 'should have non-zero size');
    assert.equal(output.filename, 'resume.pdf', 'should preserve filename');
  });

  it('creates resume with custom styling', async () => {
    const config = createTestConfig();
    const tool = createTool();
    const extra = createStorageExtra(config);

    const input: Input = {
      resume: {
        basics: {
          name: 'Jane Smith',
          label: 'Product Manager',
        },
      },
      styling: {
        fontSize: {
          name: 28,
          body: 11,
        },
        alignment: {
          header: 'left',
        },
      },
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
  });

  it('handles resume with all sections', async () => {
    const config = createTestConfig();
    const tool = createTool();
    const extra = createStorageExtra(config);

    const input: Input = {
      resume: {
        basics: {
          name: 'Full Resume Test',
          label: 'Engineer',
          summary: 'Experienced professional',
        },
        work: [
          {
            name: 'Company A',
            position: 'Role',
            summary: 'Did things',
          },
        ],
        education: [
          {
            institution: 'University',
            area: 'Computer Science',
            studyType: 'BS',
          },
        ],
        skills: [{ name: 'Category', keywords: ['Skill1', 'Skill2'] }],
        awards: [{ title: 'Award', awarder: 'Organization' }],
        projects: [{ name: 'Project', description: 'Description' }],
      },
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
  });
});
