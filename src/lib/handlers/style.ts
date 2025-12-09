/**
 * Style resolution utilities for resume PDF generation
 */

import type { BulletStyle, ResolvedTextStyle, TextStyle, TypographyOptions } from './types.ts';

/**
 * Compute line gap from font size and line height
 */
function computeLineGap(fontSize: number, lineHeight?: number): number {
  if (lineHeight && fontSize) {
    return Math.max(0, (lineHeight - 1) * fontSize);
  }
  return 0;
}

/**
 * Resolve text and bullet styles into computed values
 */
export function resolveTextStyle(text: TextStyle, bullet: BulletStyle): ResolvedTextStyle {
  const fontSize = text.fontSize;
  const lineGap = computeLineGap(fontSize, text.lineHeight);
  const paragraphMarginBottom = text.marginBottom ?? 0;
  const itemMarginBottom = bullet.marginBottom ?? paragraphMarginBottom;
  const blockMarginBottom = text.blockMarginBottom ?? 0;

  return {
    fontSize,
    lineGap,
    paragraphMarginBottom,
    itemMarginBottom,
    blockMarginBottom,
  };
}

/**
 * Resolve section styles from typography options
 */
export function resolveSectionStyles(typography: TypographyOptions): ResolvedTextStyle {
  return resolveTextStyle(typography.text, typography.bullet);
}
