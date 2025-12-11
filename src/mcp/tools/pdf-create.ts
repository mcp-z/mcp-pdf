import { getFileUri, type ToolModule, writeFile } from '@mcpeasy/server';
import { type CallToolResult, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { measureTextHeight } from '../../lib/content-measure.ts';
import { registerEmojiFont } from '../../lib/emoji-renderer.ts';
import { hasEmoji, setupFonts, validateTextForFont } from '../../lib/fonts.ts';
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
    x: z.number().optional().describe('X position in points'),
    y: z.number().optional().describe('Y position in points'),
    width: z.number().optional().describe('Image width in points (default: natural width)'),
    height: z.number().optional().describe('Image height in points (default: natural height or aspect-ratio scaled)'),
  }),
  z.object({
    type: z.literal('rect'),
    x: z.number().describe('X position in points'),
    y: z.number().describe('Y position in points'),
    width: z.number().describe('Width in points'),
    height: z.number().describe('Height in points'),
    fillColor: z.string().optional().describe('Fill color (default: no fill)'),
    strokeColor: z.string().optional().describe('Stroke color (default: no stroke)'),
    lineWidth: z.number().optional().describe('Stroke width in points (default: 1)'),
  }),
  z.object({
    type: z.literal('circle'),
    x: z.number().describe('Center X position in points'),
    y: z.number().describe('Center Y position in points'),
    radius: z.number().describe('Radius in points'),
    fillColor: z.string().optional().describe('Fill color (default: no fill)'),
    strokeColor: z.string().optional().describe('Stroke color (default: no stroke)'),
    lineWidth: z.number().optional().describe('Stroke width in points (default: 1)'),
  }),
  z.object({
    type: z.literal('line'),
    x1: z.number().describe('Start X position in points'),
    y1: z.number().describe('Start Y position in points'),
    x2: z.number().describe('End X position in points'),
    y2: z.number().describe('End Y position in points'),
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

    // Position (optional - omit for flow)
    x: z.number().optional().describe('Absolute x position. Omit for flow layout.'),
    y: z.number().optional().describe('Absolute y position. Omit for flow layout.'),

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
    padding: paddingSchema.optional().describe('Inner spacing in points'),
    background: z.string().optional().describe('Background fill color'),
    border: borderSchema.optional().describe('Border with color and width'),

    // Children
    children: z.array(z.union([baseContentItemSchema, groupSchema])).describe('Nested content items'),
  })
);

// Type for group item
interface GroupItem {
  type: 'group';
  x?: number;
  y?: number;
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
    mode: z.enum(['document', 'fixed']).optional().default('document').describe("Layout mode: 'document' = auto page breaks (default), 'fixed' = no auto breaks (flyers/posters)"),
  })
  .optional()
  .describe('Layout configuration for page break behavior');

const inputSchema = z.object({
  filename: z.string().optional().describe('Optional logical filename (metadata only). Storage uses UUID. Defaults to "document.pdf".'),
  title: z.string().optional().describe('Document title metadata'),
  author: z.string().optional().describe('Document author metadata'),
  font: z.string().optional().describe('Font strategy (default: auto). Built-ins: Helvetica, Times-Roman, Courier. Use a path or URL for Unicode.'),
  layout: layoutSchema,
  pageSetup: z
    .object({
      size: z.tuple([z.number(), z.number()]).optional(),
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
  description: 'Create a PDF document with text, images, shapes, and layout control. Supports Unicode + emoji fonts, backgrounds, vector shapes, and flexbox layout via groups.',
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

  async function handler(args: Input): Promise<CallToolResult> {
    const { filename = 'document.pdf', title, author, font, layout, pageSetup, content } = args;
    const _layoutMode = layout?.mode ?? 'document';

    try {
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
      };
      if (pageSetup?.size && pageSetup.size.length >= 2) {
        const [width, height] = pageSetup.size;
        if (width !== undefined && height !== undefined) {
          docOptions.size = [width, height] as [number, number];
        }
      }
      if (pageSetup?.margins) docOptions.margins = pageSetup.margins;
      const doc = new PDFDocument(docOptions);

      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      const pdfPromise = new Promise<Buffer>((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
      });

      if (pageSetup?.backgroundColor) {
        const pageSize: [number, number] = pageSetup?.size && pageSetup.size.length >= 2 ? [pageSetup.size[0] ?? 612, pageSetup.size[1] ?? 792] : [612, 792];
        doc.rect(0, 0, pageSize[0], pageSize[1]).fill(pageSetup.backgroundColor);
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
          const pageSize = pageSetup?.size || [612, 792];
          const x = doc.x;
          const y = doc.y;
          doc.rect(0, 0, pageSize[0], pageSize[1]).fill(pageSetup.backgroundColor);
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
          const fontSize = item.type === 'heading' ? ((item.fontSize as number) ?? 24) : ((item.fontSize as number) ?? 12);
          const fontName = item.type === 'heading' ? (item.bold !== false ? boldFont : regularFont) : item.bold ? boldFont : regularFont;
          return measureTextHeight(doc, item.text as string, fontSize, fontName, emojiAvailable, {
            width: availableWidth,
            indent: item.indent as number | undefined,
            lineGap: item.lineGap as number | undefined,
          });
        }
        if (item.type === 'image') {
          return (item.height as number) ?? 100;
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
            const fontSize = item.fontSize ?? 12;
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
            if (item.moveDown !== undefined) doc.moveDown(item.moveDown);
            break;
          }
          case 'heading': {
            const fontSize = item.fontSize ?? 24;
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
            if (item.moveDown !== undefined) doc.moveDown(item.moveDown);
            break;
          }
          case 'image': {
            const opts: Record<string, unknown> = {};
            if (item.width !== undefined) opts.width = item.width;
            if (item.height !== undefined) opts.height = item.height;

            const imgX = computedX ?? item.x;
            const imgY = computedY ?? item.y;

            if (imgX !== undefined && imgY !== undefined) {
              doc.image(item.imagePath, imgX, imgY, opts);
            } else {
              doc.image(item.imagePath, opts);
            }
            break;
          }
          case 'rect': {
            const rectX = computedX ?? item.x;
            const rectY = computedY ?? item.y;
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
            const circleX = computedX ?? item.x;
            const circleY = computedY ?? item.y;

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

      // Calculate layout using Yoga
      const layoutNodes = await calculateLayout(layoutContent, pageWidth, pageHeight, measureHeight, margins);

      // Check for content overflow in fixed layout mode
      if (_layoutMode === 'fixed') {
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

      // Render all content using computed layout
      for (const layoutNode of layoutNodes) {
        renderLayoutNode(layoutNode);
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
