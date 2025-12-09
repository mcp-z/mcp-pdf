/**
 * Credential list element handler (awards, certificates, publications) with emoji support
 */

import type PDFKit from 'pdfkit';
import { formatDate } from '../formatting.ts';
import type { CredentialData, CredentialListElement, FormattingOptions } from '../ir/types.ts';
import type { LayoutEngine } from '../layout-engine.ts';
import { renderTextWithEmoji } from '../pdf-helpers.ts';
import { ensureString, paragraphsFromContent, renderParagraphs, resolveStyles } from './renderer-helpers.ts';
import type { TypographyOptions } from './types.ts';

function getCredentialFields(item: CredentialData, formatting: FormattingOptions): { title: string; source: string; date: string; summary?: string } {
  const dateFormat = formatting.dateFormat || 'MMM YYYY';

  // Award: { title, awarder, date, summary }
  if ('title' in item && 'awarder' in item) {
    return {
      title: ensureString(item.title),
      source: ensureString(item.awarder),
      date: formatDate(item.date, dateFormat),
      summary: ensureString(item.summary),
    };
  }

  // Publication: { name, publisher, releaseDate, summary }
  if ('publisher' in item || 'releaseDate' in item) {
    return {
      title: ensureString(item.name),
      source: ensureString(item.publisher),
      date: formatDate(item.releaseDate, dateFormat),
      summary: ensureString(item.summary),
    };
  }

  // Certificate: { name, issuer, date }
  return {
    title: ensureString(item.name),
    source: ensureString(item.issuer),
    date: formatDate(item.date, dateFormat),
  };
}

export function renderCredentialListHandler(doc: PDFKit.PDFDocument, layout: LayoutEngine, element: CredentialListElement, typography: TypographyOptions, formatting: FormattingOptions, emojiAvailable: boolean): void {
  const { items } = element;
  if (!items.length) return;

  const style = resolveStyles(typography);

  for (const item of items) {
    const { title, source, date, summary } = getCredentialFields(item, formatting);
    if (!title) continue;

    // Build metadata line
    const metaParts = [source, date].filter(Boolean);
    const metaLine = metaParts.join(', ');

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
