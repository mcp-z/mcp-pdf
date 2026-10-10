/**
 * Resume elements as blocks of positioned lines.
 *
 * Each element is laid out once into a block: its height (what Yoga lays out), its lines (what is drawn), and which
 * lines must stay with the next (where a page may not break). Measuring, page breaking and drawing all read the same
 * block, so they cannot disagree.
 */

import { ensureString, paragraphsFromContent, renderContactLine, renderField } from '../formatting.ts';
import type { CredentialData, DividerElement, EntryHeaderElement, HeaderElement, KeywordListElement, LanguageListElement, LayoutElement, ReferenceListElement, SectionTitleElement, StructuredContentElement, TemplateElement, TextElement } from '../ir/types.ts';
import { layoutText, type TextLayoutOptions } from '../text-layout.ts';
import type { TextStyle } from '../text-style.ts';
import { calculateEntryColumnWidths, type RenderContext } from './types.ts';

export interface BlockLine {
  /** Offset from the top of the block */
  top: number;
  height: number;
  /** A page may not break between this line and the next */
  keepWithNext: boolean;
  /** Draws the line with the block's left edge at `x` and this line's top at `y` */
  draw: (x: number, y: number) => void;
}

export interface Block {
  height: number;
  lines: BlockLine[];
  /** The block's last line stays with the first line of the next block (titles and entry headers) */
  keepWithNext: boolean;
}

const REGULAR: TextStyle = {};
const BOLD: TextStyle = { bold: true };
const ITALIC: TextStyle = { italic: true };

interface TextPart {
  text: string;
  style: TextStyle;
  fontSize: number;
  color?: string;
  /** Offset from the block's left edge */
  x?: number;
  width?: number;
  align?: TextLayoutOptions['align'];
  lineGap?: number;
  characterSpacing?: number;
  /** Field-template output is always markdown; free text follows the markdown option */
  markdown: boolean;
}

/**
 * Accumulates lines top to bottom.
 */
class BlockBuilder {
  private y = 0;
  private readonly lines: BlockLine[] = [];
  private readonly ctx: RenderContext;
  private readonly width: number;

  constructor(ctx: RenderContext, width: number) {
    this.ctx = ctx;
    this.width = width;
  }

  gap(points: number): void {
    this.y += points;
  }

  private layout(part: TextPart) {
    return layoutText(
      this.ctx.doc,
      part.text,
      { fonts: this.ctx.fonts, style: part.style, fontSize: part.fontSize, color: part.color ?? 'black' },
      {
        width: part.width ?? this.width - (part.x ?? 0),
        align: part.align,
        lineGap: part.lineGap,
        characterSpacing: part.characterSpacing,
        markdown: part.markdown,
        emoji: this.ctx.emojiAvailable,
        hyperlinkColor: this.ctx.hyperlinkColor,
      }
    );
  }

  /** Text whose lines may break across pages, unless `keepWithNext` */
  text(part: TextPart, keepWithNext = false): void {
    const block = this.layout(part);
    for (const line of block.lines) {
      this.lines.push({ top: this.y + line.top, height: line.height, keepWithNext, draw: (x, y) => line.draw(x + (part.x ?? 0), y) });
    }
    this.y += block.height;
  }

  /** Texts side by side (left column and right-aligned dates, for example), kept together as one line */
  row(parts: TextPart[]): void {
    const blocks = parts.map((part) => ({ part, block: this.layout(part) }));
    const height = Math.max(0, ...blocks.map(({ block }) => block.height));
    this.lines.push({
      top: this.y,
      height,
      keepWithNext: false,
      draw: (x, y) => {
        for (const { part, block } of blocks) for (const line of block.lines) line.draw(x + (part.x ?? 0), y + line.top);
      },
    });
    this.y += height;
  }

  /** A horizontal rule across the block at the current position, occupying `height` */
  rule(thickness: number, color: string, height: number): void {
    const width = this.width;
    const doc = this.ctx.doc;
    this.lines.push({
      top: this.y,
      height,
      keepWithNext: false,
      draw: (x, y) => {
        doc
          .strokeColor(color)
          .lineWidth(thickness)
          .moveTo(x, y)
          .lineTo(x + width, y)
          .stroke();
      },
    });
    this.y += height;
  }

  /** `unbreakable` keeps every line with the next, so the block moves to a new page whole */
  build(options: { keepWithNext?: boolean; unbreakable?: boolean } = {}): Block {
    const lines = options.unbreakable ? this.lines.map((line, i) => ({ ...line, keepWithNext: line.keepWithNext || i < this.lines.length - 1 })) : this.lines;
    return { height: this.y, lines, keepWithNext: options.keepWithNext ?? false };
  }
}

function contentStyle(ctx: RenderContext) {
  const { content } = ctx.typography;
  return {
    fontSize: content.fontSize,
    lineGap: (content.lineHeight ?? 1.3) * content.fontSize - content.fontSize,
    paragraphMarginBottom: content.paragraphMarginBottom,
    itemMarginBottom: content.itemMarginBottom,
    blockMarginBottom: content.bulletGap + content.bulletMarginBottom,
  };
}

// =============================================================================
// Element blocks
// =============================================================================

function textBlock(b: BlockBuilder, ctx: RenderContext, element: TextElement): Block {
  const paragraphs = paragraphsFromContent(element.content);
  if (paragraphs.length === 0) return b.build();
  const { content } = ctx.typography;
  const style = contentStyle(ctx);
  b.gap(content.marginTop);
  paragraphs.forEach((paragraph, i) => {
    if (i > 0) b.gap(style.paragraphMarginBottom);
    b.text({ text: paragraph, style: REGULAR, fontSize: style.fontSize, align: 'justify', lineGap: style.lineGap, markdown: ctx.parseMarkdown });
  });
  b.gap(content.marginBottom);
  return b.build();
}

function sectionTitleBlock(b: BlockBuilder, ctx: RenderContext, element: SectionTitleElement): Block {
  if (!element.title) return b.build();
  const { sectionTitle } = ctx.typography;
  b.gap(sectionTitle.marginTop ?? 0);
  b.text({ text: element.title.toUpperCase(), style: BOLD, fontSize: sectionTitle.fontSize, characterSpacing: sectionTitle.letterSpacing ?? 0, markdown: ctx.parseMarkdown });
  b.gap(sectionTitle.underlineGap ?? 0);
  b.rule(sectionTitle.underlineThickness ?? 0.5, '#000000', 1);
  b.gap(sectionTitle.marginBottom ?? 0);
  return b.build({ keepWithNext: true, unbreakable: true });
}

function headerBlock(b: BlockBuilder, ctx: RenderContext, element: HeaderElement): Block {
  const { header } = ctx.typography;
  b.text({ text: element.name.toUpperCase(), style: BOLD, fontSize: header.name.fontSize, align: 'center', characterSpacing: header.name.letterSpacing ?? 0, markdown: ctx.parseMarkdown });
  b.gap(header.name.marginBottom ?? 0);
  if (element.contactItems.length > 0) {
    b.text({ text: renderContactLine(ctx.fieldTemplates, element.contactItems), style: REGULAR, fontSize: header.contact.fontSize, align: 'center', characterSpacing: header.contact.letterSpacing ?? 0, markdown: true });
  }
  b.gap(header.marginBottom ?? 0);
  return b.build({ unbreakable: true });
}

function dividerBlock(b: BlockBuilder, element: DividerElement): Block {
  const thickness = element.thickness ?? 0.5;
  b.gap(element.margin?.top ?? 8);
  b.rule(thickness, element.color ?? '#cccccc', thickness);
  b.gap(element.margin?.bottom ?? 8);
  return b.build({ unbreakable: true });
}

function keywordListBlock(b: BlockBuilder, ctx: RenderContext, element: KeywordListElement): Block {
  const style = contentStyle(ctx);
  for (const skill of element.items) {
    const text = renderField(ctx.fieldTemplates.skill, { name: ensureString(skill.name), level: ensureString((skill as Record<string, unknown>).level), keywords: skill.keywords || [] });
    b.text({ text, style: REGULAR, fontSize: style.fontSize, lineGap: style.lineGap, markdown: true });
    b.gap(style.itemMarginBottom);
  }
  return b.build();
}

function languageListBlock(b: BlockBuilder, ctx: RenderContext, element: LanguageListElement): Block {
  const style = contentStyle(ctx);
  const text = element.items
    .map((item) => renderField(ctx.fieldTemplates.language, item))
    .filter(Boolean)
    .join(', ');
  if (text) b.text({ text, style: REGULAR, fontSize: style.fontSize, lineGap: style.lineGap, markdown: true });
  return b.build();
}

function credentialListBlock(b: BlockBuilder, ctx: RenderContext, items: CredentialData[]): Block {
  const style = contentStyle(ctx);
  for (const item of items) {
    const title = ensureString(item.title || item.name);
    if (!title) continue;
    b.text({ text: title, style: BOLD, fontSize: style.fontSize, markdown: ctx.parseMarkdown }, true);
    const meta = renderField(ctx.fieldTemplates.credential, { title: item.title, name: item.name, awarder: item.awarder, issuer: item.issuer, publisher: item.publisher, date: item.date, releaseDate: item.releaseDate });
    if (meta) b.text({ text: meta, style: ITALIC, fontSize: style.fontSize, color: '#444444', markdown: true });
    for (const paragraph of paragraphsFromContent(ensureString(item.summary))) {
      b.gap(style.paragraphMarginBottom);
      b.text({ text: paragraph, style: REGULAR, fontSize: style.fontSize, align: 'justify', lineGap: style.lineGap, markdown: ctx.parseMarkdown });
    }
    b.gap(style.blockMarginBottom);
  }
  return b.build();
}

function referenceListBlock(b: BlockBuilder, ctx: RenderContext, element: ReferenceListElement): Block {
  const style = contentStyle(ctx);
  const { quote } = ctx.typography;
  for (const ref of element.items) {
    const name = ensureString(ref.name);
    const reference = ensureString(ref.reference);
    if (!name && !reference) continue;
    if (name) {
      b.text({ text: name, style: BOLD, fontSize: style.fontSize, markdown: ctx.parseMarkdown }, true);
      b.gap(style.itemMarginBottom);
    }
    if (reference) b.text({ text: `"${reference}"`, style: ITALIC, fontSize: style.fontSize, x: quote.indent, lineGap: style.lineGap, markdown: ctx.parseMarkdown });
    b.gap(style.blockMarginBottom);
  }
  return b.build();
}

function entryHeaderBlock(b: BlockBuilder, ctx: RenderContext, element: EntryHeaderElement, width: number): Block {
  const { typography, fieldTemplates } = ctx;
  const style = contentStyle(ctx);
  const { entry: entryStyle } = typography;
  const { leftWidth, rightWidth } = calculateEntryColumnWidths(width, entryStyle.date.width);
  const right = width - rightWidth;
  const entry = element.entry as Record<string, unknown>;
  const company = ensureString(entry.name ?? entry.organization ?? entry.institution ?? entry.entity);
  const position = ensureString(entry.position ?? entry.studyType ?? (entry.roles as string[] | undefined)?.[0]);
  const location = ensureString(entry.location);
  const dates = renderField(fieldTemplates.dateRange, { start: element.entry.startDate, end: element.entry.endDate });

  if (element.marginTop !== undefined) b.gap(element.marginTop === 0 ? typography.content.entrySpacing : element.marginTop);

  if (element.variant === 'education') {
    b.row([
      { text: company, style: BOLD, fontSize: style.fontSize, width: leftWidth, markdown: ctx.parseMarkdown },
      ...(dates ? [{ text: dates, style: REGULAR, fontSize: entryStyle.company.fontSize, color: entryStyle.company.color ?? '#666666', x: right, width: rightWidth, align: 'right' as const, markdown: true }] : []),
    ]);
    const degree = renderField(fieldTemplates.degree, { studyType: element.entry.studyType, area: element.entry.area });
    if (degree || element.entry.score) b.gap(typography.entryHeader.lineSpacing);
    if (degree) {
      b.text({ text: degree, style: ITALIC, fontSize: style.fontSize, lineGap: style.lineGap, markdown: true });
      if (element.entry.score) b.gap(typography.entryHeader.lineSpacing);
    }
    if (element.entry.score) b.text({ text: `GPA: ${element.entry.score}`, style: REGULAR, fontSize: style.fontSize, color: entryStyle.location.color ?? '#444444', lineGap: style.lineGap, markdown: false });
  } else {
    b.row([...(company ? [{ text: company, style: BOLD, fontSize: entryStyle.position.fontSize, width: leftWidth, markdown: ctx.parseMarkdown }] : []), ...(location ? [{ text: location, style: BOLD, fontSize: entryStyle.location.fontSize, x: right, width: rightWidth, align: 'right' as const, markdown: false }] : [])]);
    b.gap(typography.entryHeader.lineSpacing);
    b.row([
      { text: position, style: ITALIC, fontSize: entryStyle.position.fontSize, width: leftWidth, markdown: ctx.parseMarkdown },
      ...(dates ? [{ text: dates, style: ITALIC, fontSize: entryStyle.company.fontSize, color: entryStyle.company.color ?? '#444444', x: right, width: rightWidth, align: 'right' as const, markdown: true }] : []),
    ]);
  }
  b.gap(typography.entryHeader.marginBottom);
  return b.build({ keepWithNext: true, unbreakable: true });
}

function structuredContentBlock(b: BlockBuilder, ctx: RenderContext, element: StructuredContentElement): Block {
  const { content } = ctx.typography;
  const style = contentStyle(ctx);
  const indent = element.spacing?.bulletIndent ?? content.bulletIndent;
  const paragraphMargin = element.spacing?.paragraphMarginBottom ?? content.paragraphMarginBottom;
  const bulletGap = element.spacing?.bulletGap ?? content.bulletGap;
  const bulletMargin = element.spacing?.bulletMarginBottom ?? content.bulletMarginBottom;
  const summaries = Array.isArray(element.summary) ? element.summary : element.summary?.split(/\n\n+/).filter(Boolean) || [];
  const bullets = element.bullets ?? [];

  if (summaries.length > 0) b.gap(content.marginTop);
  for (const summary of summaries) {
    b.text({ text: summary, style: REGULAR, fontSize: content.fontSize, align: 'justify', lineGap: style.lineGap, markdown: ctx.parseMarkdown });
    b.gap(paragraphMargin);
  }
  if (summaries.length > 0 && bullets.length > 0) b.gap(bulletGap);
  for (const bullet of bullets) {
    b.text({ text: `• ${bullet}`, style: REGULAR, fontSize: content.fontSize, x: indent, lineGap: style.lineGap, markdown: ctx.parseMarkdown });
    b.gap(bulletMargin);
  }
  return b.build();
}

function templateBlock(b: BlockBuilder, ctx: RenderContext, element: TemplateElement): Block {
  const style = contentStyle(ctx);
  const text = renderField(element.template, element.data);
  if (text) b.text({ text, style: REGULAR, fontSize: style.fontSize, lineGap: style.lineGap, markdown: true });
  return b.build();
}

/**
 * Lays an element out at `width`.
 */
export function buildBlock(ctx: RenderContext, element: LayoutElement, width: number): Block {
  const b = new BlockBuilder(ctx, width);
  switch (element.type) {
    case 'text':
      return textBlock(b, ctx, element);
    case 'section-title':
      return sectionTitleBlock(b, ctx, element);
    case 'header':
      return headerBlock(b, ctx, element);
    case 'divider':
      return dividerBlock(b, element);
    case 'keyword-list':
      return keywordListBlock(b, ctx, element);
    case 'language-list':
      return languageListBlock(b, ctx, element);
    case 'credential-list':
      return credentialListBlock(b, ctx, element.items);
    case 'reference-list':
      return referenceListBlock(b, ctx, element);
    case 'entry-header':
      return entryHeaderBlock(b, ctx, element, width);
    case 'structured-content':
      return structuredContentBlock(b, ctx, element);
    case 'template':
      return templateBlock(b, ctx, element);
    case 'entry-list':
      throw new Error('entry-list elements are expanded into entry headers and content before layout');
  }
}
