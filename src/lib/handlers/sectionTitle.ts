/**
 * Section title element handler with emoji support
 */

import type PDFKit from 'pdfkit';
import type { FormattingOptions, SectionTitleElement } from '../ir/types.ts';
import type { LayoutEngine } from '../layout-engine.ts';
import { renderTextWithEmoji } from '../pdf-helpers.ts';
import type { TypographyOptions } from './types.ts';

export function renderSectionTitleHandler(doc: PDFKit.PDFDocument, layout: LayoutEngine, element: SectionTitleElement, typography: TypographyOptions, _formatting: FormattingOptions, emojiAvailable: boolean): void {
  const title = element.title;
  if (!title) return;

  const { sectionTitle } = typography;

  // Add top margin before section title
  layout.advanceY(sectionTitle.marginTop ?? 0);

  const pageWidth = layout.getPageWidth();

  // Measure title height
  doc.font(typography.fonts.bold).fontSize(sectionTitle.fontSize);
  const titleHeight = doc.heightOfString(title.toUpperCase(), { width: pageWidth });

  // Ensure we can fit the title + underline + at least the first entry header
  // Entry header = org name + position + date = ~60px minimum
  const minContentHeight = 60;
  const headerBlock = titleHeight + 8 + minContentHeight;
  layout.ensureSpace(doc, headerBlock);

  const y = layout.getCurrentY();

  // Draw title with emoji support
  doc.fillColor('#000000');
  renderTextWithEmoji(doc, title.toUpperCase(), sectionTitle.fontSize, typography.fonts.bold, emojiAvailable, {
    x: layout.getMargin(),
    y,
    width: pageWidth,
    characterSpacing: sectionTitle.letterSpacing ?? 0,
  });

  layout.advanceY(titleHeight + (sectionTitle.underlineGap ?? 0));

  // Draw underline
  const lineY = layout.getCurrentY();
  doc
    .strokeColor('#000000')
    .lineWidth(sectionTitle.underlineThickness ?? 0.5)
    .moveTo(layout.getMargin(), lineY)
    .lineTo(layout.getMargin() + pageWidth, lineY)
    .stroke();

  layout.advanceY(sectionTitle.marginBottom ?? 0);
}
