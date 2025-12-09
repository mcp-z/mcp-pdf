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

  // Ensure space for title + underline only
  // Note: The group handler (react-pdf style wrap={false}) ensures the section title
  // stays with the first entry. We only need to ensure space for the title itself.
  const underlineHeight = (sectionTitle.underlineGap ?? 0) + 1;
  layout.ensureSpace(doc, titleHeight + underlineHeight + (sectionTitle.marginBottom ?? 0));

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
