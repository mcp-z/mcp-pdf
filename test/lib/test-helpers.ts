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
