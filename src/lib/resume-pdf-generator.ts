/**
 * Resume PDF generator using Yoga layout engine with emoji support
 */

import PDFDocument from 'pdfkit';
// Import generated type from JSON Schema
import type { ResumeSchema } from '../../assets/resume.ts';
import { DEFAULT_PAGE_SIZE, type Margins, PAGE_SIZES, type PageSizePreset, RESUME_DEFAULT_MARGINS } from '../constants.ts';
import type { Logger } from '../types.ts';
import { registerEmojiFont } from './emoji-renderer.ts';
import { hasEmoji, needsUnicodeFont, setupFonts } from './fonts.ts';
import { isTwoColumnLayout, transformToResumeLayout } from './ir/layout-transform.ts';
import { DEFAULT_SECTIONS, transformToLayout } from './ir/transform.ts';
import type { FieldTemplates, SectionsConfig } from './ir/types.ts';
import type { FontConfig, TypographyOptions } from './types/typography.ts';
import { DEFAULT_TYPOGRAPHY } from './types/typography.ts';
import { calculateResumeLayout, calculateTwoColumnLayout, createRenderContext, type PageConfig, paginateLayoutWithAtomicGroups, renderPage } from './yoga-resume/index.ts';

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
  /** Page size preset (default: LETTER) */
  pageSize?: PageSizePreset;
  /** Page background color (hex like "#fffff0" or named color). Default: white. */
  backgroundColor?: string;
  /** Explicit margins (if provided, overrides default resume margins) */
  margins?: Margins;
  /** Whether to parse markdown */
  parseMarkdown?: boolean;
  /** Color for hyperlink text (default: #0066CC) */
  hyperlinkColor?: string;
}

/**
 * Setup fonts for the PDF document
 * Returns a FontConfig compatible with TypographyOptions (includes italic variants)
 * Falls back to Helvetica if font resolution or registration fails
 */

/**
 * Merge partial typography options with defaults
 */
function mergeTypography(defaults: TypographyOptions, overrides?: Partial<TypographyOptions>, fonts?: FontConfig): TypographyOptions {
  if (!overrides && !fonts) {
    return defaults;
  }

  const merged = { ...defaults };

  // Validate that all override keys exist in defaults
  if (overrides) {
    const validKeys = new Set(Object.keys(defaults));
    const overrideKeys = Object.keys(overrides);
    const unknownKeys = overrideKeys.filter((key) => !validKeys.has(key));

    if (unknownKeys.length > 0) {
      throw new Error(`Unknown typography properties: ${unknownKeys.join(', ')}`);
    }
  }

  // Apply typography overrides first
  if (overrides) {
    if (overrides.fonts) merged.fonts = { ...merged.fonts, ...overrides.fonts };
    if (overrides.header) merged.header = { ...merged.header, ...overrides.header };
    if (overrides.sectionTitle) merged.sectionTitle = { ...merged.sectionTitle, ...overrides.sectionTitle };
    if (overrides.entry) merged.entry = { ...merged.entry, ...overrides.entry };
    if (overrides.content) merged.content = { ...merged.content, ...overrides.content };
    if (overrides.entryHeader) merged.entryHeader = { ...merged.entryHeader, ...overrides.entryHeader };
    if (overrides.quote) merged.quote = { ...merged.quote, ...overrides.quote };
    if (overrides.divider) merged.divider = { ...merged.divider, ...overrides.divider };
  }

  // Apply font overrides from setupFonts - these take priority over typography.fonts
  if (fonts) {
    merged.fonts = fonts;
  }

  return merged;
}

/**
 * Renders a resume to PDF buffer using the transform → render pipeline
 */
export async function generateResumePDFBuffer(resume: ResumeSchema, options: RenderOptions, logger: Logger): Promise<Buffer> {
  // Check if content has Unicode characters or emoji
  const resumeText = JSON.stringify(resume);
  const containsUnicode = needsUnicodeFont(resumeText);
  const containsEmoji = hasEmoji(resumeText);
  const isDefaultFont = !options.font || options.font === 'auto';

  // Register emoji font for rendering
  const emojiAvailable = containsEmoji ? registerEmojiFont() : false;

  // Warn about emoji if font not available
  if (containsEmoji && !emojiAvailable) {
    logger.warn('⚠️  EMOJI DETECTED but emoji font not available.\n' + '   Run: npm install (to download Noto Color Emoji)\n' + '   Emojis will be skipped in the PDF.');
  } else if (containsEmoji && emojiAvailable) {
    logger.info('✅ Emoji support enabled - rendering emojis as inline images');
  }

  // Warn if Unicode detected with default font
  if (containsUnicode && isDefaultFont && !containsEmoji) {
    logger.warn("⚠️  Unicode characters detected. If they don't render properly, " + 'provide a Unicode font URL. Find fonts at https://fontsource.org');
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

  // Resolve page size
  const pageSize = options.pageSize ? PAGE_SIZES[options.pageSize] : DEFAULT_PAGE_SIZE;

  // Build ATS-friendly metadata from IR
  const { name, label, keywords } = layoutDoc.metadata;
  const skillKeywords = keywords?.join(', ') || '';

  const doc = new PDFDocument({
    size: [pageSize.width, pageSize.height],
    margins: options.margins ?? RESUME_DEFAULT_MARGINS,
    autoFirstPage: false, // Create pages explicitly for consistent background handling
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

  // Apply background color to ALL pages consistently via pageAdded event
  doc.on('pageAdded', () => {
    if (options.backgroundColor) {
      doc.rect(0, 0, pageSize.width, pageSize.height).fill(options.backgroundColor);
      doc.fillColor('black');
    }
  });

  // Add first page explicitly - triggers same event handler as all other pages
  doc.addPage();

  // Setup fonts
  const fonts = await setupFonts(doc, options.font);

  // Merge typography with defaults and font overrides
  const typography = mergeTypography(DEFAULT_TYPOGRAPHY, options.typography, fonts);

  // Page configuration
  const pageConfig: PageConfig = {
    width: pageSize.width,
    height: pageSize.height,
    margins: options.margins ?? RESUME_DEFAULT_MARGINS,
  };

  // Create render context
  const renderCtx = createRenderContext(doc, typography, layoutDoc.fieldTemplates, emojiAvailable, options.parseMarkdown ?? false, options.hyperlinkColor ?? '#0066CC');

  // Return a promise that resolves when the PDF is complete
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Render based on layout type using Yoga layout engine
    (async () => {
      if (isTwoColumnLayout(resumeLayout)) {
        // Two-column layout: calculate and render columns
        const twoColumnResult = await calculateTwoColumnLayout(
          doc,
          {
            gap: resumeLayout.gap,
            left: {
              width: resumeLayout.left.width,
              elements: resumeLayout.left.elements,
            },
            right: {
              width: resumeLayout.right.width,
              elements: resumeLayout.right.elements,
            },
          },
          typography,
          layoutDoc.fieldTemplates,
          emojiAvailable,
          pageConfig
        );

        // Paginate both columns
        const leftPages = paginateLayoutWithAtomicGroups(twoColumnResult.left, pageConfig);
        const rightPages = paginateLayoutWithAtomicGroups(twoColumnResult.right, pageConfig);
        const maxPages = Math.max(leftPages.length, rightPages.length);

        // Render pages
        for (let pageNum = 0; pageNum < maxPages; pageNum++) {
          if (pageNum > 0) {
            doc.addPage();
          }
          // Render left column nodes for this page
          const leftPage = leftPages[pageNum];
          if (leftPage) {
            renderPage(renderCtx, leftPage);
          }
          // Render right column nodes for this page
          const rightPage = rightPages[pageNum];
          if (rightPage) {
            renderPage(renderCtx, rightPage);
          }
        }
      } else {
        // Single-column layout
        const layoutNodes = await calculateResumeLayout(doc, resumeLayout.elements, typography, layoutDoc.fieldTemplates, emojiAvailable, pageConfig);

        // Paginate the layout
        const pages = paginateLayoutWithAtomicGroups(layoutNodes, pageConfig);

        // Render all pages
        for (const page of pages) {
          if (page.number > 0) {
            doc.addPage();
          }
          renderPage(renderCtx, page);
        }
      }
      doc.end();
    })().catch(reject);
  });
}

export { DEFAULT_SECTIONS } from './ir/transform.ts';
export type { FieldTemplates, SectionsConfig } from './ir/types.ts';
export type { TypographyOptions } from './types/typography.ts';
export { DEFAULT_TYPOGRAPHY } from './types/typography.ts';
