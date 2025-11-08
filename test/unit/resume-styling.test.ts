import assert from 'assert/strict';
import type { JsonResume } from '../../src/lib/json-resume-schema.ts';
import { generateResumePDFBuffer, type ResumeStyling } from '../../src/lib/resume-generator.ts';

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
  it('generates resume with default styling', async () => {
    const pdfBuffer = await generateResumePDFBuffer(sampleResume);

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('generates resume with custom font sizes', async () => {
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

    const pdfBuffer = await generateResumePDFBuffer(sampleResume, undefined, styling);

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('generates resume with custom spacing', async () => {
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

    const pdfBuffer = await generateResumePDFBuffer(sampleResume, undefined, styling);

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('generates resume with left-aligned header', async () => {
    const styling: ResumeStyling = {
      alignment: {
        header: 'left',
      },
    };

    const pdfBuffer = await generateResumePDFBuffer(sampleResume, undefined, styling);

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('generates resume with custom margins', async () => {
    const styling: ResumeStyling = {
      margins: {
        top: 100,
        bottom: 100,
        left: 100,
        right: 100,
      },
    };

    const pdfBuffer = await generateResumePDFBuffer(sampleResume, undefined, styling);

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });

  it('generates resume with all styling options combined', async () => {
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

    const pdfBuffer = await generateResumePDFBuffer(sampleResume, undefined, styling);

    assert.ok(pdfBuffer instanceof Buffer, 'Should return a Buffer');
    assert.ok(pdfBuffer.length > 0, 'PDF should have content');
    console.log(`    📄 Created: (${pdfBuffer.length} bytes)`);
  });
});
