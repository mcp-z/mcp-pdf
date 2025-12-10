/**
 * Language list element handler with emoji support
 */

import type PDFKit from 'pdfkit';
import { renderField } from '../formatting.ts';
import type { FieldTemplates, LanguageListElement } from '../ir/types.ts';
import type { LayoutEngine } from '../layout-engine.ts';
import { renderTextWithEmoji } from '../pdf-helpers.ts';
import { resolveStyles } from './renderer-helpers.ts';
import type { TypographyOptions } from './types.ts';

export function renderLanguageListHandler(doc: PDFKit.PDFDocument, layout: LayoutEngine, element: LanguageListElement, typography: TypographyOptions, fieldTemplates: Required<FieldTemplates>, emojiAvailable: boolean): void {
  const { items } = element;
  if (!items.length) return;

  const style = resolveStyles(typography);

  // Format each language using the language field template
  const formatted = items
    .map((lang) => {
      return renderField(fieldTemplates.language, {
        language: lang.language,
        fluency: lang.fluency,
      });
    })
    .filter(Boolean);

  if (!formatted.length) return;

  const text = formatted.join(', ');

  // Measure and ensure space
  doc.font(typography.fonts.regular).fontSize(style.fontSize);
  const textHeight = doc.heightOfString(text, {
    width: layout.getPageWidth(),
    lineGap: style.lineGap,
  });
  layout.ensureSpace(doc, textHeight);

  // Render with emoji support
  doc.fillColor('#000000');
  renderTextWithEmoji(doc, text, style.fontSize, typography.fonts.regular, emojiAvailable, {
    x: layout.getMargin(),
    y: layout.getCurrentY(),
    width: layout.getPageWidth(),
    lineGap: style.lineGap,
  });
  layout.advanceY(textHeight);

  // Trailing spacing
  layout.advanceY(style.blockMarginBottom);
}
