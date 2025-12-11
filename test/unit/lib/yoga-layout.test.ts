import assert from 'assert';
import { calculateGroupLayout, calculateLayout, type HeightMeasurer, type LayoutContent } from '../../../src/lib/yoga-layout.ts';

// Simple height measurer - returns fixed height for testing
const fixedHeightMeasurer: HeightMeasurer = () => 20;

describe('yoga-layout', () => {
  describe('calculateLayout', () => {
    it('calculates two equal flex children', async () => {
      const content: LayoutContent[] = [
        {
          type: 'group',
          direction: 'row',
          width: 500,
          children: [
            { type: 'group', flex: 1, height: 100 },
            { type: 'group', flex: 1, height: 100 },
          ],
        },
      ];

      const result = await calculateLayout(content, 612, undefined, fixedHeightMeasurer, {
        top: 0,
        right: 56,
        bottom: 0,
        left: 56,
      });

      assert.equal(result.length, 1);
      const group = result[0];
      assert.ok(group?.children);
      assert.equal(group.children.length, 2);
      assert.equal(group.children[0]?.width, 250);
      assert.equal(group.children[1]?.width, 250);
      assert.equal(group.children[1]?.x, group.children[0]?.x + 250);
    });

    it('applies gap between children', async () => {
      const content: LayoutContent[] = [
        {
          type: 'group',
          direction: 'row',
          width: 520,
          gap: 20,
          children: [
            { type: 'group', flex: 1, height: 100 },
            { type: 'group', flex: 1, height: 100 },
          ],
        },
      ];

      const result = await calculateLayout(content, 612, undefined, fixedHeightMeasurer, {
        top: 0,
        right: 46,
        bottom: 0,
        left: 46,
      });

      assert.equal(result.length, 1);
      const group = result[0];
      assert.ok(group?.children);
      // With gap 20, two flex:1 children split remaining 500pt
      assert.equal(group.children[0]?.width, 250);
      assert.equal(group.children[1]?.width, 250);
      // Second child x should be first child width + gap
      assert.equal(group.children[1]?.x, group.children[0]?.x + 250 + 20);
    });

    it('handles percentage widths', async () => {
      const content: LayoutContent[] = [
        {
          type: 'group',
          direction: 'row',
          width: 500,
          children: [
            { type: 'group', width: '30%', height: 100 },
            { type: 'group', width: '70%', height: 100 },
          ],
        },
      ];

      const result = await calculateLayout(content, 612, undefined, fixedHeightMeasurer, {
        top: 0,
        right: 56,
        bottom: 0,
        left: 56,
      });

      assert.equal(result.length, 1);
      const group = result[0];
      assert.ok(group?.children);
      assert.equal(group.children[0]?.width, 150); // 30% of 500
      assert.equal(group.children[1]?.width, 350); // 70% of 500
    });

    it('handles column direction (default)', async () => {
      const content: LayoutContent[] = [
        {
          type: 'group',
          width: 500,
          children: [
            { type: 'group', height: 100 },
            { type: 'group', height: 50 },
          ],
        },
      ];

      const result = await calculateLayout(content, 612, undefined, fixedHeightMeasurer, {
        top: 50,
        right: 56,
        bottom: 50,
        left: 56,
      });

      assert.equal(result.length, 1);
      const group = result[0];
      assert.ok(group?.children);
      // Children should stack vertically
      assert.equal(group.children[0]?.y, group.y);
      assert.equal(group.children[1]?.y, group.y + 100);
    });

    it('handles justify space-between', async () => {
      const content: LayoutContent[] = [
        {
          type: 'group',
          direction: 'row',
          width: 500,
          justify: 'space-between',
          children: [
            { type: 'group', width: 100, height: 50 },
            { type: 'group', width: 100, height: 50 },
          ],
        },
      ];

      const result = await calculateLayout(content, 612, undefined, fixedHeightMeasurer, {
        top: 0,
        right: 56,
        bottom: 0,
        left: 56,
      });

      const group = result[0];
      assert.ok(group?.children);
      // First child at start, second child at end
      assert.equal(group.children[0]?.x, group.x);
      assert.equal(group.children[1]?.x, group.x + 500 - 100); // Right aligned
    });

    it('handles padding', async () => {
      const content: LayoutContent[] = [
        {
          type: 'group',
          width: 500,
          padding: 20,
          children: [{ type: 'text', height: 50 }],
        },
      ];

      const result = await calculateLayout(content, 612, undefined, fixedHeightMeasurer, {
        top: 50,
        right: 56,
        bottom: 50,
        left: 56,
      });

      const group = result[0];
      assert.ok(group?.children);
      // Child should be offset by padding
      assert.equal(group.children[0]?.x, group.x + 20);
      assert.equal(group.children[0]?.y, group.y + 20);
    });

    it('handles absolute positioning', async () => {
      const content: LayoutContent[] = [
        {
          type: 'group',
          position: 'absolute',
          x: 100,
          y: 200,
          width: 300,
          height: 150,
        },
      ];

      const result = await calculateLayout(content, 612, 792, fixedHeightMeasurer);

      assert.equal(result.length, 1);
      assert.equal(result[0]?.x, 100);
      assert.equal(result[0]?.y, 200);
      assert.equal(result[0]?.width, 300);
      assert.equal(result[0]?.height, 150);
    });

    it('applies margins to content area', async () => {
      const content: LayoutContent[] = [{ type: 'text', height: 20 }];

      const result = await calculateLayout(content, 612, undefined, fixedHeightMeasurer, {
        top: 50,
        right: 54,
        bottom: 50,
        left: 54,
      });

      assert.equal(result.length, 1);
      assert.equal(result[0]?.x, 54); // Left margin
      assert.equal(result[0]?.y, 50); // Top margin
    });

    it('measures leaf node heights', async () => {
      const customMeasurer: HeightMeasurer = (content, width) => {
        if (content.type === 'text') {
          return width / 10; // Height based on width
        }
        return 20;
      };

      const content: LayoutContent[] = [{ type: 'text', width: 300 }];

      const result = await calculateLayout(content, 612, undefined, customMeasurer, {
        top: 0,
        right: 56,
        bottom: 0,
        left: 56,
      });

      assert.equal(result[0]?.height, 30); // 300 / 10
    });
  });

  describe('calculateGroupLayout', () => {
    it('calculates self-centering with align: center', async () => {
      const group: LayoutContent = {
        type: 'group',
        width: 300,
        height: 100,
        align: 'center',
      };

      const result = await calculateGroupLayout(group, 600, fixedHeightMeasurer);

      assert.equal(result.width, 300);
      assert.equal(result.x, 150); // Centered in 600pt container
    });

    it('calculates self-alignment with align: end', async () => {
      const group: LayoutContent = {
        type: 'group',
        width: 200,
        height: 100,
        align: 'end',
      };

      const result = await calculateGroupLayout(group, 500, fixedHeightMeasurer);

      assert.equal(result.width, 200);
      assert.equal(result.x, 300); // Right-aligned in 500pt container
    });

    it('preserves explicit y position', async () => {
      const group: LayoutContent = {
        type: 'group',
        width: 300,
        height: 100,
        align: 'center',
        y: 150,
      };

      const result = await calculateGroupLayout(group, 600, fixedHeightMeasurer);

      assert.equal(result.y, 150);
      assert.equal(result.x, 150);
    });

    it('handles nested children', async () => {
      const group: LayoutContent = {
        type: 'group',
        width: 400,
        direction: 'row',
        align: 'center',
        children: [
          { type: 'group', flex: 1, height: 50 },
          { type: 'group', flex: 1, height: 50 },
        ],
      };

      const result = await calculateGroupLayout(group, 600, fixedHeightMeasurer);

      assert.equal(result.x, 100); // Centered
      assert.ok(result.children);
      assert.equal(result.children.length, 2);
      assert.equal(result.children[0]?.width, 200);
      assert.equal(result.children[1]?.width, 200);
    });
  });

  describe('flex proportions', () => {
    it('distributes space by flex ratios', async () => {
      const content: LayoutContent[] = [
        {
          type: 'group',
          direction: 'row',
          width: 600,
          children: [
            { type: 'group', flex: 1, height: 100 },
            { type: 'group', flex: 2, height: 100 },
            { type: 'group', flex: 1, height: 100 },
          ],
        },
      ];

      const result = await calculateLayout(content, 700, undefined, fixedHeightMeasurer, {
        top: 0,
        right: 50,
        bottom: 0,
        left: 50,
      });

      const group = result[0];
      assert.ok(group?.children);
      // Total flex = 4, so 600/4 = 150 per flex unit
      assert.equal(group.children[0]?.width, 150); // flex: 1
      assert.equal(group.children[1]?.width, 300); // flex: 2
      assert.equal(group.children[2]?.width, 150); // flex: 1
    });
  });
});
