import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import { setupFonts } from '../src/lib/fonts.ts';

const outputPath = join(tmpdir(), 'space-resume-full.pdf');

async function generateSpaceResume() {
  const doc = new PDFDocument({
    size: [612, 792],
    margins: { top: 50, bottom: 50, left: 60, right: 60 },
  });

  const stream = createWriteStream(outputPath);
  doc.pipe(stream);

  const fonts = await setupFonts(doc);
  const { regular: regularFont, bold: boldFont } = fonts;

  const pageWidth = 612;

  // Black background
  doc.rect(0, 0, 612, 792).fill('black');

  doc.on('pageAdded', () => {
    doc.rect(0, 0, 612, 792).fill('black');
  });

  doc.moveDown(2);
  doc.fontSize(11).font(regularFont).fillColor('#4DA6FF');
  doc.text('IN THE VASTNESS OF SPACE AND TIME...', { align: 'center' });
  doc.moveDown(1.5);

  const resumeContent = [
    { text: 'THE ODYSSEY OF ALEX QUANTUM', isHeading: true },
    { text: 'Chapter I: The Engineer Awakens', isHeading: true },
    { text: '', isHeading: false },
    { text: 'Home World: San Francisco, CA, USA', isHeading: false },
    { text: 'Holotransmission: +1 (555) 123-4567 | DataNet: alex@example.com', isHeading: false },
    { text: '', isHeading: false },
    { text: 'In an era when organizations needed visionaries, one engineer discovered they possessed', isHeading: false },
    { text: 'a rare gift - the ability to unite teams, modernize legacy systems,', isHeading: false },
    { text: 'and lead transformations through impossible challenges. This is their story...', isHeading: false },
    { text: '', isHeading: false },
    { text: "THE HERO'S JOURNEY", isHeading: true },
    { text: '', isHeading: false },
    { text: 'Chapter VII: The Platform Awakening (2024-2025)', isHeading: true },
    { text: 'Alliance: TechCorp Industries | Title: Senior Engineering Manager', isHeading: false },
    { text: '', isHeading: false },
    { text: 'Our hero discovered a critical challenge - users across the organization', isHeading: false },
    { text: 'needed better tools for collaboration. Armed with modern cloud technologies', isHeading: false },
    { text: 'and AI-driven insights, Alex led an expedition to modernize the platform.', isHeading: false },
    { text: '', isHeading: false },
    { text: 'Through microservices architecture, containerization, and continuous deployment,', isHeading: false },
    { text: 'they transformed a legacy monolith into a scalable, distributed system that', isHeading: false },
    { text: 'would serve thousands of users across multiple regions. Developer productivity', isHeading: false },
    { text: 'increased by 300%, deployment times dropped from hours to minutes, and the', isHeading: false },
    { text: 'organization gained the agility needed to compete in a rapidly evolving market.', isHeading: false },
    { text: '', isHeading: false },
    { text: 'But the quest continued. The infrastructure was fragmented across 500+', isHeading: false },
    { text: 'repositories, each with its own build system, deployment pipeline, and', isHeading: false },
    { text: 'monitoring stack. Alex conceived The Unified Platform Initiative - a', isHeading: false },
    { text: 'bold strategy to consolidate tooling, standardize workflows, and create', isHeading: false },
    { text: 'a consistent developer experience across all engineering teams. Through', isHeading: false },
    { text: 'careful planning, stakeholder alignment, and incremental rollouts, they', isHeading: false },
    { text: 'brought order to chaos and established a foundation for sustainable growth.', isHeading: false },
    { text: '', isHeading: false },
    { text: 'Chapter VI: The Data Renaissance (2021-2024)', isHeading: true },
    { text: 'Alliance: DataVerse Corporation | Title: Principal Engineer', isHeading: false },
    { text: '', isHeading: false },
    { text: 'In the age of big data, Alex pioneered real-time analytics platforms that', isHeading: false },
    { text: 'processed billions of events per day. Using distributed stream processing,', isHeading: false },
    { text: 'machine learning pipelines, and advanced visualization techniques, they', isHeading: false },
    { text: 'empowered business users to make data-driven decisions with confidence.', isHeading: false },
    { text: '', isHeading: false },
    { text: 'The platform reduced query latency from minutes to milliseconds, enabling', isHeading: false },
    { text: 'interactive exploration of massive datasets. Predictive models provided early', isHeading: false },
    { text: 'warnings of system anomalies, preventing outages before they occurred. And', isHeading: false },
    { text: 'automated dashboards delivered insights directly to stakeholders, eliminating', isHeading: false },
    { text: 'manual reporting overhead. The impact rippled across the organization,', isHeading: false },
    { text: 'transforming how teams understood their users, optimized operations, and', isHeading: false },
    { text: 'planned for the future. In just three years, the data platform became the', isHeading: false },
    { text: 'most critical system in the entire technology stack - a testament to the', isHeading: false },
    { text: 'power of visionary engineering combined with user-centered design.', isHeading: false },
  ];

  const totalLines = resumeContent.length;

  // Strategy: Continuous tapering across ALL content
  for (let i = 0; i < resumeContent.length; i++) {
    const section = resumeContent[i];
    if (!section) continue;

    if (section.text === '') {
      doc.moveDown(0.3);
      continue;
    }

    // Calculate perspective effect - content starts far (small) and grows closer (larger)
    const progress = i / totalLines; // 0.0 at start → 1.0 at end
    const fontSize = 7 + progress * 13; // 7pt (far) → 20pt (near)
    const textWidth = 250 + progress * 250; // 250px (far) → 500px (near)
    const xPos = (pageWidth - textWidth) / 2; // Center horizontally

    const isHeading = section.isHeading;
    const font = isHeading ? boldFont : regularFont;

    doc.fillColor('#FFD700');
    doc.fontSize(isHeading ? Math.max(fontSize, 12) : fontSize).font(font);

    // THREE-ARGUMENT FORM is critical for proper centering with width
    doc.text(section.text, xPos, undefined, {
      align: 'center',
      width: textWidth,
      oblique: 15, // Italic slant for perspective effect
      characterSpacing: 0.3,
    });

    doc.moveDown(isHeading ? 0.4 : 0.2);
  }

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  console.log(`\n✅ Space Resume (Full) created: ${outputPath}`);
  console.log('   📊 Features:');
  console.log('   • Continuous tapering: 7pt → 20pt font size');
  console.log('   • Width progression: 250px → 500px');
  console.log('   • Centered text with perfect alignment');
  console.log('   • Oblique (italic) slant for perspective');
  console.log('   • Multi-page with consistent background\n');
}

generateSpaceResume().catch(console.error);
