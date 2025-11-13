import { parseTransportConfig } from '@mcpeasy/server';
import { homedir } from 'os';
import path, { resolve } from 'path';
import { parseArgs } from 'util';
import type { ServerConfig } from './types.ts';

/**
 * Parse PDF server configuration from CLI arguments and environment.
 */
export function parseServerConfig(args: string[], env: Record<string, string | undefined>): ServerConfig {
  // Parse shared transport config
  const transportConfig = parseTransportConfig(args, env);

  // Parse application-level config (BASE_URL, LOG_LEVEL)
  const { values } = parseArgs({
    args,
    options: {
      'base-url': { type: 'string' },
      'log-level': { type: 'string' },
    },
    strict: false, // Allow other arguments
    allowPositionals: true,
  });

  const rootDir = process.cwd() === '/' ? homedir() : process.cwd();
  const baseDir = path.join(rootDir, '.mcp-z');
  const cliBaseUrl = typeof values['base-url'] === 'string' ? values['base-url'] : undefined;
  const envBaseUrl = env.BASE_URL;
  const baseUrl = cliBaseUrl ?? envBaseUrl;

  const cliLogLevel = typeof values['log-level'] === 'string' ? values['log-level'] : undefined;
  const envLogLevel = env.LOG_LEVEL;
  const logLevel = cliLogLevel ?? envLogLevel ?? 'info';

  // Parse file storage configuration
  const cliStorageDir = typeof values['storage-dir'] === 'string' ? values['storage-dir'] : undefined;
  const envStorageDir = env.STORAGE_DIR;
  let storageDir = cliStorageDir ?? envStorageDir ?? path.join(baseDir, 'pdf', 'files');
  if (storageDir.startsWith('~')) storageDir = storageDir.replace(/^~/, homedir());

  // Combine configs
  return {
    ...transportConfig,
    storageDir: resolve(storageDir),
    ...(baseUrl && { baseUrl }),
    logLevel,
    baseDir,
  };
}

/**
 * Build production configuration from process globals.
 * Entry point for production server.
 */
export function buildConfig(): ServerConfig {
  return parseServerConfig(process.argv, process.env);
}
