import type { ToolModule } from '@mcpeasy/server';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import { z } from 'zod/v3';
import { registerEmojiFont } from '../lib/emoji-renderer.ts';
import { hasEmoji, setupFonts, validateTextForFont } from '../lib/fonts.ts';
import { writePdfToFile } from '../lib/output-handler.ts';
import { renderTextWithEmoji } from '../lib/pdf-helpers.ts';
import type { ServerConfig } from '../types.ts';

const config = {
  title: 'Create PDF',
  description: 'Create a PDF document with text, images, shapes, and layout control. Supports Unicode + emoji fonts, backgrounds, and vector shapes.',
  inputSchema: {
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
    content: z.array(
      z.union([
        z.object({
          type: z.literal('text'),
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
        }),
        z.object({
          type: z.literal('heading'),
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
        }),
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
      ])
    ),
  } as any,
} as const;

type In = z.infer<z.ZodObject<typeof config.inputSchema>>;

export default function createTool(serverConfig: ServerConfig, transport?: import('@mcpeasy/server').TransportConfig): ToolModule {
  async function handler(args: In): Promise<CallToolResult> {
    const { filename = 'document.pdf', title, author, font, pageSetup, content } = args;
    try {
      const docOptions: any = {
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
            const options: any = {};
            ['x', 'y', 'align', 'indent', 'lineGap', 'paragraphGap', 'width', 'underline', 'strike', 'oblique', 'link', 'characterSpacing', 'wordSpacing', 'continued', 'lineBreak'].forEach((k) => {
              if ((item as any)[k] !== undefined) options[k] = (item as any)[k];
            });
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
            const options: any = {};
            ['x', 'y', 'align', 'indent', 'lineGap', 'paragraphGap', 'width', 'underline', 'strike', 'oblique', 'link', 'characterSpacing', 'wordSpacing', 'continued', 'lineBreak'].forEach((k) => {
              if ((item as any)[k] !== undefined) options[k] = (item as any)[k];
            });
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
      const uuid = crypto.randomUUID();
      const storedFilename = `${uuid}-${filename}`;
      const { fullPath } = await writePdfToFile(pdfBuffer, storedFilename, serverConfig.storageDir);

      // Determine URI based on transport
      let fileUri: string;
      if (transport?.type === 'stdio' || !transport) {
        // stdio mode: direct filesystem access
        fileUri = `file://${fullPath}`;
      } else {
        // HTTP mode: serve via HTTP endpoint
        const base = serverConfig.baseUrl || (transport.port ? `http://localhost:${transport.port}` : 'http://localhost');
        fileUri = `${base}/files/${storedFilename}`;
      }

      // Build response text
      const parts = ['PDF created successfully', `URI: ${fileUri}`, `Size: ${pdfBuffer.length} bytes`];

      if (warnings.length > 0) {
        parts.push('', '⚠️  Character Warnings:', ...warnings.map((w) => `• ${w}`));
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: parts.join('\n'),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: 'text' as const, text: `Error creating PDF: ${message}` }], isError: true };
    }
  }

  return {
    name: 'create-pdf',
    config,
    handler,
  };
}
