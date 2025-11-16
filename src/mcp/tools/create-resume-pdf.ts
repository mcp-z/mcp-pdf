import { getFileUri, type ToolModule, writeFile } from '@mcpeasy/server';
import { type CallToolResult, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod/v3';
import { jsonResumeSchema } from '../../lib/json-resume-schema.ts';
import { generateResumePDFBuffer, type ResumeStyling } from '../../lib/resume-generator.ts';
import type { ToolOptions } from '../../types.ts';

const inputSchema = z.object({
  filename: z.string().optional().describe('Optional logical filename (metadata only). Storage uses UUID. Defaults to "resume.pdf".'),
  resume: jsonResumeSchema.describe('Resume data in JSON Resume format'),
  font: z.string().optional().describe('Font for the PDF. Defaults to "auto" (system font detection). Built-ins are limited to ASCII; provide a path or URL for full Unicode.'),
  styling: z
    .object({
      fontSize: z
        .object({
          name: z.number().optional(),
          label: z.number().optional(),
          heading: z.number().optional(),
          subheading: z.number().optional(),
          body: z.number().optional(),
          contact: z.number().optional(),
        })
        .optional(),
      spacing: z
        .object({
          afterName: z.number().optional(),
          afterLabel: z.number().optional(),
          afterContact: z.number().optional(),
          afterHeading: z.number().optional(),
          afterSubheading: z.number().optional(),
          afterText: z.number().optional(),
          betweenSections: z.number().optional(),
        })
        .optional(),
      alignment: z
        .object({
          header: z.enum(['left', 'center', 'right']).optional(),
        })
        .optional(),
      margins: z
        .object({
          top: z.number().optional(),
          bottom: z.number().optional(),
          left: z.number().optional(),
          right: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
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
});

const config = {
  title: 'Generate Resume PDF',
  description: 'Generate a professional resume PDF from JSON Resume format. Supports styling, fonts, spacing, and multiple sections.',
  inputSchema,
  outputSchema: z.object({
    result: outputSchema,
  }),
} as const;

export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;

export default function createTool(toolOptions: ToolOptions): ToolModule {
  const { serverConfig } = toolOptions;
  const { transport } = serverConfig;

  // Validate configuration at startup - fail fast if HTTP/WS transport without baseUrl or port
  if (transport && transport.type === 'http') {
    if (!serverConfig?.baseUrl && !transport.port) {
      throw new Error('generate-resume-pdf: HTTP/WS transport requires either baseUrl in server config or port in transport config. This is a server configuration error - please provide --base-url or --port.');
    }
  }

  async function handler(args: Input): Promise<CallToolResult> {
    const { filename = 'resume.pdf', resume, font, styling } = args;
    try {
      const pdfBuffer = await generateResumePDFBuffer(resume, font, styling as ResumeStyling | undefined);

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
        operationSummary: `Generated resume PDF: ${filename}`,
        itemsProcessed: 1,
        itemsChanged: 1,
        completedAt: new Date().toISOString(),
        documentId: storedName,
        filename,
        uri: fileUri,
        sizeBytes: pdfBuffer.length,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
        structuredContent: { result },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      throw new McpError(ErrorCode.InternalError, `Error generating resume PDF: ${message}`, {
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  return {
    name: 'generate-resume-pdf',
    config,
    handler,
    // biome-ignore lint/suspicious/noExplicitAny: Type assertion needed to bypass TypeScript deep instantiation limit with complex Zod schemas
  } as any;
}
