/**
 * Position-based renderers for Yoga layout.
 *
 * These renderers receive computed positions from Yoga and render
 * at exact x, y coordinates. No advanceY() - all positions are pre-computed.
 */

import type PDFKit from 'pdfkit';
import { renderField } from '../formatting.ts';
import type { CompanyHeaderElement, CredentialData, CredentialListElement, DividerElement, EntryData, EntryHeaderElement, FieldTemplates, GroupElement, HeaderElement, KeywordListElement, LanguageListElement, ReferenceListElement, SectionTitleElement, StructuredContentElement, TextElement } from '../ir/types.ts';
import { measureMarkdownTextHeight, renderText } from '../pdf-helpers.ts';
import type { TypographyOptions } from '../types/typography.ts';
import { type ComputedPosition, calculateEntryColumnWidths, type Page, type PageNode, type RenderContext } from './types.ts';

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
      typography: { fontSize: style.fontSize, fontName: fonts.regular, fonts },
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
  doc.font(fonts.bold).fontSize(sectionTitle.fontSize).fillColor('#000000');
  renderText(doc, element.title.toUpperCase(), {
    typography: { fontSize: sectionTitle.fontSize, fontName: fonts.bold, fonts },
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
  doc.font(fonts.bold).fontSize(header.name.fontSize);
  const nameHeight = doc.heightOfString(element.name.toUpperCase(), { width: position.width, align: 'center' });

  renderText(doc, element.name.toUpperCase(), {
    typography: { fontSize: header.name.fontSize, fontName: fonts.bold, fonts },
    features: { enableEmoji: emojiAvailable, markdown: ctx.parseMarkdown },
    color: { hyperlinkColor: ctx.hyperlinkColor },
    layout: { x: position.x, y: currentY, width: position.width, align: 'center' },
    spacing: { characterSpacing: header.name.letterSpacing ?? 0 },
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
        if (item.url) {
          return renderField(fieldTemplates.url, { text: item.text, url: item.url });
        }
        return item.text;
      })
      .filter((text) => text.length > 0);

    const contactText = renderField(fieldTemplates.contactLine, { items: contactTexts });
    const _contactHeight = doc.heightOfString(contactText, { width: position.width, align: 'center' });

    // Calculate text position for link annotations
    const textWidth = doc.widthOfString(contactText);
    const _textX = position.x + (position.width - textWidth) / 2;
    const textY = currentY;

    renderText(doc, contactText, {
      typography: { fontSize: header.contact.fontSize, fontName: fonts.regular, fonts },
      features: { enableEmoji: emojiAvailable, markdown: ctx.parseMarkdown },
      color: { hyperlinkColor: ctx.hyperlinkColor },
      layout: { x: position.x, y: textY, width: position.width, align: 'center' },
      spacing: { characterSpacing: header.contact.letterSpacing ?? 0 },
    });

    // URLs are now handled through field templates and renderTextWithEmoji
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
  renderText(doc, fullText, {
    typography: { fontSize: style.fontSize, fontName: fonts.regular, fonts },
    features: { enableEmoji: emojiAvailable, markdown: ctx.parseMarkdown },
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
    doc.font(fonts.bold).fontSize(style.fontSize).fillColor('#000000');
    const titleHeight = doc.heightOfString(title, { width: position.width });
    renderText(doc, title, {
      typography: { fontSize: style.fontSize, fontName: fonts.bold, fonts },
      features: { enableEmoji: emojiAvailable, markdown: ctx.parseMarkdown },
      color: { hyperlinkColor: ctx.hyperlinkColor },
      layout: { x: position.x, y: currentY, width: position.width },
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
        renderText(doc, para, {
          typography: { fontSize: style.fontSize, fontName: fonts.regular, fonts },
          features: { enableEmoji: emojiAvailable, markdown: ctx.parseMarkdown },
          color: { hyperlinkColor: ctx.hyperlinkColor },
          layout: { x: position.x, y: currentY, width: position.width, align: 'justify' },
          spacing: { lineGap: style.lineGap },
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
      renderText(doc, name, {
        typography: { fontSize: style.fontSize, fontName: fonts.bold, fonts },
        features: { enableEmoji: emojiAvailable, markdown: ctx.parseMarkdown },
        color: { hyperlinkColor: ctx.hyperlinkColor },
        layout: { x: position.x, y: currentY, width: position.width },
      });
      currentY += nameHeight + style.itemMarginBottom;
    }

    // Quote text (italic, indented)
    if (reference) {
      const quoteWidth = position.width - quote.indent;
      doc.font(fonts.italic).fontSize(style.fontSize).fillColor('#000000');
      const quoteText = `"${reference}"`;
      const quoteHeight = doc.heightOfString(quoteText, { width: quoteWidth, lineGap: style.lineGap });
      renderText(doc, quoteText, {
        typography: { fontSize: style.fontSize, fontName: fonts.italic, fonts },
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

  let currentY = position.y;

  if (element.variant === 'education') {
    // Education: Institution + Dates on first line, degree on second
    doc.font(fonts.bold).fontSize(style.fontSize).fillColor('#000000');
    const institutionHeight = doc.heightOfString(company, { width: leftWidth });
    renderText(doc, company, {
      typography: { fontSize: style.fontSize, fontName: fonts.bold, fonts },
      features: { enableEmoji: emojiAvailable, markdown: ctx.parseMarkdown },
      color: { hyperlinkColor: ctx.hyperlinkColor },
      layout: { x: position.x, y: currentY, width: leftWidth },
    });

    if (dateText) {
      doc
        .font(fonts.regular)
        .fontSize(entryStyle.company.fontSize)
        .fillColor(entryStyle.company.color ?? '#666666');
      doc.text(dateText, position.x + position.width - rightWidth, currentY, { width: rightWidth, align: 'right' });
      doc.fillColor('#000000');
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
      doc.font(fonts.italic).fontSize(style.fontSize).fillColor('#000000');
      renderText(doc, degreeParts, {
        typography: { fontSize: style.fontSize, fontName: fonts.italic, fonts },
        features: { enableEmoji: emojiAvailable, markdown: ctx.parseMarkdown },
        color: { hyperlinkColor: ctx.hyperlinkColor },
        layout: { x: position.x, y: currentY, width: position.width },
        spacing: { lineGap: style.lineGap },
      });
      const degreeHeight = doc.heightOfString(degreeParts, { width: position.width, lineGap: style.lineGap });
      currentY += degreeHeight;

      // Only add lineSpacing if GPA follows
      if (entry.score) {
        currentY += typography.entryHeader.lineSpacing;
      }
    }

    // GPA line
    if (entry.score) {
      doc
        .font(fonts.regular)
        .fontSize(style.fontSize)
        .fillColor(entryStyle.location.color ?? '#444444');
      const gpaText = `GPA: ${entry.score}`;
      doc.text(gpaText, position.x, currentY, { width: position.width, lineGap: style.lineGap });
      doc.fillColor('#000000');
    }
  } else if (element.isGroupedPosition) {
    // Grouped work entry: Position + Dates (company is in separate CompanyHeaderElement)
    doc.font(fonts.italic).fontSize(entryStyle.position.fontSize).fillColor('#000000');
    const positionHeight = doc.heightOfString(positionText, { width: leftWidth });
    renderText(doc, positionText, {
      typography: { fontSize: entryStyle.position.fontSize, fontName: fonts.italic, fonts },
      features: { enableEmoji: emojiAvailable, markdown: ctx.parseMarkdown },
      color: { hyperlinkColor: ctx.hyperlinkColor },
      layout: { x: position.x, y: currentY, width: leftWidth },
    });

    if (dateText) {
      doc
        .font(fonts.italic)
        .fontSize(entryStyle.company.fontSize)
        .fillColor(entryStyle.company.color ?? '#444444');
      doc.text(dateText, position.x + position.width - rightWidth, currentY, { width: rightWidth, align: 'right' });
      doc.fillColor('#000000');
    }

    currentY += positionHeight;

    // Location line (if shown for grouped entries with different locations)
    if (location) {
      doc
        .font(fonts.regular)
        .fontSize(entryStyle.location.fontSize)
        .fillColor(entryStyle.location.color ?? '#444444');
      doc.text(location, position.x, currentY, { width: position.width });
      doc.fillColor('#000000');
    }
  } else {
    // Single work entry: Company + Location on first line, Position + Dates on second
    doc.font(fonts.bold).fontSize(entryStyle.position.fontSize).fillColor('#000000');
    const companyHeight = company ? doc.heightOfString(company, { width: leftWidth }) : 0;

    // Measure location height using correct font before rendering
    doc.font(fonts.bold).fontSize(entryStyle.location.fontSize);
    const locationHeight = location ? doc.heightOfString(location, { width: rightWidth }) : 0;

    // Render company
    if (company) {
      doc.font(fonts.bold).fontSize(entryStyle.position.fontSize).fillColor('#000000');
      renderText(doc, company, {
        typography: { fontSize: entryStyle.position.fontSize, fontName: fonts.bold, fonts },
        features: { enableEmoji: emojiAvailable, markdown: ctx.parseMarkdown },
        color: { hyperlinkColor: ctx.hyperlinkColor },
        layout: { x: position.x, y: currentY, width: leftWidth },
      });
    }

    // Render location
    if (location) {
      doc.font(fonts.bold).fontSize(entryStyle.location.fontSize);
      doc.text(location, position.x + position.width - rightWidth, currentY, { width: rightWidth, align: 'right' });
    }

    // Use maximum of company and location heights to prevent overlap
    currentY += Math.max(companyHeight, locationHeight) + typography.entryHeader.lineSpacing;

    // Position + Dates line
    doc.font(fonts.italic).fontSize(entryStyle.position.fontSize).fillColor('#000000');
    renderText(doc, positionText, {
      typography: { fontSize: entryStyle.position.fontSize, fontName: fonts.italic, fonts },
      features: { enableEmoji: emojiAvailable, markdown: ctx.parseMarkdown },
      color: { hyperlinkColor: ctx.hyperlinkColor },
      layout: { x: position.x, y: currentY, width: leftWidth },
    });

    if (dateText) {
      doc
        .font(fonts.italic)
        .fontSize(entryStyle.company.fontSize)
        .fillColor(entryStyle.company.color ?? '#444444');
      doc.text(dateText, position.x + position.width - rightWidth, currentY, { width: rightWidth, align: 'right' });
      doc.fillColor('#000000');
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
    doc.font(fonts.regular).fontSize(content.fontSize).fillColor('#000000');
    renderText(doc, summary, {
      typography: { fontSize: content.fontSize, fontName: fonts.regular, fonts },
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
    doc.font(fonts.regular).fontSize(content.fontSize).fillColor('#000000');

    for (const bulletItem of element.bullets) {
      const bulletText = `• ${bulletItem}`;
      renderText(doc, bulletText, {
        typography: { fontSize: content.fontSize, fontName: fonts.regular, fonts },
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

  doc.font(fonts.bold).fontSize(entryStyle.position.fontSize).fillColor('#000000');
  renderText(doc, element.company, {
    typography: { fontSize: entryStyle.position.fontSize, fontName: fonts.bold, fonts },
    features: { enableEmoji: emojiAvailable, markdown: ctx.parseMarkdown },
    color: { hyperlinkColor: ctx.hyperlinkColor },
    layout: { x: position.x, y: position.y, width: leftWidth },
  });

  if (element.location) {
    doc.font(fonts.bold).fontSize(entryStyle.location.fontSize);
    doc.text(element.location, position.x + position.width - rightWidth, position.y, { width: rightWidth, align: 'right' });
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
