import { getFileUri, type ToolModule, writeFile } from '@mcpeasy/server';
import { type CallToolResult, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { measureTextHeight } from '../../lib/content-measure.ts';
import { registerEmojiFont } from '../../lib/emoji-renderer.ts';
import { hasEmoji, setupFonts } from '../../lib/fonts.ts';
import { LayoutEngine } from '../../lib/layout-engine.ts';
import { renderTextWithEmoji } from '../../lib/pdf-helpers.ts';
import type { ToolOptions } from '../../types.ts';

const inputSchema = z.object({
  filename: z.string().optional().describe('Optional logical filename (metadata only). Storage uses UUID. Defaults to "document.pdf".'),
  text: z.string().describe('Text content for the PDF'),
  title: z.string().optional().describe('Document title metadata'),
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
});

const config = {
  title: 'Create Simple PDF',
  description: 'Create a simple PDF with just text content. Supports emoji rendering.',
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
      throw new Error('pdf-create-simple: HTTP/WS transport requires either baseUrl in server config or port in transport config. This is a server configuration error - please provide --base-url or --port.');
    }
  }

  async function handler(args: Input): Promise<CallToolResult> {
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

      // Initialize LayoutEngine for auto page breaks
      const engine = new LayoutEngine();
      engine.init(doc, { mode: 'document' });

      const fontSize = 12;

      // Split text into paragraphs and render with auto page breaks
      const paragraphs = text.split(/\n\n+/);

      for (const paragraph of paragraphs) {
        if (!paragraph.trim()) continue;

        // Measure paragraph height
        const height = measureTextHeight(doc, paragraph, fontSize, regularFont, emojiAvailable);

        // Ensure space for this paragraph (auto page break if needed)
        engine.ensureSpace(doc, height);

        // Render the paragraph
        renderTextWithEmoji(doc, paragraph, fontSize, regularFont, emojiAvailable);

        // Add paragraph spacing
        doc.moveDown(0.5);
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

      // Get page count from buffered pages
      const pageRange = doc.bufferedPageRange();
      const pageCount = pageRange.count || 1;

      const result: Output = {
        operationSummary: `Created simple PDF: ${filename}`,
        itemsProcessed: 1,
        itemsChanged: 1,
        completedAt: new Date().toISOString(),
        documentId: storedName,
        filename,
        uri: fileUri,
        sizeBytes: pdfBuffer.length,
        pageCount,
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
    name: 'pdf-create-simple',
    config,
    handler,
  } satisfies ToolModule;
}
