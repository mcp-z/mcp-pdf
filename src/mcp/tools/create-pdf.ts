import { getFileUri, type ToolModule, type TransportConfig, writeFile } from '@mcpeasy/server';
import { type CallToolResult, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import PDFDocument from 'pdfkit';
import { z } from 'zod/v3';
import { registerEmojiFont } from '../../lib/emoji-renderer.ts';
import { hasEmoji, setupFonts, validateTextForFont } from '../../lib/fonts.ts';
import { type PDFTextOptions, renderTextWithEmoji } from '../../lib/pdf-helpers.ts';
import type { ServerConfig } from '../../types.ts';

type ContentItem = z.infer<typeof contentItemSchema>;

const textBaseSchema = z.object({
  text: z.string().optional(),
  fontSize: z.number().optional(),
  bold: z.boolean().optional(),
  color: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  align: z.enum(['left', 'center', 'right', 'justify']).optional(),
  indent: z.number().optional(),
  lineGap: z.number().optional(),
  paragraphGap: z.number().optional(),
  width: z.number().optional(),
  moveDown: z.number().optional(),
  underline: z.boolean().optional(),
  strike: z.boolean().optional(),
  oblique: z.union([z.boolean(), z.number()]).optional(),
  link: z.string().optional(),
  characterSpacing: z.number().optional(),
  wordSpacing: z.number().optional(),
  continued: z.boolean().optional(),
  lineBreak: z.boolean().optional(),
});

const contentItemSchema = z.union([
  textBaseSchema.extend({ type: z.literal('text') }),
  textBaseSchema.extend({ type: z.literal('heading') }),
  z.object({
    type: z.literal('image'),
    imagePath: z.string(),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  }),
  z.object({
    type: z.literal('rect'),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    fillColor: z.string().optional(),
    strokeColor: z.string().optional(),
    lineWidth: z.number().optional(),
  }),
  z.object({
    type: z.literal('circle'),
    x: z.number(),
    y: z.number(),
    radius: z.number(),
    fillColor: z.string().optional(),
    strokeColor: z.string().optional(),
    lineWidth: z.number().optional(),
  }),
  z.object({
    type: z.literal('line'),
    x1: z.number(),
    y1: z.number(),
    x2: z.number(),
    y2: z.number(),
    strokeColor: z.string().optional(),
    lineWidth: z.number().optional(),
  }),
  z.object({ type: z.literal('pageBreak') }),
]);

const inputSchema = z.object({
  filename: z.string().optional().describe('Optional logical filename (metadata only). Storage uses UUID. Defaults to "document.pdf".'),
  title: z.string().optional().describe('Document title metadata'),
  author: z.string().optional().describe('Document author metadata'),
  font: z.string().optional().describe('Font strategy (default: auto). Built-ins: Helvetica, Times-Roman, Courier. Use a path or URL for Unicode.'),
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
  description: 'Create a PDF document with text, images, shapes, and layout control. Supports Unicode + emoji fonts, backgrounds, and vector shapes.',
  inputSchema,
  outputSchema: z.object({
    result: outputSchema,
  }),
} as const;

export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;

export default function createTool(serverConfig: ServerConfig, transport?: TransportConfig): ToolModule {
  // Validate configuration at startup - fail fast if HTTP/WS transport without baseUrl or port
  if (transport && transport.type === 'http') {
    if (!serverConfig?.baseUrl && !transport.port) {
      throw new Error('create-pdf: HTTP/WS transport requires either baseUrl in server config or port in transport config. This is a server configuration error - please provide --base-url or --port.');
    }
  }

  // Helper function to extract PDF text options from content items
  function extractTextOptions(item: Extract<ContentItem, { type: 'text' | 'heading' }>): PDFTextOptions {
    const options: PDFTextOptions = {};
    if (item.x !== undefined) options.x = item.x;
    if (item.y !== undefined) options.y = item.y;
    if (item.align !== undefined) options.align = item.align;
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
    const { filename = 'document.pdf', title, author, font, pageSetup, content } = args;
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
      if (pageSetup?.size) docOptions.size = pageSetup.size;
      if (pageSetup?.margins) docOptions.margins = pageSetup.margins;
      const doc = new PDFDocument(docOptions);

      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      const pdfPromise = new Promise<Buffer>((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
      });

      if (pageSetup?.backgroundColor) {
        const pageSize = pageSetup?.size || [612, 792];
        doc.rect(0, 0, pageSize[0], pageSize[1]).fill(pageSetup.backgroundColor);
      }

      const contentText = JSON.stringify(content);
      const containsEmoji = hasEmoji(contentText);
      const emojiAvailable = containsEmoji ? registerEmojiFont() : false;
      const fonts = await setupFonts(doc, font);
      const { regular: regularFont, bold: boldFont } = fonts;

      const warnings: string[] = [];
      for (const item of content) {
        if ((item.type === 'text' || item.type === 'heading') && item.text) {
          const fnt = item.bold ? boldFont : regularFont;
          const validation = validateTextForFont(item.text, fnt);
          if (validation.hasUnsupportedCharacters) warnings.push(...validation.warnings);
        }
      }

      const drawBackgroundOnPage = () => {
        if (pageSetup?.backgroundColor) {
          const pageSize = pageSetup?.size || [612, 792];
          const x = doc.x;
          const y = doc.y;
          doc.rect(0, 0, pageSize[0], pageSize[1]).fill(pageSetup.backgroundColor);
          doc.x = x;
          doc.y = y;
        }
      };
      doc.on('pageAdded', drawBackgroundOnPage);

      for (const item of content) {
        switch (item.type) {
          case 'text': {
            if (item.x !== undefined && item.align !== undefined) throw new Error('Cannot use both x and align in text element');
            const fontSize = item.fontSize ?? 12;
            const fnt = item.bold ? boldFont : regularFont;
            if (item.color) doc.fillColor(item.color);
            const options = extractTextOptions(item);
            renderTextWithEmoji(doc, item.text ?? '', fontSize, fnt, emojiAvailable, options);
            if (item.color) doc.fillColor('black');
            if (item.moveDown !== undefined) doc.moveDown(item.moveDown);
            break;
          }
          case 'heading': {
            if (item.x !== undefined && item.align !== undefined) throw new Error('Cannot use both x and align in heading element');
            const fontSize = item.fontSize ?? 24;
            const fnt = item.bold !== false ? boldFont : regularFont;
            if (item.color) doc.fillColor(item.color);
            const options = extractTextOptions(item);
            renderTextWithEmoji(doc, item.text ?? '', fontSize, fnt, emojiAvailable, options);
            if (item.color) doc.fillColor('black');
            if (item.moveDown !== undefined) doc.moveDown(item.moveDown);
            break;
          }
          case 'image': {
            const opts: Record<string, unknown> = {};
            if (item.width !== undefined) opts.width = item.width;
            if (item.height !== undefined) opts.height = item.height;
            if (item.x !== undefined && item.y !== undefined) doc.image(item.imagePath, item.x, item.y, opts);
            else doc.image(item.imagePath, opts);
            break;
          }
          case 'rect': {
            doc.rect(item.x, item.y, item.width, item.height);
            if (item.fillColor && item.strokeColor) {
              if (item.lineWidth) doc.lineWidth(item.lineWidth);
              doc.fillAndStroke(item.fillColor, item.strokeColor);
            } else if (item.fillColor) doc.fill(item.fillColor);
            else if (item.strokeColor) {
              if (item.lineWidth) doc.lineWidth(item.lineWidth);
              doc.stroke(item.strokeColor);
            }
            doc.fillColor('black');
            break;
          }
          case 'circle': {
            doc.circle(item.x, item.y, item.radius);
            if (item.fillColor && item.strokeColor) {
              if (item.lineWidth) doc.lineWidth(item.lineWidth);
              doc.fillAndStroke(item.fillColor, item.strokeColor);
            } else if (item.fillColor) doc.fill(item.fillColor);
            else if (item.strokeColor) {
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

      doc.end();
      const pdfBuffer = await pdfPromise;

      // Write file with ID prefix
      const { storedName } = await writeFile(pdfBuffer, filename, {
        storageDir: serverConfig.storageDir,
      });

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
        pageCount: content.filter((item) => item.type === 'pageBreak').length + 1,
        ...(warnings.length > 0 && { warnings }),
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
        structuredContent: result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      throw new McpError(ErrorCode.InternalError, `Error creating PDF: ${message}`, {
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  return {
    name: 'create-pdf',
    config,
    handler,
    // biome-ignore lint/suspicious/noExplicitAny: Type assertion needed to bypass TypeScript deep instantiation limit with complex Zod schemas
  } as any;
}
