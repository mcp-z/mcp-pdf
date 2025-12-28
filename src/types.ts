import type { BaseServerConfig, Logger as ServerLogger } from '@mcpeasy/server';

export type Logger = ServerLogger;

/**
 * PDF server configuration interface
 * Composes transport config and application-level config
 */
export interface ServerConfig extends BaseServerConfig {
  // PDF-specific configuration
  storageDir: string;
  baseUrl?: string;

  logLevel: string;
  baseDir: string;
  name: string;
  version: string;
}

export interface ToolOptions {
  serverConfig: ServerConfig;
}
