/**
 * Keyword list element handler (skills, interests) with emoji support
 */

import type PDFKit from 'pdfkit';
import { renderField } from '../formatting.ts';
import type { FieldTemplates, KeywordListElement } from '../ir/types.ts';
import type { LayoutEngine } from '../layout-engine.ts';
import { ensureString, resolveStyles } from './renderer-helpers.ts';
import type { TypographyOptions } from './types.ts';

export function renderKeywordListHandler(doc: PDFKit.PDFDocument, layout: LayoutEngine, element: KeywordListElement, typography: TypographyOptions, fieldTemplates: Required<FieldTemplates>, _emojiAvailable: boolean): void {
  const { items } = element;
  if (!items.length) return;

  const style = resolveStyles(typography);

  for (const skill of items) {
    const name = ensureString(skill.name);
    const level = ensureString((skill as Record<string, unknown>).level);
    const keywords = skill.keywords || [];

    // Use skill field template
    const fullText = renderField(fieldTemplates.skill, {
      name,
      level,
      keywords,
    });

    // For bold prefix, we still need to calculate it separately
    const prefix = level ? `${name} (${level}): ` : `${name}: `;
    const keywordsText = keywords.join(', ');

    doc.font(typography.fonts.regular).fontSize(style.fontSize);
    const textHeight = doc.heightOfString(fullText, {
      width: layout.getPageWidth(),
      lineGap: style.lineGap,
    });
    layout.ensureSpace(doc, textHeight + style.itemMarginBottom);

    // Draw category name in bold using PDFKit's continued mode for proper inline flow
    doc.font(typography.fonts.bold).fontSize(style.fontSize);
    doc.text(prefix, layout.getMargin(), layout.getCurrentY(), {
      continued: true,
      lineGap: style.lineGap,
    });

    // Draw keywords in regular font (flows inline via continued mode)
    doc.font(typography.fonts.regular).fontSize(style.fontSize);
    doc.text(keywordsText, {
      width: layout.getPageWidth(),
      lineGap: style.lineGap,
    });

    layout.advanceY(textHeight + style.itemMarginBottom);
  }
}
