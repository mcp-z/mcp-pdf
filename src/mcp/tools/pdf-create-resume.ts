import { getFileUri, type ToolModule, writeFile } from '@mcpeasy/server';
import { type CallToolResult, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { generateResumePDFBuffer, type RenderOptions, type TypographyOptions } from '../../lib/resume-pdf-generator.ts';
import { validateResume } from '../../lib/validator.ts';
import type { ToolOptions } from '../../types.ts';

// Use loose Zod schema for MCP input, AJV validates strictly
const resumeInputSchema = z.record(z.string(), z.any()).describe('Resume data in JSON Resume format');

// Section configuration schema
const sectionConfigSchema = z.object({
  source: z.string().describe('Data source path (e.g., "work", "education", "meta.valueProp")'),
  title: z.string().optional().describe('Section title (omit for no title)'),
  template: z.string().optional().describe('LiquidJS template for custom rendering'),
});

// Divider configuration schema
const dividerConfigSchema = z.object({
  type: z.literal('divider'),
  thickness: z.number().optional().describe('Line thickness in points'),
  color: z.string().optional().describe('Line color (hex or named)'),
});

// Field templates schema - LiquidJS templates for field-level formatting
const fieldTemplatesSchema = z
  .object({
    location: z.string().optional().describe('Location display template (default: "{{ city }}{% if region %}, {{ region }}{% endif %}")'),
    dateRange: z.string().optional().describe("Date range template. Date format tokens: YYYY (4-digit year), YY (2-digit), MMMM (January), MMM (Jan), MM (01), M (1), DD (05), D (5). Default: \"{{ start | date: 'MMM YYYY' }} – {{ end | date: 'MMM YYYY' | default: 'Present' }}\""),
    degree: z.string().optional().describe('Education degree template (default: "{{ studyType }}{% if area %}, {{ area }}{% endif %}")'),
    credential: z.string().optional().describe('Credential metadata template (default: "{{ title | default: name }}{% if awarder %}, {{ awarder }}{% endif %}")'),
    language: z.string().optional().describe('Language display template (default: "{{ language }}{% if fluency %} ({{ fluency }}){% endif %}")'),
    skill: z.string().optional().describe('Skill display template (default: "{{ name }}: {{ keywords | join: \', \' }}")'),
    contactLine: z.string().optional().describe('Contact line template (default: "{{ items | join: \' | \' }}")'),
  })
  .optional()
  .describe('LiquidJS templates for field-level rendering. Filters: date (format dates), default (fallback value), tenure (calculate duration), join (join arrays)');

// Sections configuration schema
const sectionsConfigSchema = z
  .object({
    sections: z
      .array(z.union([sectionConfigSchema, dividerConfigSchema]))
      .optional()
      .describe('Section order and configuration'),
    fieldTemplates: fieldTemplatesSchema,
  })
  .optional()
  .describe('Sections configuration for section ordering and field templates');

// Column configuration schema for two-column layouts
const columnConfigSchema = z.object({
  width: z.union([z.string(), z.number()]).optional().describe('Column width as percentage ("30%") or points (150)'),
  sections: z.array(z.string()).describe('Source paths of sections for this column (e.g., ["skills", "languages"])'),
});

// Layout schema for spatial arrangement
const layoutSchema = z
  .object({
    style: z.enum(['single-column', 'two-column']).default('single-column').describe('Layout style (default: single-column)'),
    columns: z
      .object({
        left: columnConfigSchema.optional().describe('Left/sidebar column configuration'),
        right: columnConfigSchema.optional().describe('Right/main column configuration'),
      })
      .optional()
      .describe('Column configuration for two-column layout'),
    gap: z.number().optional().default(30).describe('Gap between columns in points (default: 30)'),
  })
  .optional()
  .describe('Spatial arrangement of sections. Omit for single-column (default). Use style: "two-column" with columns config for sidebar layouts.');

// Typography/styling schema (points-based, not moveDown)
const stylingSchema = z
  .object({
    fontSize: z
      .object({
        name: z.number().optional().describe('Name font size (default: 30)'),
        heading: z.number().optional().describe('Section heading font size (default: 12)'),
        subheading: z.number().optional().describe('Entry title font size (default: 11)'),
        body: z.number().optional().describe('Body text font size (default: 10)'),
        contact: z.number().optional().describe('Contact info font size (default: 10)'),
      })
      .optional(),
    spacing: z
      .object({
        afterName: z.number().optional().describe('Space after name in points'),
        afterHeading: z.number().optional().describe('Space after section headings in points'),
        afterSubheading: z.number().optional().describe('Space after entry titles in points'),
        afterText: z.number().optional().describe('Space after paragraphs in points'),
        betweenSections: z.number().optional().describe('Space between sections in points'),
      })
      .optional(),
    margins: z
      .object({
        top: z.number().optional().describe('Top margin in points (default: 50)'),
        bottom: z.number().optional().describe('Bottom margin in points (default: 50)'),
        left: z.number().optional().describe('Left margin in points (default: 54)'),
        right: z.number().optional().describe('Right margin in points (default: 54)'),
      })
      .optional(),
    alignment: z
      .object({
        header: z.enum(['left', 'center', 'right']).optional().describe('Header alignment (default: center)'),
      })
      .optional(),
  })
  .optional()
  .describe('Typography and styling options');

const inputSchema = z.object({
  filename: z.string().optional().describe('Optional logical filename (metadata only). Storage uses UUID. Defaults to "resume.pdf".'),
  resume: resumeInputSchema,
  font: z.string().optional().describe('Font for the PDF. Defaults to "auto" (system font detection). Built-ins are limited to ASCII; provide a path or URL for full Unicode.'),
  sections: sectionsConfigSchema,
  layout: layoutSchema,
  styling: stylingSchema,
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
  description: 'Generate a professional resume PDF from JSON Resume format. Supports layout customization, date/locale formatting, styling, fonts, and automatic page breaks.',
  inputSchema,
  outputSchema: z.object({
    result: outputSchema,
  }),
} as const;

export type Input = z.input<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;

export default function createTool(toolOptions: ToolOptions) {
  const { serverConfig } = toolOptions;
  const { transport } = serverConfig;

  // Validate configuration at startup - fail fast if HTTP/WS transport without baseUrl or port
  if (transport && transport.type === 'http') {
    if (!serverConfig?.baseUrl && !transport.port) {
      throw new Error('pdf-create-resume: HTTP/WS transport requires either baseUrl in server config or port in transport config. This is a server configuration error - please provide --base-url or --port.');
    }
  }

  async function handler(args: Input): Promise<CallToolResult> {
    const { filename = 'resume.pdf', resume, font, sections, layout, styling } = args;

    try {
      // Validate resume against JSON Schema
      const validation = validateResume(resume);
      if (!validation.valid) {
        throw new McpError(ErrorCode.InvalidParams, `Resume validation failed: ${validation.errors?.join('; ') || 'Unknown error'}`);
      }

      // Validate layout configuration
      if (layout?.style === 'two-column' && layout.columns) {
        const leftSections = layout.columns.left?.sections || [];
        const rightSections = layout.columns.right?.sections || [];

        // Get all defined section sources
        const definedSources = new Set<string>();
        if (sections?.sections) {
          for (const section of sections.sections) {
            if ('source' in section) {
              definedSources.add(section.source);
            }
          }
        }

        // If no custom sections defined, use default sources
        if (definedSources.size === 0) {
          // Default sources from DEFAULT_SECTIONS
          const defaultSources = ['header', 'basics.summary', 'work', 'volunteer', 'education', 'awards', 'certificates', 'publications', 'skills', 'languages', 'interests', 'projects', 'references'];
          for (const s of defaultSources) {
            definedSources.add(s);
          }
        }

        // Check for sections in columns that don't exist
        const allColumnSections = [...leftSections, ...rightSections];
        const invalidSections = allColumnSections.filter((s) => !definedSources.has(s));
        if (invalidSections.length > 0) {
          throw new McpError(ErrorCode.InvalidParams, `Layout references unknown sections: ${invalidSections.join(', ')}. Available sections: ${[...definedSources].join(', ')}`);
        }

        // Check for duplicate sections across columns
        const duplicates = leftSections.filter((s) => rightSections.includes(s));
        if (duplicates.length > 0) {
          throw new McpError(ErrorCode.InvalidParams, `Sections cannot appear in both columns: ${duplicates.join(', ')}`);
        }
      }

      // Build render options
      const renderOptions: RenderOptions = {
        font,
      };

      // Map sections config
      if (sections) {
        renderOptions.sections = {
          sections:
            sections.sections?.map((section) => {
              if ('type' in section && section.type === 'divider') {
                return {
                  type: 'divider' as const,
                  thickness: section.thickness,
                  color: section.color,
                };
              }
              // TypeScript needs explicit narrowing for discriminated unions
              const sectionConfig = section as { source: string; title?: string; template?: string };
              return {
                source: sectionConfig.source,
                title: sectionConfig.title,
                template: sectionConfig.template,
              };
            }) || [],
          fieldTemplates: sections.fieldTemplates,
        };
      }

      // Map styling to typography
      if (styling) {
        renderOptions.typography = {
          text: {
            fontSize: styling.fontSize?.body ?? 10,
            lineHeight: 1.2,
            marginTop: styling.spacing?.afterText ?? 2,
            marginBottom: styling.spacing?.afterText ?? 2,
            blockMarginBottom: styling.spacing?.betweenSections ?? 8,
          },
          header: {
            marginTop: 0,
            marginBottom: styling.spacing?.afterName ?? 5,
            name: {
              fontSize: styling.fontSize?.name ?? 30,
              marginTop: 0,
              marginBottom: styling.spacing?.afterName ?? 5,
              letterSpacing: 2,
            },
            contact: {
              fontSize: styling.fontSize?.contact ?? 10,
              letterSpacing: 0.5,
            },
          },
          sectionTitle: {
            fontSize: styling.fontSize?.heading ?? 12,
            marginTop: styling.spacing?.betweenSections ?? 12,
            marginBottom: styling.spacing?.afterHeading ?? 4,
            letterSpacing: 1.5,
            underlineGap: 2,
            underlineThickness: 0.5,
          },
          entry: {
            position: {
              fontSize: styling.fontSize?.subheading ?? 11,
              marginTop: 0,
              marginBottom: styling.spacing?.afterSubheading ?? 1,
            },
            company: {
              fontSize: 10,
              color: '#333333',
            },
            location: {
              fontSize: 10,
              color: '#666666',
            },
            date: {
              width: 90,
            },
          },
          bullet: {
            indent: 15,
            marginTop: 0,
            marginBottom: 2,
          },
          quote: {
            indent: 20,
          },
          divider: {
            marginTop: 10,
            marginBottom: 10,
            thickness: 0.5,
            color: '#cccccc',
          },
        } as Partial<TypographyOptions>;
      }

      // Map layout config
      if (layout) {
        renderOptions.layout = {
          style: layout.style,
          gap: layout.gap,
          columns: layout.columns
            ? {
                left: layout.columns.left ? { width: layout.columns.left.width, sections: layout.columns.left.sections } : undefined,
                right: layout.columns.right ? { width: layout.columns.right.width, sections: layout.columns.right.sections } : undefined,
              }
            : undefined,
        };
      }

      // Generate PDF
      const pdfBuffer = await generateResumePDFBuffer(resume, renderOptions);

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
            text: JSON.stringify(result),
          },
        ],
        structuredContent: { result },
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);

      throw new McpError(ErrorCode.InternalError, `Error generating resume PDF: ${message}`, {
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  return {
    name: 'pdf-create-resume',
    config,
    handler,
  } satisfies ToolModule;
}
