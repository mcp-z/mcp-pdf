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
 * Default margin for general PDF documents (1 inch = 72 points).
 */
export const DEFAULT_MARGIN = 72;

/**
 * Default margins for resume documents.
 * Intentionally tighter than standard 1-inch margins to fit more content.
 * top/bottom: 50pt (~0.69"), left/right: 54pt (~0.75")
 */
export const RESUME_DEFAULT_MARGINS = {
  top: 50,
  right: 54,
  bottom: 50,
  left: 54,
} as const;

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
