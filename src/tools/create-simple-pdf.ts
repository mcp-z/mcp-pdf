import { getFileUri, type ToolModule, writeFile } from '@mcpeasy/server';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import PDFDocument from 'pdfkit';
import { z } from 'zod/v3';
import { registerEmojiFont } from '../lib/emoji-renderer.ts';
import { hasEmoji, setupFonts } from '../lib/fonts.ts';
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
  // Validate configuration at startup - fail fast if HTTP/WS transport without baseUrl or port
  if (transport && transport.type === 'http') {
    if (!serverConfig?.baseUrl && !transport.port) {
      throw new Error('create-simple-pdf: HTTP/WS transport requires either baseUrl in server config or port in transport config. This is a server configuration error - please provide --base-url or --port.');
    }
  }

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
