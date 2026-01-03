import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import emojiRegexFactory from 'emoji-regex';
import { existsSync } from 'fs';
import moduleRoot from 'module-root-sync';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Cross-platform __dirname (works in both CJS and ESM)
const __dirname = dirname(fileURLToPath(import.meta.url));

// Path to the downloaded emoji font (in .fonts/ directory at project root)
// Use keyExists to ensure we find the actual package root, not a parent module
const PROJECT_ROOT = moduleRoot(__dirname);
const EMOJI_FONT_PATH = join(PROJECT_ROOT, '.fonts', 'NotoColorEmoji.ttf');

let emojiFontRegistered = false;

/**
 * Register the emoji font with @napi-rs/canvas
 * This should be called once at application startup
 * Returns false if font file not found or registration fails
 */
export function registerEmojiFont(): boolean {
  if (emojiFontRegistered) {
    return true;
  }

  if (!existsSync(EMOJI_FONT_PATH)) {
    return false;
  }

  try {
    GlobalFonts.registerFromPath(EMOJI_FONT_PATH, 'NotoColorEmoji');
    emojiFontRegistered = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Emoji metrics returned from measurement
 */
export interface EmojiMetrics {
  width: number;
  height: number;
  /** Offset from text baseline to center emoji vertically with text */
  baselineOffset: number;
}

/**
 * Measure emoji dimensions using canvas text metrics.
 * Returns actual measured dimensions instead of guessing.
 *
 * @param emoji - The emoji character to measure
 * @param fontSize - The font size in points
 * @returns Metrics object with width, height, and baseline offset
 */
export function measureEmoji(emoji: string, fontSize: number): EmojiMetrics {
  if (!registerEmojiFont()) {
    // Fallback: emoji fonts are typically square at fontSize
    return { width: fontSize, height: fontSize, baselineOffset: 0 };
  }

  try {
    // Create a small canvas just for measurement
    const canvas = createCanvas(1, 1);
    const ctx = canvas.getContext('2d');
    ctx.font = `${fontSize}px NotoColorEmoji`;

    const metrics = ctx.measureText(emoji);

    // Width from actual measurement
    const width = metrics.width;

    // Height from font metrics (ascent + descent)
    // actualBoundingBoxAscent/Descent give the actual rendered bounds
    const ascent = metrics.actualBoundingBoxAscent ?? fontSize * 0.8;
    const descent = metrics.actualBoundingBoxDescent ?? fontSize * 0.2;
    const height = ascent + descent;

    // Baseline offset: use industry standard vertical-align: -0.125em
    // This shifts the emoji DOWN by 12.5% of fontSize to align with text.
    // Reference: Iconify, CSS icon alignment best practices
    // https://iconify.design/docs/icon-components/react/inline.html
    const baselineOffset = fontSize * 0.125;

    return { width, height, baselineOffset };
  } catch (_err) {
    // Fallback to fontSize (emojis are square)
    return { width: fontSize, height: fontSize, baselineOffset: 0 };
  }
}

/**
 * Render a single emoji character to a PNG buffer
 *
 * @param emoji - The emoji character to render
 * @param size - The font size (canvas will be sized to fit)
 * @returns PNG buffer, or null if font not available or rendering fails
 */
export function renderEmojiToBuffer(emoji: string, size: number): Buffer | null {
  if (!registerEmojiFont()) {
    return null;
  }

  try {
    // Measure actual emoji dimensions
    const metrics = measureEmoji(emoji, size);

    // Canvas size based on measured dimensions with small padding for anti-aliasing
    const padding = 2; // Fixed 2px padding for anti-aliasing, not percentage-based
    const canvasWidth = Math.ceil(metrics.width) + padding * 2;
    const canvasHeight = Math.ceil(metrics.height) + padding * 2;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Set font and render emoji
    ctx.font = `${size}px NotoColorEmoji`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    // Center the emoji in the canvas
    ctx.fillText(emoji, canvasWidth / 2, canvasHeight / 2);

    return canvas.toBuffer('image/png');
  } catch {
    return null;
  }
}

/**
 * Split text into segments of regular text and emoji characters
 *
 * Uses the industry-standard emoji-regex package to detect all valid emoji
 * as per the Unicode Standard. Handles:
 * - ZWJ sequences (👨‍💼, 🧘‍♂️)
 * - Variation selectors (️)
 * - Skin tone modifiers (🏻-🏿)
 * - Flag sequences (🇺🇸)
 * - Keycap sequences (0️⃣-9️⃣, #️⃣, *️⃣)
 * - All other emoji per Unicode Standard
 *
 * @param text - Input text containing mixed content
 * @returns Array of segments with type indicator
 */
export function splitTextAndEmoji(text: string): Array<{ type: 'text' | 'emoji'; content: string }> {
  const segments: Array<{ type: 'text' | 'emoji'; content: string }> = [];

  // Use emoji-regex package for accurate, up-to-date emoji detection
  const emojiRegex = emojiRegexFactory();

  let lastIndex = 0;
  let match = emojiRegex.exec(text);

  while (match !== null) {
    // Add text before emoji
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    // Add emoji (full sequence including ZWJ, modifiers, etc.)
    segments.push({
      type: 'emoji',
      content: match[0],
    });

    lastIndex = match.index + match[0].length;
    match = emojiRegex.exec(text);
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return segments;
}
