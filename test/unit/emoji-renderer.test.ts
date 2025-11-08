import assert from 'assert/strict';
import { splitTextAndEmoji } from '../../src/lib/emoji-renderer.ts';

describe('splitTextAndEmoji', (): void => {
  it('returns single text segment for ASCII-only text', (): void => {
    const result = splitTextAndEmoji('Hello World');
    assert.deepStrictEqual(result, [{ type: 'text', content: 'Hello World' }]);
  });

  it('returns empty array for empty string', (): void => {
    const result = splitTextAndEmoji('');
    assert.deepStrictEqual(result, []);
  });

  it('does NOT split on Greek letters (they render fine)', (): void => {
    const result = splitTextAndEmoji('Ξ Greek letter');
    assert.deepStrictEqual(result, [{ type: 'text', content: 'Ξ Greek letter' }]);
  });

  it('does NOT split on geometric shapes (they render fine)', (): void => {
    const result = splitTextAndEmoji('△ ○ ◆ shapes');
    assert.deepStrictEqual(result, [{ type: 'text', content: '△ ○ ◆ shapes' }]);
  });

  it('splits on miscellaneous symbols that are emoji per Unicode Standard', (): void => {
    // Note: ☑, ⚠ are emoji per Unicode Standard and emoji-regex correctly identifies them
    // This gives us color versions instead of black & white!
    const result = splitTextAndEmoji('☐ ☑ ⚠ ★ symbols');
    // ☑ and ⚠ are emoji, ☐ and ★ are not (per Unicode emoji list)
    assert.ok(
      result.some((seg) => seg.type === 'emoji'),
      'Should detect emoji in symbols'
    );
  });

  it('splits on dingbats that are emoji per Unicode Standard', (): void => {
    // Note: ✂ is an emoji per Unicode Standard and emoji-regex correctly identifies it
    const result = splitTextAndEmoji('✂ ✓ ✗ ➤ dingbats');
    // ✂ is an emoji (per Unicode emoji list)
    assert.ok(
      result.some((seg) => seg.type === 'emoji'),
      'Should detect emoji in dingbats'
    );
  });

  it('splits true emoji from text', (): void => {
    const result = splitTextAndEmoji('Hello 👋 World');
    assert.deepStrictEqual(result, [
      { type: 'text', content: 'Hello ' },
      { type: 'emoji', content: '👋' },
      { type: 'text', content: ' World' },
    ]);
  });

  it('handles emoji at start', (): void => {
    const result = splitTextAndEmoji('😀 Hello');
    assert.deepStrictEqual(result, [
      { type: 'emoji', content: '😀' },
      { type: 'text', content: ' Hello' },
    ]);
  });

  it('handles emoji at end', (): void => {
    const result = splitTextAndEmoji('Hello 🎉');
    assert.deepStrictEqual(result, [
      { type: 'text', content: 'Hello ' },
      { type: 'emoji', content: '🎉' },
    ]);
  });

  it('handles only emoji', (): void => {
    const result = splitTextAndEmoji('😀🎉👋');
    assert.deepStrictEqual(result, [
      { type: 'emoji', content: '😀' },
      { type: 'emoji', content: '🎉' },
      { type: 'emoji', content: '👋' },
    ]);
  });

  it('handles multiple emoji with text between', (): void => {
    const result = splitTextAndEmoji('Hello 👋 how are you 😀 today');
    assert.deepStrictEqual(result, [
      { type: 'text', content: 'Hello ' },
      { type: 'emoji', content: '👋' },
      { type: 'text', content: ' how are you ' },
      { type: 'emoji', content: '😀' },
      { type: 'text', content: ' today' },
    ]);
  });

  it('handles extended emoji (U+1FA00-U+1FAFF)', (): void => {
    const result = splitTextAndEmoji('Hello 🪀 yoyo');
    assert.deepStrictEqual(result, [
      { type: 'text', content: 'Hello ' },
      { type: 'emoji', content: '🪀' },
      { type: 'text', content: ' yoyo' },
    ]);
  });

  it('correctly handles mixed standard symbols and emoji', (): void => {
    // Standard symbols that are NOT emoji (Ξ △ ○) vs true emoji (😀)
    // Note: ☐ might be split by emoji-regex if it's on the emoji list
    const result = splitTextAndEmoji('Ξ △ ○ 😀 test');
    // Should have at least one emoji segment for 😀
    assert.ok(
      result.some((seg) => seg.type === 'emoji' && seg.content === '😀'),
      'Should detect true emoji'
    );
    // Greek letters and geometric shapes should remain as text
    assert.ok(
      result.some((seg) => seg.type === 'text' && seg.content.includes('Ξ')),
      'Should keep Greek letters as text'
    );
  });

  it('real-world example: resume with symbols', (): void => {
    const result = splitTextAndEmoji('• Ξ Platform Growth: Scaled system—achieved 40+ success');
    assert.deepStrictEqual(result, [{ type: 'text', content: '• Ξ Platform Growth: Scaled system—achieved 40+ success' }], 'Should treat bullets, Greek letters, and dashes as regular text');
  });

  it('real-world example: resume with true emoji', (): void => {
    const result = splitTextAndEmoji('🚀 Platform Growth: Scaled system successfully');
    assert.deepStrictEqual(result, [
      { type: 'emoji', content: '🚀' },
      { type: 'text', content: ' Platform Growth: Scaled system successfully' },
    ]);
  });

  it('handles complex emoji sequences (skin tones, ZWJ sequences)', (): void => {
    // Note: Skin tone modifiers and ZWJ sequences are complex, but our regex
    // should at least capture the base emoji
    const result = splitTextAndEmoji('Hello 👋🏼 World');

    // The result may vary depending on how the regex handles modifiers
    // At minimum, we should have an emoji segment
    assert.ok(
      result.some((seg) => seg.type === 'emoji'),
      'Should detect emoji in sequence'
    );
  });
});
