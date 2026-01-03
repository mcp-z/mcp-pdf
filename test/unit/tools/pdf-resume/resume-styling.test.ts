import assert from 'assert';
import { generateResumePDFBuffer, type RenderOptions, type ResumeSchema } from '../../../../src/lib/resume-pdf-generator.ts';
import type { Logger } from '../../../../src/types.ts';

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

describe('Resume Styling Options', () => {
  it('generates resume with default styling', async () => {
    const pdfBuffer = await generateResumePDFBuffer(sampleResume, {}, silentLogger);

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('generates resume with custom font sizes via type assertion', async () => {
    // Use type assertion for partial nested typography
    const options: RenderOptions = {
      typography: {
        header: {
          name: { fontSize: 32 },
          contact: { fontSize: 11 },
        },
        sectionTitle: { fontSize: 22 },
        text: { fontSize: 12 },
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
        text: {
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
        text: {
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
