/**
 * Yoga-based resume layout: elements become blocks of lines, Yoga positions them, and pages are cut between lines.
 */

export { type Block, type BlockLine, buildBlock } from './blocks.ts';
export { calculateResumeLayout, calculateTwoColumnLayout, type TwoColumnLayoutConfig } from './ir-to-yoga.ts';
export { DEFAULT_PAGE_CONFIG, drawPage, getContentHeight, type PageSlice, type PlacedBlock, paginateBlocks } from './paginate.ts';
export type { LayoutConfig, PageConfig, RenderContext, SingleColumnConfig, TwoColumnConfig } from './types.ts';
export { isTwoColumnConfig } from './types.ts';
