import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import emojiRegexFactory from 'emoji-regex';
import moduleRoot from 'module-root-sync';

// Cross-platform __dirname (works in both CJS and ESM)
const __dirname = dirname(fileURLToPath(import.meta.url));

// Path to the downloaded emoji font (in .fonts/ directory at project root)
// Use keyExists to ensure we find the actual package root, not a parent module
const PROJECT_ROOT = moduleRoot(__dirname, { keyExists: 'name' });
const EMOJI_FONT_PATH = join(PROJECT_ROOT, '.fonts', 'NotoColorEmoji.ttf');

let emojiFontRegistered = false;

/**
 * Register the emoji font with @napi-rs/canvas
 * This should be called once at application startup
 */
export function registerEmojiFont(): boolean {
  if (emojiFontRegistered) {
    return true;
  }

  if (!existsSync(EMOJI_FONT_PATH)) {
    console.warn('⚠️  Emoji font not found at:', EMOJI_FONT_PATH);
    console.warn('   Run: npm install (to trigger postinstall script)');
    return false;
  }

  try {
    GlobalFonts.registerFromPath(EMOJI_FONT_PATH, 'NotoColorEmoji');
    emojiFontRegistered = true;
    return true;
  } catch (err) {
    console.warn('⚠️  Failed to register emoji font:', err);
    return false;
  }
}

/**
 * Render a single emoji character to a PNG buffer
 *
 * @param emoji - The emoji character to render
 * @param size - The font size (canvas will be sized to fit)
 * @returns PNG buffer, or null if font not available
 */
export function renderEmojiToBuffer(emoji: string, size: number): Buffer | null {
  if (!registerEmojiFont()) {
    return null;
  }

  try {
    // Create canvas with some padding for emoji rendering
    const padding = Math.ceil(size * 0.1);
    const canvasSize = size + padding * 2;

    const canvas = createCanvas(canvasSize, canvasSize);
    const ctx = canvas.getContext('2d');

    // Set font and render emoji
    ctx.font = `${size}px NotoColorEmoji`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    // Center the emoji in the canvas
    ctx.fillText(emoji, canvasSize / 2, canvasSize / 2);

    return canvas.toBuffer('image/png');
  } catch (err) {
    console.warn(`⚠️  Failed to render emoji "${emoji}":`, err);
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
