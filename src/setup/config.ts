import type * as McpServer from '@mcp-z/server';
import { Module } from 'module';
import { homedir } from 'os';
import * as path from 'path';
import { parseArgs } from 'util';
import type { ServerConfig } from '../types.ts';
import { readPkg } from './version-help.ts';

const pkg = readPkg();

// @mcp-z/server is requireable at the >=20 floor; deferred so --version/--help (handled via
// version-help.ts, never this file) load neither it nor its transitive graph.
const _require = typeof require === 'undefined' ? Module.createRequire(import.meta.url) : require;

/**
 * Parse PDF server configuration from CLI arguments and environment.
 */
export function parseConfig(args: string[], env: Record<string, string | undefined>): ServerConfig {
  const mcpServer = _require('@mcp-z/server') as typeof McpServer;
  const transportConfig = mcpServer.parseConfig(args, env);

  // Parse application-level config (LOG_LEVEL, RESOURCE_STORE_URI, BASE_URL)
  const { values } = parseArgs({
    args,
    options: {
      'log-level': { type: 'string' },
      'base-url': { type: 'string' },
      'resource-store-uri': { type: 'string' },
    },
    strict: false, // Allow other arguments
    allowPositionals: true,
  });

  const name = pkg.name.replace(/^@[^/]+\//, '');
  let rootDir = homedir();
  try {
    const configPath = mcpServer.findConfigPath({ config: '.mcp.json', cwd: process.cwd(), stopDir: homedir() });
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
  const cliResourceStoreUri = typeof values['resource-store-uri'] === 'string' ? values['resource-store-uri'] : undefined;
  const envResourceStoreUri = env.RESOURCE_STORE_URI;
  const defaultResourceStorePath = path.join(baseDir, name, 'files');
  const resourceStoreUri = normalizeResourceStoreUri(cliResourceStoreUri ?? envResourceStoreUri ?? defaultResourceStorePath);

  // Combine configs
  return {
    ...transportConfig,
    resourceStoreUri,
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

function normalizeResourceStoreUri(resourceStoreUri: string): string {
  const filePrefix = 'file://';
  if (resourceStoreUri.startsWith(filePrefix)) {
    const rawPath = resourceStoreUri.slice(filePrefix.length);
    const expandedPath = rawPath.startsWith('~') ? rawPath.replace(/^~/, homedir()) : rawPath;
    return `${filePrefix}${path.resolve(expandedPath)}`;
  }

  if (resourceStoreUri.includes('://')) return resourceStoreUri;

  const expandedPath = resourceStoreUri.startsWith('~') ? resourceStoreUri.replace(/^~/, homedir()) : resourceStoreUri;
  return `${filePrefix}${path.resolve(expandedPath)}`;
}
