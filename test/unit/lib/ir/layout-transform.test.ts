import assert from 'assert';
import { buildElementSourceMap, isSingleColumnLayout, isTwoColumnLayout, transformToResumeLayout } from '../../../../src/lib/ir/layout-transform.ts';
import type { LayoutElement, SectionConfig } from '../../../../src/lib/ir/types.ts';

describe('layout-transform', () => {
  describe('buildElementSourceMap', () => {
    it('maps elements to their section sources from element.source property', () => {
      const elements: LayoutElement[] = [
        { type: 'group', children: [], source: 'work' },
        { type: 'group', children: [], source: 'education' },
      ];
      const sections: SectionConfig[] = [{ source: 'work' }, { source: 'education' }];

      const sourceMap = buildElementSourceMap(elements, sections);

      assert.equal(sourceMap.get(elements[0]), 'work');
      assert.equal(sourceMap.get(elements[1]), 'education');
    });

    it('skips elements without source property', () => {
      const elements: LayoutElement[] = [
        { type: 'group', children: [], source: 'work' },
        { type: 'divider' }, // No source
        { type: 'group', children: [], source: 'skills' },
      ];
      const sections: SectionConfig[] = [{ source: 'work' }, { source: 'skills' }];

      const sourceMap = buildElementSourceMap(elements, sections);

      assert.equal(sourceMap.get(elements[0]), 'work');
      assert.equal(sourceMap.get(elements[2]), 'skills');
      assert.equal(sourceMap.has(elements[1] as LayoutElement), false);
    });

    it('reads source directly from elements regardless of section order', () => {
      // Elements have source set directly - sections parameter is ignored (backwards compat)
      const elements: LayoutElement[] = [
        { type: 'group', children: [], source: 'work' },
        { type: 'group', children: [], source: 'education' },
      ];
      const sections = [{ source: 'work' }, { type: 'divider' as const }, { source: 'education' }];

      const sourceMap = buildElementSourceMap(elements, sections);

      assert.equal(sourceMap.get(elements[0]), 'work');
      assert.equal(sourceMap.get(elements[1]), 'education');
    });
  });

  describe('transformToResumeLayout', () => {
    it('returns single-column layout when no layout config provided', () => {
      const elements: LayoutElement[] = [{ type: 'text', text: 'Hello' }];
      const sections: SectionConfig[] = [];

      const result = transformToResumeLayout(elements, sections);

      assert.ok(isSingleColumnLayout(result));
      assert.equal(result.style, 'single-column');
      assert.deepEqual(result.elements, elements);
    });

    it('returns single-column layout when style is single-column', () => {
      const elements: LayoutElement[] = [{ type: 'text', text: 'Hello' }];
      const sections: SectionConfig[] = [];

      const result = transformToResumeLayout(elements, sections, { style: 'single-column' });

      assert.ok(isSingleColumnLayout(result));
      assert.equal(result.style, 'single-column');
    });

    it('returns two-column layout with elements assigned to columns', () => {
      const elements: LayoutElement[] = [
        { type: 'group', children: [], source: 'work' },
        { type: 'group', children: [], source: 'skills' },
      ];
      const sections: SectionConfig[] = [{ source: 'work' }, { source: 'skills' }];

      const result = transformToResumeLayout(elements, sections, {
        style: 'two-column',
        columns: {
          left: { sections: ['skills'] },
          right: { sections: ['work'] },
        },
      });

      assert.ok(isTwoColumnLayout(result));
      assert.equal(result.style, 'two-column');
      assert.equal(result.left.elements.length, 1);
      assert.equal(result.right.elements.length, 1);
    });

    it('uses default widths when not specified', () => {
      const elements: LayoutElement[] = [];
      const sections: SectionConfig[] = [];

      const result = transformToResumeLayout(elements, sections, {
        style: 'two-column',
        columns: {
          left: { sections: [] },
          right: { sections: [] },
        },
      });

      assert.ok(isTwoColumnLayout(result));
      assert.equal(result.left.width, '30%');
      assert.equal(result.right.width, '70%');
    });

    it('uses default gap when not specified', () => {
      const elements: LayoutElement[] = [];
      const sections: SectionConfig[] = [];

      const result = transformToResumeLayout(elements, sections, {
        style: 'two-column',
        columns: {
          left: { sections: [] },
          right: { sections: [] },
        },
      });

      assert.ok(isTwoColumnLayout(result));
      assert.equal(result.gap, 30);
    });

    it('preserves custom widths and gap', () => {
      const elements: LayoutElement[] = [];
      const sections: SectionConfig[] = [];

      const result = transformToResumeLayout(elements, sections, {
        style: 'two-column',
        gap: 40,
        columns: {
          left: { width: '25%', sections: [] },
          right: { width: '75%', sections: [] },
        },
      });

      assert.ok(isTwoColumnLayout(result));
      assert.equal(result.gap, 40);
      assert.equal(result.left.width, '25%');
      assert.equal(result.right.width, '75%');
    });

    it('assigns unassigned elements to right column', () => {
      const elements: LayoutElement[] = [
        { type: 'group', children: [], source: 'work' },
        { type: 'group', children: [], source: 'skills' },
        { type: 'group', children: [], source: 'misc' },
      ];
      const sections: SectionConfig[] = [{ source: 'work' }, { source: 'skills' }, { source: 'misc' }];

      const result = transformToResumeLayout(elements, sections, {
        style: 'two-column',
        columns: {
          left: { sections: ['skills'] },
          // 'work' and 'misc' not assigned to any column
        },
      });

      assert.ok(isTwoColumnLayout(result));
      assert.equal(result.left.elements.length, 1); // skills
      assert.equal(result.right.elements.length, 2); // work + misc (unassigned)
    });
  });

  describe('type guards', () => {
    it('isTwoColumnLayout returns true for two-column', () => {
      const layout = { style: 'two-column' as const, gap: 30, left: { elements: [] }, right: { elements: [] } };
      assert.ok(isTwoColumnLayout(layout));
      assert.ok(!isSingleColumnLayout(layout));
    });

    it('isSingleColumnLayout returns true for single-column', () => {
      const layout = { style: 'single-column' as const, elements: [] };
      assert.ok(isSingleColumnLayout(layout));
      assert.ok(!isTwoColumnLayout(layout));
    });
  });
});
