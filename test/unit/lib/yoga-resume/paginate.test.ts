import assert from 'assert';
import type { GroupElement, LayoutElement, TextElement } from '../../../../src/lib/ir/types.ts';
import { getContentHeight, paginateLayout, paginateLayoutWithAtomicGroups } from '../../../../src/lib/yoga-resume/paginate.ts';
import type { PageConfig, ResumeLayoutNode } from '../../../../src/lib/yoga-resume/types.ts';

/**
 * Helper to create a text element
 */
function textElement(content: string): TextElement {
  return { type: 'text', content };
}

/**
 * Helper to create a group element
 */
function groupElement(children: LayoutElement[], wrap = true): GroupElement {
  return { type: 'group', children, wrap };
}

/**
 * Helper to create a ResumeLayoutNode from element and position
 */
function layoutNode(element: LayoutElement, y: number, height: number, children?: ResumeLayoutNode[]): ResumeLayoutNode {
  return {
    element,
    x: 54, // default left margin
    y,
    width: 504, // default content width
    height,
    children,
  };
}

describe('yoga-resume/paginate', () => {
  // US Letter: 792pt height, margins 50pt top/bottom = 692pt content height
  // Content starts at y=50, page bottom at y=742
  const config: PageConfig = {
    width: 612,
    height: 792,
    margins: { top: 50, bottom: 50, left: 54, right: 54 },
  };

  describe('getContentHeight', () => {
    it('calculates content height from page config', () => {
      const contentHeight = getContentHeight(config);
      assert.equal(contentHeight, 692); // 792 - 50 - 50
    });
  });

  describe('paginateLayout', () => {
    it('places nodes that fit on single page', () => {
      const nodes: ResumeLayoutNode[] = [layoutNode(textElement('Header'), 50, 30), layoutNode(textElement('Content'), 80, 100)];

      const pages = paginateLayout(nodes, config);

      assert.equal(pages.length, 1);
      assert.equal(pages[0].nodes.length, 2);
      // Y positions should be unchanged for first page
      assert.equal(pages[0].nodes[0].position.y, 50);
      assert.equal(pages[0].nodes[1].position.y, 80);
    });

    it('creates new page when node exceeds page bottom', () => {
      const contentHeight = getContentHeight(config); // 692
      const _pageBottom = config.margins.top + contentHeight; // 742

      // First node fits
      // Second node at y=700 with height=100 would end at 800, exceeding 742
      const nodes: ResumeLayoutNode[] = [
        layoutNode(textElement('First'), 50, 100),
        layoutNode(textElement('Second'), 700, 100), // bottom at 800 > 742
      ];

      const pages = paginateLayout(nodes, config);

      assert.equal(pages.length, 2, 'should create 2 pages');
      assert.equal(pages[0].nodes.length, 1);
      assert.equal(pages[1].nodes.length, 1);
      // Second node should start at top margin of new page
      assert.equal(pages[1].nodes[0].position.y, 50);
    });
  });

  describe('paginateLayoutWithAtomicGroups', () => {
    it('keeps atomic groups together when they overflow', () => {
      const _contentHeight = getContentHeight(config); // 692

      // Create an atomic group that starts near the bottom and would overflow
      const atomicGroup = groupElement([textElement('Item 1'), textElement('Item 2')], false);

      const nodes: ResumeLayoutNode[] = [
        layoutNode(textElement('First'), 50, 600), // Takes most of page 1
        layoutNode(atomicGroup, 650, 150), // Would overflow: 650 + 150 = 800 > 742
      ];

      const pages = paginateLayoutWithAtomicGroups(nodes, config);

      assert.equal(pages.length, 2, 'should create 2 pages');
      assert.equal(pages[0].nodes.length, 1, 'first page has 1 node');
      assert.equal(pages[1].nodes.length, 1, 'second page has atomic group');
      // Atomic group should start at top margin of new page
      assert.equal(pages[1].nodes[0].position.y, 50);
    });
  });

  describe('nested group children overflow', () => {
    /**
     * This test demonstrates the core pagination bug:
     * When a non-atomic group contains children that extend beyond the page,
     * the children's content overflows instead of being paginated.
     *
     * The current algorithm only checks if the TOP-LEVEL node fits,
     * but doesn't recursively check or split children within groups.
     */
    it('should not allow nested children to overflow page bottom', () => {
      const pageBottom = config.margins.top + getContentHeight(config); // 742

      // Create a parent group with children
      // Child 1: y=50, height=600 -> bottom at 650 (fits)
      // Child 2: y=650, height=200 -> bottom at 850 (OVERFLOWS!)
      const parentGroup = groupElement([textElement('Child 1'), textElement('Child 2 - this will overflow')], true); // wrap=true means not atomic

      // The parent group's total height encompasses both children
      const parentNode = layoutNode(
        parentGroup,
        50, // starts at top margin
        800, // total height (child1: 600 + child2: 200)
        [
          // Child nodes with their positions
          layoutNode(textElement('Child 1'), 50, 600),
          layoutNode(textElement('Child 2 - this will overflow'), 650, 200),
        ]
      );

      const nodes: ResumeLayoutNode[] = [parentNode];
      const pages = paginateLayoutWithAtomicGroups(nodes, config);

      // CURRENT BEHAVIOR (BUG):
      // The algorithm places the entire parent group on page 1
      // because it only checks the top-level node, not the children.
      // Child 2 ends at y=850, which is 108pt past page bottom (742).

      // EXPECTED BEHAVIOR:
      // The algorithm should recognize that Child 2 overflows and either:
      // 1. Split Child 2 to the next page, OR
      // 2. Move Child 2 entirely to the next page

      // For this test, we verify that NO content extends past page bottom
      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        const page = pages[pageIndex];
        for (const node of page.nodes) {
          const nodeBottom = node.position.y + node.position.height;
          assert.ok(nodeBottom <= pageBottom, `Page ${pageIndex + 1}: Node bottom (${nodeBottom}) exceeds page bottom (${pageBottom}). ` + `Node starts at y=${node.position.y}, height=${node.position.height}`);

          // Also check children if present
          if (node.children) {
            for (const child of node.children) {
              const childBottom = child.position.y + child.position.height;
              assert.ok(childBottom <= pageBottom, `Page ${pageIndex + 1}: Child node bottom (${childBottom}) exceeds page bottom (${pageBottom}). ` + `Child starts at y=${child.position.y}, height=${child.position.height}`);
            }
          }
        }
      }
    });

    it('should paginate deeply nested groups correctly', () => {
      const pageBottom = config.margins.top + getContentHeight(config); // 742

      // Simulate a real resume structure:
      // - Section group (wrap=true)
      //   - Section title
      //   - Entry group (wrap=false, atomic - should stay together)
      //     - Entry header
      //     - Entry content (bullets)
      //   - Entry group (wrap=false, atomic)
      //     - Entry header
      //     - Entry content

      const entry1Header = textElement('Company 1 - Position 1');
      const entry1Content = textElement('Bullet points for entry 1');
      const entry1Group = groupElement([entry1Header, entry1Content], false); // atomic

      const entry2Header = textElement('Company 2 - Position 2');
      const entry2Content = textElement('Bullet points for entry 2 - long content');
      const entry2Group = groupElement([entry2Header, entry2Content], false); // atomic

      const sectionTitle = textElement('PROFESSIONAL EXPERIENCE');
      const sectionGroup = groupElement([sectionTitle, entry1Group, entry2Group], true); // not atomic

      // Layout: Section starts at 50
      // - Title: 50-80 (30pt)
      // - Entry 1: 80-580 (500pt)
      // - Entry 2: 580-880 (300pt) <- OVERFLOWS! Bottom at 880 > 742
      const sectionNode = layoutNode(
        sectionGroup,
        50,
        830, // total height
        [
          layoutNode(sectionTitle, 50, 30),
          layoutNode(entry1Group, 80, 500, [layoutNode(entry1Header, 80, 50), layoutNode(entry1Content, 130, 450)]),
          layoutNode(entry2Group, 580, 300, [
            // This entry overflows
            layoutNode(entry2Header, 580, 50),
            layoutNode(entry2Content, 630, 250), // Bottom at 880!
          ]),
        ]
      );

      const nodes: ResumeLayoutNode[] = [sectionNode];
      const pages = paginateLayoutWithAtomicGroups(nodes, config);

      // Expected: Entry 2 should be moved to page 2 (it's atomic)
      // Page 1: Section title + Entry 1
      // Page 2: Entry 2

      // Verify no content overflows
      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        const page = pages[pageIndex];

        function checkNodeBounds(node: (typeof page.nodes)[0], depth = 0): void {
          const nodeBottom = node.position.y + node.position.height;
          assert.ok(nodeBottom <= pageBottom, `Page ${pageIndex + 1}, depth ${depth}: Node bottom (${nodeBottom}) exceeds page bottom (${pageBottom})`);

          if (node.children) {
            for (const child of node.children) {
              checkNodeBounds(child, depth + 1);
            }
          }
        }

        for (const node of page.nodes) {
          checkNodeBounds(node);
        }
      }

      // Also verify we got multiple pages (content was split)
      assert.ok(pages.length >= 2, `Expected at least 2 pages due to overflow, got ${pages.length}`);
    });

    it('should handle entry that starts near page bottom and overflows', () => {
      const _pageBottom = config.margins.top + getContentHeight(config); // 742

      // Realistic scenario: Multiple entries where the last one overflows
      // Entry 1: y=50, height=300 -> bottom at 350
      // Entry 2: y=350, height=300 -> bottom at 650
      // Entry 3: y=650, height=200 -> bottom at 850 (OVERFLOWS)

      const entries = [
        layoutNode(groupElement([textElement('Entry 1')], false), 50, 300),
        layoutNode(groupElement([textElement('Entry 2')], false), 350, 300),
        layoutNode(groupElement([textElement('Entry 3')], false), 650, 200), // overflows
      ];

      const pages = paginateLayoutWithAtomicGroups(entries, config);

      // Entry 3 should be moved to page 2 since it's atomic and doesn't fit
      assert.equal(pages.length, 2, 'should have 2 pages');
      assert.equal(pages[0].nodes.length, 2, 'page 1 should have entries 1 and 2');
      assert.equal(pages[1].nodes.length, 1, 'page 2 should have entry 3');

      // Verify entry 3 is repositioned at top of page 2
      assert.equal(pages[1].nodes[0].position.y, 50, 'entry 3 should start at top margin');
    });
  });
});
