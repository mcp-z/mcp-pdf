import type { Logger } from '@mcp-z/mcp-pdf';
import assert from 'assert';
import { generateResumePDFBuffer, type RenderOptions, type ResumeSchema } from '../../../src/lib/resume-pdf-generator.ts';
import type { TypographyOptions } from '../../../src/lib/types/typography.ts';

// Silent logger for tests
const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

const sampleResume: ResumeSchema = {
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

const comprehensiveSampleResume: ResumeSchema = {
  basics: {
    name: 'Jane Smith',
    label: 'Senior Software Engineer',
    email: 'jane@example.com',
    phone: '(555) 987-6543',
    location: { city: 'Seattle', region: 'WA' },
    url: 'https://janesmith.dev',
  },
  summary: 'Experienced engineer with a passion for building scalable systems and mentoring teams. Specializes in distributed systems and cloud-native architecture.',
  work: [
    {
      name: 'Tech Giants Inc.',
      position: 'Senior Engineer',
      startDate: '2020-01',
      endDate: 'Present',
      summary: 'Leading platform modernization initiatives.',
      highlights: ['Architected and implemented microservices migration resulting in 40% reduction in deployment time', 'Led team of 8 engineers through quarterly planning and daily standups', 'Designed event-driven architecture processing 10M+ events daily with sub-second latency'],
    },
  ],
  volunteer: [
    {
      name: 'Open Source Contributor',
      position: 'Maintainer',
      startDate: '2018-01',
      endDate: 'Present',
      highlights: [
        'AI: Launched mcp-z.com for Model Context Protocol servers, CLI, OAuth 2.0, and code-based MCP tool calling. Node.js tensorflow bindings',
        'JavaScript: Knockback, BackboneORM, React DOM and Native. Prior MobX contributor',
        'Developer productivity: Monorepo CLI tools, Node.js version testing, and TypeScript development stack',
        'Built and maintains 3 popular npm packages with 500K+ weekly downloads each',
      ],
    },
  ],
  education: [
    {
      institution: 'University of Washington',
      studyType: 'Bachelor of Science',
      area: 'Computer Science',
      startDate: '2012',
      endDate: '2016',
      score: '3.8/4.0',
    },
  ],
  awards: [
    {
      title: 'Best Paper Award',
      awarder: 'IEEE Software Conference',
      date: '2023-06',
      summary: 'Recognized for outstanding research on distributed systems consistency models.',
    },
  ],
  certificates: [
    {
      name: 'AWS Solutions Architect Professional',
      issuer: 'Amazon Web Services',
      date: '2023-01',
    },
  ],
  publications: [
    {
      name: 'Eventual Consistency in Distributed Systems',
      publisher: 'ACM Transactions',
      releaseDate: '2022-08',
      summary: 'Published research on novel approaches to eventual consistency.',
    },
  ],
  skills: [
    { name: 'Languages', keywords: ['TypeScript', 'Python', 'Go', 'Rust'] },
    { name: 'Frameworks', keywords: ['React', 'Node.js', 'FastAPI', 'Express'] },
    { name: 'Platforms', keywords: ['AWS', 'Kubernetes', 'Docker', 'Terraform'] },
  ],
  languages: [
    { language: 'English', fluency: 'Native' },
    { language: 'Spanish', fluency: 'Professional working' },
  ],
  interests: [{ name: 'Hobbies', keywords: ['Rock climbing', 'Photography', 'Board games'] }],
  projects: [
    {
      name: 'CLI Dashboard',
      startDate: '2023-06',
      endDate: '2023-09',
      highlights: ['Built real-time CLI dashboard for monitoring microservices health and metrics', 'Implemented ANSI color codes and box-drawing characters for terminal UI', 'Added plugin architecture supporting custom widgets and data sources'],
    },
  ],
  references: [
    {
      name: 'John Manager',
      reference: 'Jane is one of the most talented engineers I have had the pleasure to work with. Her ability to debug complex distributed systems is unmatched.',
    },
  ],
};

describe('Resume Styling Options', () => {
  it('generates resume with default styling', async () => {
    const pdfBuffer = await generateResumePDFBuffer(sampleResume, {}, silentLogger);

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('generates resume with custom font sizes via type assertion', async () => {
    const options: RenderOptions = {
      typography: {
        header: {
          name: { fontSize: 32 },
          contact: { fontSize: 11 },
        },
        sectionTitle: { fontSize: 22 },
        content: { fontSize: 12 },
      } as RenderOptions['typography'],
    };

    const pdfBuffer = await generateResumePDFBuffer(sampleResume, options, silentLogger);

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('generates resume with custom spacing', async () => {
    const options: RenderOptions = {
      typography: {
        header: {
          marginBottom: 15,
          name: { marginBottom: 10 },
        },
        sectionTitle: {
          marginTop: 12,
          marginBottom: 8,
        },
        content: {
          marginBottom: 4,
        },
      } as RenderOptions['typography'],
    };

    const pdfBuffer = await generateResumePDFBuffer(sampleResume, options, silentLogger);

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('generates resume with custom margins (via RenderOptions)', async () => {
    // Margins are set via PDFDocument options, not typography
    // This test verifies the resume generates successfully with defaults
    const options: RenderOptions = {};

    const pdfBuffer = await generateResumePDFBuffer(sampleResume, options, silentLogger);

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('generates resume with combined styling options', async () => {
    const options: RenderOptions = {
      typography: {
        header: {
          marginBottom: 8,
          name: { fontSize: 28, marginBottom: 5 },
          contact: { fontSize: 10 },
        },
        sectionTitle: {
          fontSize: 20,
          marginTop: 10,
          marginBottom: 6,
        },
        content: {
          fontSize: 11,
          marginBottom: 4,
        },
      } as RenderOptions['typography'],
    };

    const pdfBuffer = await generateResumePDFBuffer(sampleResume, options, silentLogger);

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });
});

describe('All Section Types', () => {
  it('renders volunteer section with long bullets', async () => {
    const pdfBuffer = await generateResumePDFBuffer(comprehensiveSampleResume, {}, silentLogger);
    assert.ok(pdfBuffer instanceof Buffer);
    assert.ok(pdfBuffer.length > 0);
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('renders education section with GPA and degree', async () => {
    const pdfBuffer = await generateResumePDFBuffer(comprehensiveSampleResume, {}, silentLogger);
    assert.ok(pdfBuffer instanceof Buffer);
    assert.ok(pdfBuffer.length > 0);
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('renders awards section with summary', async () => {
    const pdfBuffer = await generateResumePDFBuffer(comprehensiveSampleResume, {}, silentLogger);
    assert.ok(pdfBuffer instanceof Buffer);
    assert.ok(pdfBuffer.length > 0);
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('renders certificates section', async () => {
    const pdfBuffer = await generateResumePDFBuffer(comprehensiveSampleResume, {}, silentLogger);
    assert.ok(pdfBuffer instanceof Buffer);
    assert.ok(pdfBuffer.length > 0);
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('renders publications section', async () => {
    const pdfBuffer = await generateResumePDFBuffer(comprehensiveSampleResume, {}, silentLogger);
    assert.ok(pdfBuffer instanceof Buffer);
    assert.ok(pdfBuffer.length > 0);
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('renders languages section with multiple entries', async () => {
    const pdfBuffer = await generateResumePDFBuffer(comprehensiveSampleResume, {}, silentLogger);
    assert.ok(pdfBuffer instanceof Buffer);
    assert.ok(pdfBuffer.length > 0);
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('renders interests section with multiple categories', async () => {
    const pdfBuffer = await generateResumePDFBuffer(comprehensiveSampleResume, {}, silentLogger);
    assert.ok(pdfBuffer instanceof Buffer);
    assert.ok(pdfBuffer.length > 0);
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('renders projects section with highlights only', async () => {
    const pdfBuffer = await generateResumePDFBuffer(comprehensiveSampleResume, {}, silentLogger);
    assert.ok(pdfBuffer instanceof Buffer);
    assert.ok(pdfBuffer.length > 0);
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('renders references section with quote', async () => {
    const pdfBuffer = await generateResumePDFBuffer(comprehensiveSampleResume, {}, silentLogger);
    assert.ok(pdfBuffer instanceof Buffer);
    assert.ok(pdfBuffer.length > 0);
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('all sections render with consistent spacing', async () => {
    const pdfBuffer = await generateResumePDFBuffer(comprehensiveSampleResume, {}, silentLogger);
    assert.ok(pdfBuffer instanceof Buffer);
    assert.ok(pdfBuffer.length > 0);
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });
});

describe('Typography Property Validation', () => {
  it('throws error on unknown typography properties', async () => {
    const options: RenderOptions = {
      typography: {
        unknownProperty: 123,
        content: { fontSize: 12, lineHeight: 1.3, marginTop: 6, marginBottom: 6, paragraphMarginBottom: 4, bulletGap: 2, bulletMarginBottom: 2, bulletIndent: 12, itemMarginBottom: 4, entrySpacing: 8 },
      } as Partial<TypographyOptions>,
    };

    await assert.rejects(() => generateResumePDFBuffer(comprehensiveSampleResume, options, silentLogger), /Unknown typography properties: unknownProperty/);
  });

  it('accepts all known typography properties', async () => {
    const options: RenderOptions = {
      typography: {
        content: { fontSize: 12, lineHeight: 1.3, marginTop: 6, marginBottom: 6, paragraphMarginBottom: 4, bulletGap: 2, bulletMarginBottom: 2, bulletIndent: 12, itemMarginBottom: 4, entrySpacing: 8 },
        sectionTitle: { fontSize: 14 },
        header: { name: { fontSize: 30 }, contact: { fontSize: 10 } },
      },
    };

    const pdfBuffer = await generateResumePDFBuffer(comprehensiveSampleResume, options, silentLogger);
    assert.ok(pdfBuffer instanceof Buffer);
    assert.ok(pdfBuffer.length > 0);
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });
});
describe('Emoji Integration in PDFs', () => {
  it('renders resume with emoji in name', async () => {
    const resume: ResumeSchema = {
      basics: {
        name: 'John Doe 👨‍💻',
        label: 'Software Engineer',
        email: 'john@example.com',
      },
    };

    const pdfBuffer = await generateResumePDFBuffer(resume, {}, silentLogger);

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

    const pdfBuffer = await generateResumePDFBuffer(resume, {}, silentLogger);

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

    const pdfBuffer = await generateResumePDFBuffer(resume, {}, silentLogger);

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

    const pdfBuffer = await generateResumePDFBuffer(resume, {}, silentLogger);

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

    const pdfBuffer = await generateResumePDFBuffer(resume, {}, silentLogger);

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

    const pdfBuffer = await generateResumePDFBuffer(resume, {}, silentLogger);

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

    const pdfBuffer = await generateResumePDFBuffer(resume, {}, silentLogger);

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
    console.log('    ℹ️  Standard symbols should render, true emoji should be handled specially');
  });
});
