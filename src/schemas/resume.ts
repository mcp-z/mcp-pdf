/**
 * Reusable resume schemas for PDF tools.
 * These schemas define the structure for resume-specific configuration.
 */

import { z } from 'zod';

// Section configuration schema
export const sectionConfigSchema = z.object({
  source: z.string().describe('Path to data in resume schema using dot notation. Examples: "basics" (for header), "basics.summary", "work", "volunteer", "education", "awards", "certificates", "publications", "skills", "languages", "interests", "projects", "references", "meta.customField".'),
  render: z
    .enum(['header', 'entry-list', 'keyword-list', 'language-list', 'credential-list', 'reference-list', 'summary-highlights', 'text'])
    .optional()
    .describe('Built-in renderer type. Auto-inferred from data shape if omitted. Only needed when: (1) you want "header" rendering (never auto-inferred), or (2) you want to force a specific renderer. Not needed if using template.'),
  title: z.string().optional().describe('Section title (omit for no title)'),
  template: z.string().optional().describe('LiquidJS template for custom rendering. Use instead of render for full control. Receives source data as template context (e.g., {{ name }}, {{ keywords | join: ", " }}).'),
  showTenure: z.boolean().optional().describe('Show tenure duration for work/volunteer sections'),
});

// Divider configuration schema
export const dividerConfigSchema = z.object({
  type: z.literal('divider'),
  thickness: z.number().optional().describe('Line thickness in points (default: 0.5)'),
  color: z.string().optional().describe('Line color (hex or named, default: #cccccc)'),
});

// Field templates schema - LiquidJS templates for field-level formatting
export const fieldTemplatesSchema = z
  .object({
    location: z.string().optional().describe('Location display template (default: "{{ city }}{% if region %}, {{ region }}{% endif %}")'),
    dateRange: z.string().optional().describe("Date range template. Date format tokens: YYYY (4-digit year), YY (2-digit), MMMM (January), MMM (Jan), MM (01), M (1), DD (05), D (5). Default: \"{{ start | date: 'MMM YYYY' }} – {{ end | date: 'MMM YYYY' | default: 'Present' }}\""),
    degree: z.string().optional().describe('Education degree template (default: "{{ studyType }}{% if area %}, {{ area }}{% endif %}")'),
    credential: z.string().optional().describe('Credential metadata template (default: "{{ title | default: name }}{% if awarder %}, {{ awarder }}{% endif %}")'),
    language: z.string().optional().describe('Language display template (default: "{{ language }}{% if fluency %} ({{ fluency }}){% endif %}")'),
    skill: z.string().optional().describe('Skill template (default: "{{ name }}: {{ keywords | join: \', \' }}")'),
    contactLine: z.string().optional().describe('Contact line template (default: "{{ items | join: \' | \' }}")'),
  })
  .optional()
  .describe('LiquidJS templates for field-level rendering. Filters: date (format dates), default (fallback value), tenure (calculate duration), join (join arrays)');

// Sections configuration schema
export const sectionsConfigSchema = z
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
export const columnConfigSchema = z.object({
  width: z.union([z.string(), z.number()]).optional().describe('Column width as percentage ("30%") or points (150)'),
  sections: z
    .array(z.string())
    .describe(
      'Section sources to place in this column. Use source paths from section config: "basics", "basics.summary", "work", "volunteer", "education", "awards", "certificates", "publications", "skills", "languages", "interests", "projects", "references", "meta.customField". Sections not assigned to a column go to the right column by default.'
    ),
});

// Layout schema for spatial arrangement
export const resumeLayoutSchema = z
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
export const stylingSchema = z
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
      .optional()
      .describe('Page margins in points. all 4 (top, bottom, left, right) are REQUIRED if provided. Defaults vary by page size (LETTER/LEGAL: 50pt/54pt, A4: ~50pt/54pt).'),
    alignment: z
      .object({
        header: z.enum(['left', 'center', 'right']).optional().describe('Header alignment (default: center)'),
      })
      .optional(),
  })
  .optional()
  .describe('Typography and styling options');
