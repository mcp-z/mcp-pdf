/**
 * Element measurement functions for calculating heights without rendering.
 * Used by the group handler to measure children before ensuring space.
 */

import type PDFKit from 'pdfkit';
import { renderField } from '../formatting.ts';
import type { EntryData, EntryListElement, FieldTemplates, LayoutElement, SectionTitleElement } from '../ir/types.ts';
import type { LayoutEngine } from '../layout-engine.ts';
import { ensureString, paragraphsFromContent, resolveStyles } from './renderer-helpers.ts';
import type { TypographyOptions } from './types.ts';

/**
 * Measure the height of a section title element
 */
export function measureSectionTitle(doc: PDFKit.PDFDocument, layout: LayoutEngine, element: SectionTitleElement, typography: TypographyOptions): number {
  const title = element.title;
  if (!title) return 0;

  const { sectionTitle } = typography;
  const pageWidth = layout.getPageWidth();

  doc.font(typography.fonts.bold).fontSize(sectionTitle.fontSize);
  const titleHeight = doc.heightOfString(title.toUpperCase(), { width: pageWidth });

  // Total: marginTop + titleHeight + underlineGap + marginBottom
  const total = (sectionTitle.marginTop ?? 0) + titleHeight + (sectionTitle.underlineGap ?? 0) + (sectionTitle.marginBottom ?? 0);

  return total;
}

/**
 * Measure the height of the first entry in an entry-list (for atomic grouping).
 * This measures just enough to keep section title + first entry header together.
 */
export function measureFirstEntry(doc: PDFKit.PDFDocument, layout: LayoutEngine, element: EntryListElement, typography: TypographyOptions, fieldTemplates: Required<FieldTemplates>): number {
  const { entries, variant } = element;
  if (!entries.length) return 0;

  const firstEntry = entries[0] as EntryData;
  const style = resolveStyles(typography);
  const { entry: entryStyle, bullet } = typography;

  if (variant === 'education') {
    return measureEducationEntry(doc, layout, firstEntry, typography, fieldTemplates);
  }

  // For work entries, measure header + first content item
  const rightWidth = entryStyle.date.width;
  const leftWidth = layout.getPageWidth() - rightWidth - 10;

  const entryData = firstEntry as Record<string, unknown>;
  const company = ensureString(entryData.name ?? entryData.organization ?? entryData.entity);
  const position = ensureString(entryData.position ?? (entryData.roles as string[])?.[0]);
  const location = ensureString(entryData.location);

  // Line 1: Company + Location
  doc.font(typography.fonts.bold).fontSize(entryStyle.position.fontSize);
  const companyHeight = company ? doc.heightOfString(company, { width: leftWidth }) : 0;
  const locationHeight = location ? doc.heightOfString(location, { width: rightWidth }) : 0;
  const line1Height = Math.max(companyHeight, locationHeight);

  // Line 2: Position + Dates (using dateRange field template)
  doc.font(typography.fonts.italic).fontSize(entryStyle.position.fontSize);
  const positionHeight = doc.heightOfString(position || 'Position', { width: leftWidth });

  const dateText = renderField(fieldTemplates.dateRange, {
    start: firstEntry.startDate,
    end: firstEntry.endDate,
  });

  doc.font(typography.fonts.italic).fontSize(entryStyle.company.fontSize);
  const dateHeight = dateText ? doc.heightOfString(dateText, { width: rightWidth }) : 0;
  const line2Height = Math.max(positionHeight, dateHeight);

  const headerHeight = line1Height + line2Height + 4;

  // First content item (paragraph or bullet)
  const summaryText = entryData.summary ?? entryData.description;
  const summaryParagraphs = paragraphsFromContent(summaryText as string | string[] | undefined);
  const highlights = Array.isArray(entryData.highlights) ? (entryData.highlights as string[]).map(ensureString).filter(Boolean) : [];

  doc.font(typography.fonts.regular).fontSize(style.fontSize);
  const firstParagraph = summaryParagraphs[0];
  const firstParagraphHeight = firstParagraph
    ? doc.heightOfString(firstParagraph, {
        width: layout.getPageWidth(),
        lineGap: style.lineGap,
      })
    : 0;

  const bulletWidth = layout.getPageWidth() - bullet.indent;
  const firstHighlight = highlights[0];
  const firstBulletHeight = firstHighlight
    ? doc.heightOfString(`• ${firstHighlight}`, {
        width: bulletWidth,
        lineGap: style.lineGap,
      })
    : 0;

  const firstContentHeight = firstParagraphHeight || firstBulletHeight;
  const entryTitleMarginBottom = entryStyle.position.marginBottom ?? 0;

  return headerHeight + entryTitleMarginBottom + style.blockMarginBottom + firstContentHeight;
}

/**
 * Measure education entry height
 */
function measureEducationEntry(doc: PDFKit.PDFDocument, layout: LayoutEngine, entry: EntryData, typography: TypographyOptions, fieldTemplates: Required<FieldTemplates>): number {
  const style = resolveStyles(typography);
  const { entry: entryStyle } = typography;

  const rightWidth = entryStyle.date.width;
  const leftWidth = layout.getPageWidth() - rightWidth - 10;
  const lineGap = style.lineGap;
  const itemMargin = style.itemMarginBottom;

  const institution = ensureString(entry.institution);

  // Use dateRange and degree field templates
  const dates = renderField(fieldTemplates.dateRange, {
    start: entry.startDate,
    end: entry.endDate,
  });
  const degreeParts = renderField(fieldTemplates.degree, {
    studyType: entry.studyType,
    area: entry.area,
  });

  doc.font(typography.fonts.bold).fontSize(style.fontSize);
  const institutionHeight = doc.heightOfString(institution || 'Institution', { width: leftWidth });
  doc.font(typography.fonts.italic).fontSize(style.fontSize);
  const dateHeight = dates ? doc.heightOfString(dates, { width: rightWidth }) : 0;
  const line1Height = Math.max(institutionHeight, dateHeight);

  doc.font(typography.fonts.italic).fontSize(style.fontSize);
  const degreeHeight = degreeParts ? doc.heightOfString(degreeParts, { width: layout.getPageWidth(), lineGap }) : 0;
  const gpaHeight = entry.score ? doc.heightOfString(`GPA: ${entry.score}`, { width: layout.getPageWidth(), lineGap }) : 0;

  return line1Height + degreeHeight + gpaHeight + itemMargin * 3 + style.blockMarginBottom;
}

/**
 * Measure any layout element's height.
 * Returns 0 for elements that can't be measured or are unknown.
 */
export function measureElement(doc: PDFKit.PDFDocument, layout: LayoutEngine, element: LayoutElement, typography: TypographyOptions, fieldTemplates: Required<FieldTemplates>): number {
  switch (element.type) {
    case 'section-title':
      return measureSectionTitle(doc, layout, element, typography);

    case 'entry-list':
      // For grouping purposes, we measure first entry only
      return measureFirstEntry(doc, layout, element, typography, fieldTemplates);

    case 'group':
      // Recursively measure children
      return element.children.reduce((sum, child) => sum + measureElement(doc, layout, child, typography, fieldTemplates), 0);

    // For other types, we could add specific measurements
    // For now, return 0 (they'll handle their own ensureSpace)
    default:
      return 0;
  }
}
