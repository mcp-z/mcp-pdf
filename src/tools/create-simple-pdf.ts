import type { ToolModule } from '@mcpeasy/server';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import { z } from 'zod/v3';
import { registerEmojiFont } from '../lib/emoji-renderer.ts';
import { hasEmoji, setupFonts } from '../lib/fonts.ts';
import { writePdfToFile } from '../lib/output-handler.ts';
import { renderTextWithEmoji } from '../lib/pdf-helpers.ts';
import type { ServerConfig } from '../types.ts';

const config = {
  title: 'Create Simple PDF',
  description: 'Create a simple PDF with just text content. Supports emoji rendering.',
  inputSchema: {
    filename: z.string().optional().describe('Optional logical filename (metadata only). Storage uses UUID. Defaults to "document.pdf".'),
    text: z.string().describe('Text content for the PDF'),
    title: z.string().optional().describe('Document title metadata'),
  } as any,
} as const;

type In = z.infer<z.ZodObject<typeof config.inputSchema>>;

export default function createTool(serverConfig: ServerConfig, transport?: import('@mcpeasy/server').TransportConfig): ToolModule {
  async function handler(args: In): Promise<CallToolResult> {
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

      return {
        content: [
          {
            type: 'text' as const,
            text: ['PDF created successfully', `URI: ${fileUri}`, `Size: ${pdfBuffer.length} bytes`].join('\n'),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: 'text' as const, text: `Error creating PDF: ${message}` }], isError: true };
    }
  }

  return {
    name: 'create-simple-pdf',
    config,
    handler,
  };
}
