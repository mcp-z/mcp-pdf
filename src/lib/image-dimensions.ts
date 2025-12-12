/**
 * Image dimension utilities for PDF generation.
 *
 * Follows the React Native pattern:
 * - Local files: Read intrinsic dimensions from file headers
 * - Network images: Require explicit dimensions (throw error otherwise)
 */

import * as fs from 'fs';
import imageSize from 'image-size';
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

    // image-size v2 requires Uint8Array, read file into buffer
    const buffer = fs.readFileSync(resolvedPath);
    const dimensions = imageSize(new Uint8Array(buffer));
    if (dimensions.width && dimensions.height) {
      return {
        width: dimensions.width,
        height: dimensions.height,
      };
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
