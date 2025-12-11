/**
 * Height measurement functions for Yoga-based resume layout.
 *
 * These functions measure the height of each IR element type
 * for Yoga layout calculation. All measurements are in points.
 */

import type PDFKit from 'pdfkit';
import { measureTextHeight } from '../content-measure.ts';
import { renderField } from '../formatting.ts';
import type { CompanyHeaderElement, CredentialData, CredentialListElement, DividerElement, EntryContentLineElement, EntryData, EntryHeaderElement, EntryListElement, FieldTemplates, GroupElement, HeaderElement, KeywordListElement, LanguageListElement, LayoutElement, ReferenceListElement, SectionTitleElement, TextElement } from '../ir/types.ts';
import type { TypographyOptions } from '../types/typography.ts';
import { calculateEntryColumnWidths, type MeasureContext } from './types.ts';

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
// Element Measurers
// =============================================================================

/**
 * Measure text element height.
 */
export function measureText(ctx: MeasureContext, element: TextElement): number {
  const { doc, typography, emojiAvailable, width } = ctx;
  const style = getResolvedStyle(typography);
  const paragraphs = paragraphsFromContent(element.content);

  if (paragraphs.length === 0) return 0;

  let totalHeight = 0;
  for (let i = 0; i < paragraphs.length; i++) {
    const height = measureTextHeight(doc, paragraphs[i], style.fontSize, typography.fonts.regular, emojiAvailable, {
      width,
      lineGap: style.lineGap,
    });
    totalHeight += height;
    if (i < paragraphs.length - 1) {
      totalHeight += style.paragraphMarginBottom;
    }
  }

  return totalHeight;
}

/**
 * Measure section title element height.
 */
export function measureSectionTitle(ctx: MeasureContext, element: SectionTitleElement): number {
  const { doc, typography, width } = ctx;
  const { sectionTitle } = typography;

  if (!element.title) return 0;

  doc.font(typography.fonts.bold).fontSize(sectionTitle.fontSize);
  const titleHeight = doc.heightOfString(element.title.toUpperCase(), { width });

  const underlineHeight = (sectionTitle.underlineGap ?? 0) + 1;
  const marginTop = sectionTitle.marginTop ?? 0;
  const marginBottom = sectionTitle.marginBottom ?? 0;

  return marginTop + titleHeight + underlineHeight + marginBottom;
}

/**
 * Measure header element height.
 */
export function measureHeader(ctx: MeasureContext, element: HeaderElement): number {
  const { doc, typography, fieldTemplates, width } = ctx;
  const { header } = typography;

  // Name height
  doc.font(typography.fonts.bold).fontSize(header.name.fontSize);
  const nameHeight = doc.heightOfString(element.name.toUpperCase(), { width, align: 'center' });

  // Contact line height
  let contactHeight = 0;
  if (element.contactItems.length > 0) {
    const contactTexts = element.contactItems
      .map((item) => {
        if (item.location) {
          return renderField(fieldTemplates.location, item.location);
        }
        return item.text;
      })
      .filter((text) => text.length > 0);

    const contactText = renderField(fieldTemplates.contactLine, { items: contactTexts });

    doc.font(typography.fonts.regular).fontSize(header.contact.fontSize);
    contactHeight = doc.heightOfString(contactText, { width, align: 'center' });
  }

  const nameMarginBottom = header.name.marginBottom ?? 0;
  const headerMarginBottom = header.marginBottom ?? 0;

  return nameHeight + nameMarginBottom + contactHeight + headerMarginBottom;
}

/**
 * Measure divider element height.
 */
export function measureDivider(_ctx: MeasureContext, element: DividerElement): number {
  const marginTop = element.margin?.top ?? 8;
  const marginBottom = element.margin?.bottom ?? 8;
  const thickness = element.thickness ?? 0.5;

  return marginTop + thickness + marginBottom;
}

/**
 * Measure a single work entry height.
 */
function measureWorkEntry(ctx: MeasureContext, entry: EntryData, isGrouped: boolean, showLocation: boolean): number {
  const { doc, typography, fieldTemplates, width } = ctx;
  const style = getResolvedStyle(typography);
  const { entry: entryStyle, bullet } = typography;

  const { leftWidth, rightWidth } = calculateEntryColumnWidths(width, entryStyle.date.width);

  const entryData = entry as Record<string, unknown>;
  const company = ensureString(entryData.name ?? entryData.organization ?? entryData.entity);
  const position = ensureString(entryData.position ?? (entryData.roles as string[])?.[0]);
  const location = showLocation ? ensureString(entryData.location) : '';

  const dateText = renderField(fieldTemplates.dateRange, {
    start: entry.startDate,
    end: entry.endDate,
  });

  const summaryText = entryData.summary ?? entryData.description;
  const summaryParagraphs = paragraphsFromContent(summaryText as string | string[] | undefined);
  const highlights = Array.isArray(entryData.highlights) ? (entryData.highlights as string[]).map(ensureString).filter(Boolean) : [];

  let totalHeight = 0;

  if (!isGrouped) {
    // Line 1: Company + Location
    doc.font(typography.fonts.bold).fontSize(entryStyle.position.fontSize);
    const companyHeight = company ? doc.heightOfString(company, { width: leftWidth }) : 0;
    const locationHeight = location ? doc.heightOfString(location, { width: rightWidth }) : 0;
    const line1Height = Math.max(companyHeight, locationHeight);
    totalHeight += line1Height + (entryStyle.position.marginBottom ?? 0);
  }

  // Position + Dates line
  doc.font(typography.fonts.italic).fontSize(entryStyle.position.fontSize);
  const positionHeight = doc.heightOfString(position, { width: leftWidth });
  doc.font(typography.fonts.italic).fontSize(entryStyle.company.fontSize);
  const dateHeight = dateText ? doc.heightOfString(dateText, { width: rightWidth }) : 0;
  const line2Height = Math.max(positionHeight, dateHeight);
  totalHeight += line2Height;

  // Location line (for grouped entries only)
  if (isGrouped && location) {
    doc.font(typography.fonts.regular).fontSize(entryStyle.location.fontSize);
    const locHeight = doc.heightOfString(location, { width });
    totalHeight += locHeight;
  }

  // Spacing before content
  const hasContent = summaryParagraphs.length > 0 || highlights.length > 0;
  totalHeight += hasContent ? style.blockMarginBottom + 4 : 2;

  // Summary paragraphs
  if (summaryParagraphs.length > 0) {
    doc.font(typography.fonts.regular).fontSize(style.fontSize);
    for (const para of summaryParagraphs) {
      totalHeight += doc.heightOfString(para, { width, lineGap: style.lineGap });
      totalHeight += style.paragraphMarginBottom;
    }
  }

  // Bullet highlights
  if (highlights.length > 0) {
    if (summaryParagraphs.length > 0) {
      totalHeight += style.blockMarginBottom;
    }
    const bulletWidth = width - bullet.indent;
    doc.font(typography.fonts.regular).fontSize(style.fontSize);
    for (const highlight of highlights) {
      totalHeight += doc.heightOfString(`• ${highlight}`, { width: bulletWidth, lineGap: style.lineGap });
      totalHeight += bullet.marginBottom ?? 2;
    }
  }

  totalHeight += style.blockMarginBottom;

  return totalHeight;
}

/**
 * Measure company header height (for grouped entries).
 */
function measureCompanyHeader(ctx: MeasureContext, company: string, location: string | null): number {
  const { doc, typography, width } = ctx;
  const { entry: entryStyle } = typography;
  const style = getResolvedStyle(typography);

  const { leftWidth, rightWidth } = calculateEntryColumnWidths(width, entryStyle.date.width);

  doc.font(typography.fonts.bold).fontSize(entryStyle.position.fontSize);
  const companyHeight = doc.heightOfString(company, { width: leftWidth });
  const locationHeight = location ? doc.heightOfString(location, { width: rightWidth }) : 0;
  const line1Height = Math.max(companyHeight, locationHeight);

  return line1Height + (entryStyle.position.marginBottom ?? 0) + style.blockMarginBottom;
}

// =============================================================================
// Fine-Grained Entry Element Measurers (for better pagination)
// =============================================================================

/**
 * Measure entry header element height (company/position/dates only, no content).
 */
export function measureEntryHeader(ctx: MeasureContext, element: EntryHeaderElement): number {
  const { doc, typography, fieldTemplates, width } = ctx;
  const style = getResolvedStyle(typography);
  const { entry: entryStyle } = typography;

  const { leftWidth, rightWidth } = calculateEntryColumnWidths(width, entryStyle.date.width);

  const entry = element.entry;
  const entryData = entry as Record<string, unknown>;
  const company = ensureString(entryData.name ?? entryData.organization ?? entryData.institution ?? entryData.entity);
  const position = ensureString(entryData.position ?? entryData.studyType ?? (entryData.roles as string[])?.[0]);
  const location = element.showLocation !== false ? ensureString(entryData.location) : '';

  const dateText = renderField(fieldTemplates.dateRange, {
    start: entry.startDate,
    end: entry.endDate,
  });

  let totalHeight = 0;

  if (element.variant === 'education') {
    // Education: Institution + Dates on first line, degree on second
    doc.font(typography.fonts.bold).fontSize(style.fontSize);
    const institutionHeight = doc.heightOfString(company, { width: leftWidth });
    doc.font(typography.fonts.italic).fontSize(style.fontSize);
    const dateHeight = dateText ? doc.heightOfString(dateText, { width: rightWidth }) : 0;
    totalHeight += Math.max(institutionHeight, dateHeight) + style.itemMarginBottom;

    // Degree line
    const degreeParts = renderField(fieldTemplates.degree, {
      studyType: entry.studyType,
      area: entry.area,
    });
    if (degreeParts) {
      doc.font(typography.fonts.italic).fontSize(style.fontSize);
      totalHeight += doc.heightOfString(degreeParts, { width, lineGap: style.lineGap }) + style.itemMarginBottom;
    }

    // GPA line
    if (entry.score) {
      doc.font(typography.fonts.regular).fontSize(style.fontSize);
      totalHeight += doc.heightOfString(`GPA: ${entry.score}`, { width, lineGap: style.lineGap }) + style.itemMarginBottom;
    }
  } else if (element.isGroupedPosition) {
    // Grouped work entry: Position + Dates (company is in separate CompanyHeaderElement)
    doc.font(typography.fonts.italic).fontSize(entryStyle.position.fontSize);
    const positionHeight = doc.heightOfString(position, { width: leftWidth });
    doc.font(typography.fonts.italic).fontSize(entryStyle.company.fontSize);
    const dateHeight = dateText ? doc.heightOfString(dateText, { width: rightWidth }) : 0;
    totalHeight += Math.max(positionHeight, dateHeight);

    // Location line (if shown for grouped entries with different locations)
    if (location) {
      doc.font(typography.fonts.regular).fontSize(entryStyle.location.fontSize);
      totalHeight += doc.heightOfString(location, { width });
    }
  } else {
    // Single work entry: Company + Location on first line, Position + Dates on second
    doc.font(typography.fonts.bold).fontSize(entryStyle.position.fontSize);
    const companyHeight = company ? doc.heightOfString(company, { width: leftWidth }) : 0;
    const locationHeight = location ? doc.heightOfString(location, { width: rightWidth }) : 0;
    totalHeight += Math.max(companyHeight, locationHeight) + (entryStyle.position.marginBottom ?? 0);

    // Position + Dates line
    doc.font(typography.fonts.italic).fontSize(entryStyle.position.fontSize);
    const positionHeight = doc.heightOfString(position, { width: leftWidth });
    doc.font(typography.fonts.italic).fontSize(entryStyle.company.fontSize);
    const dateHeight = dateText ? doc.heightOfString(dateText, { width: rightWidth }) : 0;
    totalHeight += Math.max(positionHeight, dateHeight);
  }

  // Add small spacing after header before content
  totalHeight += style.blockMarginBottom + 4;

  return totalHeight;
}

/**
 * Measure entry content line element height (single summary paragraph or bullet).
 */
export function measureEntryContentLine(ctx: MeasureContext, element: EntryContentLineElement): number {
  const { doc, typography, width } = ctx;
  const style = getResolvedStyle(typography);
  const { bullet } = typography;

  let totalHeight = element.marginTop;

  if (element.contentType === 'summary') {
    doc.font(typography.fonts.regular).fontSize(style.fontSize);
    totalHeight += doc.heightOfString(element.text, { width, lineGap: style.lineGap });
  } else {
    // Bullet
    const bulletWidth = width - bullet.indent;
    doc.font(typography.fonts.regular).fontSize(style.fontSize);
    totalHeight += doc.heightOfString(`• ${element.text}`, { width: bulletWidth, lineGap: style.lineGap });
  }

  // Add trailing margin for last item
  if (element.position === 'last' || element.position === 'only') {
    totalHeight += style.blockMarginBottom;
  }

  return totalHeight;
}

/**
 * Measure company header element height (for grouped entries).
 */
export function measureCompanyHeaderElement(ctx: MeasureContext, element: CompanyHeaderElement): number {
  const { doc, typography, width } = ctx;
  const { entry: entryStyle } = typography;
  const style = getResolvedStyle(typography);

  const { leftWidth, rightWidth } = calculateEntryColumnWidths(width, entryStyle.date.width);

  doc.font(typography.fonts.bold).fontSize(entryStyle.position.fontSize);
  const companyHeight = doc.heightOfString(element.company, { width: leftWidth });
  const locationHeight = element.location ? doc.heightOfString(element.location, { width: rightWidth }) : 0;
  const line1Height = Math.max(companyHeight, locationHeight);

  return line1Height + (entryStyle.position.marginBottom ?? 0) + style.blockMarginBottom;
}

/**
 * Measure education entry height.
 */
function measureEducationEntry(ctx: MeasureContext, entry: EntryData): number {
  const { doc, typography, fieldTemplates, width } = ctx;
  const style = getResolvedStyle(typography);
  const { entry: entryStyle } = typography;

  const { leftWidth, rightWidth } = calculateEntryColumnWidths(width, entryStyle.date.width);

  const institution = ensureString(entry.institution);

  const dates = renderField(fieldTemplates.dateRange, {
    start: entry.startDate,
    end: entry.endDate,
  });

  const degreeParts = renderField(fieldTemplates.degree, {
    studyType: entry.studyType,
    area: entry.area,
  });

  doc.font(typography.fonts.bold).fontSize(style.fontSize);
  const institutionHeight = doc.heightOfString(institution, { width: leftWidth });
  doc.font(typography.fonts.italic).fontSize(style.fontSize);
  const dateHeight = dates ? doc.heightOfString(dates, { width: rightWidth }) : 0;
  const line1Height = Math.max(institutionHeight, dateHeight);

  doc.font(typography.fonts.italic).fontSize(style.fontSize);
  const degreeHeight = degreeParts ? doc.heightOfString(degreeParts, { width, lineGap: style.lineGap }) : 0;
  const gpaHeight = entry.score ? doc.heightOfString(`GPA: ${entry.score}`, { width, lineGap: style.lineGap }) : 0;

  return line1Height + degreeHeight + gpaHeight + style.itemMarginBottom * 3 + style.blockMarginBottom;
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
 * Measure entry list element height.
 */
export function measureEntryList(ctx: MeasureContext, element: EntryListElement): number {
  const { entries, variant } = element;
  if (entries.length === 0) return 0;

  let totalHeight = 0;

  if (variant === 'education') {
    for (const entry of entries) {
      totalHeight += measureEducationEntry(ctx, entry);
    }
  } else {
    const groups = groupByCompany(entries);

    for (const group of groups) {
      if (group.length === 1) {
        totalHeight += measureWorkEntry(ctx, group[0], false, true);
      } else {
        // Grouped entries
        const firstJob = group[0] as Record<string, unknown>;
        const company = ensureString(firstJob.name ?? firstJob.organization ?? firstJob.entity);

        const locations = group.map((j) => ensureString((j as Record<string, unknown>).location)).filter(Boolean);
        const uniqueLocations = [...new Set(locations)];
        const sameLocation = uniqueLocations.length <= 1;
        const sharedLocation = sameLocation && uniqueLocations.length === 1 ? (uniqueLocations[0] ?? null) : null;

        totalHeight += measureCompanyHeader(ctx, company, sharedLocation);

        for (const entry of group) {
          totalHeight += measureWorkEntry(ctx, entry, true, !sameLocation);
        }
      }
    }
  }

  return totalHeight;
}

/**
 * Measure keyword list element height.
 */
export function measureKeywordList(ctx: MeasureContext, element: KeywordListElement): number {
  const { doc, typography, fieldTemplates, width } = ctx;
  const style = getResolvedStyle(typography);

  if (element.items.length === 0) return 0;

  let totalHeight = 0;

  for (const skill of element.items) {
    const name = ensureString(skill.name);
    const level = ensureString((skill as Record<string, unknown>).level);
    const keywords = skill.keywords || [];

    const fullText = renderField(fieldTemplates.skill, { name, level, keywords });

    doc.font(typography.fonts.regular).fontSize(style.fontSize);
    const textHeight = doc.heightOfString(fullText, { width, lineGap: style.lineGap });
    totalHeight += textHeight + style.itemMarginBottom;
  }

  return totalHeight;
}

/**
 * Measure language list element height.
 */
export function measureLanguageList(ctx: MeasureContext, element: LanguageListElement): number {
  const { doc, typography, fieldTemplates, width } = ctx;
  const style = getResolvedStyle(typography);

  if (element.items.length === 0) return 0;

  // Languages are rendered as a comma-separated list
  const languageTexts = element.items.map((item) => renderField(fieldTemplates.language, item)).filter(Boolean);
  const fullText = languageTexts.join(', ');

  doc.font(typography.fonts.regular).fontSize(style.fontSize);
  return doc.heightOfString(fullText, { width, lineGap: style.lineGap });
}

/**
 * Measure credential list element height.
 */
export function measureCredentialList(ctx: MeasureContext, element: CredentialListElement): number {
  const { doc, typography, fieldTemplates, width } = ctx;
  const style = getResolvedStyle(typography);

  if (element.items.length === 0) return 0;

  let totalHeight = 0;

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

    doc.font(typography.fonts.bold).fontSize(style.fontSize);
    const titleHeight = doc.heightOfString(title, { width });

    doc.font(typography.fonts.italic).fontSize(style.fontSize);
    const metaHeight = metaLine ? doc.heightOfString(metaLine, { width }) : 0;

    const summaryParagraphs = paragraphsFromContent(ensureString(item.summary));
    let summaryHeight = 0;
    if (summaryParagraphs.length > 0) {
      doc.font(typography.fonts.regular).fontSize(style.fontSize);
      for (const para of summaryParagraphs) {
        summaryHeight += doc.heightOfString(para, { width, lineGap: style.lineGap });
      }
      summaryHeight += style.paragraphMarginBottom;
    }

    totalHeight += titleHeight + metaHeight + summaryHeight + style.blockMarginBottom;
  }

  return totalHeight;
}

/**
 * Measure reference list element height.
 */
export function measureReferenceList(ctx: MeasureContext, element: ReferenceListElement): number {
  const { doc, typography, width } = ctx;
  const style = getResolvedStyle(typography);
  const { quote } = typography;

  if (element.items.length === 0) return 0;

  let totalHeight = 0;

  for (const ref of element.items) {
    const name = ensureString(ref.name);
    const reference = ensureString(ref.reference);

    if (!name && !reference) continue;

    // Name line
    if (name) {
      doc.font(typography.fonts.bold).fontSize(style.fontSize);
      totalHeight += doc.heightOfString(name, { width });
      totalHeight += style.itemMarginBottom;
    }

    // Quote text (indented)
    if (reference) {
      const quoteWidth = width - quote.indent;
      doc.font(typography.fonts.italic).fontSize(style.fontSize);
      totalHeight += doc.heightOfString(`"${reference}"`, { width: quoteWidth, lineGap: style.lineGap });
    }

    totalHeight += style.blockMarginBottom;
  }

  return totalHeight;
}

/**
 * Measure group element height (sum of children).
 */
export function measureGroup(ctx: MeasureContext, element: GroupElement): number {
  let totalHeight = 0;

  for (const child of element.children) {
    totalHeight += measureElement(ctx, child);
  }

  return totalHeight;
}

// =============================================================================
// Main Dispatch Function
// =============================================================================

/**
 * Measure any layout element height.
 * This is the main entry point for height measurement.
 */
export function measureElement(ctx: MeasureContext, element: LayoutElement): number {
  switch (element.type) {
    case 'text':
      return measureText(ctx, element);
    case 'section-title':
      return measureSectionTitle(ctx, element);
    case 'header':
      return measureHeader(ctx, element);
    case 'divider':
      return measureDivider(ctx, element);
    case 'entry-list':
      return measureEntryList(ctx, element);
    case 'keyword-list':
      return measureKeywordList(ctx, element);
    case 'language-list':
      return measureLanguageList(ctx, element);
    case 'credential-list':
      return measureCredentialList(ctx, element);
    case 'reference-list':
      return measureReferenceList(ctx, element);
    case 'group':
      return measureGroup(ctx, element);
    case 'entry-header':
      return measureEntryHeader(ctx, element);
    case 'entry-content-line':
      return measureEntryContentLine(ctx, element);
    case 'company-header':
      return measureCompanyHeaderElement(ctx, element);
    case 'template':
      // Template elements require custom measurement based on rendered content
      // For now, return 0 - templates should be transformed before layout
      return 0;
    case 'summary-highlights':
      // Summary highlights are rare, measure as text + bullets
      return measureSummaryHighlights(ctx, element);
    default:
      return 0;
  }
}

/**
 * Measure summary highlights element height.
 */
function measureSummaryHighlights(ctx: MeasureContext, element: { summary?: string; highlights: string[] }): number {
  const { doc, typography, width } = ctx;
  const style = getResolvedStyle(typography);
  const { bullet } = typography;

  let totalHeight = 0;

  // Summary paragraph
  if (element.summary) {
    doc.font(typography.fonts.regular).fontSize(style.fontSize);
    totalHeight += doc.heightOfString(element.summary, { width, lineGap: style.lineGap });
    totalHeight += style.paragraphMarginBottom;
  }

  // Bullet highlights
  if (element.highlights.length > 0) {
    const bulletWidth = width - bullet.indent;
    doc.font(typography.fonts.regular).fontSize(style.fontSize);
    for (const highlight of element.highlights) {
      totalHeight += doc.heightOfString(`• ${highlight}`, { width: bulletWidth, lineGap: style.lineGap });
      totalHeight += bullet.marginBottom ?? 2;
    }
  }

  return totalHeight;
}

/**
 * Create a measure context from PDF document and typography.
 */
export function createMeasureContext(doc: PDFKit.PDFDocument, typography: TypographyOptions, fieldTemplates: Required<FieldTemplates>, emojiAvailable: boolean, width: number): MeasureContext {
  return {
    doc,
    typography,
    fieldTemplates,
    emojiAvailable,
    width,
  };
}
