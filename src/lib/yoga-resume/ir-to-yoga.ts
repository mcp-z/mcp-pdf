/**
 * Lays resume elements out with Yoga.
 *
 * Yoga positions each element from its block's height; the same blocks are then paginated and drawn.
 */

import type { LayoutElement } from '../ir/types.ts';
import type { HeightMeasurer, LayoutContent } from '../yoga-layout.ts';
import { calculateLayout } from '../yoga-layout.ts';
import { type Block, buildBlock } from './blocks.ts';
import { DEFAULT_PAGE_CONFIG, type PlacedBlock } from './paginate.ts';
import type { PageConfig, RenderContext } from './types.ts';

function toYoga(element: LayoutElement): LayoutContent {
  return { type: element.type, _element: element };
}

/**
 * Measures through blocks, remembering each element's block at the width Yoga asked for so the placed block is the
 * one that was measured.
 */
function blockMeasurer(ctx: RenderContext): { measure: HeightMeasurer; blockFor: (element: LayoutElement, width: number) => Block } {
  const blocks = new Map<LayoutElement, Map<number, Block>>();
  const blockFor = (element: LayoutElement, width: number): Block => {
    let byWidth = blocks.get(element);
    if (!byWidth) {
      byWidth = new Map();
      blocks.set(element, byWidth);
    }
    let block = byWidth.get(width);
    if (!block) {
      block = buildBlock(ctx, element, width);
      byWidth.set(width, block);
    }
    return block;
  };
  const measure: HeightMeasurer = (content, availableWidth) => {
    const element = (content as LayoutContent & { _element?: LayoutElement })._element;
    return element ? blockFor(element, availableWidth).height : 0;
  };
  return { measure, blockFor };
}

/**
 * Lays elements out in one column down the page.
 */
export async function calculateResumeLayout(ctx: RenderContext, elements: LayoutElement[], config: PageConfig = DEFAULT_PAGE_CONFIG): Promise<PlacedBlock[]> {
  const { measure, blockFor } = blockMeasurer(ctx);
  const nodes = await calculateLayout(elements.map(toYoga), config.width, undefined, measure, config.margins);
  return nodes.map((node, i) => ({ block: blockFor(elements[i] as LayoutElement, node.width), x: node.x, y: node.y }));
}

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
 * Lays elements out in two columns that grow independently from the top.
 */
export async function calculateTwoColumnLayout(ctx: RenderContext, layout: TwoColumnLayoutConfig, config: PageConfig = DEFAULT_PAGE_CONFIG): Promise<{ left: PlacedBlock[]; right: PlacedBlock[] }> {
  const { measure, blockFor } = blockMeasurer(ctx);
  const contentWidth = config.width - config.margins.left - config.margins.right;
  const tree: LayoutContent = {
    type: 'group',
    direction: 'row',
    gap: layout.gap,
    width: contentWidth,
    alignItems: 'start',
    children: [
      { type: 'group', direction: 'column', width: layout.left.width ?? '30%', children: layout.left.elements.map(toYoga) },
      { type: 'group', direction: 'column', width: layout.right.width ?? '70%', children: layout.right.elements.map(toYoga) },
    ],
  };
  const [row] = await calculateLayout([tree], config.width, undefined, measure, config.margins);
  const [left, right] = row?.children ?? [];
  if (!left || !right) throw new Error('Yoga failed to compute column layout');
  const place = (column: typeof left, elements: LayoutElement[]): PlacedBlock[] => (column.children ?? []).map((node, i) => ({ block: blockFor(elements[i] as LayoutElement, node.width), x: node.x, y: node.y }));
  return { left: place(left, layout.left.elements), right: place(right, layout.right.elements) };
}
