import { mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';

/**
 * Ensure the output directory exists
 */
export async function ensureOutputDirectory(directory: string): Promise<void> {
  // Use the async mkdir to avoid blocking the event loop. We still
  // tolerate the directory already existing.
  await mkdir(directory, { recursive: true });
}

/**
 * Write PDF buffer to file in sandboxed directory
 * Returns the full path where the file was written
 */
export async function writePdfToFile(buffer: Buffer, filename: string, storageDir: string): Promise<{ fullPath: string; storedName: string }> {
  const outputDir = resolve(storageDir);
  await ensureOutputDirectory(outputDir);
  const storedName = filename;
  const fullPath = join(outputDir, storedName);
  await writeFile(fullPath, buffer);
  return { fullPath, storedName };
}

/**
 * Extract the original filename from a stored filename
 * Format: {uuid}-{original-filename}.pdf
 * UUID is first 36 characters (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
 */
export function extractOriginalFilename(storedFilename: string): string {
  // UUID is exactly 36 characters, followed by a hyphen, then the original filename
  if (storedFilename.length > 37 && storedFilename.charAt(36) === '-') {
    return storedFilename.substring(37);
  }
  // Fallback: return the full filename if format doesn't match
  return storedFilename;
}
