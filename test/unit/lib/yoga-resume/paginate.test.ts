import assert from 'assert';
import type { Block } from '../../../../src/lib/yoga-resume/blocks.ts';
import { getContentHeight, type PageSlice, paginateBlocks } from '../../../../src/lib/yoga-resume/paginate.ts';
import type { PageConfig } from '../../../../src/lib/yoga-resume/types.ts';

// US Letter, 50pt top and bottom margins: content runs from y=50 to y=742
const config: PageConfig = { width: 612, height: 792, margins: { top: 50, bottom: 50, left: 54, right: 54 } };

/** A block of `count` lines of `lineHeight`; `keep` marks every line as kept with the next (unbreakable) */
function block(count: number, lineHeight = 10, options: { keepWithNext?: boolean; unbreakable?: boolean } = {}): Block {
  return {
    height: count * lineHeight,
    keepWithNext: options.keepWithNext ?? false,
    lines: Array.from({ length: count }, (_, i) => ({ top: i * lineHeight, height: lineHeight, keepWithNext: (options.unbreakable ?? false) && i < count - 1, draw: () => {} })),
  };
}

/** Lays blocks out one after another from the top margin, as Yoga does for a column */
function stack(blocks: Block[]): Array<{ block: Block; x: number; y: number }> {
  let y = config.margins.top;
  return blocks.map((b) => {
    const placed = { block: b, x: 54, y };
    y += b.height;
    return placed;
  });
}

function summary(pages: PageSlice[][]): Array<Array<[number, number, number]>> {
  return pages.map((page) => page.map((s) => [s.top, s.from, s.to]));
}

describe('yoga-resume/paginate', () => {
  it('calculates content height from page config', () => {
    assert.strictEqual(getContentHeight(config), 692);
  });

  it('places blocks that fit on one page', () => {
    const pages = paginateBlocks(stack([block(3), block(5)]), config);
    assert.deepStrictEqual(summary(pages), [
      [
        [50, 0, 30],
        [80, 0, 50],
      ],
    ]);
  });

  it('breaks a block between lines at the bottom of the page', () => {
    // 680pt fill, then 4 lines of 10pt: two fit above 742, two move on
    const pages = paginateBlocks(stack([block(68), block(4)]), config);
    assert.deepStrictEqual(summary(pages), [
      [
        [50, 0, 680],
        [730, 0, 10],
      ],
      [[40, 10, 40]],
    ]);
  });

  it('continues a block taller than a page across several pages', () => {
    const pages = paginateBlocks(stack([block(150)]), config);
    assert.strictEqual(pages.length, 3);
    assert.deepStrictEqual(
      pages.map((page) => page.map((s) => s.to - s.from)),
      [[690], [690], [120]]
    );
  });

  it('moves a title to the next page with the first line after it', () => {
    // The title (690-710) fits, but the first 40pt content line after it (710-750) does not
    const pages = paginateBlocks(stack([block(64), block(2, 10, { keepWithNext: true, unbreakable: true }), block(3, 40)]), config);
    assert.deepStrictEqual(summary(pages), [
      [[50, 0, 640]],
      [
        [50, 0, 20],
        [70, 0, 120],
      ],
    ]);
  });

  it('keeps a chain of titles and headers with the first content line', () => {
    const title = block(1, 20, { keepWithNext: true });
    const header = block(2, 15, { keepWithNext: true, unbreakable: true });
    const pages = paginateBlocks(stack([block(64), title, header, block(5)]), config);
    assert.deepStrictEqual(
      pages.map((page) => page.length),
      [1, 3]
    );
  });

  it('moves an unbreakable block whole', () => {
    const pages = paginateBlocks(stack([block(66), block(4, 10, { unbreakable: true })]), config);
    assert.deepStrictEqual(summary(pages), [[[50, 0, 660]], [[50, 0, 40]]]);
  });

  it('places an unbreakable block taller than a page rather than looping', () => {
    const pages = paginateBlocks(stack([block(80, 10, { unbreakable: true })]), config);
    assert.deepStrictEqual(summary(pages), [[[50, 0, 800]]]);
  });
});
