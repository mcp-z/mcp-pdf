import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { DEFAULT_PURGE_HOURS } from '../constants.ts';

const FALSEY = new Set(['0', 'false', 'no', 'off']);

/**
 * Configuration for PDF server
 * @public
 */
export interface PdfServerConfig {
  /** Directory where PDFs are stored */
  storageDir: string;
  /** Hours before PDFs are purged (0 = never) */
  purgeHours: number;
  /** Include file paths in tool responses */
  includePath: boolean;
}

/**
 * Read configuration from environment variables.
 * This should only be called once at server startup.
 */
export function loadConfig(): PdfServerConfig {
  let storageDir = process.env.PDF_STORAGE_DIR || join(homedir(), '.mcp-pdf');
  if (storageDir.startsWith('~')) storageDir = storageDir.replace(/^~/, homedir());

  const purgeHours = process.env.PDF_PURGE_HOURS === undefined ? DEFAULT_PURGE_HOURS : parseInt(process.env.PDF_PURGE_HOURS, 10);
  const includePath = process.env.PDF_INCLUDE_PATH === undefined ? true : !FALSEY.has(process.env.PDF_INCLUDE_PATH.toString().trim().toLowerCase());
  return { storageDir: resolve(storageDir), purgeHours, includePath };
}

/**
 * Create a default config for testing
 */
// NOTE: test helpers (like createTestConfig) live under test/lib per project conventions.
