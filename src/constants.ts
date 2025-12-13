/**
 * Constants for PDF generation.
 *
 * Page sizes are in points (72 points = 1 inch).
 */

/**
 * Standard page size presets.
 */
export const PAGE_SIZES = {
  /** US Letter: 8.5" × 11" */
  LETTER: { width: 612, height: 792 },
  /** ISO A4: 210mm × 297mm */
  A4: { width: 595, height: 842 },
  /** US Legal: 8.5" × 14" */
  LEGAL: { width: 612, height: 1008 },
} as const;

export type PageSizePreset = keyof typeof PAGE_SIZES;
export type PageSize = { width: number; height: number };

/**
 * Default page size (US Letter).
 */
export const DEFAULT_PAGE_SIZE = PAGE_SIZES.LETTER;

/**
 * Margin type used across PDF tools.
 */
export type Margins = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

/**
 * Default margins by page size for general PDF documents.
 * Based on standard document conventions for each paper size.
 */
export const DEFAULT_MARGINS_BY_SIZE: Record<PageSizePreset, Margins> = {
  /** LETTER: 1 inch (72pt) all sides - US standard */
  LETTER: { top: 72, bottom: 72, left: 72, right: 72 },
  /** A4: 2.5cm (~71pt) top/bottom, 2cm (~57pt) left/right - ISO standard */
  A4: { top: 71, bottom: 71, left: 57, right: 57 },
  /** LEGAL: 1 inch (72pt) all sides - same as LETTER */
  LEGAL: { top: 72, bottom: 72, left: 72, right: 72 },
} as const;

/**
 * Get default margins for a page size.
 */
export function getDefaultMargins(size: PageSizePreset = 'LETTER'): Margins {
  return DEFAULT_MARGINS_BY_SIZE[size];
}

/**
 * Default margin for general PDF documents (1 inch = 72 points).
 * @deprecated Use getDefaultMargins(size) instead for page-size-appropriate defaults.
 */
export const DEFAULT_MARGIN = 72;

/**
 * Default margins for resume documents.
 * Intentionally tighter than standard 1-inch margins to fit more content.
 * top/bottom: 50pt (~0.69"), left/right: 54pt (~0.75")
 */
export const RESUME_DEFAULT_MARGINS: Margins = {
  top: 50,
  right: 54,
  bottom: 50,
  left: 54,
};

/**
 * Epsilon tolerance for floating-point comparisons in text wrapping.
 * Half a point provides reasonable precision while avoiding floating-point edge cases.
 */
export const WRAP_EPSILON = 0.5;

/**
 * Default font sizes for content rendering.
 */
export const DEFAULT_TEXT_FONT_SIZE = 12;
export const DEFAULT_HEADING_FONT_SIZE = 24;
