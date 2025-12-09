/**
 * Keyword list element handler (skills, interests) with emoji support
 */

import type PDFKit from 'pdfkit';
import type { FormattingOptions, KeywordListElement } from '../ir/types.ts';
import type { LayoutEngine } from '../layout-engine.ts';
import { renderTextWithEmoji } from '../pdf-helpers.ts';
import { ensureString, resolveStyles } from './renderer-helpers.ts';
import type { TypographyOptions } from './types.ts';

export function renderKeywordListHandler(doc: PDFKit.PDFDocument, layout: LayoutEngine, element: KeywordListElement, typography: TypographyOptions, _formatting: FormattingOptions, emojiAvailable: boolean): void {
  const { items } = element;
  if (!items.length) return;

  const style = resolveStyles(typography);

  for (const skill of items) {
    const name = ensureString(skill.name);
    const level = ensureString((skill as Record<string, unknown>).level);
    const keywords = skill.keywords && skill.keywords.length ? skill.keywords.join(', ') : '';

    const prefix = level ? `${name} (${level}): ` : `${name}: `;
    const fullText = prefix + keywords;

    doc.font(typography.fonts.regular).fontSize(style.fontSize);
    const textHeight = doc.heightOfString(fullText, {
      width: layout.getPageWidth(),
      lineGap: style.lineGap,
    });
    layout.ensureSpace(doc, textHeight + style.itemMarginBottom);

    // Draw category name in bold
    doc.font(typography.fonts.bold).fontSize(style.fontSize);
    const prefixWidth = doc.widthOfString(prefix);
    renderTextWithEmoji(doc, prefix, style.fontSize, typography.fonts.bold, emojiAvailable, {
      x: layout.getMargin(),
      y: layout.getCurrentY(),
    });

    // Draw keywords in regular font (inline with prefix)
    doc.font(typography.fonts.regular).fontSize(style.fontSize);
    renderTextWithEmoji(doc, keywords, style.fontSize, typography.fonts.regular, emojiAvailable, {
      x: layout.getMargin() + prefixWidth,
      y: layout.getCurrentY(),
      width: layout.getPageWidth() - prefixWidth,
      lineGap: style.lineGap,
    });

    layout.advanceY(textHeight + style.itemMarginBottom);
  }
}
