import crypto from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import PDFDocument from 'pdfkit';
import { z } from 'zod/v3';
import type { PdfServerConfig } from '../lib/config.ts';
import { registerEmojiFont } from '../lib/emoji-renderer.ts';
import { hasEmoji, setupFonts } from '../lib/fonts.ts';
import { writePdfToFile } from '../lib/output-handler.ts';
import { renderTextWithEmoji } from '../lib/pdf-helpers.ts';

export function registerCreateSimplePdfTool(server: McpServer, config: PdfServerConfig) {
  server.registerTool(
    'create-simple-pdf',
    {
      title: 'Create Simple PDF',
      description: 'Create a simple PDF with just text content. Supports emoji rendering.',
      inputSchema: {
        filename: z.string().optional().describe('Optional logical filename (metadata only). Storage uses UUID. Defaults to "document.pdf".'),
        text: z.string().describe('Text content for the PDF'),
        title: z.string().optional().describe('Document title metadata'),
      } as any,
    },
    async (args: any) => {
      const { filename = 'document.pdf', text, title } = args;
      try {
        const doc = new PDFDocument({
          info: {
            ...(title && { Title: title }),
            ...(filename && { Subject: filename }),
          },
        });
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        const pdfPromise = new Promise<Buffer>((resolve, reject) => {
          doc.on('end', () => resolve(Buffer.concat(chunks)));
          doc.on('error', reject);
        });

        const containsEmoji = hasEmoji(text);
        const emojiAvailable = containsEmoji ? registerEmojiFont() : false;
        const fonts = await setupFonts(doc);
        const { regular: regularFont } = fonts;

        renderTextWithEmoji(doc, text, 12, regularFont, emojiAvailable);
        doc.end();

        const pdfBuffer = await pdfPromise;
        const uuid = crypto.randomUUID();
        const storedFilename = `${uuid}.pdf`;
        const { fullPath } = await writePdfToFile(pdfBuffer, storedFilename, config.storageDir);
        const includePath = config.includePath;
        return {
          content: [
            {
              type: 'text' as const,
              text: ['PDF created successfully', `Resource: mcp-pdf://${uuid}`, includePath ? `Output: ${fullPath}` : undefined, `Size: ${pdfBuffer.length} bytes`, filename !== 'document.pdf' ? `Filename: ${filename}` : undefined].filter(Boolean).join('\n'),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: 'text' as const, text: `Error creating PDF: ${message}` }], isError: true };
      }
    }
  );
}
