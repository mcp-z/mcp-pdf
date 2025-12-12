/**
 * Page break logic for Yoga-based resume layout.
 *
 * Yoga calculates positions as if everything is on one infinite page.
 * This module splits the computed layout into pages, adjusting Y positions
 * for each page.
 */

import { DEFAULT_PAGE_SIZE, RESUME_DEFAULT_MARGINS } from '../../constants.ts';
import type { GroupElement, LayoutElement } from '../ir/types.ts';
import type { Page, PageConfig, PageNode, ResumeLayoutNode } from './types.ts';

/**
 * Default page configuration (US Letter with resume margins).
 */
export const DEFAULT_PAGE_CONFIG: PageConfig = {
  width: DEFAULT_PAGE_SIZE.width,
  height: DEFAULT_PAGE_SIZE.height,
  margins: RESUME_DEFAULT_MARGINS,
};

/**
 * Calculate the content height available on a page.
 */
export function getContentHeight(config: PageConfig): number {
  return config.height - config.margins.top - config.margins.bottom;
}

/**
 * Calculate the content width available on a page.
 */
export function getContentWidth(config: PageConfig): number {
  return config.width - config.margins.left - config.margins.right;
}

/**
 * Check if a node is a group with wrap=false (atomic block).
 */
function isAtomicGroup(element: LayoutElement): element is GroupElement {
  return element.type === 'group' && element.wrap === false;
}

/**
 * Convert a ResumeLayoutNode to a PageNode with adjusted Y position.
 */
function toPageNode(node: ResumeLayoutNode, yOffset: number): PageNode {
  const pageNode: PageNode = {
    element: node.element,
    position: {
      x: node.x,
      y: node.y - yOffset,
      width: node.width,
      height: node.height,
    },
  };

  if (node.children && node.children.length > 0) {
    pageNode.children = node.children.map((child) => toPageNode(child, yOffset));
  }

  return pageNode;
}

/**
 * Split layout nodes into pages.
 *
 * Algorithm:
 * 1. Process nodes in order, tracking current Y position
 * 2. When a node would overflow the page, start a new page
 * 3. Adjust Y positions so each page starts at margins.top
 *
 * @param nodes - Computed layout nodes from Yoga
 * @param config - Page configuration
 * @returns Array of pages with adjusted node positions
 */
export function paginateLayout(nodes: ResumeLayoutNode[], config: PageConfig = DEFAULT_PAGE_CONFIG): Page[] {
  const contentHeight = getContentHeight(config);
  const pageBottom = config.margins.top + contentHeight;

  const pages: Page[] = [{ number: 0, nodes: [] }];
  let currentPage = 0;
  let pageStartY = 0; // Y offset for current page

  for (const node of nodes) {
    const nodeTop = node.y;
    const _nodeBottom = node.y + node.height;
    const nodeHeight = node.height;

    // Check if node fits on current page
    // Note: nodeTop already includes margins.top from Yoga layout
    const currentPageY = nodeTop - pageStartY;
    const nodeBottomOnPage = currentPageY + nodeHeight;
    const fitsOnPage = nodeBottomOnPage <= pageBottom;

    // Check if this is an atomic group that should stay together
    const _isAtomic = isAtomicGroup(node.element);

    if (!fitsOnPage) {
      // Node doesn't fit - start new page
      currentPage++;
      pages.push({ number: currentPage, nodes: [] });

      // New page starts at the top margin
      // Calculate offset so this node starts at margins.top
      pageStartY = nodeTop - config.margins.top;
    }

    // Add node to current page with adjusted Y
    const pageNode = toPageNode(node, pageStartY);
    pages[currentPage].nodes.push(pageNode);
  }

  return pages;
}

/**
 * Check if a node would cause a page break at the given Y position.
 * Note: nodeY should already include margins.top from Yoga layout.
 */
export function wouldCausePageBreak(nodeY: number, nodeHeight: number, currentPageStartY: number, config: PageConfig): boolean {
  const contentHeight = getContentHeight(config);
  const pageBottom = config.margins.top + contentHeight;
  const nodeBottomOnPage = nodeY - currentPageStartY + nodeHeight;

  return nodeBottomOnPage > pageBottom;
}

/**
 * Calculate the Y offset for a new page.
 *
 * @param nodeY - The Y position of the node that triggered the page break
 * @param config - Page configuration
 * @returns The Y offset to subtract from nodes on the new page
 */
export function calculateNewPageOffset(nodeY: number, config: PageConfig): number {
  // The node should start at the top margin of the new page
  return nodeY - config.margins.top;
}

/**
 * Advanced pagination that handles atomic groups (wrap=false).
 *
 * When a group with wrap=false doesn't fit on the current page,
 * the entire group moves to the next page.
 */
export function paginateLayoutWithAtomicGroups(nodes: ResumeLayoutNode[], config: PageConfig = DEFAULT_PAGE_CONFIG): Page[] {
  const contentHeight = getContentHeight(config);
  const pageBottom = config.margins.top + contentHeight;

  const pages: Page[] = [{ number: 0, nodes: [] }];
  let currentPage = 0;
  let pageStartY = 0;

  for (const node of nodes) {
    const nodeTop = node.y;
    const nodeHeight = node.height;
    const isAtomic = isAtomicGroup(node.element);

    // Calculate position on current page
    // Note: nodeTop already includes margins.top from Yoga layout
    const currentPageY = nodeTop - pageStartY;
    const nodeBottomOnPage = currentPageY + nodeHeight;
    const fitsOnPage = nodeBottomOnPage <= pageBottom;

    // For atomic groups, check if the whole group fits
    // If not, and we're not at the top of a page, move to next page
    if (isAtomic && !fitsOnPage) {
      // Check if we're not already at the top of a fresh page
      if (pages[currentPage].nodes.length > 0) {
        // Start new page
        currentPage++;
        pages.push({ number: currentPage, nodes: [] });
        pageStartY = nodeTop - config.margins.top;
      }
    } else if (!fitsOnPage && !isAtomic) {
      // Non-atomic element that doesn't fit - start new page
      currentPage++;
      pages.push({ number: currentPage, nodes: [] });
      pageStartY = nodeTop - config.margins.top;
    }

    // Add node to current page with adjusted Y
    const pageNode = toPageNode(node, pageStartY);
    pages[currentPage].nodes.push(pageNode);
  }

  return pages;
}

/**
 * Calculate total document height from layout nodes.
 */
export function calculateTotalHeight(nodes: ResumeLayoutNode[]): number {
  if (nodes.length === 0) return 0;

  let maxBottom = 0;
  for (const node of nodes) {
    const bottom = node.y + node.height;
    if (bottom > maxBottom) {
      maxBottom = bottom;
    }
  }

  return maxBottom;
}

/**
 * Calculate the number of pages needed for a document.
 */
export function calculatePageCount(totalHeight: number, config: PageConfig): number {
  const contentHeight = getContentHeight(config);
  return Math.ceil((totalHeight - config.margins.top) / contentHeight);
}
