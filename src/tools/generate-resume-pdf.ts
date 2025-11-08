import type { ToolModule } from '@mcpeasy/server';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import crypto from 'crypto';
import { z } from 'zod/v3';
import { jsonResumeSchema } from '../lib/json-resume-schema.ts';
import { writePdfToFile } from '../lib/output-handler.ts';
import { generateResumePDFBuffer } from '../lib/resume-generator.ts';
import type { ServerConfig } from '../types.ts';

const config = {
  title: 'Generate Resume PDF',
  description: 'Generate a professional resume PDF from JSON Resume format. Supports styling, fonts, spacing, and multiple sections.',
  inputSchema: {
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
  } as any,
} as const;

type In = z.infer<z.ZodObject<typeof config.inputSchema>>;

export default function createTool(serverConfig: ServerConfig, transport?: import('@mcpeasy/server').TransportConfig): ToolModule {
  async function handler(args: In): Promise<CallToolResult> {
    const { filename = 'resume.pdf', resume, font, styling } = args;
    try {
      const pdfBuffer = await generateResumePDFBuffer(resume, font, styling);
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
