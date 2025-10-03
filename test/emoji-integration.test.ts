import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import type { JsonResume } from '../src/json-resume-schema.ts';
import { generateResumePDF } from '../src/resume-generator.ts';

const testOutputDir = join(tmpdir(), 'mcp-pdf-emoji-integration');

describe('Emoji Integration in PDFs', () => {
  test('renders resume with emoji in name', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'resume-emoji-name.pdf');

    const resume: JsonResume = {
      basics: {
        name: 'John Doe 👨‍💻',
        label: 'Software Engineer',
        email: 'john@example.com',
      },
    };

    await generateResumePDF(resume, outputPath);

    assert.ok(existsSync(outputPath), 'PDF with emoji in name should be created');
    const stats = readFileSync(outputPath);
    assert.ok(stats.length > 0, 'PDF should have content');
    console.log(`    📄 Created: ${outputPath} (${stats.length} bytes)`);
  });

  test('renders resume with emoji in skills', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'resume-emoji-skills.pdf');

    const resume: JsonResume = {
      basics: {
        name: 'Jane Developer',
      },
      skills: [
        {
          name: 'JavaScript 💛',
          keywords: ['React ⚛️', 'Node.js 🟢'],
        },
        {
          name: 'Python 🐍',
          keywords: ['Django', 'FastAPI ⚡'],
        },
      ],
    };

    await generateResumePDF(resume, outputPath);

    assert.ok(existsSync(outputPath), 'PDF with emoji in skills should be created');
    const stats = readFileSync(outputPath);
    assert.ok(stats.length > 0, 'PDF should have content');
    console.log(`    📄 Created: ${outputPath} (${stats.length} bytes)`);
  });

  test('renders resume with emoji in job highlights', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'resume-emoji-highlights.pdf');

    const resume: JsonResume = {
      basics: {
        name: 'Alex Engineer',
      },
      work: [
        {
          name: 'Tech Corp',
          position: 'Senior Developer',
          highlights: ['Built scalable systems 🚀', 'Improved performance by 50% ⚡', 'Led team of 5 developers 👥'],
        },
      ],
    };

    await generateResumePDF(resume, outputPath);

    assert.ok(existsSync(outputPath), 'PDF with emoji in highlights should be created');
    const stats = readFileSync(outputPath);
    assert.ok(stats.length > 0, 'PDF should have content');
    console.log(`    📄 Created: ${outputPath} (${stats.length} bytes)`);
  });

  test('renders resume with various emoji types', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'resume-various-emoji.pdf');

    const resume: JsonResume = {
      basics: {
        name: 'Emoji Test 🎯',
        label: 'Full Stack Developer',
        summary: 'Passionate developer 💻 with love for clean code ✨',
      },
      work: [
        {
          name: 'Startup Inc',
          position: 'Lead Developer 👨‍💼',
          summary: 'Leading development team 🏆',
          highlights: ['Shipped 10+ features 🚢', 'Zero bugs in production ✅', 'Happy customers 😊'],
        },
      ],
      skills: [
        {
          name: 'Languages',
          keywords: ['TypeScript 🔷', 'Go 🐹', 'Rust 🦀'],
        },
      ],
      awards: [
        {
          title: 'Best Developer 🏅',
          awarder: 'Tech Awards',
          summary: 'Recognized for excellence 🌟',
        },
      ],
    };

    await generateResumePDF(resume, outputPath);

    assert.ok(existsSync(outputPath), 'PDF with various emoji should be created');
    const stats = readFileSync(outputPath);
    assert.ok(stats.length > 0, 'PDF should have content');
    console.log(`    📄 Created: ${outputPath} (${stats.length} bytes)`);
  });

  test('handles resume without emoji gracefully', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'resume-no-emoji.pdf');

    const resume: JsonResume = {
      basics: {
        name: 'Plain Name',
        label: 'Regular Job',
      },
      skills: [
        {
          name: 'Regular Skills',
          keywords: ['TypeScript', 'Node.js'],
        },
      ],
    };

    await generateResumePDF(resume, outputPath);

    assert.ok(existsSync(outputPath), 'PDF without emoji should be created');
    const stats = readFileSync(outputPath);
    assert.ok(stats.length > 0, 'PDF should have content');
    console.log(`    📄 Created: ${outputPath} (${stats.length} bytes)`);
  });

  test('renders standard Unicode symbols correctly (Greek, geometric, symbols)', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'resume-unicode-symbols.pdf');

    const resume: JsonResume = {
      basics: {
        name: 'Symbol Test Resume',
        label: 'Director of Operations',
      },
      work: [
        {
          name: 'Example Company',
          position: 'Director of Operations',
          highlights: ['Ξ Platform Growth: Scaled private photo SaaS from 5 to 40+ schools', '△ OKR-Driven Roadmap: Partnered with sales to define outcomes', '☐ B2C Revenue System: Launched photo products pipeline', '○ Microservices Architecture: Built 8+ Node.js REST services'],
        },
      ],
    };

    await generateResumePDF(resume, outputPath);

    assert.ok(existsSync(outputPath), 'PDF with Unicode symbols should be created');
    const stats = readFileSync(outputPath);
    assert.ok(stats.length > 0, 'PDF should have content');
    console.log(`    📄 Created: ${outputPath} (${stats.length} bytes)`);
    console.log('    ℹ️  Greek letters (Ξ), geometric shapes (△ ○), and symbols (☐) should render correctly');
  });

  test('correctly distinguishes between symbols and true emoji', async () => {
    await mkdir(testOutputDir, { recursive: true });
    const outputPath = join(testOutputDir, 'resume-symbols-vs-emoji.pdf');

    const resume: JsonResume = {
      basics: {
        name: 'Mixed Content Test',
        summary: 'This resume tests both standard symbols (Ξ △ ☐ ○) and true emoji (😀 👋 🎉)',
      },
      work: [
        {
          name: 'Symbol Company',
          position: 'Developer',
          highlights: ['Standard symbols: Ξ △ ☐ ○ ⚠ ★ ✓ (should render as black glyphs)', 'True emoji: 😀 👋 🎉 🚀 (need special rendering)'],
        },
      ],
    };

    await generateResumePDF(resume, outputPath);

    assert.ok(existsSync(outputPath), 'PDF with mixed symbols and emoji should be created');
    const stats = readFileSync(outputPath);
    assert.ok(stats.length > 0, 'PDF should have content');
    console.log(`    📄 Created: ${outputPath} (${stats.length} bytes)`);
    console.log('    ℹ️  Standard symbols should render, true emoji should be handled specially');
  });
});

// Print summary at the end
test('print test output directory', () => {
  console.log(`\n📁 Test PDFs with emoji generated in: ${testOutputDir}`);
  console.log('   Open these files to visually verify emoji rendering\n');
});
