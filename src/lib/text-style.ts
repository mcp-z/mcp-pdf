import type { FontConfig } from './types/typography.ts';

export interface TextStyle {
  bold?: boolean;
  italic?: boolean;
}

export interface TextPaint {
  fonts: FontConfig;
  style: TextStyle;
  fontSize: number;
  color: string;
}

export type DrawTextOptions = PDFKit.Mixins.TextOptions & { x?: number; y?: number };

// Outline width for synthesized bold as a fraction of the font size; thickens each stroke without changing advances.
const FAUX_BOLD_STROKE = 1 / 30;

function resolveStyle(fonts: FontConfig, style: TextStyle): { face: string; fakeBold: boolean; fakeItalic: boolean } {
  const bold = style.bold === true;
  const italic = style.italic === true;
  const synthetic = fonts.synthetic ?? { bold: false, italic: false };
  const face = bold && italic ? (fonts.boldItalic ?? fonts.bold) : bold ? fonts.bold : italic ? fonts.italic : fonts.regular;
  return { face, fakeBold: bold && synthetic.bold, fakeItalic: italic && (synthetic.italic || (bold && !fonts.boldItalic)) };
}

/** Name of the face that draws `style`. */
export function styleFace(fonts: FontConfig, style: TextStyle): string {
  return resolveStyle(fonts, style).face;
}

/**
 * Sets the face that draws `style`. Synthesis does not change glyph advances, so this is all measurement needs.
 */
export function selectFace(doc: PDFKit.PDFDocument, fonts: FontConfig, style: TextStyle): PDFKit.PDFDocument {
  return doc.font(styleFace(fonts, style));
}

/**
 * Draws text in `paint.style`, using the font's own bold and italic faces and synthesizing the ones it lacks:
 * bold as fill plus an outline in the text color, italic as a slant.
 */
export function drawText(doc: PDFKit.PDFDocument, text: string, paint: TextPaint, options: DrawTextOptions = {}): void {
  const { face, fakeBold, fakeItalic } = resolveStyle(paint.fonts, paint.style);
  const { x, y, ...rest } = options;
  const textOptions = { ...rest, ...(fakeBold && { fill: true, stroke: true }), ...(fakeItalic && { oblique: rest.oblique ?? true }) };
  doc.font(face).fontSize(paint.fontSize).fillColor(paint.color);
  if (fakeBold)
    doc
      .save()
      .lineWidth(paint.fontSize * FAUX_BOLD_STROKE)
      .strokeColor(paint.color);
  // PDFKit treats an undefined x as the options argument, so text at the current position omits x and y.
  if (x === undefined && y === undefined) doc.text(text, textOptions);
  else doc.text(text, x, y, textOptions);
  if (fakeBold) doc.restore();
}
