/**
 * Reference list element handler with emoji support
 */

import type PDFKit from 'pdfkit';
import type { FormattingOptions, ReferenceListElement } from '../ir/types.ts';
import type { LayoutEngine } from '../layout-engine.ts';
import { renderTextWithEmoji } from '../pdf-helpers.ts';
import { ensureString, paragraphsFromContent, resolveStyles } from './renderer-helpers.ts';
import type { TypographyOptions } from './types.ts';

export function renderReferenceListHandler(doc: PDFKit.PDFDocument, layout: LayoutEngine, element: ReferenceListElement, typography: TypographyOptions, _formatting: FormattingOptions, emojiAvailable: boolean): void {
  const { items } = element;
  if (!items.length) return;

  const style = resolveStyles(typography);
  const { quote } = typography;

  for (const ref of items) {
    const name = ensureString(ref.name);
    const referenceText = ensureString(ref.reference);

    if (!name && !referenceText) continue;

    // Measure heights
    doc.font(typography.fonts.bold).fontSize(style.fontSize);
    const nameHeight = name ? doc.heightOfString(name, { width: layout.getPageWidth() }) : 0;

    const quoteParagraphs = paragraphsFromContent(referenceText);
    doc.font(typography.fonts.italic).fontSize(style.fontSize);
    const quoteWidth = layout.getPageWidth() - quote.indent;
    const quoteHeight = quoteParagraphs.length
      ? quoteParagraphs.reduce(
          (acc, p) =>
            acc +
            doc.heightOfString(`"${p}"`, {
              width: quoteWidth,
              lineGap: style.lineGap,
            }),
          0
        )
      : 0;

    const totalHeight = nameHeight + quoteHeight + style.blockMarginBottom * 2;
    layout.ensureSpace(doc, totalHeight);

    // Render name (bold) with emoji support
    if (name) {
      doc.font(typography.fonts.bold).fontSize(style.fontSize).fillColor('#000000');
      renderTextWithEmoji(doc, name, style.fontSize, typography.fonts.bold, emojiAvailable, {
        x: layout.getMargin(),
        y: layout.getCurrentY(),
        width: layout.getPageWidth(),
      });
      layout.advanceY(nameHeight + style.paragraphMarginBottom);
    }

    // Render quote (italic, indented) with emoji support
    if (quoteParagraphs.length) {
      doc.font(typography.fonts.italic).fontSize(style.fontSize).fillColor('#333333');

      for (let i = 0; i < quoteParagraphs.length; i++) {
        const paragraph = quoteParagraphs[i];
        if (!paragraph) continue;
        const quotedText = i === 0 ? `"${paragraph}` : paragraph;
        const finalText = i === quoteParagraphs.length - 1 ? `${quotedText}"` : quotedText;

        const height = doc.heightOfString(finalText, {
          width: quoteWidth,
          lineGap: style.lineGap,
        });
        renderTextWithEmoji(doc, finalText, style.fontSize, typography.fonts.italic, emojiAvailable, {
          x: layout.getMargin() + quote.indent,
          y: layout.getCurrentY(),
          width: quoteWidth,
          lineGap: style.lineGap,
          align: 'justify',
        });
        layout.advanceY(height + style.paragraphMarginBottom);
      }

      doc.fillColor('#000000');
    }

    // Spacing between entries
    layout.advanceY(style.blockMarginBottom);
  }
}
