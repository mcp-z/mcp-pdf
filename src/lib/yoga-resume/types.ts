/**
 * Types for Yoga-based resume layout.
 *
 * These types model the resume as a tree of Yoga nodes with computed positions.
 * The IR elements are transformed into these types, laid out with Yoga,
 * and then rendered at exact computed positions.
 */

import type { FieldTemplates, LayoutElement } from '../ir/types.ts';
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
}

// =============================================================================
// Computed Position
// =============================================================================

/**
 * Computed position from Yoga layout.
 * All values in points.
 */
export interface ComputedPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

// =============================================================================
// Page Layout
// =============================================================================

/**
 * A single page of content with adjusted positions.
 */
export interface Page {
  /** 0-indexed page number */
  number: number;
  /** Layout nodes for this page with Y positions adjusted for page */
  nodes: PageNode[];
}

/**
 * A layout node with its IR element and computed position, adjusted for page.
 */
export interface PageNode {
  /** Original IR element */
  element: LayoutElement;
  /** Computed position (Y adjusted for page) */
  position: ComputedPosition;
  /** Child nodes (for groups, entry items, etc.) */
  children?: PageNode[];
}

// =============================================================================
// Measurement Context
// =============================================================================

/**
 * Context for height measurement.
 */
export interface MeasureContext {
  doc: PDFKit.PDFDocument;
  typography: TypographyOptions;
  fieldTemplates: Required<FieldTemplates>;
  emojiAvailable: boolean;
  /** Available width for content */
  width: number;
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
// Extended Layout Node
// =============================================================================

/**
 * Extended LayoutNode that includes the original IR element.
 * This bridges Yoga's computed layout with our rendering system.
 */
export interface ResumeLayoutNode {
  /** Original IR element */
  element: LayoutElement;
  /** Yoga-computed X position */
  x: number;
  /** Yoga-computed Y position */
  y: number;
  /** Yoga-computed width */
  width: number;
  /** Yoga-computed height */
  height: number;
  /** Child nodes for groups */
  children?: ResumeLayoutNode[];
}

// =============================================================================
// Type Guards
// =============================================================================

export function isTwoColumnConfig(config: LayoutConfig): config is TwoColumnConfig {
  return config.style === 'two-column';
}
