import { parseConfig as parseTransportConfig } from "@mcpeasy/server";
import * as fs from 'fs';
import moduleRoot from 'module-root-sync';
import { homedir } from 'os';
import * as path from 'path';
import * as url from 'url';
import { parseArgs } from 'util';
import type { ServerConfig } from './types.ts';

const pkg = JSON.parse(fs.readFileSync(path.join(moduleRoot(url.fileURLToPath(import.meta.url), { keyExists: 'name' }), 'package.json'), 'utf-8'));

/**
 * Parse PDF server configuration from CLI arguments and environment.
 */
export function parseConfig(args: string[], env: Record<string, string | undefined>): ServerConfig {
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

  const name = pkg.name.replace(/^@[^/]+\//, '');
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
  let storageDir = cliStorageDir ?? envStorageDir ?? path.join(baseDir, name, 'files');
  if (storageDir.startsWith('~')) storageDir = storageDir.replace(/^~/, homedir());

  // Combine configs
  return {
    ...transportConfig,
    storageDir: path.resolve(storageDir),
    ...(baseUrl && { baseUrl }),
    logLevel,
    baseDir,
    name,
    version: pkg.version,
  };
}

/**
 * Build production configuration from process globals.
 * Entry point for production server.
 */
export function buildConfig(): ServerConfig {
  return parseConfig(process.argv, process.env);
}
