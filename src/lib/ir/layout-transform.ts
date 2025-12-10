/**
 * Layout Transform: IR Elements + LayoutConfig → Two-Column Layout Structure
 *
 * This module takes the IR elements from transform.ts and reorganizes them
 * based on the layout configuration (single-column or two-column).
 *
 * For single-column: Returns elements as-is (no transformation needed)
 * For two-column: Wraps elements in column groups based on section assignment
 */

import type { ColumnConfig, LayoutConfig } from '../resume-pdf-generator.ts';
import type { DividerConfig, LayoutElement, SectionConfig } from './types.ts';

/**
 * Column layout with assigned IR elements
 */
export interface ColumnLayout {
  /** Column width - number (points) or string (percentage) */
  width?: string | number;
  /** IR elements assigned to this column */
  elements: LayoutElement[];
}

/**
 * Two-column layout structure
 */
export interface TwoColumnLayout {
  style: 'two-column';
  /** Gap between columns in points */
  gap: number;
  /** Left/sidebar column */
  left: ColumnLayout;
  /** Right/main column */
  right: ColumnLayout;
}

/**
 * Single-column layout structure (just elements in flow order)
 */
export interface SingleColumnLayout {
  style: 'single-column';
  /** All elements in original order */
  elements: LayoutElement[];
}

/**
 * Layout result - either single or two-column
 */
export type ResumeLayout = SingleColumnLayout | TwoColumnLayout;

/**
 * Get the source path for an IR element.
 * Elements are tagged with their source during transformation.
 */
function getElementSource(element: LayoutElement): string | undefined {
  return element.source;
}

/**
 * Build a mapping from IR elements to their source paths.
 * Elements are now tagged with their source during transformation,
 * so we just read from the element directly.
 *
 * @deprecated This function exists for backwards compatibility.
 * Use element.source directly instead.
 */
export function buildElementSourceMap(elements: LayoutElement[], _sections: (SectionConfig | DividerConfig)[]): Map<LayoutElement, string> {
  const sourceMap = new Map<LayoutElement, string>();

  for (const element of elements) {
    if (element.source) {
      sourceMap.set(element, element.source);
    }
  }

  return sourceMap;
}

/**
 * Assign elements to columns based on layout configuration.
 *
 * Elements are assigned to columns based on their source paths matching
 * the section source paths in the column configuration.
 *
 * Elements not explicitly assigned go to the right (main) column.
 */
function assignElementsToColumns(elements: LayoutElement[], columns: { left?: ColumnConfig; right?: ColumnConfig }): { left: LayoutElement[]; right: LayoutElement[] } {
  const leftSources = new Set(columns.left?.sections || []);
  const rightSources = new Set(columns.right?.sections || []);

  const leftElements: LayoutElement[] = [];
  const rightElements: LayoutElement[] = [];

  for (const element of elements) {
    const source = getElementSource(element);

    if (source && leftSources.has(source)) {
      leftElements.push(element);
    } else if (source && rightSources.has(source)) {
      rightElements.push(element);
    } else {
      // Default: unassigned elements go to right column
      rightElements.push(element);
    }
  }

  return { left: leftElements, right: rightElements };
}

/**
 * Transform IR elements to a layout structure based on configuration.
 *
 * @param elements - IR elements from transform.ts
 * @param sections - Section configurations (for source path mapping)
 * @param layoutConfig - Layout configuration (single-column or two-column)
 * @returns Layout structure ready for rendering
 */
export function transformToResumeLayout(elements: LayoutElement[], sections: (SectionConfig | DividerConfig)[], layoutConfig?: LayoutConfig): ResumeLayout {
  // Default: single-column layout
  if (!layoutConfig || layoutConfig.style === 'single-column' || !layoutConfig.columns) {
    return {
      style: 'single-column',
      elements,
    };
  }

  // Two-column layout - elements are tagged with their source during transformation
  const { left, right } = assignElementsToColumns(elements, layoutConfig.columns);

  return {
    style: 'two-column',
    gap: layoutConfig.gap ?? 30,
    left: {
      width: layoutConfig.columns.left?.width ?? '30%',
      elements: left,
    },
    right: {
      width: layoutConfig.columns.right?.width ?? '70%',
      elements: right,
    },
  };
}

/**
 * Type guard for two-column layout
 */
export function isTwoColumnLayout(layout: ResumeLayout): layout is TwoColumnLayout {
  return layout.style === 'two-column';
}

/**
 * Type guard for single-column layout
 */
export function isSingleColumnLayout(layout: ResumeLayout): layout is SingleColumnLayout {
  return layout.style === 'single-column';
}
