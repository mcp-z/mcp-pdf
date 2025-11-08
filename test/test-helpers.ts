import { existsSync } from 'fs';
import { mkdir, readdir, rm } from 'fs/promises';
import { join } from 'path';

const ROOT_DIR = join(import.meta.dirname, '..');
const TMP_DIR = join(ROOT_DIR, '.tmp');

/**
 * Get the path to the .tmp directory in the repo root
 * Creates the directory if it doesn't exist
 */
export async function getTmpDir(): Promise<string> {
  if (!existsSync(TMP_DIR)) {
    await mkdir(TMP_DIR, { recursive: true });
  }
  return TMP_DIR;
}

/**
 * Get a subdirectory within .tmp for organizing test outputs
 * @param subdir - Name of subdirectory (e.g., 'emoji-tests')
 * @returns Full path to subdirectory
 */
export async function getTmpSubdir(subdir: string): Promise<string> {
  const tmpDir = await getTmpDir();
  const subdirPath = join(tmpDir, subdir);
  await mkdir(subdirPath, { recursive: true });
  return subdirPath;
}

/**
 * Clean all contents of .tmp directory
 * Run this before test suites to start fresh
 */
export async function cleanTmpDir(): Promise<void> {
  if (!existsSync(TMP_DIR)) {
    return;
  }

  const entries = await readdir(TMP_DIR);
  await Promise.all(entries.map((entry) => rm(join(TMP_DIR, entry), { recursive: true, force: true })));
}

/**
 * Get a full path for a file in .tmp
 * @param filename - Name of file (e.g., 'test.pdf')
 * @returns Full path to file in .tmp
 */
export async function getTmpPath(filename: string): Promise<string> {
  const tmpDir = await getTmpDir();
  return join(tmpDir, filename);
}
