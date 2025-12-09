/**
 * Group element handler - atomic block for page break control (react-pdf style wrap={false})
 *
 * When wrap is false (or undefined), the group is atomic: if it doesn't fit on the
 * current page, the entire group moves to the next page. This is the same behavior
 * as react-pdf's <View wrap={false}>.
 *
 * Usage in IR transform:
 * {
 *   type: 'group',
 *   wrap: false,  // atomic - keep together
 *   children: [
 *     { type: 'section-title', title: 'VOLUNTEER EXPERIENCE' },
 *     { type: 'entry-list', entries: [firstEntry], variant: 'work' }
 *   ]
 * }
 */

import type PDFKit from 'pdfkit';
import type { FormattingOptions, GroupElement } from '../ir/types.ts';
import type { LayoutEngine } from '../layout-engine.ts';
import { measureElement } from './measure.ts';
import type { TypographyOptions } from './types.ts';

// Forward declaration - will be set by index.ts to avoid circular dependency
let renderElementFn: ((doc: PDFKit.PDFDocument, layout: LayoutEngine, element: unknown, typography: TypographyOptions, formatting: FormattingOptions, emojiAvailable: boolean) => void) | null = null;

export function setRenderElementFn(fn: typeof renderElementFn): void {
  renderElementFn = fn;
}

export function renderGroupHandler(doc: PDFKit.PDFDocument, layout: LayoutEngine, element: GroupElement, typography: TypographyOptions, formatting: FormattingOptions, emojiAvailable: boolean): void {
  const { children, wrap } = element;

  if (!children || children.length === 0) return;

  if (!renderElementFn) {
    throw new Error('renderGroupHandler: renderElementFn not set. Call setRenderElementFn first.');
  }

  // When wrap is false (or undefined - default to atomic), ensure space for entire group
  if (wrap === false || wrap === undefined) {
    // Measure total height of all children
    const totalHeight = children.reduce((sum, child) => {
      return sum + measureElement(doc, layout, child, typography, formatting);
    }, 0);

    // Ensure space for entire group atomically
    // If it doesn't fit, this will trigger a page break
    if (totalHeight > 0) {
      layout.ensureSpace(doc, totalHeight);
    }
  }

  // Render children sequentially
  for (const child of children) {
    renderElementFn(doc, layout, child, typography, formatting, emojiAvailable);
  }
}
