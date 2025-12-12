/**
 * pdf-document tool - Flowing documents with PDFKit native text flow.
 *
 * Best for: Reports, articles, letters, contracts, and any document with flowing text.
 * Uses PDFKit's native text flow with automatic pagination.
 *
 * Content flows sequentially from top to bottom, automatically breaking across pages.
 * No positioning required - just write content and it flows naturally.
 *
 * Default margins: 72pt (1 inch) for standard document formatting.
 */

import { getFileUri, type ToolModule, writeFile } from '@mcpeasy/server';
import { type CallToolResult, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { DEFAULT_HEADING_FONT_SIZE, DEFAULT_MARGIN, DEFAULT_TEXT_FONT_SIZE, type PageSizePreset } from '../../constants.ts';
import { registerEmojiFont } from '../../lib/emoji-renderer.ts';
import { hasEmoji, setupFonts, validateTextForFont } from '../../lib/fonts.ts';
import { resolveImageDimensions } from '../../lib/image-dimensions.ts';
import { extractTextOptions, type PDFOutput, pdfOutputSchema, resolvePageSize, textBaseSchema } from '../../lib/pdf-core.ts';
import { renderTextWithEmoji } from '../../lib/pdf-helpers.ts';
import type { ToolOptions } from '../../types.ts';

// ============================================================================
// Schemas
// ============================================================================

// Flowing content items - no position properties, content flows naturally
const flowingContentItemSchema = z.union([
  textBaseSchema.extend({ type: z.literal('text') }),
  textBaseSchema.extend({ type: z.literal('heading') }),
  z.object({
    type: z.literal('image'),
    imagePath: z.string().describe('Path to image file'),
    width: z.number().optional().describe('Image width in points (default: natural width, max: page width)'),
    height: z.number().optional().describe('Image height in points (default: natural height or aspect-ratio scaled)'),
    align: z.enum(['left', 'center', 'right']).optional().describe('Image alignment (default: left)'),
  }),
  z.object({
    type: z.literal('divider'),
    color: z.string().optional().describe('Divider color (default: #cccccc)'),
    thickness: z.number().optional().describe('Divider thickness in points (default: 1)'),
    marginTop: z.number().optional().describe('Space above divider in points (default: 10)'),
    marginBottom: z.number().optional().describe('Space below divider in points (default: 10)'),
  }),
  z.object({
    type: z.literal('spacer'),
    height: z.number().describe('Vertical space in points'),
  }),
  z
    .object({
      type: z.literal('pageBreak'),
    })
    .describe('Force a page break'),
]);

// Exported for potential external use
export type FlowingContentItem = z.infer<typeof flowingContentItemSchema>;

const inputSchema = z.object({
  filename: z.string().optional().describe('Optional logical filename (metadata only). Storage uses UUID. Defaults to "document.pdf".'),
  title: z.string().optional().describe('Document title metadata'),
  author: z.string().optional().describe('Document author metadata'),
  font: z.string().optional().describe('Font strategy (default: auto). Built-ins: Helvetica, Times-Roman, Courier. Use a path or URL for Unicode.'),
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
        .describe('Page margins in points (default: 72pt / 1 inch on all sides).'),
      backgroundColor: z.string().optional().describe('Page background color (hex like "#000000" or named color). Default: white.'),
    })
    .optional()
    .describe('Page configuration including size, margins, and background color.'),
  content: z.array(flowingContentItemSchema).describe('Document content in flow order'),
});

const config = {
  title: 'Create PDF Document',
  description: `Create a flowing PDF document with automatic pagination.

Best for: Reports, articles, letters, contracts, and documents with sequential content.

Content flows naturally from top to bottom. Pages break automatically when content exceeds page height. Use "pageBreak" to force page breaks, "divider" for horizontal rules, and "spacer" for vertical spacing.

Supported content types:
- text: Body text with optional formatting (bold, italic, color, alignment)
- heading: Section headings (larger font, bold by default)
- image: Inline images that flow with content
- divider: Horizontal line separators
- spacer: Vertical whitespace
- pageBreak: Force new page

Default margins: 72pt (1 inch) for standard document formatting.`,
  inputSchema,
  outputSchema: z.object({
    result: pdfOutputSchema,
  }),
} as const;

export type Input = z.infer<typeof inputSchema>;

export default function createTool(toolOptions: ToolOptions) {
  const { serverConfig } = toolOptions;
  const { transport } = serverConfig;

  // Validate configuration at startup
  if (transport && transport.type === 'http') {
    if (!serverConfig?.baseUrl && !transport.port) {
      throw new Error('pdf-document: HTTP/WS transport requires either baseUrl in server config or port in transport config.');
    }
  }

  async function handler(args: Input): Promise<CallToolResult> {
    const { filename = 'document.pdf', title, author, font, pageSetup, content } = args;

    try {
      // Resolve page size
      const pageSize = resolvePageSize(pageSetup?.size as PageSizePreset | [number, number] | undefined);

      // Default margins for flowing documents (1 inch = 72 points)
      const defaultMargins = {
        top: DEFAULT_MARGIN,
        bottom: DEFAULT_MARGIN,
        left: DEFAULT_MARGIN,
        right: DEFAULT_MARGIN,
      };

      const docOptions = {
        info: {
          ...(title && { Title: title }),
          ...(author && { Author: author }),
          ...(filename && { Subject: filename }),
        },
        size: [pageSize.width, pageSize.height] as [number, number],
        margins: pageSetup?.margins ?? defaultMargins,
      };

      const doc = new PDFDocument(docOptions);

      // Buffer accumulation
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      const pdfPromise = new Promise<Buffer>((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
      });

      // Apply background color
      if (pageSetup?.backgroundColor) {
        doc.rect(0, 0, pageSize.width, pageSize.height).fill(pageSetup.backgroundColor);
        doc.fillColor('black');
      }

      // Setup fonts and emoji
      const contentText = JSON.stringify(content);
      const containsEmoji = hasEmoji(contentText);
      const emojiAvailable = containsEmoji ? registerEmojiFont() : false;
      const fonts = await setupFonts(doc, font);
      const { regular: regularFont, bold: boldFont } = fonts;

      const warnings: string[] = [];

      // Track page count with background
      let actualPageCount = 1;
      doc.on('pageAdded', () => {
        actualPageCount++;
        if (pageSetup?.backgroundColor) {
          const x = doc.x;
          const y = doc.y;
          doc.rect(0, 0, pageSize.width, pageSize.height).fill(pageSetup.backgroundColor);
          doc.fillColor('black');
          doc.x = x;
          doc.y = y;
        }
      });

      // Validate text content
      for (const item of content) {
        if ((item.type === 'text' || item.type === 'heading') && item.text) {
          const fnt = item.bold ? boldFont : regularFont;
          const validation = validateTextForFont(item.text, fnt);
          if (validation.hasUnsupportedCharacters) {
            warnings.push(...validation.warnings);
          }
        }
      }

      // Get content width (page width minus margins)
      const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      // Render flowing content
      for (const item of content) {
        switch (item.type) {
          case 'text': {
            const fontSize = item.fontSize ?? DEFAULT_TEXT_FONT_SIZE;
            const fnt = item.bold ? boldFont : regularFont;
            if (item.color) doc.fillColor(item.color);

            const options = extractTextOptions(item);
            options.width = item.width ?? contentWidth;

            renderTextWithEmoji(doc, item.text ?? '', fontSize, fnt, emojiAvailable, options);

            if (item.moveDown) {
              doc.moveDown(item.moveDown);
            }
            if (item.color) doc.fillColor('black');
            break;
          }

          case 'heading': {
            const fontSize = item.fontSize ?? DEFAULT_HEADING_FONT_SIZE;
            const fnt = item.bold !== false ? boldFont : regularFont;
            if (item.color) doc.fillColor(item.color);

            const options = extractTextOptions(item);
            options.width = item.width ?? contentWidth;

            renderTextWithEmoji(doc, item.text ?? '', fontSize, fnt, emojiAvailable, options);

            if (item.moveDown) {
              doc.moveDown(item.moveDown);
            }
            if (item.color) doc.fillColor('black');
            break;
          }

          case 'image': {
            const dimensions = resolveImageDimensions(
              item.imagePath,
              item.width ?? contentWidth, // Default to content width
              item.height
            );

            // Ensure image doesn't exceed content width
            const imgWidth = Math.min(dimensions.width, contentWidth);
            const imgHeight = dimensions.height * (imgWidth / dimensions.width);

            // Calculate X position based on alignment
            let imgX = doc.x;
            if (item.align === 'center') {
              imgX = doc.page.margins.left + (contentWidth - imgWidth) / 2;
            } else if (item.align === 'right') {
              imgX = doc.page.margins.left + contentWidth - imgWidth;
            }

            doc.image(item.imagePath, imgX, doc.y, {
              width: imgWidth,
              height: imgHeight,
            });
            doc.y += imgHeight;
            doc.moveDown(0.5); // Small spacing after image
            break;
          }

          case 'divider': {
            const marginTop = item.marginTop ?? 10;
            const marginBottom = item.marginBottom ?? 10;
            const thickness = item.thickness ?? 1;
            const color = item.color ?? '#cccccc';

            doc.y += marginTop;
            doc
              .lineWidth(thickness)
              .moveTo(doc.page.margins.left, doc.y)
              .lineTo(doc.page.width - doc.page.margins.right, doc.y)
              .stroke(color);
            doc.y += thickness + marginBottom;
            break;
          }

          case 'spacer': {
            doc.y += item.height;
            break;
          }

          case 'pageBreak': {
            doc.addPage();
            break;
          }
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
        operationSummary: `Created PDF document: ${filename}`,
        itemsProcessed: content.length,
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
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        structuredContent: { result },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new McpError(ErrorCode.InternalError, `Error creating PDF document: ${message}`, {
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  return {
    name: 'pdf-document',
    config,
    handler,
  } satisfies ToolModule;
}
