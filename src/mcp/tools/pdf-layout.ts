/**
 * pdf-layout tool - Fixed/absolute positioning layouts using Yoga flexbox.
 *
 * Best for: Dashboards, slides, certificates, flyers, and any design with precise positioning.
 * Uses Yoga layout engine for flexbox-based positioning within containers.
 *
 * All items are absolutely positioned on specific pages. Use the "page" property to target
 * different pages (e.g., page: 2 for slide decks). Pages are created as needed.
 *
 * Default margins: 0 (full canvas access for precise positioning)
 */

import { getFileUri, type ToolModule, writeFile } from '@mcpeasy/server';
import { type CallToolResult, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { DEFAULT_HEADING_FONT_SIZE, DEFAULT_TEXT_FONT_SIZE, type PageSizePreset } from '../../constants.ts';
import { createWidthMeasurer, measureTextHeight } from '../../lib/content-measure.ts';
import { resolveImageDimensions } from '../../lib/image-dimensions.ts';
import { createPDFDocument, extractTextOptions, type PDFOutput, pdfOutputSchema, textBaseSchema, validateContentText } from '../../lib/pdf-core.ts';
import { renderTextWithEmoji } from '../../lib/pdf-helpers.ts';
import { calculateLayout, type LayoutContent, type LayoutNode } from '../../lib/yoga-layout.ts';
import type { ToolOptions } from '../../types.ts';

// ============================================================================
// Schemas
// ============================================================================

// Size schema - number or percentage string
const sizeSchema = z.union([z.number(), z.string().regex(/^\d+(\.\d+)?%$/)]);

// Border schema
const borderSchema = z.object({
  color: z.string(),
  width: z.number(),
});

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

// Positioned text schema (extends text base with position properties)
const positionedTextSchema = textBaseSchema.extend({
  page: z.number().int().min(1).optional().describe('Target page (default: 1). Pages are created as needed.'),
  left: z.number().optional().describe('Horizontal position in points from page left edge.'),
  top: z.number().optional().describe('Vertical position in points from page top edge.'),
});

// Base content items (without group to avoid circular reference)
const baseContentItemSchema = z.union([
  positionedTextSchema.extend({ type: z.literal('text') }),
  positionedTextSchema.extend({ type: z.literal('heading') }),
  z.object({
    type: z.literal('image'),
    imagePath: z.string().describe('Path to image file'),
    page: z.number().int().min(1).optional().describe('Target page (default: 1). Pages are created as needed.'),
    left: z.number().optional().describe('Horizontal position in points from page left edge.'),
    top: z.number().optional().describe('Vertical position in points from page top edge.'),
    width: z.number().optional().describe('Image width in points (default: natural width)'),
    height: z.number().optional().describe('Image height in points (default: natural height or aspect-ratio scaled)'),
  }),
  z.object({
    type: z.literal('rect'),
    page: z.number().int().min(1).optional().describe('Target page (default: 1). Pages are created as needed.'),
    left: z.number().describe('Horizontal position in points from page left edge.'),
    top: z.number().describe('Vertical position in points from page top edge.'),
    width: z.number().describe('Width in points'),
    height: z.number().describe('Height in points'),
    fillColor: z.string().optional().describe('Fill color (default: no fill)'),
    strokeColor: z.string().optional().describe('Stroke color (default: no stroke)'),
    lineWidth: z.number().optional().describe('Stroke width in points (default: 1)'),
  }),
  z.object({
    type: z.literal('circle'),
    page: z.number().int().min(1).optional().describe('Target page (default: 1). Pages are created as needed.'),
    left: z.number().describe('Center horizontal position in points from page left edge.'),
    top: z.number().describe('Center vertical position in points from page top edge.'),
    radius: z.number().describe('Radius in points'),
    fillColor: z.string().optional().describe('Fill color (default: no fill)'),
    strokeColor: z.string().optional().describe('Stroke color (default: no stroke)'),
    lineWidth: z.number().optional().describe('Stroke width in points (default: 1)'),
  }),
  z.object({
    type: z.literal('line'),
    page: z.number().int().min(1).optional().describe('Target page (default: 1). Pages are created as needed.'),
    x1: z.number().describe('Start X coordinate in points'),
    y1: z.number().describe('Start Y coordinate in points'),
    x2: z.number().describe('End X coordinate in points'),
    y2: z.number().describe('End Y coordinate in points'),
    strokeColor: z.string().optional().describe('Line color (default: black)'),
    lineWidth: z.number().optional().describe('Line width in points (default: 1)'),
  }),
]);

// Type for base content item
type BaseContentItem = z.infer<typeof baseContentItemSchema>;

// Group schema - flexbox container with children
// Using z.lazy for recursive type
const groupSchema: z.ZodType<GroupItem> = z.lazy(() =>
  z.object({
    type: z.literal('group'),

    // Positioning
    page: z.number().int().min(1).optional().describe('Target page (default: 1). Pages are created as needed.'),
    left: z.number().optional().describe('Horizontal position in points from page left edge.'),
    top: z.number().optional().describe('Vertical position in points from page top edge.'),

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
    padding: paddingSchema.optional().describe('Inner spacing between group border and content.'),
    background: z.string().optional().describe('Background fill color'),
    border: borderSchema.optional().describe('Border with color and width'),

    // Children
    children: z.array(z.union([baseContentItemSchema, groupSchema])).describe('Nested content items'),
  })
);

// Type for group item
interface GroupItem {
  type: 'group';
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
    overflow: z.enum(['auto', 'warn']).optional().default('auto').describe("Overflow behavior: 'auto' = normal (default), 'warn' = log warning if content exceeds page bounds"),
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
        .describe('Page size preset or custom [width, height] in points. LETTER: 612×792pt (8.5×11in). A4: 595×842pt (210×297mm). LEGAL: 612×1008pt (8.5×14in). Default: LETTER.'),
      margins: z
        .object({
          top: z.number(),
          bottom: z.number(),
          left: z.number(),
          right: z.number(),
        })
        .optional()
        .describe('Page margins in points (default: 0 on all sides for full canvas access).'),
      backgroundColor: z.string().optional().describe('Page background color (hex like "#000000" or named color). Default: white.'),
    })
    .optional()
    .describe('Page configuration including size, margins, and background color.'),
  content: z.array(contentItemSchema),
});

const config = {
  title: 'Create PDF Layout',
  description: `Create a PDF with precise positioning using Yoga flexbox layout.

Best for: Dashboards, slides, certificates, flyers, and designs requiring exact placement.

All items are positioned absolutely on specific pages. Use the "page" property to target different pages (e.g., page: 2 for multi-slide presentations). Pages are created as needed.

Use groups for flexbox containers - they support direction, gap, justify, alignItems, and alignment properties for sophisticated layouts.

Default margins: 0 (full canvas access for precise positioning).`,
  inputSchema,
  outputSchema: z.object({
    result: pdfOutputSchema,
  }),
} as const;

export type Input = z.infer<typeof inputSchema>;
export type Output = PDFOutput;

export default function createTool(toolOptions: ToolOptions) {
  const { serverConfig } = toolOptions;
  const { transport } = serverConfig;

  // Validate configuration at startup
  if (transport && transport.type === 'http') {
    if (!serverConfig?.baseUrl && !transport.port) {
      throw new Error('pdf-layout: HTTP/WS transport requires either baseUrl in server config or port in transport config.');
    }
  }

  async function handler(args: Input): Promise<CallToolResult> {
    const { filename = 'document.pdf', title, author, font, layout, pageSetup, content } = args;
    const overflowBehavior = layout?.overflow ?? 'auto';

    try {
      // Create PDF document with shared utilities
      const contentText = JSON.stringify(content);
      const setup = await createPDFDocument(
        {
          title,
          author,
          subject: filename,
          pageSize: pageSetup?.size as PageSizePreset | [number, number] | undefined,
          margins: pageSetup?.margins,
          backgroundColor: pageSetup?.backgroundColor,
        },
        font,
        contentText
      );

      const { doc, pdfPromise, fonts, emojiAvailable, warnings } = setup;
      const { regular: regularFont, bold: boldFont } = fonts;

      // Validate text content against font
      validateContentText(content as ContentItem[], regularFont, boldFont, warnings);

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
            if (computedX !== undefined) options.x = computedX;
            if (computedY !== undefined) options.y = computedY;
            if (computedWidth !== undefined) options.width = computedWidth;

            renderTextWithEmoji(doc, item.text ?? '', fontSize, fnt, emojiAvailable, options);
            if (item.color) doc.fillColor('black');
            break;
          }
          case 'image': {
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
        }
      }

      // Render a group with its visual properties
      function renderGroupVisuals(group: GroupItem, layoutNode: LayoutNode) {
        if (group.background) {
          doc.rect(layoutNode.x, layoutNode.y, layoutNode.width, layoutNode.height).fill(group.background);
          doc.fillColor('black');
        }

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
          renderGroupVisuals(group, node);

          if (node.children) {
            for (const childNode of node.children) {
              renderLayoutNode(childNode);
            }
          }
        } else {
          renderBaseItem(item as BaseContentItem, node.x, node.y, node.width);
        }
      }

      // Helper to get page number for an item
      function getItemPage(item: ContentItem): number {
        if ('page' in item && typeof item.page === 'number') return item.page;
        return 1;
      }

      // Group content by page number
      function groupContentByPage(items: ContentItem[]): Map<number, ContentItem[]> {
        const pageGroups = new Map<number, ContentItem[]>();
        for (const item of items) {
          const pageNum = getItemPage(item);
          const existing = pageGroups.get(pageNum) ?? [];
          existing.push(item);
          pageGroups.set(pageNum, existing);
        }
        return pageGroups;
      }

      // Group content by page
      const pageGroups = groupContentByPage(content as ContentItem[]);
      const maxPage = Math.max(...pageGroups.keys(), 1);

      // Width measurer for row layouts with space-between
      const measureWidth = createWidthMeasurer(doc, regularFont, boldFont, emojiAvailable);

      // Calculate layout and render per page
      for (let pageNum = 1; pageNum <= maxPage; pageNum++) {
        if (pageNum > 1) {
          doc.addPage();
        }

        // Get content for this page
        const pageContent = pageGroups.get(pageNum) ?? [];
        if (pageContent.length === 0) continue;

        // Convert to LayoutContent for Yoga
        const layoutContent: LayoutContent[] = pageContent.map((item) => item as unknown as LayoutContent);

        // Calculate layout for THIS page only
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
              warnings.push(`Page ${pageNum}: Content exceeds page height by ${Math.ceil(bottom - pageHeight)}px. Consider reducing font sizes or removing content.`);
              break;
            }
          }
        }

        // Render items for this page
        for (const node of layoutNodes) {
          renderLayoutNode(node);
        }
      }

      doc.end();
      const pdfBuffer = await pdfPromise;

      // Write file
      const { storedName } = await writeFile(pdfBuffer, filename, { storageDir: serverConfig.storageDir });

      // Generate URI
      const fileUri = getFileUri(storedName, transport, {
        storageDir: serverConfig.storageDir,
        ...(serverConfig.baseUrl && { baseUrl: serverConfig.baseUrl }),
        endpoint: '/files',
      });

      const result: PDFOutput = {
        operationSummary: `Created PDF layout: ${filename}`,
        itemsProcessed: 1,
        itemsChanged: 1,
        completedAt: new Date().toISOString(),
        documentId: storedName,
        filename,
        uri: fileUri,
        sizeBytes: pdfBuffer.length,
        pageCount: setup.actualPageCount,
        ...(warnings.length > 0 && { warnings }),
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        structuredContent: { result },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new McpError(ErrorCode.InternalError, `Error creating PDF layout: ${message}`, {
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  return {
    name: 'pdf-layout',
    config,
    handler,
  } satisfies ToolModule;
}
