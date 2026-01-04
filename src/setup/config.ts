import { findConfigPath, parseConfig as parseTransportConfig } from '@mcp-z/server';
import * as fs from 'fs';
import moduleRoot from 'module-root-sync';
import { homedir } from 'os';
import * as path from 'path';
import * as url from 'url';
import { parseArgs } from 'util';
import type { ServerConfig } from '../types.ts';

const pkg = JSON.parse(fs.readFileSync(path.join(moduleRoot(url.fileURLToPath(import.meta.url)), 'package.json'), 'utf-8'));

const HELP_TEXT = `
Usage: mcp-pdf [options]

MCP server for PDF document generation and processing.

Options:
  --version              Show version number
  --help                 Show this help message
  --base-url=<url>       Base URL for HTTP file serving
  --log-level=<level>    Logging level (default: info)
  --storage-dir=<path>   Directory for file storage (default: .mcp-z/files)

Environment Variables:
  BASE_URL               Base URL for HTTP file serving (optional)
  LOG_LEVEL              Default logging level (optional)
  STORAGE_DIR            Storage directory (optional)

Examples:
  mcp-pdf                           # Use default settings
  mcp-pdf --port=3000               # HTTP transport on port 3000
  mcp-pdf --storage-dir=./pdfs      # Custom storage directory
  LOG_LEVEL=debug mcp-pdf           # Set log level via env var
`.trim();

/**
 * Handle --version and --help flags before config parsing.
 * These should work without requiring any configuration.
 */
export function handleVersionHelp(args: string[]): { handled: boolean; output?: string } {
  const { values } = parseArgs({
    args,
    options: {
      version: { type: 'boolean' },
      help: { type: 'boolean' },
    },
    strict: false,
  });

  if (values.version) return { handled: true, output: pkg.version };
  if (values.help) return { handled: true, output: HELP_TEXT };
  return { handled: false };
}

/**
 * Parse PDF server configuration from CLI arguments and environment.
 */
export function parseConfig(args: string[], env: Record<string, string | undefined>): ServerConfig {
  const transportConfig = parseTransportConfig(args, env);

  // Parse application-level config (LOG_LEVEL, STORAGE_DIR, BASE_URL)
  const { values } = parseArgs({
    args,
    options: {
      'log-level': { type: 'string' },
      'base-url': { type: 'string' },
      'storage-dir': { type: 'string' },
    },
    strict: false, // Allow other arguments
    allowPositionals: true,
  });

  const name = pkg.name.replace(/^@[^/]+\//, '');
  let rootDir = homedir();
  try {
    const configPath = findConfigPath({ config: '.mcp.json', cwd: process.cwd(), stopDir: homedir() });
    rootDir = path.dirname(configPath);
  } catch {
    rootDir = homedir();
  }
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
export function createConfig(): ServerConfig {
  return parseConfig(process.argv, process.env);
}
