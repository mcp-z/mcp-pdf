/**
 * Entry list element handler (work, education, volunteer, projects) with emoji support
 */

import type PDFKit from 'pdfkit';
import { renderField } from '../formatting.ts';
import type { EntryData, EntryListElement, FieldTemplates } from '../ir/types.ts';
import type { LayoutEngine } from '../layout-engine.ts';
import { renderTextWithEmoji } from '../pdf-helpers.ts';
import { ensureString, paragraphsFromContent, renderBullets, renderParagraphs, resolveStyles } from './renderer-helpers.ts';
import type { TypographyOptions } from './types.ts';

interface ResumeWork {
  name?: string;
  location?: string;
  position?: string;
  startDate?: string;
  endDate?: string;
  summary?: string | string[];
  highlights?: string[];
}

interface ResumeEducation {
  institution?: string;
  area?: string;
  studyType?: string;
  startDate?: string;
  endDate?: string;
  gpa?: string;
}

function getCompanyName(entry: EntryData): string {
  const rec = entry as Record<string, unknown>;
  const name = ensureString(rec.name ?? rec.organization ?? rec.entity);
  return name.trim().toLowerCase();
}

function groupByCompany(entries: EntryData[]): EntryData[][] {
  const groups: EntryData[][] = [];
  let currentGroup: EntryData[] = [];
  let currentCompany = '';

  for (const entry of entries) {
    const company = getCompanyName(entry);
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

function renderPosition(doc: PDFKit.PDFDocument, layout: LayoutEngine, job: ResumeWork, typography: TypographyOptions, fieldTemplates: Required<FieldTemplates>, emojiAvailable: boolean, showLocation: boolean): void {
  const style = resolveStyles(typography);
  const { entry: entryStyle, bullet } = typography;
  const rightWidth = entryStyle.date.width;
  const leftWidth = layout.getPageWidth() - rightWidth - 10;

  const entryData = job as Record<string, unknown>;
  const position = ensureString(entryData.position ?? (entryData.roles as string[])?.[0]);
  const location = showLocation ? ensureString(entryData.location) : '';

  // Use dateRange field template
  const dateText = renderField(fieldTemplates.dateRange, {
    start: job.startDate,
    end: job.endDate,
  });

  const summaryText = entryData.summary ?? entryData.description;
  const summaryParagraphs = paragraphsFromContent(summaryText as string | string[] | undefined);
  const highlights = Array.isArray(entryData.highlights) ? (entryData.highlights as string[]).map(ensureString).filter(Boolean) : [];

  // Measure heights
  doc.font(typography.fonts.italic).fontSize(entryStyle.position.fontSize);
  const positionHeight = doc.heightOfString(position, { width: leftWidth });
  doc.font(typography.fonts.italic).fontSize(entryStyle.company.fontSize);
  const dateHeight = dateText ? doc.heightOfString(dateText, { width: rightWidth }) : 0;
  const line1Height = Math.max(positionHeight, dateHeight);

  let line2Height = 0;
  if (location) {
    doc.font(typography.fonts.regular).fontSize(entryStyle.location.fontSize);
    line2Height = doc.heightOfString(location, { width: layout.getPageWidth() });
  }

  const headerHeight = line1Height + line2Height + 4;

  doc.font(typography.fonts.regular).fontSize(style.fontSize);
  const firstParagraph = summaryParagraphs[0];
  const firstParagraphHeight = firstParagraph
    ? doc.heightOfString(firstParagraph, {
        width: layout.getPageWidth(),
        lineGap: style.lineGap,
      })
    : 0;
  doc.font(typography.fonts.regular).fontSize(style.fontSize);
  const bulletWidth = layout.getPageWidth() - bullet.indent;
  const firstHighlight = highlights[0];
  const firstBulletHeight = firstHighlight
    ? doc.heightOfString(`• ${firstHighlight}`, {
        width: bulletWidth,
        lineGap: style.lineGap,
      })
    : 0;

  const firstContentHeight = firstParagraphHeight || firstBulletHeight;
  layout.ensureSpace(doc, headerHeight + style.blockMarginBottom + firstContentHeight);

  // Line 1: Position + Dates
  doc.font(typography.fonts.italic).fontSize(entryStyle.position.fontSize).fillColor('#000000');
  renderTextWithEmoji(doc, position, entryStyle.position.fontSize, typography.fonts.italic, emojiAvailable, {
    x: layout.getMargin(),
    y: layout.getCurrentY(),
    width: leftWidth,
  });
  if (dateText) {
    doc
      .font(typography.fonts.italic)
      .fontSize(entryStyle.company.fontSize)
      .fillColor(entryStyle.company.color ?? '#444444');
    doc.text(dateText, layout.getMargin() + layout.getPageWidth() - rightWidth, layout.getCurrentY(), { width: rightWidth, align: 'right' });
    doc.fillColor('#000000');
  }
  layout.advanceY(line1Height);

  // Line 2: Location
  if (location) {
    doc
      .font(typography.fonts.regular)
      .fontSize(entryStyle.location.fontSize)
      .fillColor(entryStyle.location.color ?? '#444444');
    doc.text(location, layout.getMargin(), layout.getCurrentY(), { width: layout.getPageWidth() });
    doc.fillColor('#000000');
    layout.advanceY(line2Height);
  }

  const hasContent = summaryParagraphs.length > 0 || highlights.length > 0;
  layout.advanceY(hasContent ? style.blockMarginBottom : 2);

  if (summaryParagraphs.length) {
    doc.font(typography.fonts.regular).fillColor('#000000');
    renderParagraphs(doc, layout, summaryParagraphs, style, typography, emojiAvailable, 'justify');
  }

  if (highlights.length) {
    if (summaryParagraphs.length) {
      layout.advanceY(style.blockMarginBottom);
    }
    doc.font(typography.fonts.regular).fillColor('#000000');
    renderBullets(doc, layout, highlights, style, typography, emojiAvailable, bullet.indent);
  }

  layout.advanceY(style.blockMarginBottom);
}

function renderCompanyHeader(doc: PDFKit.PDFDocument, layout: LayoutEngine, company: string, location: string | null, typography: TypographyOptions, emojiAvailable: boolean): void {
  const style = resolveStyles(typography);
  const { entry: entryStyle } = typography;
  const rightWidth = entryStyle.date.width;
  const leftWidth = layout.getPageWidth() - rightWidth - 10;

  doc.font(typography.fonts.bold).fontSize(entryStyle.position.fontSize);
  const companyHeight = doc.heightOfString(company, { width: leftWidth });
  const locationHeight = location ? doc.heightOfString(location, { width: rightWidth }) : 0;
  const line1Height = Math.max(companyHeight, locationHeight);

  const headerHeight = line1Height + 4;
  layout.ensureSpace(doc, headerHeight + style.blockMarginBottom);

  doc.font(typography.fonts.bold).fontSize(entryStyle.position.fontSize).fillColor('#000000');
  renderTextWithEmoji(doc, company, entryStyle.position.fontSize, typography.fonts.bold, emojiAvailable, {
    x: layout.getMargin(),
    y: layout.getCurrentY(),
    width: leftWidth,
  });
  if (location) {
    doc.font(typography.fonts.bold).fontSize(entryStyle.location.fontSize);
    doc.text(location, layout.getMargin() + layout.getPageWidth() - rightWidth, layout.getCurrentY(), { width: rightWidth, align: 'right' });
  }
  const entryTitleMarginBottom = entryStyle.position.marginBottom ?? 0;
  layout.advanceY(line1Height + entryTitleMarginBottom);
}

function renderSingleWorkEntry(doc: PDFKit.PDFDocument, layout: LayoutEngine, job: ResumeWork, typography: TypographyOptions, fieldTemplates: Required<FieldTemplates>, emojiAvailable: boolean): void {
  const style = resolveStyles(typography);
  const { entry: entryStyle, bullet } = typography;
  const rightWidth = entryStyle.date.width;
  const leftWidth = layout.getPageWidth() - rightWidth - 10;

  const entryData = job as Record<string, unknown>;
  const company = ensureString(entryData.name ?? entryData.organization ?? entryData.entity);
  const position = ensureString(entryData.position ?? (entryData.roles as string[])?.[0]);
  const location = ensureString(entryData.location);

  // Use dateRange field template
  const dateText = renderField(fieldTemplates.dateRange, {
    start: job.startDate,
    end: job.endDate,
  });

  const summaryText = entryData.summary ?? entryData.description;
  const summaryParagraphs = paragraphsFromContent(summaryText as string | string[] | undefined);
  const highlights = Array.isArray(entryData.highlights) ? (entryData.highlights as string[]).map(ensureString).filter(Boolean) : [];

  // Measure heights
  doc.font(typography.fonts.bold).fontSize(entryStyle.position.fontSize);
  const companyHeight = company ? doc.heightOfString(company, { width: leftWidth }) : 0;
  const locationHeight = location ? doc.heightOfString(location, { width: rightWidth }) : 0;
  const line1Height = Math.max(companyHeight, locationHeight);

  doc.font(typography.fonts.italic).fontSize(entryStyle.position.fontSize);
  const positionHeight = doc.heightOfString(position, { width: leftWidth });
  doc.font(typography.fonts.italic).fontSize(entryStyle.company.fontSize);
  const dateHeight = dateText ? doc.heightOfString(dateText, { width: rightWidth }) : 0;
  const line2Height = Math.max(positionHeight, dateHeight);

  const headerHeight = line1Height + line2Height + 4;

  doc.font(typography.fonts.regular).fontSize(style.fontSize);
  const firstParagraph = summaryParagraphs[0];
  const firstParagraphHeight = firstParagraph
    ? doc.heightOfString(firstParagraph, {
        width: layout.getPageWidth(),
        lineGap: style.lineGap,
      })
    : 0;
  doc.font(typography.fonts.regular).fontSize(style.fontSize);
  const bulletWidth = layout.getPageWidth() - bullet.indent;
  const firstHighlight = highlights[0];
  const firstBulletHeight = firstHighlight
    ? doc.heightOfString(`• ${firstHighlight}`, {
        width: bulletWidth,
        lineGap: style.lineGap,
      })
    : 0;

  const firstContentHeight = firstParagraphHeight || firstBulletHeight;
  layout.ensureSpace(doc, headerHeight + style.blockMarginBottom + firstContentHeight);

  // Line 1: Company + Location
  if (company) {
    doc.font(typography.fonts.bold).fontSize(entryStyle.position.fontSize).fillColor('#000000');
    renderTextWithEmoji(doc, company, entryStyle.position.fontSize, typography.fonts.bold, emojiAvailable, {
      x: layout.getMargin(),
      y: layout.getCurrentY(),
      width: leftWidth,
    });
  }
  if (location) {
    doc.font(typography.fonts.bold).fontSize(entryStyle.location.fontSize);
    doc.text(location, layout.getMargin() + layout.getPageWidth() - rightWidth, layout.getCurrentY(), { width: rightWidth, align: 'right' });
  }
  const entryTitleMarginBottom = entryStyle.position.marginBottom ?? 0;
  layout.advanceY(line1Height + entryTitleMarginBottom);

  // Line 2: Position + Dates
  doc.font(typography.fonts.italic).fontSize(entryStyle.position.fontSize).fillColor('#000000');
  renderTextWithEmoji(doc, position, entryStyle.position.fontSize, typography.fonts.italic, emojiAvailable, {
    x: layout.getMargin(),
    y: layout.getCurrentY(),
    width: leftWidth,
  });
  if (dateText) {
    doc
      .font(typography.fonts.italic)
      .fontSize(entryStyle.company.fontSize)
      .fillColor(entryStyle.company.color ?? '#444444');
    doc.text(dateText, layout.getMargin() + layout.getPageWidth() - rightWidth, layout.getCurrentY(), { width: rightWidth, align: 'right' });
    doc.fillColor('#000000');
  }

  const hasContent = summaryParagraphs.length > 0 || highlights.length > 0;
  layout.advanceY(line2Height + 3 + (hasContent ? style.blockMarginBottom : 0));

  if (summaryParagraphs.length) {
    doc.font(typography.fonts.regular).fillColor('#000000');
    renderParagraphs(doc, layout, summaryParagraphs, style, typography, emojiAvailable, 'justify');
  }

  if (highlights.length) {
    if (summaryParagraphs.length) {
      layout.advanceY(style.blockMarginBottom);
    }
    doc.font(typography.fonts.regular).fillColor('#000000');
    renderBullets(doc, layout, highlights, style, typography, emojiAvailable, bullet.indent);
  }

  layout.advanceY(style.blockMarginBottom);
}

function renderGroupedWorkEntry(doc: PDFKit.PDFDocument, layout: LayoutEngine, jobs: ResumeWork[], typography: TypographyOptions, fieldTemplates: Required<FieldTemplates>, emojiAvailable: boolean): void {
  const firstJob = jobs[0] as Record<string, unknown>;
  const company = ensureString(firstJob.name ?? firstJob.organization ?? firstJob.entity);

  const locations = jobs.map((j) => ensureString((j as Record<string, unknown>).location)).filter(Boolean);
  const uniqueLocations = [...new Set(locations)];
  const sameLocation = uniqueLocations.length <= 1;
  const sharedLocation = sameLocation && uniqueLocations.length === 1 ? (uniqueLocations[0] ?? null) : null;

  renderCompanyHeader(doc, layout, company, sharedLocation, typography, emojiAvailable);

  for (const job of jobs) {
    renderPosition(doc, layout, job, typography, fieldTemplates, emojiAvailable, !sameLocation);
  }
}

function renderEducationEntry(doc: PDFKit.PDFDocument, layout: LayoutEngine, ed: ResumeEducation, typography: TypographyOptions, fieldTemplates: Required<FieldTemplates>, emojiAvailable: boolean): void {
  const style = resolveStyles(typography);
  const { entry: entryStyle } = typography;

  const rightWidth = entryStyle.date.width;
  const leftWidth = layout.getPageWidth() - rightWidth - 10;
  const lineGap = style.lineGap;
  const itemMargin = style.itemMarginBottom;

  const institution = ensureString(ed.institution);

  // Use dateRange field template
  const dates = renderField(fieldTemplates.dateRange, {
    start: ed.startDate,
    end: ed.endDate,
  });

  // Use degree field template
  const degreeParts = renderField(fieldTemplates.degree, {
    studyType: ed.studyType,
    area: ed.area,
  });

  doc.font(typography.fonts.bold).fontSize(style.fontSize);
  const institutionHeight = doc.heightOfString(institution, { width: leftWidth });
  doc.font(typography.fonts.italic).fontSize(style.fontSize);
  const dateHeight = dates ? doc.heightOfString(dates, { width: rightWidth }) : 0;
  const line1Height = Math.max(institutionHeight, dateHeight);

  doc.font(typography.fonts.italic).fontSize(style.fontSize);
  const degreeHeight = degreeParts ? doc.heightOfString(degreeParts, { width: layout.getPageWidth(), lineGap }) : 0;
  const gpaHeight = ed.gpa ? doc.heightOfString(`GPA: ${ed.gpa}`, { width: layout.getPageWidth(), lineGap }) : 0;

  const entryHeight = line1Height + degreeHeight + gpaHeight + itemMargin * 2;
  layout.ensureSpace(doc, entryHeight);

  doc.font(typography.fonts.bold).fontSize(style.fontSize).fillColor('#000000');
  renderTextWithEmoji(doc, institution, style.fontSize, typography.fonts.bold, emojiAvailable, {
    x: layout.getMargin(),
    y: layout.getCurrentY(),
    width: leftWidth,
  });
  if (dates) {
    doc
      .font(typography.fonts.italic)
      .fontSize(style.fontSize)
      .fillColor(entryStyle.company.color ?? '#444444');
    doc.text(dates, layout.getMargin() + layout.getPageWidth() - rightWidth, layout.getCurrentY(), { width: rightWidth, align: 'right' });
    doc.fillColor('#000000');
  }
  layout.advanceY(line1Height + itemMargin);

  if (degreeParts) {
    doc.font(typography.fonts.italic).fontSize(style.fontSize).fillColor('#000000');
    renderTextWithEmoji(doc, degreeParts, style.fontSize, typography.fonts.italic, emojiAvailable, {
      x: layout.getMargin(),
      y: layout.getCurrentY(),
      width: layout.getPageWidth(),
      lineGap,
    });
    layout.advanceY(degreeHeight + itemMargin);
  }

  if (ed.gpa) {
    doc
      .font(typography.fonts.regular)
      .fontSize(style.fontSize)
      .fillColor(entryStyle.location.color ?? '#444444');
    const gpaText = `GPA: ${ed.gpa}`;
    const gpaHeightVal = doc.heightOfString(gpaText, { width: layout.getPageWidth(), lineGap });
    doc.text(gpaText, layout.getMargin(), layout.getCurrentY(), { width: layout.getPageWidth(), lineGap });
    layout.advanceY(gpaHeightVal + itemMargin);
    doc.fillColor('#000000');
  }

  layout.advanceY(style.blockMarginBottom);
}

export function renderEntryListHandler(doc: PDFKit.PDFDocument, layout: LayoutEngine, element: EntryListElement, typography: TypographyOptions, fieldTemplates: Required<FieldTemplates>, emojiAvailable: boolean): void {
  const { entries, variant } = element;
  if (!entries.length) return;

  if (variant === 'education') {
    for (const entry of entries) {
      renderEducationEntry(doc, layout, entry as ResumeEducation, typography, fieldTemplates, emojiAvailable);
    }
  } else {
    const groups = groupByCompany(entries);

    for (const group of groups) {
      if (group.length === 1) {
        renderSingleWorkEntry(doc, layout, group[0] as ResumeWork, typography, fieldTemplates, emojiAvailable);
      } else {
        renderGroupedWorkEntry(doc, layout, group as ResumeWork[], typography, fieldTemplates, emojiAvailable);
      }
    }
  }
}
