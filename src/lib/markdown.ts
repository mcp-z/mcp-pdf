/**
 * Markdown parsing utilities using micromark via mdast
 * Provides robust markdown tokenization for PDF rendering
 */

import { fromMarkdown, type Options } from 'mdast-util-from-markdown';
import type { Node } from 'unist';
import { visit } from 'unist-util-visit';

/**
 * Token types for styled text segments
 */
export type Token = { type: 'text'; text: string } | { type: 'bold'; text: string } | { type: 'italic'; text: string } | { type: 'boldItalic'; text: string } | { type: 'link'; text: string; url: string };

// Text is formatted inline only: line-start syntax (lists, headings, quotes, code blocks), raw HTML and images stay literal.
const INLINE_ONLY: NonNullable<Options['extensions']>[number] = {
  disable: { null: ['blockQuote', 'codeFenced', 'codeIndented', 'definition', 'headingAtx', 'htmlFlow', 'htmlText', 'labelStartImage', 'list', 'setextUnderline', 'thematicBreak'] },
};

/**
 * Tokenize markdown text into styled tokens using micromark
 *
 * Supports:
 * - **bold** or __bold__
 * - *italic* or _italic_
 * - ***bold+italic*** or ___bold+italic___
 * - [link text](url)
 * - `code`, drawn as plain text
 * - backslash escapes; paragraphs and line breaks are kept
 *
 * @param markdown - Text with markdown syntax
 * @returns Array of tokens
 */
export function tokenizeMarkdown(markdown: string): Token[] {
  const tree = fromMarkdown(markdown, { extensions: [INLINE_ONLY] });
  const tokens: Token[] = [];

  // Helper to extract text recursively from node
  const extractText = (node: Node): string => {
    if ('value' in node && typeof node.value === 'string') {
      return node.value;
    }
    if ('children' in node && Array.isArray(node.children)) {
      return node.children.map(extractText).join('');
    }
    return '';
  };

  visit(tree, (node: Node, index, parent: Node | undefined) => {
    if (node.type === 'paragraph') {
      if (index) tokens.push({ type: 'text', text: '\n\n' });
      return;
    }
    if (node.type === 'break') {
      tokens.push({ type: 'text', text: '\n' });
      return;
    }

    // Skip text nodes that are children of styled nodes (link, strong, emphasis)
    if (node.type === 'text' || node.type === 'inlineCode') {
      // Only add text if parent is not a styled node
      if (parent?.type !== 'link' && parent?.type !== 'strong' && parent?.type !== 'emphasis') {
        if ('value' in node && typeof node.value === 'string') {
          tokens.push({ type: 'text', text: node.value });
        }
      }
      return;
    }

    // link
    if (node.type === 'link') {
      const text = extractText(node);
      const url = 'url' in node && typeof node.url === 'string' ? node.url : '';
      tokens.push({ type: 'link', text, url });
      return;
    }

    // bold / italic / bold+italic
    if (node.type === 'strong' || node.type === 'emphasis') {
      // Skip if parent is also a styled node (we want the outermost one)
      if (parent?.type === 'strong' || parent?.type === 'emphasis') {
        return;
      }

      const text = extractText(node);

      const children = 'children' in node && Array.isArray(node.children) ? node.children : [];
      const hasStrong = children.some((c) => c.type === 'strong');
      const hasEm = children.some((c) => c.type === 'emphasis');

      tokens.push({
        type: (node.type === 'strong' && hasEm) || (node.type === 'emphasis' && hasStrong) ? 'boldItalic' : node.type === 'strong' ? 'bold' : 'italic',
        text,
      });
    }
  });

  return tokens;
}

/**
 * Styled segment for PDF rendering
 */
export interface StyledSegment {
  type: 'text' | 'link';
  content: string;
  bold: boolean;
  italic: boolean;
  url?: string;
}

/**
 * Convert markdown tokens to styled segments for PDF rendering
 *
 * @param tokens - Markdown tokens from tokenizeMarkdown
 * @returns Array of segments with styling information
 */
export function tokensToStyledSegments(tokens: Token[]): StyledSegment[] {
  return tokens.map((token) => {
    const segment: StyledSegment = {
      type: token.type === 'link' ? 'link' : 'text',
      content: token.text,
      bold: token.type === 'bold' || token.type === 'boldItalic',
      italic: token.type === 'italic' || token.type === 'boldItalic',
      url: token.type === 'link' ? token.url : undefined,
    };
    return segment;
  });
}

/**
 * Escapes a value so markdown renders it as itself, for inserting data into markdown templates.
 */
export function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_[\]<>&!]/g, '\\$&');
}
