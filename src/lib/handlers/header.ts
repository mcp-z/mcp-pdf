/**
 * Header element handler with emoji support
 */

import type PDFKit from 'pdfkit';
import { renderField } from '../formatting.ts';
import type { FieldTemplates, HeaderElement } from '../ir/types.ts';
import type { LayoutEngine } from '../layout-engine.ts';
import { renderTextWithEmoji } from '../pdf-helpers.ts';
import type { TypographyOptions } from './types.ts';

export function renderHeaderHandler(doc: PDFKit.PDFDocument, layout: LayoutEngine, element: HeaderElement, typography: TypographyOptions, fieldTemplates: Required<FieldTemplates>, emojiAvailable: boolean): void {
  const { name, contactItems } = element;
  const { header } = typography;

  // Name
  doc.fontSize(header.name.fontSize).font(typography.fonts.bold);
  const nameHeight = doc.heightOfString(name.toUpperCase(), {
    width: layout.getPageWidth(),
    align: 'center',
  });

  renderTextWithEmoji(doc, name.toUpperCase(), header.name.fontSize, typography.fonts.bold, emojiAvailable, {
    x: layout.getMargin(),
    y: layout.getCurrentY(),
    width: layout.getPageWidth(),
    align: 'center',
    characterSpacing: header.name.letterSpacing ?? 0,
  });
  layout.advanceY(nameHeight);

  // Contact line
  if (contactItems.length) {
    layout.advanceY(header.name.marginBottom ?? 0);
    doc.fontSize(header.contact.fontSize).font(typography.fonts.regular).fillColor('#000000');

    // Build display text for each contact item
    // Location items use the location field template
    const contactTexts = contactItems
      .map((item) => {
        if (item.location) {
          return renderField(fieldTemplates.location, item.location);
        }
        return item.text;
      })
      .filter((text) => text.length > 0);

    // Render contact line using the contactLine template
    const contactText = renderField(fieldTemplates.contactLine, { items: contactTexts });

    const contactHeight = doc.heightOfString(contactText, {
      width: layout.getPageWidth(),
      align: 'center',
    });

    // Calculate text position for link annotations
    const textWidth = doc.widthOfString(contactText);
    const textX = layout.getMargin() + (layout.getPageWidth() - textWidth) / 2;
    const textY = layout.getCurrentY();

    // Render the contact text with emoji support
    renderTextWithEmoji(doc, contactText, header.contact.fontSize, typography.fonts.regular, emojiAvailable, {
      x: layout.getMargin(),
      y: textY,
      width: layout.getPageWidth(),
      align: 'center',
      characterSpacing: header.contact.letterSpacing ?? 0,
    });

    // Add clickable link annotations
    let searchPos = 0;
    for (const item of contactItems) {
      if (item.url) {
        // Get the display text for this item (same logic as contact line)
        const itemText = item.location ? renderField(fieldTemplates.location, item.location) : item.text;
        if (!itemText) continue;

        const idx = contactText.indexOf(itemText, searchPos);
        if (idx >= 0) {
          const beforeText = contactText.substring(0, idx);
          const beforeWidth = doc.widthOfString(beforeText);
          const linkWidth = doc.widthOfString(itemText);
          const linkX = textX + beforeWidth;
          const linkHeight = header.contact.fontSize;
          doc.link(linkX, textY, linkWidth, linkHeight, item.url);
          searchPos = idx + itemText.length;
        }
      }
    }

    layout.advanceY(contactHeight);
  }

  layout.advanceY(header.marginBottom ?? 0);
}
