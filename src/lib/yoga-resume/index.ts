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

export type { TwoColumnLayoutConfig } from './ir-to-yoga.js';
// IR to Yoga transformation
export {
  calculateResumeLayout,
  calculateTwoColumnLayout,
  transformToYogaNodes,
} from './ir-to-yoga.js';

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
  measureText,
} from './measure.js';

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
} from './paginate.js';
// Rendering
export {
  createRenderContext,
  renderCredentialList,
  renderDivider,
  renderEntryList,
  renderGroup,
  renderHeader,
  renderKeywordList,
  renderLanguageList,
  renderPage,
  renderPageNode,
  renderReferenceList,
  renderSectionTitle,
  renderSummaryHighlights,
  renderText,
} from './render.js';
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
} from './types.js';
export { isTwoColumnConfig } from './types.js';
