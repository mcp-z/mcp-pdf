/**
 * Divider element handler
 */

import type PDFKit from 'pdfkit';
import type { DividerElement, FormattingOptions } from '../ir/types.ts';
import type { LayoutEngine } from '../layout-engine.ts';
import type { TypographyOptions } from './types.ts';

export function renderDividerHandler(doc: PDFKit.PDFDocument, layout: LayoutEngine, element: DividerElement, typography: TypographyOptions, _formatting: FormattingOptions, _emojiAvailable: boolean): void {
  const { divider } = typography;
  const thickness = element.thickness ?? divider.thickness ?? 0.5;
  const color = element.color ?? divider.color ?? '#cccccc';
  const marginTop = element.margin?.top ?? divider.marginTop ?? 8;
  const marginBottom = element.margin?.bottom ?? divider.marginBottom ?? 8;

  // Add top margin
  layout.advanceY(marginTop);

  // Ensure we have room for the divider
  layout.ensureSpace(doc, thickness + marginBottom);

  const y = layout.getCurrentY();
  const x1 = layout.getMargin();
  const x2 = x1 + layout.getPageWidth();

  // Draw the line
  doc.strokeColor(color).lineWidth(thickness).moveTo(x1, y).lineTo(x2, y).stroke();

  // Reset stroke color
  doc.strokeColor('#000000');

  // Advance past the line and add bottom margin
  layout.advanceY(thickness + marginBottom);
}
