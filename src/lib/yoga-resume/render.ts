/**
 * Position-based renderers for Yoga layout.
 *
 * These renderers receive computed positions from Yoga and render
 * at exact x, y coordinates. No advanceY() - all positions are pre-computed.
 */

import type PDFKit from 'pdfkit';
import { renderField } from '../formatting.ts';
import type { CredentialData, CredentialListElement, DividerElement, EntryData, EntryListElement, FieldTemplates, GroupElement, HeaderElement, KeywordListElement, LanguageListElement, ReferenceListElement, SectionTitleElement, SummaryHighlightsElement, TextElement } from '../ir/types.ts';
import { renderTextWithEmoji } from '../pdf-helpers.ts';
import type { TypographyOptions } from '../types/typography.ts';
import type { ComputedPosition, Page, PageNode, RenderContext } from './types.ts';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Ensure a value is a string.
 */
function ensureString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}

/**
 * Get resolved text style values from typography.
 */
function getResolvedStyle(typography: TypographyOptions) {
  const { text } = typography;
  return {
    fontSize: text.fontSize,
    lineGap: (text.lineHeight ?? 1.3) * text.fontSize - text.fontSize,
    paragraphMarginBottom: text.marginBottom ?? 4,
    itemMarginBottom: text.marginBottom ?? 4,
    blockMarginBottom: text.blockMarginBottom ?? 6,
  };
}

/**
 * Convert content to array of paragraphs.
 */
function paragraphsFromContent(content: string | string[] | undefined): string[] {
  if (!content) return [];
  if (Array.isArray(content)) return content.filter(Boolean);
  return content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

// =============================================================================
// Element Renderers
// =============================================================================

/**
 * Render text element at computed position.
 */
export function renderText(ctx: RenderContext, element: TextElement, position: ComputedPosition): void {
  const { doc, typography, emojiAvailable, fonts } = ctx;
  const style = getResolvedStyle(typography);
  const paragraphs = paragraphsFromContent(element.content);

  if (paragraphs.length === 0) return;

  let currentY = position.y;

  for (let i = 0; i < paragraphs.length; i++) {
    renderTextWithEmoji(doc, paragraphs[i], style.fontSize, fonts.regular, emojiAvailable, {
      x: position.x,
      y: currentY,
      width: position.width,
      lineGap: style.lineGap,
      align: 'justify',
    });

    // Calculate height of this paragraph to advance Y
    doc.font(fonts.regular).fontSize(style.fontSize);
    const height = doc.heightOfString(paragraphs[i], { width: position.width, lineGap: style.lineGap });
    currentY += height;

    if (i < paragraphs.length - 1) {
      currentY += style.paragraphMarginBottom;
    }
  }
}

/**
 * Render section title at computed position.
 */
export function renderSectionTitle(ctx: RenderContext, element: SectionTitleElement, position: ComputedPosition): void {
  const { doc, typography, emojiAvailable, fonts } = ctx;
  const { sectionTitle } = typography;

  if (!element.title) return;

  const marginTop = sectionTitle.marginTop ?? 0;
  let currentY = position.y + marginTop;

  // Draw title with emoji support
  doc.font(fonts.bold).fontSize(sectionTitle.fontSize).fillColor('#000000');
  renderTextWithEmoji(doc, element.title.toUpperCase(), sectionTitle.fontSize, fonts.bold, emojiAvailable, {
    x: position.x,
    y: currentY,
    width: position.width,
    characterSpacing: sectionTitle.letterSpacing ?? 0,
  });

  // Calculate title height
  const titleHeight = doc.heightOfString(element.title.toUpperCase(), { width: position.width });
  currentY += titleHeight + (sectionTitle.underlineGap ?? 0);

  // Draw underline
  doc
    .strokeColor('#000000')
    .lineWidth(sectionTitle.underlineThickness ?? 0.5)
    .moveTo(position.x, currentY)
    .lineTo(position.x + position.width, currentY)
    .stroke();
}

/**
 * Render header element at computed position.
 */
export function renderHeader(ctx: RenderContext, element: HeaderElement, position: ComputedPosition): void {
  const { doc, typography, fieldTemplates, emojiAvailable, fonts } = ctx;
  const { header } = typography;

  let currentY = position.y;

  // Name
  doc.font(fonts.bold).fontSize(header.name.fontSize);
  const nameHeight = doc.heightOfString(element.name.toUpperCase(), { width: position.width, align: 'center' });

  renderTextWithEmoji(doc, element.name.toUpperCase(), header.name.fontSize, fonts.bold, emojiAvailable, {
    x: position.x,
    y: currentY,
    width: position.width,
    align: 'center',
    characterSpacing: header.name.letterSpacing ?? 0,
  });
  currentY += nameHeight + (header.name.marginBottom ?? 0);

  // Contact line
  if (element.contactItems.length > 0) {
    doc.font(fonts.regular).fontSize(header.contact.fontSize).fillColor('#000000');

    const contactTexts = element.contactItems
      .map((item) => {
        if (item.location) {
          return renderField(fieldTemplates.location, item.location);
        }
        return item.text;
      })
      .filter((text) => text.length > 0);

    const contactText = renderField(fieldTemplates.contactLine, { items: contactTexts });
    const _contactHeight = doc.heightOfString(contactText, { width: position.width, align: 'center' });

    // Calculate text position for link annotations
    const textWidth = doc.widthOfString(contactText);
    const textX = position.x + (position.width - textWidth) / 2;
    const textY = currentY;

    renderTextWithEmoji(doc, contactText, header.contact.fontSize, fonts.regular, emojiAvailable, {
      x: position.x,
      y: textY,
      width: position.width,
      align: 'center',
      characterSpacing: header.contact.letterSpacing ?? 0,
    });

    // Add clickable link annotations
    let searchPos = 0;
    for (const item of element.contactItems) {
      if (item.url) {
        const itemText = item.location ? renderField(fieldTemplates.location, item.location) : item.text;
        if (!itemText) continue;

        const idx = contactText.indexOf(itemText, searchPos);
        if (idx >= 0) {
          const beforeText = contactText.substring(0, idx);
          const beforeWidth = doc.widthOfString(beforeText);
          const linkWidth = doc.widthOfString(itemText);
          const linkX = textX + beforeWidth;
          doc.link(linkX, textY, linkWidth, header.contact.fontSize, item.url);
          searchPos = idx + itemText.length;
        }
      }
    }
  }
}

/**
 * Render divider element at computed position.
 */
export function renderDivider(ctx: RenderContext, element: DividerElement, position: ComputedPosition): void {
  const { doc } = ctx;
  const marginTop = element.margin?.top ?? 8;
  const thickness = element.thickness ?? 0.5;
  const color = element.color ?? '#cccccc';

  const lineY = position.y + marginTop;

  doc
    .strokeColor(color)
    .lineWidth(thickness)
    .moveTo(position.x, lineY)
    .lineTo(position.x + position.width, lineY)
    .stroke();
}

/**
 * Render keyword list element at computed position.
 */
export function renderKeywordList(ctx: RenderContext, element: KeywordListElement, position: ComputedPosition): void {
  const { doc, typography, fieldTemplates, fonts } = ctx;
  const style = getResolvedStyle(typography);

  if (element.items.length === 0) return;

  let currentY = position.y;

  for (const skill of element.items) {
    const name = ensureString(skill.name);
    const level = ensureString((skill as Record<string, unknown>).level);
    const keywords = skill.keywords || [];

    const fullText = renderField(fieldTemplates.skill, { name, level, keywords });
    const prefix = level ? `${name} (${level}): ` : `${name}: `;
    const keywordsText = keywords.join(', ');

    doc.font(fonts.regular).fontSize(style.fontSize);
    const textHeight = doc.heightOfString(fullText, { width: position.width, lineGap: style.lineGap });

    // Draw category name in bold using continued mode
    doc.font(fonts.bold).fontSize(style.fontSize);
    doc.text(prefix, position.x, currentY, {
      continued: true,
      lineGap: style.lineGap,
    });

    // Draw keywords in regular font
    doc.font(fonts.regular).fontSize(style.fontSize);
    doc.text(keywordsText, {
      width: position.width,
      lineGap: style.lineGap,
    });

    currentY += textHeight + style.itemMarginBottom;
  }
}

/**
 * Render language list element at computed position.
 */
export function renderLanguageList(ctx: RenderContext, element: LanguageListElement, position: ComputedPosition): void {
  const { doc, typography, fieldTemplates, emojiAvailable, fonts } = ctx;
  const style = getResolvedStyle(typography);

  if (element.items.length === 0) return;

  const languageTexts = element.items.map((item) => renderField(fieldTemplates.language, item)).filter(Boolean);
  const fullText = languageTexts.join(', ');

  doc.font(fonts.regular).fontSize(style.fontSize).fillColor('#000000');
  renderTextWithEmoji(doc, fullText, style.fontSize, fonts.regular, emojiAvailable, {
    x: position.x,
    y: position.y,
    width: position.width,
    lineGap: style.lineGap,
  });
}

/**
 * Render credential list element at computed position.
 */
export function renderCredentialList(ctx: RenderContext, element: CredentialListElement, position: ComputedPosition): void {
  const { doc, typography, fieldTemplates, emojiAvailable, fonts } = ctx;
  const style = getResolvedStyle(typography);

  if (element.items.length === 0) return;

  let currentY = position.y;

  for (const item of element.items) {
    const title = ensureString((item as CredentialData).title || (item as CredentialData).name);
    if (!title) continue;

    const metaLine = renderField(fieldTemplates.credential, {
      title: item.title,
      name: item.name,
      awarder: item.awarder,
      issuer: item.issuer,
      publisher: item.publisher,
      date: item.date,
      releaseDate: item.releaseDate,
    });

    // Render title (bold)
    doc.font(fonts.bold).fontSize(style.fontSize).fillColor('#000000');
    const titleHeight = doc.heightOfString(title, { width: position.width });
    renderTextWithEmoji(doc, title, style.fontSize, fonts.bold, emojiAvailable, {
      x: position.x,
      y: currentY,
      width: position.width,
    });
    currentY += titleHeight;

    // Render metadata line (italic, gray)
    if (metaLine) {
      doc.font(fonts.italic).fontSize(style.fontSize).fillColor('#444444');
      const metaHeight = doc.heightOfString(metaLine, { width: position.width });
      doc.text(metaLine, position.x, currentY, { width: position.width });
      currentY += metaHeight;
      doc.fillColor('#000000');
    }

    // Render summary if present
    const summaryParagraphs = paragraphsFromContent(ensureString(item.summary));
    if (summaryParagraphs.length > 0) {
      currentY += style.paragraphMarginBottom;
      doc.font(fonts.regular).fillColor('#000000');

      for (const para of summaryParagraphs) {
        renderTextWithEmoji(doc, para, style.fontSize, fonts.regular, emojiAvailable, {
          x: position.x,
          y: currentY,
          width: position.width,
          lineGap: style.lineGap,
          align: 'justify',
        });
        doc.font(fonts.regular).fontSize(style.fontSize);
        const paraHeight = doc.heightOfString(para, { width: position.width, lineGap: style.lineGap });
        currentY += paraHeight + style.paragraphMarginBottom;
      }
    }

    currentY += style.blockMarginBottom;
  }
}

/**
 * Render reference list element at computed position.
 */
export function renderReferenceList(ctx: RenderContext, element: ReferenceListElement, position: ComputedPosition): void {
  const { doc, typography, emojiAvailable, fonts } = ctx;
  const style = getResolvedStyle(typography);
  const { quote } = typography;

  if (element.items.length === 0) return;

  let currentY = position.y;

  for (const ref of element.items) {
    const name = ensureString(ref.name);
    const reference = ensureString(ref.reference);

    if (!name && !reference) continue;

    // Name line (bold)
    if (name) {
      doc.font(fonts.bold).fontSize(style.fontSize).fillColor('#000000');
      const nameHeight = doc.heightOfString(name, { width: position.width });
      renderTextWithEmoji(doc, name, style.fontSize, fonts.bold, emojiAvailable, {
        x: position.x,
        y: currentY,
        width: position.width,
      });
      currentY += nameHeight + style.itemMarginBottom;
    }

    // Quote text (italic, indented)
    if (reference) {
      const quoteWidth = position.width - quote.indent;
      doc.font(fonts.italic).fontSize(style.fontSize).fillColor('#000000');
      const quoteText = `"${reference}"`;
      const quoteHeight = doc.heightOfString(quoteText, { width: quoteWidth, lineGap: style.lineGap });
      renderTextWithEmoji(doc, quoteText, style.fontSize, fonts.italic, emojiAvailable, {
        x: position.x + quote.indent,
        y: currentY,
        width: quoteWidth,
        lineGap: style.lineGap,
      });
      currentY += quoteHeight;
    }

    currentY += style.blockMarginBottom;
  }
}

/**
 * Render entry list element at computed position.
 * This is complex - delegates to work or education entry renderers.
 */
export function renderEntryList(ctx: RenderContext, element: EntryListElement, position: ComputedPosition): void {
  const { entries, variant } = element;
  if (entries.length === 0) return;

  let currentY = position.y;

  if (variant === 'education') {
    for (const entry of entries) {
      const height = renderEducationEntry(ctx, entry, position.x, currentY, position.width);
      currentY += height;
    }
  } else {
    // Work entries - group by company
    const groups = groupByCompany(entries);

    for (const group of groups) {
      if (group.length === 1) {
        const height = renderSingleWorkEntry(ctx, group[0], position.x, currentY, position.width);
        currentY += height;
      } else {
        const height = renderGroupedWorkEntry(ctx, group, position.x, currentY, position.width);
        currentY += height;
      }
    }
  }
}

/**
 * Group entries by company name.
 */
function groupByCompany(entries: EntryData[]): EntryData[][] {
  const groups: EntryData[][] = [];
  let currentGroup: EntryData[] = [];
  let currentCompany = '';

  for (const entry of entries) {
    const rec = entry as Record<string, unknown>;
    const company = ensureString(rec.name ?? rec.organization ?? rec.entity)
      .trim()
      .toLowerCase();

    if (company === currentCompany && currentGroup.length > 0) {
      currentGroup.push(entry);
    } else {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [entry];
      currentCompany = company;
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Render a single work entry. Returns height rendered.
 */
function renderSingleWorkEntry(ctx: RenderContext, entry: EntryData, x: number, y: number, width: number): number {
  const { doc, typography, fieldTemplates, emojiAvailable, fonts } = ctx;
  const style = getResolvedStyle(typography);
  const { entry: entryStyle, bullet } = typography;

  const rightWidth = entryStyle.date.width;
  const leftWidth = width - rightWidth - 10;

  const entryData = entry as Record<string, unknown>;
  const company = ensureString(entryData.name ?? entryData.organization ?? entryData.entity);
  const position = ensureString(entryData.position ?? (entryData.roles as string[])?.[0]);
  const location = ensureString(entryData.location);

  const dateText = renderField(fieldTemplates.dateRange, {
    start: entry.startDate,
    end: entry.endDate,
  });

  const summaryText = entryData.summary ?? entryData.description;
  const summaryParagraphs = paragraphsFromContent(summaryText as string | string[] | undefined);
  const highlights = Array.isArray(entryData.highlights) ? (entryData.highlights as string[]).map(ensureString).filter(Boolean) : [];

  let currentY = y;

  // Line 1: Company + Location
  if (company) {
    doc.font(fonts.bold).fontSize(entryStyle.position.fontSize).fillColor('#000000');
    const companyHeight = doc.heightOfString(company, { width: leftWidth });
    renderTextWithEmoji(doc, company, entryStyle.position.fontSize, fonts.bold, emojiAvailable, {
      x,
      y: currentY,
      width: leftWidth,
    });

    if (location) {
      doc.font(fonts.bold).fontSize(entryStyle.location.fontSize);
      doc.text(location, x + width - rightWidth, currentY, { width: rightWidth, align: 'right' });
    }

    currentY += companyHeight + (entryStyle.position.marginBottom ?? 0);
  }

  // Line 2: Position + Dates
  doc.font(fonts.italic).fontSize(entryStyle.position.fontSize).fillColor('#000000');
  const positionHeight = doc.heightOfString(position, { width: leftWidth });
  renderTextWithEmoji(doc, position, entryStyle.position.fontSize, fonts.italic, emojiAvailable, {
    x,
    y: currentY,
    width: leftWidth,
  });

  if (dateText) {
    doc
      .font(fonts.italic)
      .fontSize(entryStyle.company.fontSize)
      .fillColor(entryStyle.company.color ?? '#444444');
    doc.text(dateText, x + width - rightWidth, currentY, { width: rightWidth, align: 'right' });
    doc.fillColor('#000000');
  }

  const hasContent = summaryParagraphs.length > 0 || highlights.length > 0;
  currentY += positionHeight + 3 + (hasContent ? style.blockMarginBottom : 0);

  // Summary paragraphs
  if (summaryParagraphs.length > 0) {
    doc.font(fonts.regular).fillColor('#000000');
    for (const para of summaryParagraphs) {
      renderTextWithEmoji(doc, para, style.fontSize, fonts.regular, emojiAvailable, {
        x,
        y: currentY,
        width,
        lineGap: style.lineGap,
        align: 'justify',
      });
      doc.font(fonts.regular).fontSize(style.fontSize);
      const paraHeight = doc.heightOfString(para, { width, lineGap: style.lineGap });
      currentY += paraHeight + style.paragraphMarginBottom;
    }
  }

  // Bullet highlights
  if (highlights.length > 0) {
    if (summaryParagraphs.length > 0) {
      currentY += style.blockMarginBottom;
    }
    const bulletWidth = width - bullet.indent;
    doc.font(fonts.regular).fillColor('#000000');

    for (const highlight of highlights) {
      const bulletText = `• ${highlight}`;
      renderTextWithEmoji(doc, bulletText, style.fontSize, fonts.regular, emojiAvailable, {
        x: x + bullet.indent,
        y: currentY,
        width: bulletWidth,
        lineGap: style.lineGap,
      });
      doc.font(fonts.regular).fontSize(style.fontSize);
      const bulletHeight = doc.heightOfString(bulletText, { width: bulletWidth, lineGap: style.lineGap });
      currentY += bulletHeight + (bullet.marginBottom ?? 2);
    }
  }

  currentY += style.blockMarginBottom;

  return currentY - y;
}

/**
 * Render grouped work entries (multiple positions at same company). Returns height rendered.
 */
function renderGroupedWorkEntry(ctx: RenderContext, entries: EntryData[], x: number, y: number, width: number): number {
  const { doc, typography, emojiAvailable, fonts } = ctx;
  const style = getResolvedStyle(typography);
  const { entry: entryStyle } = typography;

  const firstJob = entries[0] as Record<string, unknown>;
  const company = ensureString(firstJob.name ?? firstJob.organization ?? firstJob.entity);

  const locations = entries.map((j) => ensureString((j as Record<string, unknown>).location)).filter(Boolean);
  const uniqueLocations = [...new Set(locations)];
  const sameLocation = uniqueLocations.length <= 1;
  const sharedLocation = sameLocation && uniqueLocations.length === 1 ? (uniqueLocations[0] ?? null) : null;

  let currentY = y;

  // Company header
  const rightWidth = entryStyle.date.width;
  const leftWidth = width - rightWidth - 10;

  doc.font(fonts.bold).fontSize(entryStyle.position.fontSize).fillColor('#000000');
  const companyHeight = doc.heightOfString(company, { width: leftWidth });
  renderTextWithEmoji(doc, company, entryStyle.position.fontSize, fonts.bold, emojiAvailable, {
    x,
    y: currentY,
    width: leftWidth,
  });

  if (sharedLocation) {
    doc.font(fonts.bold).fontSize(entryStyle.location.fontSize);
    doc.text(sharedLocation, x + width - rightWidth, currentY, { width: rightWidth, align: 'right' });
  }

  currentY += companyHeight + (entryStyle.position.marginBottom ?? 0) + style.blockMarginBottom;

  // Render each position
  for (const entry of entries) {
    const height = renderPositionEntry(ctx, entry, x, currentY, width, !sameLocation);
    currentY += height;
  }

  return currentY - y;
}

/**
 * Render a position within a grouped work entry. Returns height rendered.
 */
function renderPositionEntry(ctx: RenderContext, entry: EntryData, x: number, y: number, width: number, showLocation: boolean): number {
  const { doc, typography, fieldTemplates, emojiAvailable, fonts } = ctx;
  const style = getResolvedStyle(typography);
  const { entry: entryStyle, bullet } = typography;

  const rightWidth = entryStyle.date.width;
  const leftWidth = width - rightWidth - 10;

  const entryData = entry as Record<string, unknown>;
  const position = ensureString(entryData.position ?? (entryData.roles as string[])?.[0]);
  const location = showLocation ? ensureString(entryData.location) : '';

  const dateText = renderField(fieldTemplates.dateRange, {
    start: entry.startDate,
    end: entry.endDate,
  });

  const summaryText = entryData.summary ?? entryData.description;
  const summaryParagraphs = paragraphsFromContent(summaryText as string | string[] | undefined);
  const highlights = Array.isArray(entryData.highlights) ? (entryData.highlights as string[]).map(ensureString).filter(Boolean) : [];

  let currentY = y;

  // Line 1: Position + Dates
  doc.font(fonts.italic).fontSize(entryStyle.position.fontSize).fillColor('#000000');
  const positionHeight = doc.heightOfString(position, { width: leftWidth });
  renderTextWithEmoji(doc, position, entryStyle.position.fontSize, fonts.italic, emojiAvailable, {
    x,
    y: currentY,
    width: leftWidth,
  });

  if (dateText) {
    doc
      .font(fonts.italic)
      .fontSize(entryStyle.company.fontSize)
      .fillColor(entryStyle.company.color ?? '#444444');
    doc.text(dateText, x + width - rightWidth, currentY, { width: rightWidth, align: 'right' });
    doc.fillColor('#000000');
  }

  currentY += positionHeight;

  // Line 2: Location (if shown)
  if (location) {
    doc
      .font(fonts.regular)
      .fontSize(entryStyle.location.fontSize)
      .fillColor(entryStyle.location.color ?? '#444444');
    const locHeight = doc.heightOfString(location, { width });
    doc.text(location, x, currentY, { width });
    currentY += locHeight;
    doc.fillColor('#000000');
  }

  const hasContent = summaryParagraphs.length > 0 || highlights.length > 0;
  currentY += hasContent ? style.blockMarginBottom + 4 : 2;

  // Summary paragraphs
  if (summaryParagraphs.length > 0) {
    doc.font(fonts.regular).fillColor('#000000');
    for (const para of summaryParagraphs) {
      renderTextWithEmoji(doc, para, style.fontSize, fonts.regular, emojiAvailable, {
        x,
        y: currentY,
        width,
        lineGap: style.lineGap,
        align: 'justify',
      });
      doc.font(fonts.regular).fontSize(style.fontSize);
      const paraHeight = doc.heightOfString(para, { width, lineGap: style.lineGap });
      currentY += paraHeight + style.paragraphMarginBottom;
    }
  }

  // Bullet highlights
  if (highlights.length > 0) {
    if (summaryParagraphs.length > 0) {
      currentY += style.blockMarginBottom;
    }
    const bulletWidth = width - bullet.indent;
    doc.font(fonts.regular).fillColor('#000000');

    for (const highlight of highlights) {
      const bulletText = `• ${highlight}`;
      renderTextWithEmoji(doc, bulletText, style.fontSize, fonts.regular, emojiAvailable, {
        x: x + bullet.indent,
        y: currentY,
        width: bulletWidth,
        lineGap: style.lineGap,
      });
      doc.font(fonts.regular).fontSize(style.fontSize);
      const bulletHeight = doc.heightOfString(bulletText, { width: bulletWidth, lineGap: style.lineGap });
      currentY += bulletHeight + (bullet.marginBottom ?? 2);
    }
  }

  currentY += style.blockMarginBottom;

  return currentY - y;
}

/**
 * Render an education entry. Returns height rendered.
 */
function renderEducationEntry(ctx: RenderContext, entry: EntryData, x: number, y: number, width: number): number {
  const { doc, typography, fieldTemplates, emojiAvailable, fonts } = ctx;
  const style = getResolvedStyle(typography);
  const { entry: entryStyle } = typography;

  const rightWidth = entryStyle.date.width;
  const leftWidth = width - rightWidth - 10;

  const institution = ensureString(entry.institution);

  const dates = renderField(fieldTemplates.dateRange, {
    start: entry.startDate,
    end: entry.endDate,
  });

  const degreeParts = renderField(fieldTemplates.degree, {
    studyType: entry.studyType,
    area: entry.area,
  });

  let currentY = y;

  // Line 1: Institution + Dates
  doc.font(fonts.bold).fontSize(style.fontSize).fillColor('#000000');
  const institutionHeight = doc.heightOfString(institution, { width: leftWidth });
  renderTextWithEmoji(doc, institution, style.fontSize, fonts.bold, emojiAvailable, {
    x,
    y: currentY,
    width: leftWidth,
  });

  if (dates) {
    doc
      .font(fonts.italic)
      .fontSize(style.fontSize)
      .fillColor(entryStyle.company.color ?? '#444444');
    doc.text(dates, x + width - rightWidth, currentY, { width: rightWidth, align: 'right' });
    doc.fillColor('#000000');
  }

  currentY += institutionHeight + style.itemMarginBottom;

  // Degree line (italic)
  if (degreeParts) {
    doc.font(fonts.italic).fontSize(style.fontSize).fillColor('#000000');
    const degreeHeight = doc.heightOfString(degreeParts, { width, lineGap: style.lineGap });
    renderTextWithEmoji(doc, degreeParts, style.fontSize, fonts.italic, emojiAvailable, {
      x,
      y: currentY,
      width,
      lineGap: style.lineGap,
    });
    currentY += degreeHeight + style.itemMarginBottom;
  }

  // GPA line
  if (entry.score) {
    doc
      .font(fonts.regular)
      .fontSize(style.fontSize)
      .fillColor(entryStyle.location.color ?? '#444444');
    const gpaText = `GPA: ${entry.score}`;
    const gpaHeight = doc.heightOfString(gpaText, { width, lineGap: style.lineGap });
    doc.text(gpaText, x, currentY, { width, lineGap: style.lineGap });
    currentY += gpaHeight + style.itemMarginBottom;
    doc.fillColor('#000000');
  }

  currentY += style.blockMarginBottom;

  return currentY - y;
}

/**
 * Render summary highlights element at computed position.
 */
export function renderSummaryHighlights(ctx: RenderContext, element: SummaryHighlightsElement, position: ComputedPosition): void {
  const { doc, typography, emojiAvailable, fonts } = ctx;
  const style = getResolvedStyle(typography);
  const { bullet } = typography;

  let currentY = position.y;

  // Summary paragraph
  if (element.summary) {
    doc.font(fonts.regular).fontSize(style.fontSize).fillColor('#000000');
    renderTextWithEmoji(doc, element.summary, style.fontSize, fonts.regular, emojiAvailable, {
      x: position.x,
      y: currentY,
      width: position.width,
      lineGap: style.lineGap,
    });
    const summaryHeight = doc.heightOfString(element.summary, { width: position.width, lineGap: style.lineGap });
    currentY += summaryHeight + style.paragraphMarginBottom;
  }

  // Bullet highlights
  if (element.highlights.length > 0) {
    const bulletWidth = position.width - bullet.indent;
    doc.font(fonts.regular).fillColor('#000000');

    for (const highlight of element.highlights) {
      const bulletText = `• ${highlight}`;
      renderTextWithEmoji(doc, bulletText, style.fontSize, fonts.regular, emojiAvailable, {
        x: position.x + bullet.indent,
        y: currentY,
        width: bulletWidth,
        lineGap: style.lineGap,
      });
      const bulletHeight = doc.heightOfString(bulletText, { width: bulletWidth, lineGap: style.lineGap });
      currentY += bulletHeight + (bullet.marginBottom ?? 2);
    }
  }
}

/**
 * Render a group element at computed position.
 */
export function renderGroup(ctx: RenderContext, _element: GroupElement, _position: ComputedPosition, children?: PageNode[]): void {
  // Groups just render their children - the children have their own computed positions
  if (children) {
    for (const child of children) {
      renderPageNode(ctx, child);
    }
  }
}

// =============================================================================
// Main Dispatch Functions
// =============================================================================

/**
 * Render a PageNode (element with computed position).
 */
export function renderPageNode(ctx: RenderContext, node: PageNode): void {
  const { element, position, children } = node;

  switch (element.type) {
    case 'text':
      renderText(ctx, element, position);
      break;
    case 'section-title':
      renderSectionTitle(ctx, element, position);
      break;
    case 'header':
      renderHeader(ctx, element, position);
      break;
    case 'divider':
      renderDivider(ctx, element, position);
      break;
    case 'entry-list':
      renderEntryList(ctx, element, position);
      break;
    case 'keyword-list':
      renderKeywordList(ctx, element, position);
      break;
    case 'language-list':
      renderLanguageList(ctx, element, position);
      break;
    case 'credential-list':
      renderCredentialList(ctx, element, position);
      break;
    case 'reference-list':
      renderReferenceList(ctx, element, position);
      break;
    case 'summary-highlights':
      renderSummaryHighlights(ctx, element, position);
      break;
    case 'group':
      renderGroup(ctx, element, position, children);
      break;
    case 'template':
      // Template elements should be pre-processed
      break;
  }
}

/**
 * Render a full page of nodes.
 */
export function renderPage(ctx: RenderContext, page: Page): void {
  for (const node of page.nodes) {
    renderPageNode(ctx, node);
  }
}

/**
 * Create a render context.
 */
export function createRenderContext(doc: PDFKit.PDFDocument, typography: TypographyOptions, fieldTemplates: Required<FieldTemplates>, emojiAvailable: boolean): RenderContext {
  return {
    doc,
    typography,
    fieldTemplates,
    emojiAvailable,
    fonts: typography.fonts,
  };
}
