/**
 * Template element handler with emoji support
 */

import type PDFKit from 'pdfkit';
import type { FormattingOptions, TemplateElement } from '../ir/types.ts';
import type { LayoutEngine } from '../layout-engine.ts';
import { render } from '../template.ts';
import { renderParagraphs, resolveStyles } from './renderer-helpers.ts';
import type { TypographyOptions } from './types.ts';

export function renderTemplateHandler(doc: PDFKit.PDFDocument, layout: LayoutEngine, element: TemplateElement, typography: TypographyOptions, _formatting: FormattingOptions, emojiAvailable: boolean): void {
  // Render the template with the data
  const rendered = render(element.template, element.data);

  // Split into lines and render as text
  const lines = rendered.split('\n').filter((line) => line.trim());
  if (!lines.length) return;

  const style = resolveStyles(typography);

  const fontKey = element.style?.font ?? 'regular';
  const font = typography.fonts[fontKey] ?? typography.fonts.regular;
  const align = element.style?.alignment ?? 'left';

  doc.font(font).fillColor('#000000');
  renderParagraphs(doc, layout, lines, style, typography, emojiAvailable, align);

  layout.advanceY(style.blockMarginBottom);
}
