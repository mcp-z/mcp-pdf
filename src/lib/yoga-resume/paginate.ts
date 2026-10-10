/**
 * Page breaks for the Yoga-based resume layout.
 *
 * Yoga positions blocks as if on one endless page. This splits them into pages, breaking only between lines and
 * never directly after a line that is kept with the next: a title or entry header always stays with the first line
 * after it, and anything else may continue on the next page between any two lines.
 */

import { DEFAULT_PAGE_SIZE, RESUME_DEFAULT_MARGINS } from '../../constants.ts';
import type { Block } from './blocks.ts';
import type { PageConfig } from './types.ts';

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

/** A block positioned by Yoga on the endless page */
export interface PlacedBlock {
  block: Block;
  x: number;
  y: number;
}

/** The part of a block drawn on one page: lines whose top lies in [from, to), with the block's top at page y `top` */
export interface PageSlice {
  block: Block;
  x: number;
  top: number;
  from: number;
  to: number;
}

/** Offsets within a block where a page may break: before a line whose previous line is not kept with it */
function breakOffsets(block: Block): number[] {
  return block.lines.filter((_line, i) => i > 0 && !(block.lines[i - 1]?.keepWithNext ?? false)).map((line) => line.top);
}

/** Height from a block's top to the end of its first unbreakable run of lines */
function firstRun(block: Block): number {
  return breakOffsets(block)[0] ?? block.height;
}

/**
 * Splits positioned blocks (one column, in order) into pages.
 */
export function paginateBlocks(placed: PlacedBlock[], config: PageConfig): PageSlice[][] {
  const pageTop = config.margins.top;
  const pageBottom = config.height - config.margins.bottom;
  const pages: PageSlice[][] = [[]];
  // Endless-page y that maps to the top of the current page's content area
  let offset = 0;
  const current = (): PageSlice[] => pages[pages.length - 1] as PageSlice[];
  const newPage = (startAt: number): void => {
    pages.push([]);
    offset = startAt - pageTop;
  };

  placed.forEach(({ block, x, y }, index) => {
    // A block kept with the next needs room for itself, any following kept blocks, and the first run of the block after
    let required = y + block.height;
    for (let next = index; placed[next]?.block.keepWithNext; next++) {
      const after = placed[next + 1];
      if (after) required = after.y + firstRun(after.block);
    }

    let from = 0;
    for (;;) {
      const fitsBottom = (at: number): boolean => at - offset <= pageBottom + 1e-6;
      if (fitsBottom(from === 0 ? required : y + block.height)) {
        current().push({ block, x, top: y - offset, from, to: block.height });
        return;
      }
      const candidates = breakOffsets(block).filter((b) => b > from && fitsBottom(y + b));
      const cut = candidates[candidates.length - 1];
      if (cut !== undefined && !(from === 0 && block.keepWithNext)) {
        current().push({ block, x, top: y - offset, from, to: cut });
        newPage(y + cut);
        from = cut;
        continue;
      }
      if (current().length > 0) {
        newPage(y + from);
        continue;
      }
      // Nothing fits on an empty page: place the rest as it is
      current().push({ block, x, top: y - offset, from, to: block.height });
      return;
    }
  });
  return pages;
}

/**
 * Draws one page's slices: every line whose top lies in the slice.
 */
export function drawPage(slices: PageSlice[]): void {
  for (const slice of slices) {
    for (const line of slice.block.lines) {
      if (line.top >= slice.from && line.top < slice.to) line.draw(slice.x, slice.top + line.top);
    }
  }
}
