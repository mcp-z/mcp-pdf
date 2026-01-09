/**
 * Yoga-based resume layout module.
 *
 * This module provides:
 * - Type definitions for Yoga-based resume layout
 * - Height measurement for IR elements
 * - Pagination for multi-page documents
 * - IR to Yoga transformation
 * - Position-based rendering
 */

export type { TwoColumnLayoutConfig } from './ir-to-yoga.ts';
// IR to Yoga transformation
export {
  calculateResumeLayout,
  calculateTwoColumnLayout,
  transformToYogaNodes,
} from './ir-to-yoga.ts';

// Measurement
export {
  createMeasureContext,
  measureCredentialList,
  measureDivider,
  measureElement,
  measureEntryList,
  measureGroup,
  measureHeader,
  measureKeywordList,
  measureLanguageList,
  measureReferenceList,
  measureSectionTitle,
  measureStructuredContent,
  measureText,
} from './measure.ts';

// Pagination
export {
  calculateNewPageOffset,
  calculatePageCount,
  calculateTotalHeight,
  DEFAULT_PAGE_CONFIG,
  getContentHeight,
  getContentWidth,
  paginateLayout,
  paginateLayoutWithAtomicGroups,
  wouldCausePageBreak,
} from './paginate.ts';
// Rendering
export {
  createRenderContext,
  renderCredentialList,
  renderDivider,
  renderGroup,
  renderHeader,
  renderKeywordList,
  renderLanguageList,
  renderPage,
  renderPageNode,
  renderReferenceList,
  renderSectionTitle,
  renderStructuredContent,
  renderTextElement,
} from './render.ts';
// Types
export type {
  ComputedPosition,
  LayoutConfig,
  MeasureContext,
  Page,
  PageConfig,
  PageNode,
  RenderContext,
  ResumeLayoutNode,
  SingleColumnConfig,
  TwoColumnConfig,
} from './types.ts';
export { isTwoColumnConfig } from './types.ts';
