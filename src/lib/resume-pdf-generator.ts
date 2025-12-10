/**
 * Resume PDF generator using IR transformation pipeline with emoji support
 */

import PDFDocument from 'pdfkit';
// Import generated type from JSON Schema
import type { ResumeSchema } from '../../assets/resume.d.ts';
import { registerEmojiFont } from './emoji-renderer.ts';
import { hasEmoji, isPDFStandardFont, needsUnicodeFont, resolveFont } from './fonts.ts';
import { renderElement, renderLayoutDocument } from './handlers/index.ts';
import type { TypographyOptions } from './handlers/types.ts';
import { DEFAULT_TYPOGRAPHY } from './handlers/types.ts';
import type { ResumeLayout } from './ir/layout-transform.ts';
import { isTwoColumnLayout, transformToResumeLayout } from './ir/layout-transform.ts';
import { DEFAULT_SECTIONS, transformToLayout } from './ir/transform.ts';
import type { FieldTemplates, LayoutElement, SectionsConfig } from './ir/types.ts';
import { LayoutEngine } from './layout-engine.ts';
import { calculateLayout, type HeightMeasurer, type LayoutContent } from './yoga-layout.ts';

// Re-export types for external use
export type { ResumeSchema };

/**
 * Column configuration for two-column layouts
 */
export interface ColumnConfig {
  /** Column width as percentage ("30%") or points (150) */
  width?: string | number;
  /** Source paths of sections for this column */
  sections: string[];
}

/**
 * Layout configuration for spatial arrangement
 */
export interface LayoutConfig {
  /** Layout style: single-column (default) or two-column */
  style?: 'single-column' | 'two-column';
  /** Column configuration for two-column layout */
  columns?: {
    left?: ColumnConfig;
    right?: ColumnConfig;
  };
  /** Gap between columns in points (default: 30) */
  gap?: number;
}

/**
 * Render options for resume PDF generation
 */
export interface RenderOptions {
  /** Custom typography settings */
  typography?: Partial<TypographyOptions>;
  /** Sections configuration (section order, titles, etc.) */
  sections?: SectionsConfig;
  /** Field templates for customizing field-level rendering (dates, locations, etc.) */
  fieldTemplates?: FieldTemplates;
  /** Font specification (path, URL, 'auto', or standard font name) */
  font?: string;
  /** Layout configuration for spatial arrangement (single-column or two-column) */
  layout?: LayoutConfig;
}

/**
 * Setup fonts for the PDF document
 * Returns a FontConfig compatible with TypographyOptions
 */
async function setupFonts(doc: InstanceType<typeof PDFDocument>, fontSpec?: string): Promise<{ regular: string; bold: string; italic: string; boldItalic: string }> {
  const spec = fontSpec || 'auto';
  const resolvedFont = await resolveFont(spec);

  // Fall back to Helvetica if resolution failed
  if (!resolvedFont) {
    console.warn(`Could not resolve font "${spec}", falling back to Helvetica`);
    return {
      regular: 'Helvetica',
      bold: 'Helvetica-Bold',
      italic: 'Helvetica-Oblique',
      boldItalic: 'Helvetica-BoldOblique',
    };
  }

  // If it's a standard PDF font, use its variants
  if (isPDFStandardFont(resolvedFont)) {
    if (resolvedFont.startsWith('Helvetica')) {
      return {
        regular: 'Helvetica',
        bold: 'Helvetica-Bold',
        italic: 'Helvetica-Oblique',
        boldItalic: 'Helvetica-BoldOblique',
      };
    }
    if (resolvedFont.startsWith('Times')) {
      return {
        regular: 'Times-Roman',
        bold: 'Times-Bold',
        italic: 'Times-Italic',
        boldItalic: 'Times-BoldItalic',
      };
    }
    if (resolvedFont.startsWith('Courier')) {
      return {
        regular: 'Courier',
        bold: 'Courier-Bold',
        italic: 'Courier-Oblique',
        boldItalic: 'Courier-BoldOblique',
      };
    }

    // For Symbol or ZapfDingbats, use as-is
    return {
      regular: resolvedFont,
      bold: resolvedFont,
      italic: resolvedFont,
      boldItalic: resolvedFont,
    };
  }

  // It's a custom font file - register it with PDFKit
  try {
    doc.registerFont('CustomFont', resolvedFont);
    return {
      regular: 'CustomFont',
      bold: 'CustomFont',
      italic: 'CustomFont',
      boldItalic: 'CustomFont',
    };
  } catch (err) {
    console.warn(`Failed to register font "${resolvedFont}":`, err);
    return {
      regular: 'Helvetica',
      bold: 'Helvetica-Bold',
      italic: 'Helvetica-Oblique',
      boldItalic: 'Helvetica-BoldOblique',
    };
  }
}

/**
 * Merge partial typography options with defaults
 */
function mergeTypography(defaults: TypographyOptions, overrides?: Partial<TypographyOptions>, fonts?: { regular: string; bold: string; italic: string; boldItalic: string }): TypographyOptions {
  if (!overrides && !fonts) {
    return defaults;
  }

  const merged = { ...defaults };

  // Apply font overrides
  if (fonts) {
    merged.fonts = fonts;
  }

  // Apply typography overrides
  if (overrides) {
    if (overrides.fonts) merged.fonts = { ...merged.fonts, ...overrides.fonts };
    if (overrides.header) merged.header = { ...merged.header, ...overrides.header };
    if (overrides.sectionTitle) merged.sectionTitle = { ...merged.sectionTitle, ...overrides.sectionTitle };
    if (overrides.entry) merged.entry = { ...merged.entry, ...overrides.entry };
    if (overrides.text) merged.text = { ...merged.text, ...overrides.text };
    if (overrides.bullet) merged.bullet = { ...merged.bullet, ...overrides.bullet };
    if (overrides.quote) merged.quote = { ...merged.quote, ...overrides.quote };
    if (overrides.divider) merged.divider = { ...merged.divider, ...overrides.divider };
  }

  return merged;
}

/**
 * Convert column width config to Yoga-compatible format
 * @param width - Width as percentage string ("30%") or points (150)
 * @param defaultPercent - Default percentage if not specified
 */
function normalizeColumnWidth(width: string | number | undefined, defaultPercent: string): string | number {
  if (width === undefined) {
    return defaultPercent;
  }
  return width;
}

/**
 * Render elements within a column context
 */
function renderColumnElements(doc: InstanceType<typeof PDFDocument>, layoutEngine: LayoutEngine, elements: LayoutElement[], typography: TypographyOptions, fieldTemplates: Required<FieldTemplates>, emojiAvailable: boolean): void {
  for (const element of elements) {
    renderElement(doc, layoutEngine, element, typography, fieldTemplates, emojiAvailable);
  }
}

/**
 * Render a two-column layout using Yoga for precise column positioning
 */
async function renderTwoColumnLayout(doc: InstanceType<typeof PDFDocument>, layoutEngine: LayoutEngine, resumeLayout: ResumeLayout & { style: 'two-column' }, typography: TypographyOptions, fieldTemplates: Required<FieldTemplates>, emojiAvailable: boolean): Promise<void> {
  const contentWidth = layoutEngine.getContentWidth();
  const marginLeft = layoutEngine.getMargin();
  const gap = resumeLayout.gap;

  // Normalize column widths
  const leftWidth = normalizeColumnWidth(resumeLayout.left.width, '30%');
  const rightWidth = normalizeColumnWidth(resumeLayout.right.width, '70%');

  // Create Yoga layout structure for two columns
  const columnLayout: LayoutContent = {
    type: 'group',
    direction: 'row',
    gap,
    width: contentWidth,
    children: [
      { type: 'group', width: leftWidth, height: 1 }, // Placeholder height for layout calc
      { type: 'group', width: rightWidth, height: 1 },
    ],
  };

  // Simple measurer - columns don't need height measurement for position calculation
  const measureHeight: HeightMeasurer = () => 1;

  // Calculate layout with Yoga
  const layoutNodes = await calculateLayout(
    [columnLayout],
    contentWidth + marginLeft * 2, // Page width
    undefined, // No page height constraint
    measureHeight,
    { top: 0, right: marginLeft, bottom: 0, left: marginLeft }
  );

  // Extract computed column positions
  const rootNode = layoutNodes[0];
  const leftColumn = rootNode?.children?.[0];
  const rightColumn = rootNode?.children?.[1];
  if (!leftColumn || !rightColumn) {
    throw new Error('Yoga layout failed to compute two-column positions');
  }

  // Track starting Y position
  const startY = layoutEngine.getCurrentY();

  // Render left column using computed Yoga position and width
  layoutEngine.setColumnContext(leftColumn.x, leftColumn.width);
  renderColumnElements(doc, layoutEngine, resumeLayout.left.elements, typography, fieldTemplates, emojiAvailable);
  const leftEndY = layoutEngine.getCurrentY();

  // Reset Y and render right column using computed Yoga position and width
  layoutEngine.setY(startY);
  layoutEngine.setColumnContext(rightColumn.x, rightColumn.width);
  renderColumnElements(doc, layoutEngine, resumeLayout.right.elements, typography, fieldTemplates, emojiAvailable);
  const rightEndY = layoutEngine.getCurrentY();

  // Clear column context and set Y to the max of both columns
  layoutEngine.clearColumnContext();
  layoutEngine.setY(Math.max(leftEndY, rightEndY));
}

/**
 * Renders a resume to PDF buffer using the transform → render pipeline
 */
export async function generateResumePDFBuffer(resume: ResumeSchema, options: RenderOptions = {}): Promise<Buffer> {
  // Check if content has Unicode characters or emoji
  const resumeText = JSON.stringify(resume);
  const containsUnicode = needsUnicodeFont(resumeText);
  const containsEmoji = hasEmoji(resumeText);
  const isDefaultFont = !options.font || options.font === 'auto';

  // Register emoji font for rendering
  const emojiAvailable = containsEmoji ? registerEmojiFont() : false;

  // Warn about emoji if font not available
  if (containsEmoji && !emojiAvailable) {
    console.warn('⚠️  EMOJI DETECTED but emoji font not available.\n' + '   Run: npm install (to download Noto Color Emoji)\n' + '   Emojis will be skipped in the PDF.');
  } else if (containsEmoji && emojiAvailable) {
    console.log('✅ Emoji support enabled - rendering emojis as inline images');
  }

  // Warn if Unicode detected with default font
  if (containsUnicode && isDefaultFont && !containsEmoji) {
    console.warn("⚠️  Unicode characters detected. If they don't render properly, " + 'provide a Unicode font URL. Find fonts at https://fontsource.org');
  }

  // Build sections config with field templates
  const baseSections = options.sections ?? DEFAULT_SECTIONS;
  const sectionsConfig: SectionsConfig = {
    ...baseSections,
    fieldTemplates: options.fieldTemplates ? { ...baseSections.fieldTemplates, ...options.fieldTemplates } : baseSections.fieldTemplates,
  };

  // Transform resume to IR
  const layoutDoc = transformToLayout(resume, sectionsConfig);

  // Apply layout transform for two-column support
  const resumeLayout = transformToResumeLayout(layoutDoc.elements, sectionsConfig.sections ?? [], options.layout);

  // Build ATS-friendly metadata from IR
  const { name, label, keywords } = layoutDoc.metadata;
  const skillKeywords = keywords?.join(', ') || '';

  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 50, bottom: 50, left: 54, right: 54 },
    // ATS & Accessibility improvements
    pdfVersion: '1.5',
    tagged: true,
    lang: 'en-US',
    displayTitle: true,
    info: {
      Title: `${name || 'Resume'} - Resume`,
      Author: name || 'Unknown',
      Subject: label || '',
      Keywords: `resume, CV${skillKeywords ? `, ${skillKeywords}` : ''}`,
    },
  });

  // Setup fonts
  const fonts = await setupFonts(doc, options.font);

  // Merge typography with defaults and font overrides
  const typography = mergeTypography(DEFAULT_TYPOGRAPHY, options.typography, fonts);

  // Initialize layout engine
  const layout = new LayoutEngine();
  layout.init(doc);

  // Return a promise that resolves when the PDF is complete
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Render based on layout type (async for Yoga-based two-column layout)
    (async () => {
      if (isTwoColumnLayout(resumeLayout)) {
        // Two-column layout: render columns side by side using Yoga
        await renderTwoColumnLayout(doc, layout, resumeLayout, typography, layoutDoc.fieldTemplates, emojiAvailable);
      } else {
        // Single-column layout: render as before
        renderLayoutDocument(doc, layout, layoutDoc, typography, emojiAvailable);
      }
      doc.end();
    })().catch(reject);
  });
}

export type { TypographyOptions } from './handlers/types.ts';
export { DEFAULT_TYPOGRAPHY } from './handlers/types.ts';
/** @deprecated Use DEFAULT_SECTIONS instead */
export { DEFAULT_LAYOUT, DEFAULT_SECTIONS } from './ir/transform.ts';
// Re-export types for external use
/** @deprecated Use SectionsConfig instead */
export type { FieldTemplates, LayoutConfig as LegacySectionsConfig, SectionsConfig } from './ir/types.ts';
