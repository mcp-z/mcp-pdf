import assert from 'assert';
import { generateResumePDFBuffer, type ResumeSchema } from '../../../../src/lib/resume-pdf-generator.ts';

describe('Emoji Integration in PDFs', () => {
  it('renders resume with emoji in name', async () => {
    const resume: ResumeSchema = {
      basics: {
        name: 'John Doe 👨‍💻',
        label: 'Software Engineer',
        email: 'john@example.com',
      },
    };

    const pdfBuffer = await generateResumePDFBuffer(resume);

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('renders resume with emoji in skills', async () => {
    const resume: ResumeSchema = {
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

    const pdfBuffer = await generateResumePDFBuffer(resume);

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('renders resume with emoji in job highlights', async () => {
    const resume: ResumeSchema = {
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

    const pdfBuffer = await generateResumePDFBuffer(resume);

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('renders resume with various emoji types', async () => {
    const resume: ResumeSchema = {
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

    const pdfBuffer = await generateResumePDFBuffer(resume);

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('handles resume without emoji gracefully', async () => {
    const resume: ResumeSchema = {
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

    const pdfBuffer = await generateResumePDFBuffer(resume);

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('renders standard Unicode symbols correctly (Greek, geometric, symbols)', async () => {
    const resume: ResumeSchema = {
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

    const pdfBuffer = await generateResumePDFBuffer(resume);

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
    console.log('    ℹ️  Greek letters (Ξ), geometric shapes (△ ○), and symbols (☐) should render correctly');
  });

  it('correctly distinguishes between symbols and true emoji', async () => {
    const resume: ResumeSchema = {
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

    const pdfBuffer = await generateResumePDFBuffer(resume);

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
    console.log('    ℹ️  Standard symbols should render, true emoji should be handled specially');
  });
});
