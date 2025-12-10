/**
 * Yoga Layout Integration
 *
 * Provides flexbox layout calculations using Facebook's Yoga layout engine.
 * This module translates our content schema into Yoga nodes, calculates layout,
 * and returns computed positions for rendering.
 *
 * Note: Uses lazy dynamic import to support CJS builds (yoga-layout is ESM-only).
 */

import type { Align, Justify, Node as YogaNode } from 'yoga-layout';

// Lazy-loaded Yoga module for CJS compatibility
let yogaModule: typeof import('yoga-layout') | null = null;

/**
 * Get the Yoga module (lazy-loaded for CJS compatibility)
 */
async function getYoga(): Promise<typeof import('yoga-layout')> {
  if (!yogaModule) {
    yogaModule = await import('yoga-layout');
  }
  return yogaModule;
}

/**
 * Layout properties for groups (flexbox container)
 */
export interface FlexboxProperties {
  /** Flex direction: column (default) or row */
  direction?: 'column' | 'row';
  /** Gap between children in points */
  gap?: number;
  /** Flex grow factor for this item */
  flex?: number;
  /** Main axis alignment */
  justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around';
  /** Cross axis alignment for children */
  alignItems?: 'start' | 'center' | 'end' | 'stretch';
  /** Self alignment (overrides parent's alignItems) */
  align?: 'start' | 'center' | 'end';
  /** Width - number (points) or string (percentage like "50%") */
  width?: number | string;
  /** Height - number (points) or string (percentage like "50%") */
  height?: number | string;
  /** Padding */
  padding?: number | { top?: number; right?: number; bottom?: number; left?: number };
}

/**
 * Layout node representing a content item with computed position
 */
export interface LayoutNode {
  /** Computed left position */
  x: number;
  /** Computed top position */
  y: number;
  /** Computed width */
  width: number;
  /** Computed height */
  height: number;
  /** Original content item reference */
  content: unknown;
  /** Child layout nodes */
  children?: LayoutNode[];
}

/**
 * Content item with flexbox properties for layout calculation
 */
export interface LayoutContent {
  type: string;
  /** Absolute x position (optional - omit for flow) */
  x?: number;
  /** Absolute y position (optional - omit for flow) */
  y?: number;
  /** Flexbox properties */
  direction?: 'column' | 'row';
  gap?: number;
  flex?: number;
  justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around';
  alignItems?: 'start' | 'center' | 'end' | 'stretch';
  align?: 'start' | 'center' | 'end';
  width?: number | string;
  height?: number | string;
  padding?: number | { top?: number; right?: number; bottom?: number; left?: number };
  /** Children for group type */
  children?: LayoutContent[];
  /** Visual properties */
  background?: string;
  border?: { color: string; width: number };
  /** Allow any other properties */
  [key: string]: unknown;
}

/**
 * Height measurer function type
 * Called by layout engine to measure text/image heights
 */
export type HeightMeasurer = (content: LayoutContent, availableWidth: number) => number;

/**
 * Map our justify values to Yoga Justify constants
 */
function mapJustify(Justify: typeof import('yoga-layout').Justify, justify?: string): Justify {
  switch (justify) {
    case 'center':
      return Justify.Center;
    case 'end':
      return Justify.FlexEnd;
    case 'space-between':
      return Justify.SpaceBetween;
    case 'space-around':
      return Justify.SpaceAround;
    default:
      return Justify.FlexStart;
  }
}

/**
 * Map our alignItems values to Yoga Align constants
 */
function mapAlign(Align: typeof import('yoga-layout').Align, align?: string): Align {
  switch (align) {
    case 'center':
      return Align.Center;
    case 'end':
      return Align.FlexEnd;
    case 'stretch':
      return Align.Stretch;
    default:
      return Align.FlexStart;
  }
}

/**
 * Parse percentage string to number
 */
function parsePercentage(value: string): number | null {
  if (value.endsWith('%')) {
    const num = parseFloat(value.slice(0, -1));
    return Number.isNaN(num) ? null : num;
  }
  return null;
}

/**
 * Apply size (width/height) to a Yoga node
 */
function applySize(_node: YogaNode, value: number | string | undefined, setter: (value: number) => void, percentSetter: (value: number) => void) {
  if (value === undefined) return;

  if (typeof value === 'number') {
    setter(value);
  } else {
    const percent = parsePercentage(value);
    if (percent !== null) {
      percentSetter(percent);
    }
  }
}

/**
 * Apply padding to a Yoga node
 */
function applyPadding(node: YogaNode, Edge: typeof import('yoga-layout').Edge, padding: number | { top?: number; right?: number; bottom?: number; left?: number } | undefined) {
  if (padding === undefined) return;

  if (typeof padding === 'number') {
    node.setPadding(Edge.All, padding);
  } else {
    if (padding.top !== undefined) node.setPadding(Edge.Top, padding.top);
    if (padding.right !== undefined) node.setPadding(Edge.Right, padding.right);
    if (padding.bottom !== undefined) node.setPadding(Edge.Bottom, padding.bottom);
    if (padding.left !== undefined) node.setPadding(Edge.Left, padding.left);
  }
}

/**
 * Create a Yoga node for a content item
 */
function createYogaNode(
  Yoga: typeof import('yoga-layout').default,
  FlexDirection: typeof import('yoga-layout').FlexDirection,
  Justify: typeof import('yoga-layout').Justify,
  Align: typeof import('yoga-layout').Align,
  Edge: typeof import('yoga-layout').Edge,
  content: LayoutContent,
  parentWidth: number,
  measureHeight: HeightMeasurer
): YogaNode {
  const node = Yoga.Node.create();

  // Apply flex direction
  if (content.direction === 'row') {
    node.setFlexDirection(FlexDirection.Row);
  } else {
    node.setFlexDirection(FlexDirection.Column);
  }

  // Apply gap
  if (content.gap !== undefined) {
    node.setGap(Yoga.GUTTER_ALL, content.gap);
  }

  // Apply flex grow
  if (content.flex !== undefined) {
    node.setFlexGrow(content.flex);
  }

  // Apply justify content
  node.setJustifyContent(mapJustify(Justify, content.justify));

  // Apply align items
  node.setAlignItems(mapAlign(Align, content.alignItems));

  // Apply self alignment
  if (content.align !== undefined) {
    node.setAlignSelf(mapAlign(Align, content.align));
  }

  // Apply width
  applySize(
    node,
    content.width,
    (v) => node.setWidth(v),
    (v) => node.setWidthPercent(v)
  );

  // Apply height
  applySize(
    node,
    content.height,
    (v) => node.setHeight(v),
    (v) => node.setHeightPercent(v)
  );

  // Apply padding
  applyPadding(node, Edge, content.padding);

  // For non-group leaf nodes, measure height
  if (content.type !== 'group' && !content.children) {
    // Calculate available width for measuring
    let availableWidth = parentWidth;
    if (content.width !== undefined) {
      if (typeof content.width === 'number') {
        availableWidth = content.width;
      } else {
        const percent = parsePercentage(content.width);
        if (percent !== null) {
          availableWidth = (parentWidth * percent) / 100;
        }
      }
    }

    const height = measureHeight(content, availableWidth);
    if (height > 0) {
      node.setHeight(height);
    }
  }

  // Text/heading nodes default to 100% width (like CSS behavior)
  // This ensures text fills container and uses internal alignment
  if ((content.type === 'text' || content.type === 'heading') && content.width === undefined) {
    node.setWidthPercent(100);
  }

  return node;
}

/**
 * Build a Yoga node tree from content items
 */
function buildYogaTree(
  Yoga: typeof import('yoga-layout').default,
  FlexDirection: typeof import('yoga-layout').FlexDirection,
  Justify: typeof import('yoga-layout').Justify,
  Align: typeof import('yoga-layout').Align,
  Edge: typeof import('yoga-layout').Edge,
  content: LayoutContent,
  parentWidth: number,
  measureHeight: HeightMeasurer
): { node: YogaNode; content: LayoutContent } {
  const node = createYogaNode(Yoga, FlexDirection, Justify, Align, Edge, content, parentWidth, measureHeight);

  const children: { node: YogaNode; content: LayoutContent }[] = [];

  if (content.children) {
    // Calculate available width for children
    let childParentWidth = parentWidth;
    if (content.width !== undefined) {
      if (typeof content.width === 'number') {
        childParentWidth = content.width;
      } else {
        const percent = parsePercentage(content.width);
        if (percent !== null) {
          childParentWidth = (parentWidth * percent) / 100;
        }
      }
    }

    // Subtract padding from available width
    if (content.padding !== undefined) {
      if (typeof content.padding === 'number') {
        childParentWidth -= content.padding * 2;
      } else {
        childParentWidth -= (content.padding.left ?? 0) + (content.padding.right ?? 0);
      }
    }

    for (const [i, childContent] of content.children.entries()) {
      const childTree = buildYogaTree(Yoga, FlexDirection, Justify, Align, Edge, childContent, childParentWidth, measureHeight);
      node.insertChild(childTree.node, i);
      children.push(childTree);
    }
  }

  return { node, content, children } as { node: YogaNode; content: LayoutContent };
}

/**
 * Extract computed layout from Yoga node tree
 */
function extractLayout(tree: { node: YogaNode; content: LayoutContent; children?: { node: YogaNode; content: LayoutContent }[] }, offsetX: number, offsetY: number): LayoutNode {
  const layout = tree.node.getComputedLayout();

  const result: LayoutNode = {
    x: offsetX + layout.left,
    y: offsetY + layout.top,
    width: layout.width,
    height: layout.height,
    content: tree.content,
  };

  if (tree.children && tree.children.length > 0) {
    result.children = tree.children.map((child) => extractLayout(child, result.x, result.y));
  }

  return result;
}

/**
 * Free all Yoga nodes in a tree
 */
function freeYogaTree(tree: { node: YogaNode; children?: { node: YogaNode }[] }) {
  if (tree.children) {
    for (const child of tree.children) {
      freeYogaTree(child);
    }
  }
  tree.node.free();
}

/**
 * Calculate layout for content items
 *
 * @param content - Content items to lay out
 * @param pageWidth - Page width in points
 * @param pageHeight - Page height in points (optional, for percentage heights)
 * @param measureHeight - Function to measure content height
 * @param margins - Page margins
 * @returns Layout tree with computed positions
 */
export async function calculateLayout(content: LayoutContent[], pageWidth: number, pageHeight: number | undefined, measureHeight: HeightMeasurer, margins: { top: number; right: number; bottom: number; left: number } = { top: 50, right: 54, bottom: 50, left: 54 }): Promise<LayoutNode[]> {
  const yoga = await getYoga();
  const { default: Yoga, FlexDirection, Direction, Align, Justify, Edge } = yoga;

  const availableWidth = pageWidth - margins.left - margins.right;
  const availableHeight = pageHeight ? pageHeight - margins.top - margins.bottom : undefined;

  // Create root node that represents the page content area
  const root = Yoga.Node.create();
  root.setWidth(availableWidth);
  if (availableHeight !== undefined) {
    root.setHeight(availableHeight);
  }
  root.setFlexDirection(FlexDirection.Column);

  const trees: { node: YogaNode; content: LayoutContent; children?: { node: YogaNode; content: LayoutContent }[] }[] = [];

  // Build Yoga tree for each content item
  for (const item of content) {
    // If item has absolute positioning, don't add to flex layout
    if (item.x !== undefined && item.y !== undefined) {
      // Create a detached node just for measurement if needed
      const tree = buildYogaTree(Yoga, FlexDirection, Justify, Align, Edge, item, availableWidth, measureHeight);
      tree.node.calculateLayout(typeof item.width === 'number' ? item.width : availableWidth, undefined, Direction.LTR);
      trees.push({ ...tree, _absolute: true } as (typeof trees)[0] & { _absolute?: boolean });
      continue;
    }

    const tree = buildYogaTree(Yoga, FlexDirection, Justify, Align, Edge, item, availableWidth, measureHeight);
    root.insertChild(tree.node, root.getChildCount());
    trees.push(tree);
  }

  // Calculate layout
  root.calculateLayout(availableWidth, availableHeight, Direction.LTR);

  // Extract layouts
  const results: LayoutNode[] = [];
  let _treeIndex = 0;
  for (const tree of trees) {
    const treeWithAbsolute = tree as typeof tree & { _absolute?: boolean };
    if (treeWithAbsolute._absolute) {
      // Absolute positioned item - use its explicit position
      const item = tree.content;
      const layout = tree.node.getComputedLayout();
      results.push({
        x: item.x as number,
        y: item.y as number,
        width: layout.width,
        height: layout.height,
        content: tree.content,
        ...(tree.children &&
          tree.children.length > 0 && {
            children: tree.children.map((child) => extractLayout(child, item.x as number, item.y as number)),
          }),
      });
    } else {
      // Flow item - use computed position offset by margins
      results.push(extractLayout(tree, margins.left, margins.top));
    }
    _treeIndex++;
  }

  // Cleanup
  for (const tree of trees) {
    const treeWithAbsolute = tree as typeof tree & { _absolute?: boolean };
    if (!treeWithAbsolute._absolute) {
      // Node was added to root, root will handle cleanup
    }
    freeYogaTree(tree);
  }
  root.free();

  return results;
}

/**
 * Calculate layout for a single group, useful for self-centering
 *
 * @param group - Group content to lay out
 * @param containerWidth - Container width for centering calculation
 * @param measureHeight - Function to measure content height
 * @returns Layout node with computed position
 */
export async function calculateGroupLayout(group: LayoutContent, containerWidth: number, measureHeight: HeightMeasurer): Promise<LayoutNode> {
  const yoga = await getYoga();
  const { default: Yoga, FlexDirection, Direction, Align, Justify, Edge } = yoga;

  const tree = buildYogaTree(Yoga, FlexDirection, Justify, Align, Edge, group, containerWidth, measureHeight);

  // Calculate layout
  const width = typeof group.width === 'number' ? group.width : containerWidth;
  tree.node.calculateLayout(width, undefined, Direction.LTR);

  // Extract layout
  let x = 0;
  const layout = tree.node.getComputedLayout();

  // Handle self-centering
  if (group.align === 'center') {
    x = (containerWidth - layout.width) / 2;
  } else if (group.align === 'end') {
    x = containerWidth - layout.width;
  }

  // Apply explicit y if provided
  const y = group.y ?? 0;

  const result = extractLayout(tree, x, y);
  freeYogaTree(tree);

  return result;
}
