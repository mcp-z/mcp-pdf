import { homedir } from 'os';
import { join, resolve } from 'path';
import { parseArgs } from 'util';
import { parseTransportConfig } from '@mcpeasy/server';
import type { ServerConfig } from '../types.ts';

/**
 * Parse PDF server configuration from CLI arguments and environment.
 */
export function parseServerConfig(args: string[], env: Record<string, string | undefined>): ServerConfig {
  // Parse shared transport config
  const transportConfig = parseTransportConfig(args, env);

  // Parse PDF-specific config from environment variables
  let storageDir = env.PDF_STORAGE_DIR || join(homedir(), '.mcp-pdf');
  if (storageDir.startsWith('~')) storageDir = storageDir.replace(/^~/, homedir());

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

  const cliBaseUrl = typeof values['base-url'] === 'string' ? values['base-url'] : undefined;
  const envBaseUrl = env.BASE_URL;
  const baseUrl = cliBaseUrl ?? envBaseUrl;

  const cliLogLevel = typeof values['log-level'] === 'string' ? values['log-level'] : undefined;
  const envLogLevel = env.LOG_LEVEL;
  const logLevel = cliLogLevel ?? envLogLevel ?? 'info';

  // Combine configs
  return {
    ...transportConfig,
    storageDir: resolve(storageDir),
    ...(baseUrl && { baseUrl }),
    logLevel,
  };
}

/**
 * Build production configuration from process globals.
 * Entry point for production server.
 */
export function buildConfig(): ServerConfig {
  return parseServerConfig(process.argv, process.env);
}
