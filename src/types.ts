import type { BaseServerConfig, MiddlewareLayer, PromptModule, ResourceModule, Logger as ServerLogger, ToolModule } from '@mcpeasy/server';

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

export interface StorageContext {
  storageDir: string;
  baseUrl?: string;
  transport: BaseServerConfig['transport'];
}

export interface StorageExtra {
  storageContext: StorageContext;
}

/** Runtime dependencies exposed to middleware/factories. */
export interface RuntimeDeps {
  config: ServerConfig;
  logger: ServerLogger;
}

/** Collections of MCP modules produced by domain factories. */
export type DomainModules = {
  tools: ToolModule[];
  resources: ResourceModule[];
  prompts: PromptModule[];
};

/** Factory that produces a middleware layer given runtime dependencies. */
export type MiddlewareFactory = (deps: RuntimeDeps) => MiddlewareLayer;

/** Shared runtime configuration returned by `createDefaultRuntime`. */
export interface CommonRuntime {
  deps: RuntimeDeps;
  middlewareFactories: MiddlewareFactory[];
  createDomainModules: () => DomainModules;
  close: () => Promise<void>;
}

export interface RuntimeOverrides {
  middlewareFactories?: MiddlewareFactory[];
  createDomainModules?: () => DomainModules;
}
