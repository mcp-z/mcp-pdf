import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PdfServerConfig } from '../../src/lib/config.ts';

/**
 * Create a default config for tests. Tests should import from test/lib/test-helpers
 * instead of importing test helpers from production code.
 */
export function createTestConfig(overrides?: Partial<PdfServerConfig>): PdfServerConfig {
  return {
    storageDir: join(tmpdir(), '.tmp-mcp-pdf'),
    purgeHours: 24,
    includePath: true,
    ...overrides,
  };
}
