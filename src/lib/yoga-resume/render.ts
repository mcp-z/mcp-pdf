/**
 * Position-based renderers for Yoga layout.
 *
 * These renderers receive computed positions from Yoga and render
 * at exact x, y coordinates. No advanceY() - all positions are pre-computed.
 */

import type PDFKit from 'pdfkit';
import { renderContactLine, renderField } from '../formatting.ts';
import type { CompanyHeaderElement, CredentialData, CredentialListElement, DividerElement, EntryData, EntryHeaderElement, FieldTemplates, GroupElement, HeaderElement, KeywordListElement, LanguageListElement, ReferenceListElement, SectionTitleElement, StructuredContentElement, TextElement } from '../ir/types.ts';
import { measureMarkdownTextHeight, renderText } from '../pdf-helpers.ts';
import { drawText, selectFace, type TextStyle } from '../text-style.ts';
import type { TypographyOptions } from '../types/typography.ts';
import { type ComputedPosition, calculateEntryColumnWidths, type Page, type PageNode, type RenderContext } from './types.ts';

// =============================================================================
// Helper Functions
// =============================================================================

const REGULAR: TextStyle = {};
const BOLD: TextStyle = { bold: true };
const ITALIC: TextStyle = { italic: true };

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
  const { content } = typography;
  return {
    fontSize: content.fontSize,
    lineGap: (content.lineHeight ?? 1.3) * content.fontSize - content.fontSize,
    paragraphMarginBottom: content.paragraphMarginBottom,
    itemMarginBottom: content.itemMarginBottom,
    blockMarginBottom: content.bulletGap + content.bulletMarginBottom,
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

/**
 * Draw field-template output (always markdown, values escaped by the template) and return its height.
 */
function drawField(ctx: RenderContext, text: string, paint: { style: TextStyle; fontSize: number; color?: string }, layout: { x: number; y: number; width: number; align?: 'left' | 'right'; lineGap?: number }): number {
  renderText(ctx.doc, text, {
    typography: { fontSize: paint.fontSize, fonts: ctx.fonts, style: paint.style },
    features: { enableEmoji: ctx.emojiAvailable, markdown: true },
    color: { fillColor: paint.color, hyperlinkColor: ctx.hyperlinkColor },
    layout: { x: layout.x, y: layout.y, width: layout.width, align: layout.align },
    spacing: { lineGap: layout.lineGap },
  });
  return measureMarkdownTextHeight(ctx.doc, text, layout.width, paint.fontSize, layout.lineGap ?? 0, ctx.fonts, true, paint.style);
}

// =============================================================================
// Element Renderers
// =============================================================================

/**
 * Render text element at computed position.
 */
export function renderTextElement(ctx: RenderContext, element: TextElement, position: ComputedPosition): void {
  const { doc, typography, emojiAvailable, fonts } = ctx;
  const { content } = typography;
  const style = getResolvedStyle(typography);
  const paragraphs = paragraphsFromContent(element.content);

  if (paragraphs.length === 0) return;

  // Apply marginTop for spacing after section title
  let currentY = position.y + content.marginTop;

  for (let i = 0; i < paragraphs.length; i++) {
    renderText(doc, paragraphs[i], {
      typography: { fontSize: style.fontSize, fonts, style: REGULAR },
      features: { enableEmoji: emojiAvailable, markdown: ctx.parseMarkdown },
      color: { hyperlinkColor: ctx.hyperlinkColor },
      layout: { x: position.x, y: currentY, width: position.width, align: 'justify' },
      spacing: { lineGap: style.lineGap },
    });

    // Get the actual Y position after rendering (PDFKit updates doc.y)
    const _paragraphHeight = doc.y - (currentY + (i > 0 ? style.paragraphMarginBottom : 0));
    currentY = doc.y;

    if (i < paragraphs.length - 1) {
      doc.y += style.paragraphMarginBottom;
      currentY = doc.y;
    }
  }

  // marginBottom is handled by Yoga layout positioning, not by advancing doc.y
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
  selectFace(doc, fonts, BOLD).fontSize(sectionTitle.fontSize);
  renderText(doc, element.title.toUpperCase(), {
    typography: { fontSize: sectionTitle.fontSize, fonts, style: BOLD },
    features: { enableEmoji: emojiAvailable, markdown: ctx.parseMarkdown },
    color: { hyperlinkColor: ctx.hyperlinkColor },
    layout: { x: position.x, y: currentY, width: position.width },
    spacing: { characterSpacing: sectionTitle.letterSpacing ?? 0 },
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
  selectFace(doc, fonts, BOLD).fontSize(header.name.fontSize);
  const nameHeight = doc.heightOfString(element.name.toUpperCase(), { width: position.width, align: 'center' });

  renderText(doc, element.name.toUpperCase(), {
    typography: { fontSize: header.name.fontSize, fonts, style: BOLD },
    features: { enableEmoji: emojiAvailable, markdown: ctx.parseMarkdown },
    color: { hyperlinkColor: ctx.hyperlinkColor },
    layout: { x: position.x, y: currentY, width: position.width, align: 'center' },
    spacing: { characterSpacing: header.name.letterSpacing ?? 0 },
  });
  currentY += nameHeight + (header.name.marginBottom ?? 0);

  // Contact line
  if (element.contactItems.length > 0) {
    const contactText = renderContactLine(fieldTemplates, element.contactItems);
    renderText(doc, contactText, {
      typography: { fontSize: header.contact.fontSize, fonts, style: REGULAR },
      features: { enableEmoji: emojiAvailable, markdown: true },
      color: { hyperlinkColor: ctx.hyperlinkColor },
      layout: { x: position.x, y: currentY, width: position.width, align: 'center' },
      spacing: { characterSpacing: header.contact.letterSpacing ?? 0 },
    });
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
  const { doc, typography, fieldTemplates, emojiAvailable, fonts } = ctx;
  const style = getResolvedStyle(typography);

  if (element.items.length === 0) return;

  let currentY = position.y;

  for (const skill of element.items) {
    const name = ensureString(skill.name);
    const level = ensureString((skill as Record<string, unknown>).level);
    const keywords = skill.keywords || [];

    const fullText = renderField(fieldTemplates.skill, { name, level, keywords });
    renderText(doc, fullText, {
      typography: { fontSize: style.fontSize, fonts, style: REGULAR },
      features: { enableEmoji: emojiAvailable, markdown: true },
      color: { hyperlinkColor: ctx.hyperlinkColor },
      layout: { x: position.x, y: currentY, width: position.width },
      spacing: { lineGap: style.lineGap },
    });

    currentY += measureMarkdownTextHeight(doc, fullText, position.width, style.fontSize, style.lineGap, fonts) + style.itemMarginBottom;
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

  renderText(doc, fullText, {
    typography: { fontSize: style.fontSize, fonts, style: REGULAR },
    features: { enableEmoji: emojiAvailable, markdown: true },
    color: { hyperlinkColor: ctx.hyperlinkColor },
    layout: { x: position.x, y: position.y, width: position.width },
    spacing: { lineGap: style.lineGap },
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
    selectFace(doc, fonts, BOLD).fontSize(style.fontSize);
    const titleHeight = doc.heightOfString(title, { width: position.width });
    renderText(doc, title, {
      typography: { fontSize: style.fontSize, fonts, style: BOLD },
      features: { enableEmoji: emojiAvailable, markdown: ctx.parseMarkdown },
      color: { hyperlinkColor: ctx.hyperlinkColor },
      layout: { x: position.x, y: currentY, width: position.width },
    });
    currentY += titleHeight;

    // Render metadata line (italic, gray)
    if (metaLine) {
      currentY += drawField(ctx, metaLine, { style: ITALIC, fontSize: style.fontSize, color: '#444444' }, { x: position.x, y: currentY, width: position.width });
    }

    // Render summary if present
    const summaryParagraphs = paragraphsFromContent(ensureString(item.summary));
    if (summaryParagraphs.length > 0) {
      currentY += style.paragraphMarginBottom;

      for (const para of summaryParagraphs) {
        renderText(doc, para, {
          typography: { fontSize: style.fontSize, fonts, style: REGULAR },
          features: { enableEmoji: emojiAvailable, markdown: ctx.parseMarkdown },
          color: { hyperlinkColor: ctx.hyperlinkColor },
          layout: { x: position.x, y: currentY, width: position.width, align: 'justify' },
          spacing: { lineGap: style.lineGap },
        });
        selectFace(doc, fonts, REGULAR).fontSize(style.fontSize);
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
      selectFace(doc, fonts, BOLD).fontSize(style.fontSize);
      const nameHeight = doc.heightOfString(name, { width: position.width });
      renderText(doc, name, {
        typography: { fontSize: style.fontSize, fonts, style: BOLD },
        features: { enableEmoji: emojiAvailable, markdown: ctx.parseMarkdown },
        color: { hyperlinkColor: ctx.hyperlinkColor },
        layout: { x: position.x, y: currentY, width: position.width },
      });
      currentY += nameHeight + style.itemMarginBottom;
    }

    // Quote text (italic, indented)
    if (reference) {
      const quoteWidth = position.width - quote.indent;
      selectFace(doc, fonts, ITALIC).fontSize(style.fontSize);
      const quoteText = `"${reference}"`;
      const quoteHeight = doc.heightOfString(quoteText, { width: quoteWidth, lineGap: style.lineGap });
      renderText(doc, quoteText, {
        typography: { fontSize: style.fontSize, fonts, style: ITALIC },
        features: { enableEmoji: emojiAvailable, markdown: ctx.parseMarkdown },
        color: { hyperlinkColor: ctx.hyperlinkColor },
        layout: { x: position.x + quote.indent, y: currentY, width: quoteWidth },
        spacing: { lineGap: style.lineGap },
      });
      currentY += quoteHeight;
    }

    currentY += style.blockMarginBottom;
  }
}

/**
 * Group entries by company name.
 */
function _groupByCompany(entries: EntryData[]): EntryData[][] {
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
 * Render a group element at computed position.
 */
export function renderGroup(ctx: RenderContext, _element: GroupElement, children?: PageNode[]): void {
  // Groups just render their children - the children have their own computed positions
  if (children) {
    for (const child of children) {
      renderPageNode(ctx, child);
    }
  }
}

// =============================================================================
// Fine-Grained Entry Element Renderers (for better pagination)
// =============================================================================

/**
 * Render entry header element (company/position/dates only, no content).
 */
export function renderEntryHeader(ctx: RenderContext, element: EntryHeaderElement, position: ComputedPosition): void {
  const { doc, typography, fieldTemplates, emojiAvailable, fonts } = ctx;
  const style = getResolvedStyle(typography);
  const { entry: entryStyle } = typography;

  const { leftWidth, rightWidth } = calculateEntryColumnWidths(position.width, entryStyle.date.width);

  const entry = element.entry;
  const entryData = entry as Record<string, unknown>;
  const company = ensureString(entryData.name ?? entryData.organization ?? entryData.institution ?? entryData.entity);
  const positionText = ensureString(entryData.position ?? entryData.studyType ?? (entryData.roles as string[])?.[0]);
  const location = element.showLocation !== false ? ensureString(entryData.location) : '';

  const dateText = renderField(fieldTemplates.dateRange, {
    start: entry.startDate,
    end: entry.endDate,
  });

  // Apply marginTop for entry spacing (marginTop=0 means use entrySpacing from typography)
  let marginTop = 0;
  if (element.marginTop !== undefined) {
    marginTop = element.marginTop === 0 ? typography.content.entrySpacing : element.marginTop;
  }

  let currentY = position.y + marginTop;

  if (element.variant === 'education') {
    // Education: Institution + Dates on first line, degree on second
    selectFace(doc, fonts, BOLD).fontSize(style.fontSize);
    const institutionHeight = doc.heightOfString(company, { width: leftWidth });
    renderText(doc, company, {
      typography: { fontSize: style.fontSize, fonts, style: BOLD },
      features: { enableEmoji: emojiAvailable, markdown: ctx.parseMarkdown },
      color: { hyperlinkColor: ctx.hyperlinkColor },
      layout: { x: position.x, y: currentY, width: leftWidth },
    });

    if (dateText) {
      drawField(ctx, dateText, { style: REGULAR, fontSize: entryStyle.company.fontSize, color: entryStyle.company.color ?? '#666666' }, { x: position.x + position.width - rightWidth, y: currentY, width: rightWidth, align: 'right' });
    }

    currentY += institutionHeight;

    // Degree line
    const degreeParts = renderField(fieldTemplates.degree, {
      studyType: entry.studyType,
      area: entry.area,
    });

    // Add lineSpacing after institution only if degree or GPA follows
    if (degreeParts || entry.score) currentY += typography.entryHeader.lineSpacing;
    if (degreeParts) {
      currentY += drawField(ctx, degreeParts, { style: ITALIC, fontSize: style.fontSize }, { x: position.x, y: currentY, width: position.width, lineGap: style.lineGap });

      // Only add lineSpacing if GPA follows
      if (entry.score) {
        currentY += typography.entryHeader.lineSpacing;
      }
    }

    // GPA line
    if (entry.score) {
      const gpaText = `GPA: ${entry.score}`;
      drawText(doc, gpaText, { fonts, style: REGULAR, fontSize: style.fontSize, color: entryStyle.location.color ?? '#444444' }, { x: position.x, y: currentY, width: position.width, lineGap: style.lineGap });
    }
  } else if (element.isGroupedPosition) {
    // Grouped work entry: Position + Dates (company is in separate CompanyHeaderElement)
    selectFace(doc, fonts, ITALIC).fontSize(entryStyle.position.fontSize);
    const positionHeight = doc.heightOfString(positionText, { width: leftWidth });
    renderText(doc, positionText, {
      typography: { fontSize: entryStyle.position.fontSize, fonts, style: ITALIC },
      features: { enableEmoji: emojiAvailable, markdown: ctx.parseMarkdown },
      color: { hyperlinkColor: ctx.hyperlinkColor },
      layout: { x: position.x, y: currentY, width: leftWidth },
    });

    if (dateText) {
      drawField(ctx, dateText, { style: ITALIC, fontSize: entryStyle.company.fontSize, color: entryStyle.company.color ?? '#444444' }, { x: position.x + position.width - rightWidth, y: currentY, width: rightWidth, align: 'right' });
    }

    currentY += positionHeight;

    // Location line (if shown for grouped entries with different locations)
    if (location) {
      drawText(doc, location, { fonts, style: REGULAR, fontSize: entryStyle.location.fontSize, color: entryStyle.location.color ?? '#444444' }, { x: position.x, y: currentY, width: position.width });
    }
  } else {
    // Single work entry: Company + Location on first line, Position + Dates on second
    selectFace(doc, fonts, BOLD).fontSize(entryStyle.position.fontSize);
    const companyHeight = company ? doc.heightOfString(company, { width: leftWidth }) : 0;

    // Measure location height using correct font before rendering
    selectFace(doc, fonts, BOLD).fontSize(entryStyle.location.fontSize);
    const locationHeight = location ? doc.heightOfString(location, { width: rightWidth }) : 0;

    // Render company
    if (company) {
      selectFace(doc, fonts, BOLD).fontSize(entryStyle.position.fontSize);
      renderText(doc, company, {
        typography: { fontSize: entryStyle.position.fontSize, fonts, style: BOLD },
        features: { enableEmoji: emojiAvailable, markdown: ctx.parseMarkdown },
        color: { hyperlinkColor: ctx.hyperlinkColor },
        layout: { x: position.x, y: currentY, width: leftWidth },
      });
    }

    // Render location
    if (location) {
      drawText(doc, location, { fonts, style: BOLD, fontSize: entryStyle.location.fontSize, color: '#000000' }, { x: position.x + position.width - rightWidth, y: currentY, width: rightWidth, align: 'right' });
    }

    // Use maximum of company and location heights to prevent overlap
    currentY += Math.max(companyHeight, locationHeight) + typography.entryHeader.lineSpacing;

    // Position + Dates line
    selectFace(doc, fonts, ITALIC).fontSize(entryStyle.position.fontSize);
    renderText(doc, positionText, {
      typography: { fontSize: entryStyle.position.fontSize, fonts, style: ITALIC },
      features: { enableEmoji: emojiAvailable, markdown: ctx.parseMarkdown },
      color: { hyperlinkColor: ctx.hyperlinkColor },
      layout: { x: position.x, y: currentY, width: leftWidth },
    });

    if (dateText) {
      drawField(ctx, dateText, { style: ITALIC, fontSize: entryStyle.company.fontSize, color: entryStyle.company.color ?? '#444444' }, { x: position.x + position.width - rightWidth, y: currentY, width: rightWidth, align: 'right' });
    }
  }
}

/**
 * Render a structured content element (summary + optional bullets).
 * This is the single source of truth for ALL summary+bullet rendering.
 */
export function renderStructuredContent(ctx: RenderContext, element: StructuredContentElement, position: ComputedPosition): void {
  const { doc, typography, emojiAvailable, fonts } = ctx;
  const { content } = typography;

  const indent = element.spacing?.bulletIndent ?? content.bulletIndent;
  const paragraphMargin = element.spacing?.paragraphMarginBottom ?? content.paragraphMarginBottom;
  const bulletGap = element.spacing?.bulletGap ?? content.bulletGap;
  const bulletMargin = element.spacing?.bulletMarginBottom ?? content.bulletMarginBottom;
  const lineGap = (content.lineHeight ?? 1.3) * content.fontSize - content.fontSize;

  const summaries = Array.isArray(element.summary) ? element.summary : element.summary?.split(/\n\n+/).filter(Boolean) || [];
  const hasSummary = summaries.length > 0;
  const hasBullets = element.bullets && element.bullets.length > 0;

  // Use absolute positioning from Yoga layout, don't modify doc.y
  // Apply marginTop only if there's summary content (not for bullets-only elements)
  let currentY = position.y + (hasSummary ? content.marginTop : 0);

  for (const summary of summaries) {
    selectFace(doc, fonts, REGULAR).fontSize(content.fontSize);
    renderText(doc, summary, {
      typography: { fontSize: content.fontSize, fonts, style: REGULAR },
      features: { enableEmoji: emojiAvailable, markdown: ctx.parseMarkdown },
      color: { hyperlinkColor: ctx.hyperlinkColor },
      layout: { x: position.x, y: currentY, width: position.width, align: 'justify' },
      spacing: { lineGap },
    });

    // Calculate the height of the rendered text and advance
    // Use measureMarkdownTextHeight to account for bold text width (same as rendering)
    const summaryHeight = measureMarkdownTextHeight(doc, summary, position.width, content.fontSize, lineGap, fonts, ctx.parseMarkdown);
    currentY += summaryHeight + paragraphMargin;
  }

  // Add bulletGap only between summary and bullets (not before first bullet when no summary)
  if (hasBullets && hasSummary) {
    currentY += bulletGap;
  }

  if (hasBullets) {
    const bulletWidth = position.width - indent;
    selectFace(doc, fonts, REGULAR).fontSize(content.fontSize);

    for (const bulletItem of element.bullets ?? []) {
      const bulletText = `• ${bulletItem}`;
      renderText(doc, bulletText, {
        typography: { fontSize: content.fontSize, fonts, style: REGULAR },
        features: { enableEmoji: emojiAvailable, markdown: ctx.parseMarkdown },
        color: { hyperlinkColor: ctx.hyperlinkColor },
        layout: { x: position.x + indent, y: currentY, width: bulletWidth },
        spacing: { lineGap },
      });

      // Calculate the height of the bullet text and advance
      // Use measureMarkdownTextHeight to account for bold text width (same as rendering)
      const bulletHeight = measureMarkdownTextHeight(doc, bulletText, bulletWidth, content.fontSize, lineGap, fonts, ctx.parseMarkdown);
      currentY += bulletHeight + bulletMargin;
    }
  }

  // marginBottom is handled by Yoga layout positioning, not by advancing doc.y
  // Note: We don't add marginBottom here because when element has bullets, they may
  // continue in a subsequent element, and we don't want extra spacing between elements
}

/**
 * Render company header element (for grouped entries).
 */
export function renderCompanyHeader(ctx: RenderContext, element: CompanyHeaderElement, position: ComputedPosition): void {
  const { doc, typography, emojiAvailable, fonts } = ctx;
  const { entry: entryStyle } = typography;

  const { leftWidth, rightWidth } = calculateEntryColumnWidths(position.width, entryStyle.date.width);

  selectFace(doc, fonts, BOLD).fontSize(entryStyle.position.fontSize);
  renderText(doc, element.company, {
    typography: { fontSize: entryStyle.position.fontSize, fonts, style: BOLD },
    features: { enableEmoji: emojiAvailable, markdown: ctx.parseMarkdown },
    color: { hyperlinkColor: ctx.hyperlinkColor },
    layout: { x: position.x, y: position.y, width: leftWidth },
  });

  if (element.location) {
    drawText(doc, element.location, { fonts, style: BOLD, fontSize: entryStyle.location.fontSize, color: '#000000' }, { x: position.x + position.width - rightWidth, y: position.y, width: rightWidth, align: 'right' });
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
      renderTextElement(ctx, element, position);
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
    case 'structured-content':
      renderStructuredContent(ctx, element, position);
      break;
    case 'group':
      renderGroup(ctx, element, children);
      break;
    case 'entry-header':
      renderEntryHeader(ctx, element, position);
      break;
    case 'company-header':
      renderCompanyHeader(ctx, element, position);
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
export function createRenderContext(doc: PDFKit.PDFDocument, typography: TypographyOptions, fieldTemplates: Required<FieldTemplates>, emojiAvailable: boolean, parseMarkdown: boolean, hyperlinkColor: string): RenderContext {
  return {
    doc,
    typography,
    fieldTemplates,
    emojiAvailable,
    fonts: typography.fonts,
    parseMarkdown,
    hyperlinkColor,
  };
}
