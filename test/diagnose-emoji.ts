#!/usr/bin/env node

/**
 * Diagnostic script to understand emoji rendering in PDFKit
 */

import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';

const testDir = join(tmpdir(), 'mcp-pdf-emoji-diagnosis');
await mkdir(testDir, { recursive: true });

const testCases = [
  {
    name: 'built-in-helvetica',
    font: 'Helvetica',
    text: 'Hello World 👋 ASCII works fine',
    description: 'Built-in PDF font (no Unicode support)',
  },
  {
    name: 'system-font-sfns',
    font: '/System/Library/Fonts/SFNS.ttf',
    text: 'Hello World 👋 😀 🎉 with SF font',
    description: 'macOS system font (should have glyphs)',
  },
  {
    name: 'emoji-only',
    font: '/System/Library/Fonts/SFNS.ttf',
    text: '👋 😀 🎉 🚀 ✅ ❌',
    description: 'Only emoji characters',
  },
  {
    name: 'mixed-bullets',
    font: '/System/Library/Fonts/SFNS.ttf',
    text: `Skills:
• TypeScript 💙
• Node.js ⚡
• React ⚛️`,
    description: 'Mixed bullets and emoji',
  },
];

for (const testCase of testCases) {
  const outputPath = join(testDir, `${testCase.name}.pdf`);
  const doc = new PDFDocument({ compress: false }); // No compression for easier inspection
  const stream = createWriteStream(outputPath);

  console.log(`\n📝 Test: ${testCase.name}`);
  console.log(`   Font: ${testCase.font}`);
  console.log(`   Text: ${testCase.text}`);

  doc.pipe(stream);

  try {
    if (testCase.font !== 'Helvetica') {
      // Check if font exists
      const fs = await import('node:fs');
      if (!fs.existsSync(testCase.font)) {
        console.log(`   ❌ Font file not found: ${testCase.font}`);
        doc.font('Helvetica').text(`Font not found: ${testCase.font}`);
        doc.end();
        continue;
      }
      doc.registerFont('TestFont', testCase.font);
      doc.font('TestFont');
    } else {
      doc.font(testCase.font);
    }

    doc.fontSize(20);
    doc.text(testCase.text);
    console.log(`   ✅ PDF created: ${outputPath}`);
  } catch (err) {
    console.log(`   ❌ Error: ${err}`);
    doc.text(`Error: ${err}`);
  }

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });
}

console.log(`\n📁 Diagnosis PDFs saved to: ${testDir}`);
console.log('\n🔍 What to look for:');
console.log('   1. Open each PDF in Preview/Adobe');
console.log('   2. Check if emojis appear as:');
console.log('      - Colored emoji (✅ best)');
console.log('      - Black & white outlines (⚠️  partial support)');
console.log('      - Empty boxes/tofu (❌ missing glyphs)');
console.log('      - Missing completely (❌ PDFKit dropped them)');
console.log('\n💡 Common issues:');
console.log('   - SFNS.ttf may not contain color emoji');
console.log('   - Emoji require Apple Color Emoji font (.ttc format)');
console.log('   - PDFKit may not support color emoji at all');
console.log(`\nRun: open "${testDir}"\n`);
