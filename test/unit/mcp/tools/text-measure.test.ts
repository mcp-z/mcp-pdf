/**
 * Tests for text-measure tool
 */

import assert from 'assert';
import createTool from '../../../../src/mcp/tools/text-measure.ts';

describe('text-measure tool', () => {
  const tool = createTool();

  it('measures single text item', async () => {
    const result = await tool.handler({
      items: [{ text: 'Hello World', fontSize: 12 }],
    });

    assert.ok(result.structuredContent, 'Should return structured content');
    const output = result.structuredContent as { measurements: Array<{ width: number; height: number }> };
    assert.strictEqual(output.measurements.length, 1);
    assert.ok(output.measurements[0].width > 0, 'Width should be positive');
    assert.ok(output.measurements[0].height > 0, 'Height should be positive');
  });

  it('measures multiple text items', async () => {
    const result = await tool.handler({
      items: [
        { text: 'Short', fontSize: 12 },
        { text: 'This is a much longer text string', fontSize: 12 },
      ],
    });

    const output = result.structuredContent as { measurements: Array<{ width: number; height: number }> };
    assert.strictEqual(output.measurements.length, 2);
    assert.ok(output.measurements[1].width > output.measurements[0].width, 'Longer text should be wider');
  });

  it('larger font produces wider text', async () => {
    const result = await tool.handler({
      items: [
        { text: 'Same Text', fontSize: 12 },
        { text: 'Same Text', fontSize: 24 },
      ],
    });

    const output = result.structuredContent as { measurements: Array<{ width: number; height: number }> };
    assert.ok(output.measurements[1].width > output.measurements[0].width, '24pt should be wider than 12pt');
    assert.ok(output.measurements[1].height > output.measurements[0].height, '24pt should be taller than 12pt');
  });

  it('calculates wrapped height when width specified', async () => {
    const longText = 'This is a long text that should wrap when constrained to a narrow width';

    const result = await tool.handler({
      items: [
        { text: longText, fontSize: 12 }, // No width - single line
        { text: longText, fontSize: 12, width: 100 }, // Narrow - should wrap
      ],
    });

    const output = result.structuredContent as { measurements: Array<{ width: number; height: number }> };
    assert.ok(output.measurements[1].height > output.measurements[0].height, 'Wrapped text should be taller');
  });

  it('uses specified font', async () => {
    const result = await tool.handler({
      items: [{ text: 'Test', fontSize: 12 }],
      font: 'Courier',
    });

    const output = result.structuredContent as { font: string };
    assert.strictEqual(output.font, 'Courier', 'Should use Courier font');
  });
});
