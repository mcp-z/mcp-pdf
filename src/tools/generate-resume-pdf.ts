import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import crypto from 'crypto';
import { z } from 'zod/v3';
import { jsonResumeSchema } from '../json-resume-schema.ts';
import type { PdfServerConfig } from '../lib/config.ts';
import { writePdfToFile } from '../lib/output-handler.ts';
import { generateResumePDFBuffer } from '../resume-generator.ts';

export function registerGenerateResumePdfTool(server: McpServer, config: PdfServerConfig) {
  server.registerTool(
    'generate-resume-pdf',
    {
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
    },
    async (args: any) => {
      const { filename = 'resume.pdf', resume, font, styling } = args;
      try {
        const pdfBuffer = await generateResumePDFBuffer(resume, font, styling);
        const uuid = crypto.randomUUID();
        const storedFilename = `${uuid}.pdf`;
        const { fullPath } = await writePdfToFile(pdfBuffer, storedFilename, config.storageDir);
        const includePath = config.includePath;
        return {
          content: [
            {
              type: 'text' as const,
              text: ['Resume PDF generated successfully', `Resource: mcp-pdf://${uuid}`, includePath ? `Output: ${fullPath}` : undefined, `Size: ${pdfBuffer.length} bytes`, filename !== 'resume.pdf' ? `Filename: ${filename}` : undefined].filter(Boolean).join('\n'),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: 'text' as const, text: `Error generating resume PDF: ${message}` }], isError: true };
      }
    }
  );
}
