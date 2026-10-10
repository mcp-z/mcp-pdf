/**
 * Types for Yoga-based resume layout.
 *
 * These types model the resume as a tree of Yoga nodes with computed positions.
 * The IR elements are transformed into these types, laid out with Yoga,
 * and then rendered at exact computed positions.
 */

import type { FieldTemplates } from '../ir/types.ts';
import type { FontConfig, TypographyOptions } from '../types/typography.ts';

// =============================================================================
// Render Context
// =============================================================================

/**
 * Context passed to all renderers.
 * Contains everything needed to render at a computed position.
 */
export interface RenderContext {
  doc: PDFKit.PDFDocument;
  typography: TypographyOptions;
  fieldTemplates: Required<FieldTemplates>;
  emojiAvailable: boolean;
  fonts: FontConfig;
  parseMarkdown: boolean;
  hyperlinkColor: string;
}

// =============================================================================
// Layout Configuration
// =============================================================================

/**
 * Page configuration for layout calculation.
 */
export interface PageConfig {
  width: number;
  height: number;
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

/**
 * Two-column layout configuration.
 */
export interface TwoColumnConfig {
  style: 'two-column';
  gap: number;
  left: {
    width?: number | string;
    sections: string[];
  };
  right: {
    width?: number | string;
    sections: string[];
  };
}

/**
 * Single-column layout configuration.
 */
export interface SingleColumnConfig {
  style: 'single-column';
}

export type LayoutConfig = SingleColumnConfig | TwoColumnConfig;

// =============================================================================
// Type Guards
// =============================================================================

export function isTwoColumnConfig(config: LayoutConfig): config is TwoColumnConfig {
  return config.style === 'two-column';
}

// =============================================================================
// Entry Column Layout
// =============================================================================

/**
 * Default gap between left and right columns in entry layouts.
 * Used consistently across work, education, and credential entries.
 */
export const ENTRY_COLUMN_GAP = 10;

/**
 * Computed column widths for entry layouts.
 */
export interface EntryColumnWidths {
  /** Width for left column (title, company, content) */
  leftWidth: number;
  /** Width for right column (dates, location) */
  rightWidth: number;
  /** Gap between columns */
  gap: number;
}

/**
 * Calculate column widths for entry layouts (work, education, etc.).
 *
 * Entries use a two-column layout:
 * - Left: title, company, summary, highlights
 * - Right: dates, location
 *
 * This helper ensures consistent column calculations across
 * measurement and rendering code.
 *
 * @param totalWidth - Available width for the entry
 * @param dateColumnWidth - Width reserved for the right column (from typography.entry.date.width)
 * @returns Column widths and gap
 */
export function calculateEntryColumnWidths(totalWidth: number, dateColumnWidth: number): EntryColumnWidths {
  return {
    leftWidth: totalWidth - dateColumnWidth - ENTRY_COLUMN_GAP,
    rightWidth: dateColumnWidth,
    gap: ENTRY_COLUMN_GAP,
  };
}
