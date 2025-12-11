/**
 * Transform IR elements to Yoga layout nodes.
 *
 * This module bridges the IR (Intermediate Representation) from resume
 * transformation with the Yoga layout engine.
 */

import type PDFKit from 'pdfkit';
import type { FieldTemplates, GroupElement, LayoutElement } from '../ir/types.ts';
import type { TypographyOptions } from '../types/typography.ts';
import type { HeightMeasurer, LayoutContent, LayoutNode } from '../yoga-layout.ts';
import { calculateLayout } from '../yoga-layout.ts';
import { createMeasureContext, measureElement } from './measure.ts';
import { DEFAULT_PAGE_CONFIG } from './paginate.ts';
import type { PageConfig, ResumeLayoutNode } from './types.ts';

// =============================================================================
// IR to Yoga Transformation
// =============================================================================

/**
 * Transform an IR element to a Yoga LayoutContent node.
 *
 * Each IR element becomes a Yoga node with measured height.
 * Groups become container nodes with children.
 */
function irElementToYoga(element: LayoutElement): LayoutContent {
  const base: LayoutContent = {
    type: element.type,
    // Store the original element for rendering
    _element: element,
  };

  // Groups need children transformed recursively
  if (element.type === 'group') {
    const group = element as GroupElement;
    return {
      ...base,
      type: 'group',
      direction: 'column',
      children: group.children.map(irElementToYoga),
      // wrap=false means this group should stay together (atomic)
      _atomic: group.wrap === false,
    };
  }

  return base;
}

/**
 * Create a height measurer function for Yoga layout.
 *
 * This wraps our measureElement function in the interface Yoga expects.
 */
function createHeightMeasurer(doc: PDFKit.PDFDocument, typography: TypographyOptions, fieldTemplates: Required<FieldTemplates>, emojiAvailable: boolean): HeightMeasurer {
  return (content: LayoutContent, availableWidth: number): number => {
    // Get the original IR element from the Yoga node
    const element = (content as LayoutContent & { _element?: LayoutElement })._element;
    if (!element) {
      return 0;
    }

    const ctx = createMeasureContext(doc, typography, fieldTemplates, emojiAvailable, availableWidth);
    return measureElement(ctx, element);
  };
}

/**
 * Transform a LayoutDocument to Yoga layout nodes.
 */
export function transformToYogaNodes(elements: LayoutElement[]): LayoutContent[] {
  return elements.map(irElementToYoga);
}

/**
 * Calculate layout for IR elements using Yoga.
 *
 * This is the main entry point for Yoga-based layout calculation.
 *
 * @param doc - PDFKit document for measurements
 * @param elements - IR elements to lay out
 * @param typography - Typography options
 * @param fieldTemplates - Field templates for rendering
 * @param emojiAvailable - Whether emoji rendering is available
 * @param config - Page configuration
 * @returns Layout nodes with computed positions and the original IR elements
 */
export async function calculateResumeLayout(doc: PDFKit.PDFDocument, elements: LayoutElement[], typography: TypographyOptions, fieldTemplates: Required<FieldTemplates>, emojiAvailable: boolean, config: PageConfig = DEFAULT_PAGE_CONFIG): Promise<ResumeLayoutNode[]> {
  // Transform IR elements to Yoga-compatible nodes
  const yogaNodes = transformToYogaNodes(elements);

  // Create height measurer
  const measureHeight = createHeightMeasurer(doc, typography, fieldTemplates, emojiAvailable);

  // Calculate layout using Yoga
  const layoutNodes = await calculateLayout(
    yogaNodes,
    config.width,
    undefined, // Let Yoga calculate height
    measureHeight,
    config.margins
  );

  // Convert LayoutNode[] to ResumeLayoutNode[] by extracting IR elements
  return layoutNodes.map((node, index) => toResumeLayoutNode(node, elements[index]));
}

/**
 * Convert a Yoga LayoutNode to a ResumeLayoutNode.
 *
 * This extracts the original IR element and includes it in the result.
 */
function toResumeLayoutNode(node: LayoutNode, element: LayoutElement): ResumeLayoutNode {
  const result: ResumeLayoutNode = {
    element,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  };

  // Handle children for groups
  if (node.children && element.type === 'group') {
    const group = element as GroupElement;
    result.children = node.children.map((childNode, index) => toResumeLayoutNode(childNode, group.children[index]));
  }

  return result;
}

// =============================================================================
// Two-Column Layout Support
// =============================================================================

/**
 * Configuration for two-column layout.
 */
export interface TwoColumnLayoutConfig {
  gap: number;
  left: {
    width?: number | string;
    elements: LayoutElement[];
  };
  right: {
    width?: number | string;
    elements: LayoutElement[];
  };
}

/**
 * Calculate layout for two-column resume layout.
 *
 * Creates a single unified Yoga tree with left and right columns,
 * computing all positions in one pass.
 */
export async function calculateTwoColumnLayout(
  doc: PDFKit.PDFDocument,
  layout: TwoColumnLayoutConfig,
  typography: TypographyOptions,
  fieldTemplates: Required<FieldTemplates>,
  emojiAvailable: boolean,
  config: PageConfig = DEFAULT_PAGE_CONFIG
): Promise<{ left: ResumeLayoutNode[]; right: ResumeLayoutNode[]; columnPositions: { leftX: number; leftWidth: number; rightX: number; rightWidth: number } }> {
  const contentWidth = config.width - config.margins.left - config.margins.right;
  const measureHeight = createHeightMeasurer(doc, typography, fieldTemplates, emojiAvailable);

  // Normalize column widths
  const leftWidth = layout.left.width ?? '30%';
  const rightWidth = layout.right.width ?? '70%';

  // Build unified Yoga tree with actual content in both columns
  const unifiedTree: LayoutContent = {
    type: 'group',
    direction: 'row',
    gap: layout.gap,
    width: contentWidth,
    alignItems: 'start', // Columns grow independently from top
    children: [
      {
        type: 'group',
        direction: 'column',
        width: leftWidth,
        children: transformToYogaNodes(layout.left.elements),
      },
      {
        type: 'group',
        direction: 'column',
        width: rightWidth,
        children: transformToYogaNodes(layout.right.elements),
      },
    ],
  };

  // Single Yoga calculation for entire two-column layout
  const [layoutResult] = await calculateLayout([unifiedTree], config.width, undefined, measureHeight, config.margins);

  const leftColumn = layoutResult.children?.[0];
  const rightColumn = layoutResult.children?.[1];

  if (!leftColumn || !rightColumn) {
    throw new Error('Yoga failed to compute column layout');
  }

  // Extract children from each column, converting to ResumeLayoutNode
  const leftNodes = (leftColumn.children ?? []).map((node, index) => toResumeLayoutNode(node, layout.left.elements[index]));

  const rightNodes = (rightColumn.children ?? []).map((node, index) => toResumeLayoutNode(node, layout.right.elements[index]));

  return {
    left: leftNodes,
    right: rightNodes,
    columnPositions: {
      leftX: leftColumn.x,
      leftWidth: leftColumn.width,
      rightX: rightColumn.x,
      rightWidth: rightColumn.width,
    },
  };
}
