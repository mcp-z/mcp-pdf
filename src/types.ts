import type { BaseServerConfig } from '@mcpeasy/server';

export type Logger = Pick<Console, 'info' | 'error' | 'warn' | 'debug'>;

/**
 * PDF server configuration interface
 * Composes transport config and application-level config
 */
export interface ServerConfig extends BaseServerConfig {
  // PDF-specific configuration
  storageDir: string;
  baseUrl?: string;

  // Application-level logging configuration
  logLevel: string;
}
