import assert from 'assert';
import { escapeMarkdown, tokenizeMarkdown, tokensToStyledSegments } from '../../../src/lib/markdown.ts';

function segments(text: string): Array<[string, string]> {
  return tokensToStyledSegments(tokenizeMarkdown(text)).map((s) => [s.content, s.type === 'link' ? `link:${s.url}` : s.bold && s.italic ? 'bold+italic' : s.bold ? 'bold' : s.italic ? 'italic' : 'plain']);
}

function plain(text: string): string {
  return tokensToStyledSegments(tokenizeMarkdown(text))
    .map((s) => s.content)
    .join('');
}

describe('tokenizeMarkdown', () => {
  it('parses bold, italic, bold italic and links', () => {
    assert.deepStrictEqual(segments('a **b** *c* ***d*** [e](https://x.y)'), [
      ['a ', 'plain'],
      ['b', 'bold'],
      [' ', 'plain'],
      ['c', 'italic'],
      [' ', 'plain'],
      ['d', 'bold+italic'],
      [' ', 'plain'],
      ['e', 'link:https://x.y'],
    ]);
  });

  it('keeps line-start text that block markdown would turn into lists, headings and quotes', () => {
    for (const text of ['1. Led the team', '- Shipped it', '* Shipped it', '# C# expert', '> quoted', '---']) {
      assert.strictEqual(plain(text), text);
    }
  });

  it('keeps angle-bracket text and inline code', () => {
    assert.strictEqual(plain('Worked with <React> and <b>tags</b>'), 'Worked with <React> and <b>tags</b>');
    assert.strictEqual(plain('Run `npm test` daily'), 'Run npm test daily');
  });

  it('keeps line breaks and paragraphs', () => {
    assert.strictEqual(plain('line one\nline two'), 'line one\nline two');
    assert.strictEqual(plain('para one\n\npara **two**'), 'para one\n\npara two');
  });

  it('applies backslash escapes', () => {
    assert.strictEqual(plain('\\*nix and 5 \\* 3'), '*nix and 5 * 3');
  });
});

describe('escapeMarkdown', () => {
  it('makes any value render as itself', () => {
    for (const value of ['*nix', 'snake_case_name', '5 * 3 * 2', '[draft](notes)', 'C:\\path', '`tick`', '**not bold**']) {
      assert.strictEqual(plain(escapeMarkdown(value)), value, value);
    }
  });
});
