/**
 * Image dimension utilities for PDF generation.
 *
 * Follows the React Native pattern:
 * - Local files: Read intrinsic dimensions from file headers
 * - Network images: Require explicit dimensions (throw error otherwise)
 *
 * Only PNG and JPEG are supported: those are the only image formats PDFKit
 * 0.20.2 can embed. PDFImage.open gates on exactly two byte prefixes:
 *   FF D8        → JPEG parser
 *   89 50 4E 47  → PNG parser (png-js full decode)
 * anything else  → throws 'Unknown image format.'
 *
 * The parsers below mirror, step for step, the dimension logic of the
 * installed PDFKit 0.20.2 (the JPEG constructor scan loop in
 * lib/image/jpeg.js and the chunk walk of the png-js constructor used by
 * lib/image/png.js), so for every file PDFKit embeds, the dimensions we
 * report are identical to the /Width /Height PDFKit writes to the output
 * PDF. Where PDFKit lacks a bounds check (it reads out-of-range as 0 and
 * eventually throws 'Invalid JPEG.' / 'Incomplete or corrupt PNG file'),
 * we return null and fail early with a clear, actionable error.
 *
 * Both walks are structurally terminating: the cursor only moves forward,
 * at least 2 bytes per iteration (JPEG) and at least 12 bytes (PNG), so
 * the work is O(n) in buffer size and cannot hang on hostile input.
 *
 * This is proven by test/unit/lib/image-dimensions.test.ts:
 *  1. agreement: for every file PDFKit embeds, our dimensions equal the
 *     /Width /Height extracted from the actual PDF PDFKit generates
 *     (including a byte-by-byte truncation sweep of representative files);
 *  2. fuzz: tens of thousands of random, truncated, and mutated buffers
 *     never throw, never hang, and only return null or valid dimensions.
 *
 * Measuring other formats would only defer the failure to doc.image()
 * mid-render, so they fail here instead with a clear, actionable error.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Check if a path is a URL (http:// or https://)
 */
function isUrl(imagePath: string): boolean {
  return imagePath.startsWith('http://') || imagePath.startsWith('https://');
}

/**
 * Parse PNG dimensions from a buffer.
 *
 * Mirrors the chunk walk of the png-js constructor used by PDFKit 0.20.2
 * (new PNG(data) in lib/image/png.js), step for step:
 *   - walks chunks from offset 8 (the signature is gated by the caller);
 *   - each chunk is [size:4][type:4][payload:size][crc:4];
 *   - an IHDR's 13-byte payload is read at fixed offsets
 *     ([width:4][height:4][bitDepth][colorType][compression][filter]
 *     [interlace]) - as in png-js, a later IHDR overwrites an earlier one;
 *   - IEND ends the walk (its size/CRC are never consumed);
 *   - a chunk whose size+payload+CRC would run past the end returns null
 *     (png-js throws 'Incomplete or corrupt PNG file' there, so PDFKit
 *     rejects the file - we fail early with a clear error instead).
 *
 * Termination: every iteration advances the cursor at least 12 bytes, so
 * the walk is O(n) and cannot loop forever on hostile input.
 */
function parsePngDimensions(buffer: Buffer): ImageDimensions | null {
  let pos = 8;
  let dims: ImageDimensions | null = null;
  for (;;) {
    // Chunk header: 4-byte size + 4-byte type
    if (pos + 8 > buffer.length) return null;
    const chunkSize = buffer.readUInt32BE(pos);
    const t0 = buffer[pos + 4];
    const t1 = buffer[pos + 5];
    const t2 = buffer[pos + 6];
    const t3 = buffer[pos + 7];

    if (t0 === 0x49 && t1 === 0x45 && t2 === 0x4e && t3 === 0x44) {
      // 'IEND' - png-js returns here
      return dims;
    }

    if (t0 === 0x49 && t1 === 0x48 && t2 === 0x44 && t3 === 0x52) {
      // 'IHDR' - png-js reads the fixed 13-byte payload, then the 4-byte CRC,
      // and throws if any of it is missing
      if (pos + 8 + 13 + 4 > buffer.length) return null;
      dims = { width: buffer.readUInt32BE(pos + 8), height: buffer.readUInt32BE(pos + 12) };
      pos += 8 + 13;
    } else {
      // Any other chunk - skip its payload (png-js does the same)
      if (pos + 8 + chunkSize + 4 > buffer.length) return null;
      pos += 8 + chunkSize;
    }

    pos += 4; // CRC
    if (pos > buffer.length) return null; // png-js: 'Incomplete or corrupt PNG file'
  }
}

/**
 * Parse JPEG dimensions from a buffer.
 *
 * Mirrors the scan loop of the JPEG constructor in PDFKit 0.20.2
 * (lib/image/jpeg.js), step for step:
 *   - skip every byte until the next 0xff (the oracle skips any padding,
 *     including null bytes);
 *   - read the marker as the 2 bytes at that position (0xff + one byte);
 *   - SOF markers C0-CF (except C4, which is DHT) end the walk; the payload
 *     after the 2-byte segment length is [bits][height:2][width:2];
 *   - every other marker (including standalone D0-D9/01 and EOI/SOS) is
 *     followed by a 2-byte length that the oracle skips - we skip it
 *     identically, including when it lands mid-segment.
 *
 * We add the bounds checks the oracle lacks: where the oracle would read
 * out of range (its readUInt16BE returns 0 for missing bytes and it
 * eventually throws 'Invalid JPEG.'), we return null - failing early with
 * a clear error instead of a mid-render crash.
 *
 * Termination: every iteration advances the cursor at least 2 bytes, so the
 * walk is O(n) and cannot loop forever on hostile input.
 */
function parseJpegDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let marker = 0;
  let pos = 2;
  while (pos < buffer.length) {
    // Skip any padding bytes (including null) until the next 0xff leader
    while (pos < buffer.length && buffer[pos] !== 0xff) pos++;
    if (pos >= buffer.length) return null;
    if (pos + 2 > buffer.length) return null; // oracle: partial marker → 'Invalid JPEG.'

    marker = (buffer[pos] << 8) | buffer[pos + 1];
    pos += 2;

    // SOF0-SOF15 except C4 (DHT): [length:2][bits][height:2][width:2]...
    if (marker >= 0xffc0 && marker <= 0xffcf && marker !== 0xffc4) break;

    if (pos + 2 > buffer.length) return null; // oracle: 'Invalid JPEG.'
    pos += buffer.readUInt16BE(pos);
  }

  if (!(marker >= 0xffc0 && marker <= 0xffcf && marker !== 0xffc4)) return null;

  // pos is at the 2-byte segment length; payload is [bits][height:2][width:2]
  if (pos + 2 + 1 + 2 + 2 > buffer.length) return null;
  pos += 3; // segment length + bits per sample
  const height = buffer.readUInt16BE(pos);
  pos += 2;
  const width = buffer.readUInt16BE(pos);
  return { width, height };
}

/**
 * Parse intrinsic dimensions from an image buffer using the same format
 * gate as PDFKit's PDFImage.open (FF D8 → JPEG, 89 50 4E 47 → PNG).
 * Returns null for unsupported or invalid data.
 *
 * Exported for the agreement/fuzz tests in
 * test/unit/lib/image-dimensions.test.ts.
 */
export function parseImageDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 2) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return parseJpegDimensions(buffer);
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return parsePngDimensions(buffer);
  return null;
}

/**
 * Get intrinsic dimensions of a local image file.
 *
 * @param imagePath - Absolute or relative path to image file
 * @returns Dimensions or null if file doesn't exist or can't be read
 */
function getLocalImageDimensions(imagePath: string): ImageDimensions | null {
  try {
    // Resolve relative paths
    const resolvedPath = path.isAbsolute(imagePath) ? imagePath : path.resolve(process.cwd(), imagePath);

    if (!fs.existsSync(resolvedPath)) {
      return null;
    }

    const buffer = fs.readFileSync(resolvedPath);
    const dimensions = parseImageDimensions(buffer);
    if (dimensions && dimensions.width && dimensions.height) {
      return dimensions;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get image dimensions with appropriate handling for local vs network images.
 *
 * - For local files: Returns intrinsic dimensions from file headers
 * - For network URLs: Returns null (caller must provide explicit dimensions)
 *
 * @param imagePath - Path or URL to image
 * @returns Dimensions or null if unavailable
 */
function getImageDimensions(imagePath: string): ImageDimensions | null {
  if (isUrl(imagePath)) {
    // Network images require explicit dimensions (React Native pattern)
    // Return null so caller knows dimensions must be provided
    return null;
  }

  return getLocalImageDimensions(imagePath);
}

/**
 * Resolve image dimensions with explicit overrides.
 *
 * Priority:
 * 1. Explicit width/height from user
 * 2. Intrinsic dimensions from file (local files only)
 * 3. Throw error if dimensions cannot be determined
 *
 * If only width or height is provided, the other is calculated from aspect ratio
 * (if intrinsic dimensions are available).
 *
 * @param imagePath - Path or URL to image
 * @param explicitWidth - User-provided width (optional)
 * @param explicitHeight - User-provided height (optional)
 * @returns Resolved dimensions
 * @throws Error if dimensions cannot be determined
 */
export function resolveImageDimensions(imagePath: string, explicitWidth?: number, explicitHeight?: number): ImageDimensions {
  // Both dimensions provided - use them directly
  if (explicitWidth !== undefined && explicitHeight !== undefined) {
    return { width: explicitWidth, height: explicitHeight };
  }

  // Try to get intrinsic dimensions
  const intrinsic = getImageDimensions(imagePath);

  // Only width provided - calculate height from aspect ratio
  if (explicitWidth !== undefined && intrinsic) {
    const aspectRatio = intrinsic.height / intrinsic.width;
    return { width: explicitWidth, height: explicitWidth * aspectRatio };
  }

  // Only height provided - calculate width from aspect ratio
  if (explicitHeight !== undefined && intrinsic) {
    const aspectRatio = intrinsic.width / intrinsic.height;
    return { width: explicitHeight * aspectRatio, height: explicitHeight };
  }

  // No explicit dimensions - use intrinsic if available
  if (intrinsic) {
    return intrinsic;
  }

  // Cannot determine dimensions
  if (isUrl(imagePath)) {
    throw new Error(`Image dimensions required for network images. Please provide explicit width and height for: ${imagePath}`);
  }

  throw new Error(`Cannot determine image dimensions for: ${imagePath}. File may not exist or format is unsupported. Please provide explicit width and height.`);
}
