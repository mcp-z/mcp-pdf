import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Get the output directory for PDFs
 * Uses PDF_OUTPUT_DIR environment variable or defaults to ~/.mcp-pdf/
 */
export function getOutputDirectory(): string {
  const envDir = process.env.PDF_OUTPUT_DIR;
  if (envDir) {
    return resolve(envDir);
  }
  return join(homedir(), '.mcp-pdf');
}

/**
 * Sanitize a filename to prevent path traversal and unsafe characters
 * - Removes path separators and traversal attempts (..)
 * - Allows only alphanumeric, spaces, hyphens, underscores, and dots
 * - Limits length to 200 characters
 * - Prevents hidden files (starting with .)
 */
export function sanitizeFilename(filename: string): string {
  return (
    filename
      // Remove path separators
      .replace(/[/\\]/g, '_')
      // Remove unsafe characters, keep alphanumeric, spaces, hyphens, underscores, dots
      .replace(/[^a-zA-Z0-9_\-. ]/g, '_')
      // Block path traversal
      .replace(/\.\.+/g, '_')
      // No hidden files
      .replace(/^\./, '_')
      // Limit length
      .substring(0, 200)
      // Trim whitespace
      .trim()
  );
}

/**
 * Generate a unique filename by appending timestamp if file exists
 */
export function generateUniqueFilename(directory: string, filename: string): string {
  const sanitized = sanitizeFilename(filename);
  let fullPath = join(directory, sanitized);

  // If file doesn't exist, use it as-is
  if (!existsSync(fullPath)) {
    return sanitized;
  }

  // File exists, append timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('-').split('Z')[0];
  const dotIndex = sanitized.lastIndexOf('.');
  if (dotIndex > 0) {
    const name = sanitized.substring(0, dotIndex);
    const ext = sanitized.substring(dotIndex);
    return `${name}-${timestamp}${ext}`;
  }
  return `${sanitized}-${timestamp}`;
}

/**
 * Ensure the output directory exists
 */
export function ensureOutputDirectory(directory: string): void {
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
}

/**
 * Write PDF buffer to file in sandboxed directory
 * Returns the full path where the file was written
 */
export function writePdfToFile(buffer: Buffer, filename: string): string {
  const outputDir = getOutputDirectory();
  ensureOutputDirectory(outputDir);

  const uniqueFilename = generateUniqueFilename(outputDir, filename);
  const fullPath = join(outputDir, uniqueFilename);

  writeFileSync(fullPath, buffer);
  return fullPath;
}
