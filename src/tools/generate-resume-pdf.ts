import { getFileUri, type ToolModule, writeFile } from '@mcpeasy/server';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod/v3';
import { jsonResumeSchema } from '../lib/json-resume-schema.ts';
import { generateResumePDFBuffer } from '../lib/resume-generator.ts';
import type { ServerConfig } from '../types.ts';

const inputSchemaObject = z.object({
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

const config = {
  title: 'Generate Resume PDF',
  description: 'Generate a professional resume PDF from JSON Resume format. Supports styling, fonts, spacing, and multiple sections.',
  inputSchema: inputSchemaObject.shape,
} as const;

type In = z.infer<typeof inputSchemaObject>;

export default function createTool(serverConfig: ServerConfig, transport?: import('@mcpeasy/server').TransportConfig): ToolModule {
  // Validate configuration at startup - fail fast if HTTP/WS transport without baseUrl or port
  if (transport && transport.type === 'http') {
    if (!serverConfig?.baseUrl && !transport.port) {
      throw new Error('generate-resume-pdf: HTTP/WS transport requires either baseUrl in server config or port in transport config. This is a server configuration error - please provide --base-url or --port.');
    }
  }

  async function handler(args: In): Promise<CallToolResult> {
    const { filename = 'resume.pdf', resume, font, styling } = args;
    try {
      const pdfBuffer = await generateResumePDFBuffer(resume, font, styling);

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
            text: ['Resume PDF generated successfully', `URI: ${fileUri}`, `Size: ${pdfBuffer.length} bytes`].join('\n'),
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { content: [{ type: 'text' as const, text: `Error generating resume PDF: ${message}` }], isError: true };
    }
  }

  return {
    name: 'generate-resume-pdf',
    config,
    handler,
  };
}
