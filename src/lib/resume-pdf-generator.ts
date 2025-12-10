/**
 * Resume PDF generator using IR transformation pipeline with emoji support
 */

import PDFDocument from 'pdfkit';
// Import generated type from JSON Schema
import type { ResumeSchema } from '../../assets/resume.d.ts';
import { registerEmojiFont } from './emoji-renderer.ts';
import { hasEmoji, isPDFStandardFont, needsUnicodeFont, resolveFont } from './fonts.ts';
import { renderLayoutDocument } from './handlers/index.ts';
import type { TypographyOptions } from './handlers/types.ts';
import { DEFAULT_TYPOGRAPHY } from './handlers/types.ts';
import { DEFAULT_LAYOUT, transformToLayout } from './ir/transform.ts';
import type { FieldTemplates, LayoutConfig } from './ir/types.ts';
import { LayoutEngine } from './layout-engine.ts';

// Re-export types for external use
export type { ResumeSchema };

/**
 * Render options for resume PDF generation
 */
export interface RenderOptions {
  /** Custom typography settings */
  typography?: Partial<TypographyOptions>;
  /** Layout configuration (section order, titles, etc.) */
  layout?: LayoutConfig;
  /** Field templates for customizing field-level rendering (dates, locations, etc.) */
  fieldTemplates?: FieldTemplates;
  /** Font specification (path, URL, 'auto', or standard font name) */
  font?: string;
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

  // Build layout config with field templates
  const baseLayout = options.layout ?? DEFAULT_LAYOUT;
  const layoutConfig: LayoutConfig = {
    ...baseLayout,
    fieldTemplates: options.fieldTemplates ? { ...baseLayout.fieldTemplates, ...options.fieldTemplates } : baseLayout.fieldTemplates,
  };

  // Transform resume to IR
  const layoutDoc = transformToLayout(resume, layoutConfig);

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

    // Render the layout document with emoji support
    renderLayoutDocument(doc, layout, layoutDoc, typography, emojiAvailable);
    doc.end();
  });
}

export type { TypographyOptions } from './handlers/types.ts';
export { DEFAULT_TYPOGRAPHY } from './handlers/types.ts';
export { DEFAULT_LAYOUT } from './ir/transform.ts';
// Re-export types for external use
export type { FieldTemplates, LayoutConfig } from './ir/types.ts';
