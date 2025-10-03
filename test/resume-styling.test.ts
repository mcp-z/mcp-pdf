import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import type { JsonResume } from '../src/json-resume-schema.ts';
import { generateResumePDF, type ResumeStyling } from '../src/resume-generator.ts';

const testOutputDir = join(tmpdir(), 'mcp-pdf-resume-styling');

const sampleResume: JsonResume = {
  basics: {
    name: 'John Doe',
    label: 'Software Engineer',
    email: 'john@example.com',
    phone: '(555) 123-4567',
    location: {
      city: 'San Francisco',
      region: 'CA',
    },
  },
  work: [
    {
      name: 'Tech Corp',
      position: 'Senior Engineer',
      startDate: '2021-03',
      highlights: ['Built scalable systems', 'Led team of 5'],
    },
  ],
  skills: [
    {
      name: 'Languages',
      keywords: ['TypeScript', 'Python'],
    },
  ],
};

describe('Resume Styling Options', () => {
  test('generates resume with default styling', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'resume-default.pdf');

    await generateResumePDF(sampleResume, outputPath);

    assert.ok(existsSync(outputPath), 'PDF with default styling should be created');
    const stats = readFileSync(outputPath);
    assert.ok(stats.length > 0, 'PDF should have content');
    console.log(`    📄 Created: ${outputPath} (${stats.length} bytes)`);
  });

  test('generates resume with custom font sizes', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'resume-custom-fonts.pdf');

    const styling: ResumeStyling = {
      fontSize: {
        name: 32,
        label: 16,
        heading: 22,
        subheading: 18,
        body: 12,
        contact: 11,
      },
    };

    await generateResumePDF(sampleResume, outputPath, undefined, styling);

    assert.ok(existsSync(outputPath), 'PDF with custom font sizes should be created');
    const stats = readFileSync(outputPath);
    assert.ok(stats.length > 0, 'PDF should have content');
    console.log(`    📄 Created: ${outputPath} (${stats.length} bytes)`);
  });

  test('generates resume with custom spacing', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'resume-custom-spacing.pdf');

    const styling: ResumeStyling = {
      spacing: {
        afterName: 1.0,
        afterLabel: 0.5,
        afterContact: 1.5,
        afterHeading: 1.0,
        afterSubheading: 0.5,
        afterText: 0.5,
        betweenSections: 1.5,
      },
    };

    await generateResumePDF(sampleResume, outputPath, undefined, styling);

    assert.ok(existsSync(outputPath), 'PDF with custom spacing should be created');
    const stats = readFileSync(outputPath);
    assert.ok(stats.length > 0, 'PDF should have content');
    console.log(`    📄 Created: ${outputPath} (${stats.length} bytes)`);
  });

  test('generates resume with left-aligned header', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'resume-left-aligned.pdf');

    const styling: ResumeStyling = {
      alignment: {
        header: 'left',
      },
    };

    await generateResumePDF(sampleResume, outputPath, undefined, styling);

    assert.ok(existsSync(outputPath), 'PDF with left-aligned header should be created');
    const stats = readFileSync(outputPath);
    assert.ok(stats.length > 0, 'PDF should have content');
    console.log(`    📄 Created: ${outputPath} (${stats.length} bytes)`);
  });

  test('generates resume with custom margins', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'resume-custom-margins.pdf');

    const styling: ResumeStyling = {
      margins: {
        top: 100,
        bottom: 100,
        left: 100,
        right: 100,
      },
    };

    await generateResumePDF(sampleResume, outputPath, undefined, styling);

    assert.ok(existsSync(outputPath), 'PDF with custom margins should be created');
    const stats = readFileSync(outputPath);
    assert.ok(stats.length > 0, 'PDF should have content');
    console.log(`    📄 Created: ${outputPath} (${stats.length} bytes)`);
  });

  test('generates resume with all styling options combined', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'resume-all-custom.pdf');

    const styling: ResumeStyling = {
      fontSize: {
        name: 28,
        label: 14,
        heading: 20,
        subheading: 16,
        body: 11,
        contact: 10,
      },
      spacing: {
        afterName: 0.5,
        afterLabel: 0.5,
        afterContact: 1.0,
        afterHeading: 0.8,
        afterSubheading: 0.4,
        afterText: 0.4,
        betweenSections: 1.0,
      },
      alignment: {
        header: 'right',
      },
      margins: {
        top: 75,
        bottom: 75,
        left: 75,
        right: 75,
      },
    };

    await generateResumePDF(sampleResume, outputPath, undefined, styling);

    assert.ok(existsSync(outputPath), 'PDF with all custom styling should be created');
    const stats = readFileSync(outputPath);
    assert.ok(stats.length > 0, 'PDF should have content');
    console.log(`    📄 Created: ${outputPath} (${stats.length} bytes)`);
  });
});

test('print test output directory', () => {
  console.log(`\n📁 Resume styling test PDFs generated in: ${testOutputDir}`);
  console.log('   Open these files to visually verify styling customization\n');
});
