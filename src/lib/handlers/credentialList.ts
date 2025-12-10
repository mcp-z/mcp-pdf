/**
 * Credential list element handler (awards, certificates, publications) with emoji support
 */

import type PDFKit from 'pdfkit';
import { renderField } from '../formatting.ts';
import type { CredentialData, CredentialListElement, FieldTemplates } from '../ir/types.ts';
import type { LayoutEngine } from '../layout-engine.ts';
import { renderTextWithEmoji } from '../pdf-helpers.ts';
import { ensureString, paragraphsFromContent, renderParagraphs, resolveStyles } from './renderer-helpers.ts';
import type { TypographyOptions } from './types.ts';

function getCredentialFields(item: CredentialData, fieldTemplates: Required<FieldTemplates>): { title: string; metaLine: string; summary?: string } {
  // Use credential field template for the metadata line
  const metaLine = renderField(fieldTemplates.credential, {
    title: item.title,
    name: item.name,
    awarder: item.awarder,
    issuer: item.issuer,
    publisher: item.publisher,
    date: item.date,
    releaseDate: item.releaseDate,
  });

  // Determine the title (credential name)
  const title = ensureString(item.title || item.name);

  return {
    title,
    metaLine,
    summary: ensureString(item.summary),
  };
}

export function renderCredentialListHandler(doc: PDFKit.PDFDocument, layout: LayoutEngine, element: CredentialListElement, typography: TypographyOptions, fieldTemplates: Required<FieldTemplates>, emojiAvailable: boolean): void {
  const { items } = element;
  if (!items.length) return;

  const style = resolveStyles(typography);

  for (const item of items) {
    const { title, metaLine, summary } = getCredentialFields(item, fieldTemplates);
    if (!title) continue;

    // Measure heights
    doc.font(typography.fonts.bold).fontSize(style.fontSize);
    const titleHeight = doc.heightOfString(title, { width: layout.getPageWidth() });

    doc.font(typography.fonts.italic).fontSize(style.fontSize);
    const metaHeight = metaLine ? doc.heightOfString(metaLine, { width: layout.getPageWidth() }) : 0;

    const summaryParagraphs = paragraphsFromContent(summary);
    doc.font(typography.fonts.regular).fontSize(style.fontSize);
    const summaryHeight = summaryParagraphs.length
      ? summaryParagraphs.reduce(
          (acc, p) =>
            acc +
            doc.heightOfString(p, {
              width: layout.getPageWidth(),
              lineGap: style.lineGap,
            }),
          0
        )
      : 0;

    const totalHeight = titleHeight + metaHeight + summaryHeight + style.blockMarginBottom;
    layout.ensureSpace(doc, totalHeight);

    // Render title (bold) with emoji support
    doc.font(typography.fonts.bold).fontSize(style.fontSize).fillColor('#000000');
    renderTextWithEmoji(doc, title, style.fontSize, typography.fonts.bold, emojiAvailable, {
      x: layout.getMargin(),
      y: layout.getCurrentY(),
      width: layout.getPageWidth(),
    });
    layout.advanceY(titleHeight);

    // Render metadata line (italic, gray)
    if (metaLine) {
      doc.font(typography.fonts.italic).fontSize(style.fontSize).fillColor('#444444');
      doc.text(metaLine, layout.getMargin(), layout.getCurrentY(), { width: layout.getPageWidth() });
      layout.advanceY(metaHeight);
      doc.fillColor('#000000');
    }

    // Render summary if present
    if (summaryParagraphs.length) {
      layout.advanceY(style.paragraphMarginBottom);
      doc.font(typography.fonts.regular).fillColor('#000000');
      renderParagraphs(doc, layout, summaryParagraphs, style, typography, emojiAvailable, 'justify');
    }

    // Spacing between entries
    layout.advanceY(style.blockMarginBottom);
  }
}
