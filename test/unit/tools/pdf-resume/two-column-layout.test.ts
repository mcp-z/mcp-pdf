import assert from 'assert';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import createTool, { type Input, type Output } from '../../../../src/mcp/tools/pdf-resume.ts';
import type { ServerConfig } from '../../../../src/types.ts';
import { createExtra } from '../../../lib/create-extra.ts';

// Use .tmp/ in package root per QUALITY.md rule T8
const testOutputDir = join(process.cwd(), '.tmp', 'two-column-layout-tests');
const testStorageDir = join(testOutputDir, 'storage');

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

describe('pdf-resume two-column layout', () => {
  before(() => {
    mkdirSync(testStorageDir, { recursive: true });
  });

  after(() => {
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  it('creates two-column resume with left sidebar', async () => {
    const config = createTestConfig();
    const tool = createTool();
    const extra = createExtra(config);

    const input: Input = {
      filename: 'two-column-resume.pdf',
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
        languages: [
          {
            language: 'English',
            fluency: 'Native',
          },
          {
            language: 'Spanish',
            fluency: 'Intermediate',
          },
        ],
      },
      layout: {
        style: 'two-column',
        gap: 20,
        columns: {
          left: {
            width: '30%',
            sections: ['skills', 'languages'],
          },
          right: {
            width: '70%',
            sections: ['work'],
          },
        },
      },
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
    const output = result.structuredContent?.result as Output;
    assert.ok(output.documentId, 'should have documentId');
    assert.ok(output.sizeBytes > 0, 'should have non-zero size');
    assert.equal(output.filename, 'two-column-resume.pdf', 'should preserve filename');
    console.log(`    📄 Two-column resume created: ${output.sizeBytes} bytes`);
  });

  it('validates sections exist in layout columns', async () => {
    const config = createTestConfig();
    const tool = createTool();
    const extra = createExtra(config);

    const input: Input = {
      resume: {
        basics: { name: 'Test User' },
      },
      layout: {
        style: 'two-column',
        columns: {
          left: {
            sections: ['nonexistent-section'],
          },
        },
      },
    };

    try {
      await tool.handler(input, extra);
      assert.fail('should have thrown validation error');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('unknown sections'), `Expected 'unknown sections' in: ${error.message}`);
    }
  });

  it('rejects duplicate sections across columns', async () => {
    const config = createTestConfig();
    const tool = createTool();
    const extra = createExtra(config);

    const input: Input = {
      resume: {
        basics: { name: 'Test User' },
        skills: [{ name: 'Test', keywords: ['A'] }],
      },
      layout: {
        style: 'two-column',
        columns: {
          left: {
            sections: ['skills'],
          },
          right: {
            sections: ['skills'],
          },
        },
      },
    };

    try {
      await tool.handler(input, extra);
      assert.fail('should have thrown validation error');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('both columns'), `Expected 'both columns' in: ${error.message}`);
    }
  });

  it('creates two-column layout with percentage widths', async () => {
    const config = createTestConfig();
    const tool = createTool();
    const extra = createExtra(config);

    const input: Input = {
      filename: 'two-column-percentage.pdf',
      resume: {
        basics: {
          name: 'Jane Smith',
          label: 'Product Designer',
          email: 'jane@example.com',
        },
        work: [
          {
            name: 'Design Studio',
            position: 'Lead Designer',
            startDate: '2019-03',
            highlights: ['Redesigned product UI', 'Increased conversion by 25%'],
          },
        ],
        skills: [
          { name: 'Design', keywords: ['Figma', 'Sketch', 'Adobe XD'] },
          { name: 'Frontend', keywords: ['HTML', 'CSS', 'React'] },
        ],
        education: [
          {
            institution: 'Design School',
            area: 'Interaction Design',
            studyType: 'Bachelor',
            startDate: '2015-09',
            endDate: '2019-05',
          },
        ],
      },
      layout: {
        style: 'two-column',
        gap: 30,
        columns: {
          left: {
            width: '35%',
            sections: ['skills', 'education'],
          },
          right: {
            width: '65%',
            sections: ['work'],
          },
        },
      },
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
    const output = result.structuredContent?.result as Output;
    assert.ok(output.documentId, 'should have documentId');
    assert.ok(output.sizeBytes > 0, 'should have non-zero size');
    console.log(`    📄 Two-column (35%/65%) resume created: ${output.sizeBytes} bytes`);
  });

  it('creates two-column layout with point widths', async () => {
    const config = createTestConfig();
    const tool = createTool();
    const extra = createExtra(config);

    const input: Input = {
      filename: 'two-column-points.pdf',
      resume: {
        basics: {
          name: 'Bob Johnson',
          label: 'Data Scientist',
          email: 'bob@example.com',
        },
        work: [
          {
            name: 'Analytics Corp',
            position: 'Senior Data Scientist',
            startDate: '2018-06',
            highlights: ['Built ML pipeline', 'Improved model accuracy by 40%'],
          },
        ],
        skills: [{ name: 'ML', keywords: ['Python', 'TensorFlow', 'PyTorch'] }],
      },
      layout: {
        style: 'two-column',
        gap: 25,
        columns: {
          left: {
            width: 150,
            sections: ['skills'],
          },
          right: {
            width: 350,
            sections: ['work'],
          },
        },
      },
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
    const output = result.structuredContent?.result as Output;
    assert.ok(output.documentId, 'should have documentId');
    assert.ok(output.sizeBytes > 0, 'should have non-zero size');
    console.log(`    📄 Two-column (150pt/350pt) resume created: ${output.sizeBytes} bytes`);
  });

  it('defaults to single-column when layout not specified', async () => {
    const config = createTestConfig();
    const tool = createTool();
    const extra = createExtra(config);

    const input: Input = {
      filename: 'single-column-default.pdf',
      resume: {
        basics: {
          name: 'Test User',
          label: 'Engineer',
        },
        work: [
          {
            name: 'Company',
            position: 'Engineer',
            startDate: '2020-01',
          },
        ],
      },
      // No layout specified - should default to single-column
    };

    const result = await tool.handler(input, extra);

    assert.ok(result.structuredContent, 'should have structuredContent');
    const output = result.structuredContent?.result as Output;
    assert.ok(output.documentId, 'should have documentId');
    assert.ok(output.sizeBytes > 0, 'should have non-zero size');
    console.log(`    📄 Single-column (default) resume created: ${output.sizeBytes} bytes`);
  });
});
