import { getFileUri, type ToolModule, writeFile } from '@mcpeasy/server';
import { type CallToolResult, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { measureTextHeight } from '../../lib/content-measure.ts';
import { registerEmojiFont } from '../../lib/emoji-renderer.ts';
import { hasEmoji, setupFonts } from '../../lib/fonts.ts';
import { renderTextWithEmoji } from '../../lib/pdf-helpers.ts';
import { calculateLayout, type LayoutContent, type LayoutNode } from '../../lib/yoga-layout.ts';
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

      const fontSize = 12;
      const paragraphGap = fontSize * 0.5; // 0.5 line spacing between paragraphs

      // Page configuration (US Letter)
      const pageWidth = 612;
      const pageHeight = 792;
      const margins = { top: 72, right: 72, bottom: 72, left: 72 };
      const _contentWidth = pageWidth - margins.left - margins.right;
      const contentHeight = pageHeight - margins.top - margins.bottom;

      // Split text into paragraphs and build layout content
      const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
      const layoutContent: LayoutContent[] = paragraphs.map((paragraph, index) => ({
        type: 'text',
        text: paragraph,
        // Add gap after each paragraph except the last
        marginBottom: index < paragraphs.length - 1 ? paragraphGap : 0,
      }));

      // Height measurer function
      const measureHeight = (content: LayoutContent, availableWidth: number): number => {
        if (content.type === 'text' && typeof content.text === 'string') {
          const textHeight = measureTextHeight(doc, content.text, fontSize, regularFont, emojiAvailable, { width: availableWidth });
          const marginBottom = typeof content.marginBottom === 'number' ? content.marginBottom : 0;
          return textHeight + marginBottom;
        }
        return 0;
      };

      // Calculate layout with Yoga
      const layoutNodes = await calculateLayout(layoutContent, pageWidth, pageHeight, measureHeight, margins);

      // Paginate layout nodes
      interface SimplePage {
        nodes: Array<{ node: LayoutNode; adjustedY: number }>;
      }
      const pages: SimplePage[] = [{ nodes: [] }];
      let currentPage = 0;
      let pageStartY = margins.top;

      for (const node of layoutNodes) {
        const nodeY = node.y;
        const nodeHeight = node.height;
        const nodeBottomOnPage = nodeY - pageStartY + nodeHeight;

        // Check if node fits on current page
        if (nodeBottomOnPage > contentHeight && pages[currentPage].nodes.length > 0) {
          // Start new page
          currentPage++;
          pages.push({ nodes: [] });
          pageStartY = nodeY;
        }

        // Add node with adjusted Y position for this page
        pages[currentPage].nodes.push({
          node,
          adjustedY: margins.top + (nodeY - pageStartY),
        });
      }

      // Render each page
      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        if (pageIndex > 0) {
          doc.addPage();
        }

        const page = pages[pageIndex];
        for (const { node, adjustedY } of page.nodes) {
          const content = node.content as LayoutContent;
          if (content.type === 'text' && typeof content.text === 'string') {
            renderTextWithEmoji(doc, content.text, fontSize, regularFont, emojiAvailable, {
              x: node.x,
              y: adjustedY,
              width: node.width,
            });
          }
        }
      }

      // Get page count before ending document
      const pageRange = doc.bufferedPageRange();
      const pageCount = pageRange.count || 1;

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
