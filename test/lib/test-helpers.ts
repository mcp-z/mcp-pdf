import { mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { ServerConfig } from '../../src/types.ts';

/**
 * Create a default config for tests. Tests should import from test/lib/test-helpers
 * instead of importing test helpers from production code.
 */
export function createTestConfig(overrides?: Partial<ServerConfig>): ServerConfig {
  return {
    transports: [{ type: 'stdio' }],
    storageDir: join(tmpdir(), '.tmp-mcp-pdf'),
    logLevel: 'silent',
    ...overrides,
  };
}

/**
 * Clean the temporary test directory
 */
export async function cleanTmpDir(): Promise<void> {
  const tmpDir = join(process.cwd(), '.tmp');
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // Ignore if doesn't exist
  }
}

/**
 * Get a subdirectory in the .tmp directory for tests
 */
export async function getTmpSubdir(name: string): Promise<string> {
  const tmpDir = join(process.cwd(), '.tmp', name);
  mkdirSync(tmpDir, { recursive: true });
  return tmpDir;
}
