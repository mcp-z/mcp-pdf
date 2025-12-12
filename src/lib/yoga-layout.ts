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
  /** Position mode: 'relative' (default) stays in flow, 'absolute' removes from flow */
  position?: 'relative' | 'absolute';
  /** Horizontal position (CSS-style) - absolute coord if position='absolute', offset from flow position otherwise */
  left?: number;
  /** Vertical position (CSS-style) - absolute coord if position='absolute', offset from flow position otherwise */
  top?: number;
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
  /** Allow any other properties (visual props, text content, etc.) */
  [key: string]: unknown;
}

/**
 * Height measurer function type
 * Called by layout engine to measure text/image heights
 */
export type HeightMeasurer = (content: LayoutContent, availableWidth: number) => number;

/**
 * Width measurer function type
 * Called by layout engine to measure natural text width (for row layouts)
 */
export type WidthMeasurer = (content: LayoutContent) => number;

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
  measureHeight: HeightMeasurer,
  measureWidth: WidthMeasurer | undefined,
  parentDirection: 'column' | 'row' = 'column'
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

  // For non-group leaf nodes, measure height and optionally width
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

    // For row children without explicit width, measure natural text width first
    // This ensures height is measured at the correct width
    if (parentDirection === 'row' && content.width === undefined && content.flex === undefined && measureWidth) {
      const naturalWidth = measureWidth(content);
      if (naturalWidth > 0) {
        node.setWidth(naturalWidth);
        availableWidth = naturalWidth;
      }
    }

    const height = measureHeight(content, availableWidth);
    if (height > 0) {
      node.setHeight(height);
    }
  }

  // Column children fill available width (CSS block behavior)
  // Row children shrink-wrap to content (CSS flexbox behavior)
  // Flex children use flex for sizing, not auto-width
  if (content.width === undefined && content.flex === undefined && parentDirection === 'column') {
    node.setWidthPercent(100);
  }

  return node;
}

/**
 * Yoga tree node with children
 */
interface YogaTreeNode {
  node: YogaNode;
  content: LayoutContent;
  children?: YogaTreeNode[];
  /** Absolute-positioned children that don't participate in flex layout */
  absoluteChildren?: YogaTreeNode[];
}

/**
 * Calculate estimated width for a flex child in a row container
 * This allows accurate text height measurement before Yoga calculates final layout
 */
function estimateFlexChildWidth(children: LayoutContent[], childIndex: number, containerWidth: number, gap: number): number {
  // Calculate total flex value and count gaps
  let totalFlex = 0;
  let flexChildCount = 0;

  for (const child of children) {
    if (child.position === 'absolute') continue;
    if (child.flex !== undefined && child.flex > 0) {
      totalFlex += child.flex;
      flexChildCount++;
    }
  }

  // If no flex children or this child has no flex, return container width
  const targetChild = children[childIndex];
  if (!targetChild || totalFlex === 0 || !targetChild.flex) {
    return containerWidth;
  }

  // Calculate space available for flex distribution (after gaps)
  const totalGaps = Math.max(0, flexChildCount - 1);
  const spaceForFlex = containerWidth - totalGaps * gap;

  // Calculate this child's share
  return (spaceForFlex * targetChild.flex) / totalFlex;
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
  measureHeight: HeightMeasurer,
  measureWidth: WidthMeasurer | undefined,
  parentDirection: 'column' | 'row' = 'column'
): YogaTreeNode {
  const node = createYogaNode(Yoga, FlexDirection, Justify, Align, Edge, content, parentWidth, measureHeight, measureWidth, parentDirection);

  const children: YogaTreeNode[] = [];

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

    const absoluteChildren: YogaTreeNode[] = [];
    let flexIndex = 0;

    // Pass this node's direction to children so they know if they're in a row or column
    const thisDirection = content.direction || 'column';
    const gap = content.gap ?? 0;

    for (let i = 0; i < content.children.length; i++) {
      const childContent = content.children[i];
      if (!childContent) continue;

      // For row containers with flex children, estimate width for accurate height measurement
      let effectiveChildWidth = childParentWidth;
      if (thisDirection === 'row' && childContent.flex !== undefined) {
        effectiveChildWidth = estimateFlexChildWidth(content.children, i, childParentWidth, gap);
      }

      const childTree = buildYogaTree(Yoga, FlexDirection, Justify, Align, Edge, childContent, effectiveChildWidth, measureHeight, measureWidth, thisDirection);

      // Children with position='absolute' are removed from flex layout
      if (childContent.position === 'absolute') {
        // Calculate layout independently for absolute children
        childTree.node.calculateLayout(typeof childContent.width === 'number' ? childContent.width : childParentWidth, undefined, Yoga.DIRECTION_LTR);
        absoluteChildren.push(childTree);
      } else {
        node.insertChild(childTree.node, flexIndex++);
        children.push(childTree);
      }
    }

    // If parent has only absolute children and no explicit height, set minimum height
    // based on the bounding box of absolute children so subsequent siblings don't overlap
    if (absoluteChildren.length > 0 && children.length === 0 && content.height === undefined) {
      let maxBottom = 0;
      for (const absChild of absoluteChildren) {
        const absContent = absChild.content;
        const absLayout = absChild.node.getComputedLayout();
        const bottom = (absContent.top as number) + absLayout.height;
        if (bottom > maxBottom) {
          maxBottom = bottom;
        }
      }
      if (maxBottom > 0) {
        node.setHeight(maxBottom);
      }
    }

    return {
      node,
      content,
      children: children.length > 0 ? children : undefined,
      absoluteChildren: absoluteChildren.length > 0 ? absoluteChildren : undefined,
    };
  }

  return { node, content, children: children.length > 0 ? children : undefined };
}

/**
 * Extract computed layout from Yoga node tree
 */
function extractLayout(tree: YogaTreeNode, offsetX: number, offsetY: number): LayoutNode {
  const layout = tree.node.getComputedLayout();

  // Apply relative left/top offsets from computed position
  const content = tree.content;
  const relativeOffsetX = content.position !== 'absolute' && typeof content.left === 'number' ? content.left : 0;
  const relativeOffsetY = content.position !== 'absolute' && typeof content.top === 'number' ? content.top : 0;

  const result: LayoutNode = {
    x: offsetX + layout.left + relativeOffsetX,
    y: offsetY + layout.top + relativeOffsetY,
    width: layout.width,
    height: layout.height,
    content: tree.content,
  };

  const allChildren: LayoutNode[] = [];

  // Add flex children with computed positions
  if (tree.children && tree.children.length > 0) {
    for (const child of tree.children) {
      allChildren.push(extractLayout(child, result.x, result.y));
    }
  }

  // Add absolute children with their explicit positions
  if (tree.absoluteChildren && tree.absoluteChildren.length > 0) {
    for (const child of tree.absoluteChildren) {
      const childContent = child.content;
      const childLayout = child.node.getComputedLayout();
      allChildren.push({
        x: childContent.left as number,
        y: childContent.top as number,
        width: childLayout.width,
        height: childLayout.height,
        content: childContent,
        // Recursively extract any children of the absolute item
        ...(child.children &&
          child.children.length > 0 && {
            children: child.children.map((c) => extractLayout(c, childContent.left as number, childContent.top as number)),
          }),
      });
    }
  }

  if (allChildren.length > 0) {
    result.children = allChildren;
  }

  return result;
}

/**
 * Free all Yoga nodes in a tree
 */
function freeYogaTree(tree: YogaTreeNode) {
  if (tree.children) {
    for (const child of tree.children) {
      freeYogaTree(child);
    }
  }
  if (tree.absoluteChildren) {
    for (const child of tree.absoluteChildren) {
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
 * @param measureWidth - Optional function to measure content width (for row layouts with space-between)
 * @returns Layout tree with computed positions
 */
export async function calculateLayout(content: LayoutContent[], pageWidth: number, pageHeight: number | undefined, measureHeight: HeightMeasurer, margins: { top: number; right: number; bottom: number; left: number }, measureWidth?: WidthMeasurer): Promise<LayoutNode[]> {
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

  const trees: (YogaTreeNode & { _absolute?: boolean })[] = [];

  // Build Yoga tree for each content item
  for (const item of content) {
    // If item has position='absolute', don't add to flex layout
    if (item.position === 'absolute') {
      // Create a detached node just for measurement if needed
      const tree = buildYogaTree(Yoga, FlexDirection, Justify, Align, Edge, item, availableWidth, measureHeight, measureWidth);
      tree.node.calculateLayout(typeof item.width === 'number' ? item.width : availableWidth, undefined, Direction.LTR);
      trees.push({ ...tree, _absolute: true });
      continue;
    }

    const tree = buildYogaTree(Yoga, FlexDirection, Justify, Align, Edge, item, availableWidth, measureHeight, measureWidth);
    root.insertChild(tree.node, root.getChildCount());
    trees.push(tree);
  }

  // Calculate layout
  root.calculateLayout(availableWidth, availableHeight, Direction.LTR);

  // Extract layouts
  const results: LayoutNode[] = [];
  for (const tree of trees) {
    if (tree._absolute) {
      // Absolute positioned item - use its explicit position
      const item = tree.content;
      const layout = tree.node.getComputedLayout();
      results.push({
        x: item.left as number,
        y: item.top as number,
        width: layout.width,
        height: layout.height,
        content: tree.content,
        ...(tree.children &&
          tree.children.length > 0 && {
            children: tree.children.map((child) => extractLayout(child, item.left as number, item.top as number)),
          }),
      });
    } else {
      // Flow item - use computed position offset by margins
      results.push(extractLayout(tree, margins.left, margins.top));
    }
  }

  // Cleanup
  for (const tree of trees) {
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
 * @param measureWidth - Optional function to measure content width (for row layouts)
 * @returns Layout node with computed position
 */
export async function calculateGroupLayout(group: LayoutContent, containerWidth: number, measureHeight: HeightMeasurer, measureWidth?: WidthMeasurer): Promise<LayoutNode> {
  const yoga = await getYoga();
  const { default: Yoga, FlexDirection, Direction, Align, Justify, Edge } = yoga;

  const tree = buildYogaTree(Yoga, FlexDirection, Justify, Align, Edge, group, containerWidth, measureHeight, measureWidth);

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

  const result = extractLayout(tree, x, 0);
  freeYogaTree(tree);

  return result;
}
