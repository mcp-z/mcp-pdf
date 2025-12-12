import { getFileUri, type ToolModule, writeFile } from '@mcpeasy/server';
import { type CallToolResult, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { DEFAULT_HEADING_FONT_SIZE, DEFAULT_PAGE_SIZE, DEFAULT_TEXT_FONT_SIZE, PAGE_SIZES, type PageSizePreset } from '../../constants.ts';
import { createWidthMeasurer, measureTextHeight } from '../../lib/content-measure.ts';
import { registerEmojiFont } from '../../lib/emoji-renderer.ts';
import { hasEmoji, setupFonts, validateTextForFont } from '../../lib/fonts.ts';
import { resolveImageDimensions } from '../../lib/image-dimensions.ts';
import { type PDFTextOptions, renderTextWithEmoji } from '../../lib/pdf-helpers.ts';
import { calculateLayout, type LayoutContent, type LayoutNode } from '../../lib/yoga-layout.ts';
import type { ToolOptions } from '../../types.ts';

// Padding schema - number or object
const paddingSchema = z.union([
  z.number(),
  z.object({
    top: z.number().optional(),
    right: z.number().optional(),
    bottom: z.number().optional(),
    left: z.number().optional(),
  }),
]);

// Size schema - number or percentage string
const sizeSchema = z.union([z.number(), z.string().regex(/^\d+(\.\d+)?%$/)]);

// Border schema
const borderSchema = z.object({
  color: z.string(),
  width: z.number(),
});

// Text base properties (shared between text and heading)
// NOTE: Text items flow within parent groups - no x/y positioning.
// Use groups for absolute positioning.
const textBaseSchema = z.object({
  text: z.string().optional().describe('Text content to render'),
  fontSize: z.number().optional().describe('Font size in points (default: 12 for text, 24 for heading)'),
  bold: z.boolean().optional().describe('Use bold font weight (default: false for text, true for heading)'),
  color: z.string().optional().describe('Text color as hex (e.g., "#333333") or named color (default: black)'),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional().describe('Text alignment (default: left)'),
  indent: z.number().optional().describe('First line indent in points (default: 0)'),
  lineGap: z.number().optional().describe('Extra spacing between lines in points (default: 0)'),
  paragraphGap: z.number().optional().describe('Extra spacing after paragraph in points (default: 0)'),
  width: z.number().optional().describe('Text width constraint in points (default: available width)'),
  moveDown: z.number().optional().describe('Move cursor down by N lines after rendering (default: 0)'),
  underline: z.boolean().optional().describe('Underline text (default: false)'),
  strike: z.boolean().optional().describe('Strikethrough text (default: false)'),
  oblique: z.union([z.boolean(), z.number()]).optional().describe('Italic/oblique text - true or angle in degrees (default: false)'),
  link: z.string().optional().describe('URL to link text to'),
  characterSpacing: z.number().optional().describe('Extra spacing between characters in points (default: 0)'),
  wordSpacing: z.number().optional().describe('Extra spacing between words in points (default: 0)'),
  continued: z.boolean().optional().describe('Continue text on same line (default: false)'),
  lineBreak: z.boolean().optional().describe('Allow line breaks (default: true)'),
});

// Base content items (without group to avoid circular reference)
const baseContentItemSchema = z.union([
  textBaseSchema.extend({ type: z.literal('text') }),
  textBaseSchema.extend({ type: z.literal('heading') }),
  z.object({
    type: z.literal('image'),
    imagePath: z.string().describe('Path to image file'),
    position: z.enum(['relative', 'absolute']).optional().default('absolute').describe('Positioning mode (default: "absolute"). "absolute": left/top are exact page coordinates. "relative": left/top offset from document flow position.'),
    page: z.number().int().min(1).optional().describe('Target page for absolute-positioned items (default: 1). Pages are created as needed. Ignored for relative items.'),
    left: z.number().optional().describe('Horizontal position in points (CSS-style). Exact position when position="absolute", offset when position="relative".'),
    top: z.number().optional().describe('Vertical position in points (CSS-style). Exact position when position="absolute", offset when position="relative".'),
    width: z.number().optional().describe('Image width in points (default: natural width)'),
    height: z.number().optional().describe('Image height in points (default: natural height or aspect-ratio scaled)'),
  }),
  z.object({
    type: z.literal('rect'),
    position: z.enum(['relative', 'absolute']).optional().default('absolute').describe('Positioning mode (default: "absolute"). "absolute": left/top are exact page coordinates. "relative": left/top offset from document flow position.'),
    page: z.number().int().min(1).optional().describe('Target page for absolute-positioned items (default: 1). Pages are created as needed. Ignored for relative items.'),
    left: z.number().describe('Horizontal position in points (CSS-style). Exact position when position="absolute", offset when position="relative".'),
    top: z.number().describe('Vertical position in points (CSS-style). Exact position when position="absolute", offset when position="relative".'),
    width: z.number().describe('Width in points'),
    height: z.number().describe('Height in points'),
    fillColor: z.string().optional().describe('Fill color (default: no fill)'),
    strokeColor: z.string().optional().describe('Stroke color (default: no stroke)'),
    lineWidth: z.number().optional().describe('Stroke width in points (default: 1)'),
  }),
  z.object({
    type: z.literal('circle'),
    position: z.enum(['relative', 'absolute']).optional().default('absolute').describe('Positioning mode (default: "absolute"). "absolute": left/top are exact page coordinates for center. "relative": left/top offset from document flow position.'),
    page: z.number().int().min(1).optional().describe('Target page for absolute-positioned items (default: 1). Pages are created as needed. Ignored for relative items.'),
    left: z.number().describe('Center horizontal position in points (CSS-style). Exact position when position="absolute", offset when position="relative".'),
    top: z.number().describe('Center vertical position in points (CSS-style). Exact position when position="absolute", offset when position="relative".'),
    radius: z.number().describe('Radius in points'),
    fillColor: z.string().optional().describe('Fill color (default: no fill)'),
    strokeColor: z.string().optional().describe('Stroke color (default: no stroke)'),
    lineWidth: z.number().optional().describe('Stroke width in points (default: 1)'),
  }),
  z.object({
    type: z.literal('line'),
    position: z.enum(['relative', 'absolute']).optional().default('absolute').describe('Positioning mode (default: "absolute"). "absolute": coordinates are exact page positions. "relative": coordinates offset from document flow position.'),
    page: z.number().int().min(1).optional().describe('Target page for absolute-positioned items (default: 1). Pages are created as needed. Ignored for relative items.'),
    x1: z.number().describe('Start X coordinate in points'),
    y1: z.number().describe('Start Y coordinate in points'),
    x2: z.number().describe('End X coordinate in points'),
    y2: z.number().describe('End Y coordinate in points'),
    strokeColor: z.string().optional().describe('Line color (default: black)'),
    lineWidth: z.number().optional().describe('Line width in points (default: 1)'),
  }),
  z.object({ type: z.literal('pageBreak') }).describe('Force page break'),
]);

// Type for base content item
type BaseContentItem = z.infer<typeof baseContentItemSchema>;

// Group schema - flexbox container with children
// Using z.lazy for recursive type
const groupSchema: z.ZodType<GroupItem> = z.lazy(() =>
  z.object({
    type: z.literal('group'),

    // Positioning (CSS-style)
    position: z.enum(['relative', 'absolute']).optional().default('relative').describe('Positioning mode (default: "relative"). "relative": group flows in document order after previous content. "absolute": group placed at exact page coordinates (use this for fixed layouts like dashboards).'),
    page: z.number().int().min(1).optional().describe('Target page for absolute-positioned groups (default: 1). Pages are created as needed. Ignored for relative groups.'),
    left: z.number().optional().describe('Horizontal position in points (CSS-style). Required when position="absolute". When position="relative": optional offset from flow position.'),
    top: z.number().optional().describe('Vertical position in points (CSS-style). Required when position="absolute". When position="relative": optional offset from flow position.'),

    // Size
    width: sizeSchema.optional().describe('Width in points or percentage (e.g., "50%")'),
    height: sizeSchema.optional().describe('Height in points or percentage (e.g., "50%")'),

    // Flexbox layout
    direction: z.enum(['column', 'row']).optional().default('column').describe('Flex direction: column (default) or row'),
    gap: z.number().optional().describe('Gap between children in points'),
    flex: z.number().optional().describe('Flex grow factor (1 = equal share of remaining space)'),
    justify: z.enum(['start', 'center', 'end', 'space-between', 'space-around']).optional().describe('Main axis alignment'),
    alignItems: z.enum(['start', 'center', 'end', 'stretch']).optional().describe('Cross axis alignment for children'),

    // Self-positioning
    align: z.enum(['start', 'center', 'end']).optional().describe('Self alignment within parent. Use align: "center" to center this group.'),

    // Visual
    padding: paddingSchema.optional().describe('Inner spacing between group border and content (CSS box model). NOT for positioning - use position="absolute" with left/top to place group at specific page coordinates.'),
    background: z.string().optional().describe('Background fill color'),
    border: borderSchema.optional().describe('Border with color and width'),

    // Children
    children: z.array(z.union([baseContentItemSchema, groupSchema])).describe('Nested content items'),
  })
);

// Type for group item
interface GroupItem {
  type: 'group';
  position?: 'relative' | 'absolute';
  page?: number;
  left?: number;
  top?: number;
  width?: number | string;
  height?: number | string;
  direction?: 'column' | 'row';
  gap?: number;
  flex?: number;
  justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around';
  alignItems?: 'start' | 'center' | 'end' | 'stretch';
  align?: 'start' | 'center' | 'end';
  padding?: number | { top?: number; right?: number; bottom?: number; left?: number };
  background?: string;
  border?: { color: string; width: number };
  children: ContentItem[];
}

// Full content item schema including groups
const contentItemSchema = z.union([baseContentItemSchema, groupSchema]);

// Content item type
type ContentItem = BaseContentItem | GroupItem;

// Layout configuration schema
const layoutSchema = z
  .object({
    overflow: z.enum(['auto', 'warn']).optional().default('auto').describe("Overflow behavior: 'auto' = normal pagination (default), 'warn' = log warning if content exceeds final page"),
  })
  .optional()
  .describe('Layout configuration for overflow handling');

const inputSchema = z.object({
  filename: z.string().optional().describe('Optional logical filename (metadata only). Storage uses UUID. Defaults to "document.pdf".'),
  title: z.string().optional().describe('Document title metadata'),
  author: z.string().optional().describe('Document author metadata'),
  font: z.string().optional().describe('Font strategy (default: auto). Built-ins: Helvetica, Times-Roman, Courier. Use a path or URL for Unicode.'),
  layout: layoutSchema,
  pageSetup: z
    .object({
      size: z
        .union([z.enum(['LETTER', 'A4', 'LEGAL']), z.tuple([z.number(), z.number()])])
        .optional()
        .describe('Page size preset ("LETTER", "A4", "LEGAL") or custom [width, height] in points'),
      margins: z
        .object({
          top: z.number(),
          bottom: z.number(),
          left: z.number(),
          right: z.number(),
        })
        .optional(),
      backgroundColor: z.string().optional(),
    })
    .optional(),
  content: z.array(contentItemSchema),
});

const outputSchema = z.object({
  operationSummary: z.string(),
  itemsProcessed: z.number(),
  itemsChanged: z.number(),
  completedAt: z.string(),
  documentId: z.string(),
  filename: z.string(),
  uri: z.string(),
  sizeBytes: z.number(),
  pageCount: z.number().optional(),
  warnings: z.array(z.string()).optional(),
});

const config = {
  title: 'Create PDF',
  description: `Create a PDF document with text, images, shapes, and layout control. Supports Unicode + emoji fonts, backgrounds, vector shapes, and flexbox layout via groups.

Positioning determines pagination:
- position="relative" (default): Content flows in document order, auto-paginates
- position="absolute": Content placed at exact coordinates on specified page

Multi-page layouts: Use the "page" property on absolute items to target specific pages (e.g., page: 2). Pages are created as needed. Perfect for slide decks and dashboards.`,
  inputSchema,
  outputSchema: z.object({
    result: outputSchema,
  }),
} as const;

export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;

export default function createTool(toolOptions: ToolOptions) {
  const { serverConfig } = toolOptions;
  const { transport } = serverConfig;

  // Validate configuration at startup - fail fast if HTTP/WS transport without baseUrl or port
  if (transport && transport.type === 'http') {
    if (!serverConfig?.baseUrl && !transport.port) {
      throw new Error('pdf-create: HTTP/WS transport requires either baseUrl in server config or port in transport config. This is a server configuration error - please provide --base-url or --port.');
    }
  }

  // Helper function to extract PDF text options from content items
  function extractTextOptions(item: Extract<BaseContentItem, { type: 'text' | 'heading' }>): PDFTextOptions {
    const options: PDFTextOptions = {};
    // NOTE: Text items no longer have x/y - they flow within parent groups
    if (item.textAlign !== undefined) options.align = item.textAlign;
    if (item.indent !== undefined) options.indent = item.indent;
    if (item.lineGap !== undefined) options.lineGap = item.lineGap;
    if (item.paragraphGap !== undefined) options.paragraphGap = item.paragraphGap;
    if (item.width !== undefined) options.width = item.width;
    if (item.underline !== undefined) options.underline = item.underline;
    if (item.strike !== undefined) options.strike = item.strike;
    if (item.oblique !== undefined) options.oblique = item.oblique;
    if (item.link !== undefined) options.link = item.link;
    if (item.characterSpacing !== undefined) options.characterSpacing = item.characterSpacing;
    if (item.wordSpacing !== undefined) options.wordSpacing = item.wordSpacing;
    if (item.continued !== undefined) options.continued = item.continued;
    if (item.lineBreak !== undefined) options.lineBreak = item.lineBreak;
    return options;
  }

  /**
   * Resolve page size from preset name or custom dimensions.
   */
  function resolvePageSize(size: PageSizePreset | [number, number] | undefined): { width: number; height: number } {
    if (!size) return DEFAULT_PAGE_SIZE;
    if (typeof size === 'string') {
      return PAGE_SIZES[size];
    }
    return { width: size[0], height: size[1] };
  }

  async function handler(args: Input): Promise<CallToolResult> {
    const { filename = 'document.pdf', title, author, font, layout, pageSetup, content } = args;
    const overflowBehavior = layout?.overflow ?? 'auto';

    try {
      // Resolve page size from preset or custom dimensions
      const pageSize = resolvePageSize(pageSetup?.size as PageSizePreset | [number, number] | undefined);

      interface PDFDocOptions {
        info: {
          Title?: string;
          Author?: string;
          Subject?: string;
        };
        size?: [number, number];
        margins?: {
          top: number;
          bottom: number;
          left: number;
          right: number;
        };
      }

      const docOptions: PDFDocOptions = {
        info: {
          ...(title && { Title: title }),
          ...(author && { Author: author }),
          ...(filename && { Subject: filename }),
        },
        size: [pageSize.width, pageSize.height],
      };
      if (pageSetup?.margins) docOptions.margins = pageSetup.margins;
      const doc = new PDFDocument(docOptions);

      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      const pdfPromise = new Promise<Buffer>((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
      });

      if (pageSetup?.backgroundColor) {
        doc.rect(0, 0, pageSize.width, pageSize.height).fill(pageSetup.backgroundColor);
        doc.fillColor('black'); // Reset fill color after background
      }

      const contentText = JSON.stringify(content);
      const containsEmoji = hasEmoji(contentText);
      const emojiAvailable = containsEmoji ? registerEmojiFont() : false;
      const fonts = await setupFonts(doc, font);
      const { regular: regularFont, bold: boldFont } = fonts;

      const warnings: string[] = [];

      // Validate text characters
      const validateContent = (items: ContentItem[]) => {
        for (const item of items) {
          if ((item.type === 'text' || item.type === 'heading') && item.text) {
            const fnt = item.bold ? boldFont : regularFont;
            const validation = validateTextForFont(item.text, fnt);
            if (validation.hasUnsupportedCharacters) warnings.push(...validation.warnings);
          }
          if (item.type === 'group' && item.children) {
            validateContent(item.children);
          }
        }
      };
      validateContent(content as ContentItem[]);

      // Track actual page count
      let actualPageCount = 1;
      const drawBackgroundOnPage = () => {
        actualPageCount++;
        if (pageSetup?.backgroundColor) {
          const x = doc.x;
          const y = doc.y;
          doc.rect(0, 0, pageSize.width, pageSize.height).fill(pageSetup.backgroundColor);
          doc.fillColor('black'); // Reset fill color after background
          doc.x = x;
          doc.y = y;
        }
      };
      doc.on('pageAdded', drawBackgroundOnPage);

      // Get page dimensions and margins
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margins = {
        top: doc.page.margins.top,
        right: doc.page.margins.right,
        bottom: doc.page.margins.bottom,
        left: doc.page.margins.left,
      };

      // Height measurer for Yoga layout
      const measureHeight = (item: LayoutContent, availableWidth: number): number => {
        if (item.type === 'text' || item.type === 'heading') {
          if (!item.text) return 0;
          const fontSize = item.type === 'heading' ? ((item.fontSize as number) ?? DEFAULT_HEADING_FONT_SIZE) : ((item.fontSize as number) ?? DEFAULT_TEXT_FONT_SIZE);
          const fontName = item.type === 'heading' ? (item.bold !== false ? boldFont : regularFont) : item.bold ? boldFont : regularFont;
          let height = measureTextHeight(doc, item.text as string, fontSize, fontName, emojiAvailable, {
            width: availableWidth,
            indent: item.indent as number | undefined,
            lineGap: item.lineGap as number | undefined,
          });
          // Add moveDown spacing to measured height (PDFKit's moveDown uses current line height)
          const moveDown = item.moveDown as number | undefined;
          if (moveDown !== undefined && moveDown > 0) {
            doc.fontSize(fontSize).font(fontName);
            height += moveDown * doc.currentLineHeight();
          }
          return height;
        }
        if (item.type === 'image') {
          const dimensions = resolveImageDimensions(item.imagePath as string, item.width as number | undefined, item.height as number | undefined);
          return dimensions.height;
        }
        if (item.type === 'rect') {
          return item.height as number;
        }
        if (item.type === 'circle') {
          return (item.radius as number) * 2;
        }
        if (item.type === 'line') {
          return Math.abs((item.y2 as number) - (item.y1 as number));
        }
        return 0;
      };

      // Render a base content item at computed position
      function renderBaseItem(item: BaseContentItem, computedX?: number, computedY?: number, computedWidth?: number) {
        switch (item.type) {
          case 'text': {
            const fontSize = item.fontSize ?? DEFAULT_TEXT_FONT_SIZE;
            const fnt = item.bold ? boldFont : regularFont;
            if (item.color) doc.fillColor(item.color);

            const options = extractTextOptions(item);

            // Use computed position from Yoga layout - pass in options so renderTextWithEmoji
            // uses the 3-arg form of doc.text() which prevents auto-pagination
            if (computedX !== undefined) options.x = computedX;
            if (computedY !== undefined) options.y = computedY;
            if (computedWidth !== undefined) options.width = computedWidth;

            renderTextWithEmoji(doc, item.text ?? '', fontSize, fnt, emojiAvailable, options);
            if (item.color) doc.fillColor('black');
            break;
          }
          case 'heading': {
            const fontSize = item.fontSize ?? DEFAULT_HEADING_FONT_SIZE;
            const fnt = item.bold !== false ? boldFont : regularFont;
            if (item.color) doc.fillColor(item.color);

            const options = extractTextOptions(item);

            // Use computed position from Yoga layout - pass in options so renderTextWithEmoji
            // uses the 3-arg form of doc.text() which prevents auto-pagination
            if (computedX !== undefined) options.x = computedX;
            if (computedY !== undefined) options.y = computedY;
            if (computedWidth !== undefined) options.width = computedWidth;

            renderTextWithEmoji(doc, item.text ?? '', fontSize, fnt, emojiAvailable, options);
            if (item.color) doc.fillColor('black');
            break;
          }
          case 'image': {
            // Resolve dimensions consistently with measurement
            const dimensions = resolveImageDimensions(item.imagePath, item.width as number | undefined, item.height as number | undefined);
            const opts = { width: dimensions.width, height: dimensions.height };

            const imgX = computedX ?? item.left;
            const imgY = computedY ?? item.top;

            if (imgX !== undefined && imgY !== undefined) {
              doc.image(item.imagePath, imgX, imgY, opts);
            } else {
              doc.image(item.imagePath, opts);
            }
            break;
          }
          case 'rect': {
            const rectX = computedX ?? item.left;
            const rectY = computedY ?? item.top;
            const rectWidth = computedWidth ?? item.width;

            doc.rect(rectX, rectY, rectWidth, item.height);
            if (item.fillColor && item.strokeColor) {
              if (item.lineWidth) doc.lineWidth(item.lineWidth);
              doc.fillAndStroke(item.fillColor, item.strokeColor);
            } else if (item.fillColor) {
              doc.fill(item.fillColor);
            } else if (item.strokeColor) {
              if (item.lineWidth) doc.lineWidth(item.lineWidth);
              doc.stroke(item.strokeColor);
            }
            doc.fillColor('black');
            break;
          }
          case 'circle': {
            const circleX = computedX ?? item.left;
            const circleY = computedY ?? item.top;

            doc.circle(circleX, circleY, item.radius);
            if (item.fillColor && item.strokeColor) {
              if (item.lineWidth) doc.lineWidth(item.lineWidth);
              doc.fillAndStroke(item.fillColor, item.strokeColor);
            } else if (item.fillColor) {
              doc.fill(item.fillColor);
            } else if (item.strokeColor) {
              if (item.lineWidth) doc.lineWidth(item.lineWidth);
              doc.stroke(item.strokeColor);
            }
            doc.fillColor('black');
            break;
          }
          case 'line': {
            if (item.lineWidth) doc.lineWidth(item.lineWidth);
            doc
              .moveTo(item.x1, item.y1)
              .lineTo(item.x2, item.y2)
              .stroke(item.strokeColor || 'black');
            break;
          }
          case 'pageBreak': {
            doc.addPage();
            break;
          }
        }
      }

      // Render a group with its visual properties
      function renderGroupVisuals(group: GroupItem, layoutNode: LayoutNode) {
        // Draw background
        if (group.background) {
          doc.rect(layoutNode.x, layoutNode.y, layoutNode.width, layoutNode.height).fill(group.background);
          doc.fillColor('black');
        }

        // Draw border
        if (group.border) {
          doc.lineWidth(group.border.width);
          doc.rect(layoutNode.x, layoutNode.y, layoutNode.width, layoutNode.height).stroke(group.border.color);
        }
      }

      // Render a layout node tree
      function renderLayoutNode(node: LayoutNode) {
        const item = node.content as ContentItem;

        if (item.type === 'group') {
          const group = item as GroupItem;

          // Render group visuals (background, border)
          renderGroupVisuals(group, node);

          // Render children
          if (node.children) {
            for (const childNode of node.children) {
              renderLayoutNode(childNode);
            }
          }
        } else {
          // Render base content item at computed position
          renderBaseItem(item as BaseContentItem, node.x, node.y, node.width);
        }
      }

      // Convert content to LayoutContent for Yoga
      const layoutContent: LayoutContent[] = content.map((item) => item as unknown as LayoutContent);

      // Width measurer for row layouts with space-between
      const measureWidth = createWidthMeasurer(doc, regularFont, boldFont, emojiAvailable);

      // Calculate layout using Yoga
      const layoutNodes = await calculateLayout(layoutContent, pageWidth, pageHeight, measureHeight, margins, measureWidth);

      // Check for content overflow when warn mode is enabled
      if (overflowBehavior === 'warn') {
        const getMaxBottom = (node: LayoutNode): number => {
          let maxBottom = node.y + node.height;
          if (node.children) {
            for (const child of node.children) {
              maxBottom = Math.max(maxBottom, getMaxBottom(child));
            }
          }
          return maxBottom;
        };

        for (const node of layoutNodes) {
          const bottom = getMaxBottom(node);
          if (bottom > pageHeight) {
            warnings.push(`Content exceeds page height by ${Math.ceil(bottom - pageHeight)}px. Consider reducing font sizes or removing content.`);
            break;
          }
        }
      }

      // Helper to check if item has position property
      function isPositioned(item: ContentItem): boolean {
        return 'position' in item && item.position === 'absolute';
      }

      // Helper to get page number for an item (only meaningful for absolute items)
      function getItemPage(item: ContentItem): number {
        if (!isPositioned(item)) return 1; // Relative items render on page 1
        if ('page' in item && typeof item.page === 'number') return item.page;
        return 1; // Default page for absolute items
      }

      // Separate absolute and relative items
      const absoluteNodes = layoutNodes.filter((node) => {
        const item = node.content as ContentItem;
        return isPositioned(item);
      });
      const relativeNodes = layoutNodes.filter((node) => {
        const item = node.content as ContentItem;
        return !isPositioned(item);
      });

      // Determine max page needed from absolute items
      const maxPage = absoluteNodes.length > 0 ? Math.max(...absoluteNodes.map((node) => getItemPage(node.content as ContentItem))) : 1;

      // Render content page by page
      for (let pageNum = 1; pageNum <= maxPage; pageNum++) {
        if (pageNum > 1) {
          doc.addPage();
          // Background is drawn via pageAdded event handler
        }

        // Render absolute items for this page
        for (const node of absoluteNodes) {
          const item = node.content as ContentItem;
          if (getItemPage(item) === pageNum) {
            renderLayoutNode(node);
          }
        }

        // Render relative items on page 1 (they flow after absolute items)
        if (pageNum === 1) {
          for (const node of relativeNodes) {
            renderLayoutNode(node);
          }
        }
      }

      doc.end();
      const pdfBuffer = await pdfPromise;

      // Write file with ID prefix
      const { storedName } = await writeFile(pdfBuffer, filename, { storageDir: serverConfig.storageDir });

      // Generate URI based on transport type
      const fileUri = getFileUri(storedName, transport, {
        storageDir: serverConfig.storageDir,
        ...(serverConfig.baseUrl && { baseUrl: serverConfig.baseUrl }),
        endpoint: '/files',
      });

      const result: Output = {
        operationSummary: `Created PDF: ${filename}`,
        itemsProcessed: 1,
        itemsChanged: 1,
        completedAt: new Date().toISOString(),
        documentId: storedName,
        filename,
        uri: fileUri,
        sizeBytes: pdfBuffer.length,
        pageCount: actualPageCount,
        ...(warnings.length > 0 && { warnings }),
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result),
          },
        ],
        structuredContent: { result },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      throw new McpError(ErrorCode.InternalError, `Error creating PDF: ${message}`, {
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  return {
    name: 'pdf-create',
    config,
    handler,
  } satisfies ToolModule;
}
