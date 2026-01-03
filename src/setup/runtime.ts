import type { Logger, MiddlewareLayer } from '@mcp-z/server';
import { createLoggingMiddleware } from '@mcp-z/server';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';
import * as mcp from '../mcp/index.ts';
import type { CommonRuntime, RuntimeDeps, RuntimeOverrides, ServerConfig, StorageContext } from '../types.ts';

export function createLogger(config: ServerConfig): Logger {
  const hasStdio = config.transport.type === 'stdio';
  const logsPath = path.join(config.baseDir, 'logs', `${config.name}.log`);
  if (hasStdio) fs.mkdirSync(path.dirname(logsPath), { recursive: true });

  return pino({ level: config.logLevel ?? 'info' }, hasStdio ? pino.destination({ dest: logsPath, sync: false }) : pino.destination(1));
}

export function createLoggingLayer(logger: Logger): MiddlewareLayer {
  const logging = createLoggingMiddleware({ logger });
  return {
    withTool: logging.withToolLogging,
    withResource: logging.withResourceLogging,
    withPrompt: logging.withPromptLogging,
  };
}

export function createStorageLayer(storageContext: StorageContext): MiddlewareLayer {
  const wrapAtPosition = <T extends { name: string; handler: unknown; [key: string]: unknown }>(module: T, extraPosition: number): T => {
    const originalHandler = module.handler as (...args: unknown[]) => Promise<unknown>;

    const wrappedHandler = async (...allArgs: unknown[]) => {
      const extra = allArgs[extraPosition];
      (extra as { storageContext?: StorageContext }).storageContext = storageContext;
      return await originalHandler(...allArgs);
    };

    return {
      ...module,
      handler: wrappedHandler,
    } as T;
  };

  return {
    withTool: <T extends { name: string; config: unknown; handler: unknown }>(module: T): T => wrapAtPosition(module, 1) as T,
  };
}

export async function createDefaultRuntime(config: ServerConfig, overrides?: RuntimeOverrides): Promise<CommonRuntime> {
  if (config.transport.type === 'http' && !config.baseUrl && !config.transport.port) {
    throw new Error('pdf-document: HTTP/WS transport requires either baseUrl in server config or port in transport config.');
  }
  if (!config.storageDir) {
    throw new Error('pdf-document: Server configuration missing storageDir.');
  }

  const logger = createLogger(config);
  const deps: RuntimeDeps = { config, logger };

  const createDomainModules =
    overrides?.createDomainModules ??
    (() => ({
      tools: Object.values(mcp.toolFactories).map((factory) => factory()),
      // resources: Object.values(mcp.resourceFactories).map((factory) => factory()),
      resources: [],
      prompts: Object.values(mcp.promptFactories).map((factory) => factory()),
    }));
  const middlewareFactories = overrides?.middlewareFactories ?? [() => createLoggingLayer(logger), () => createStorageLayer({ storageDir: config.storageDir, baseUrl: config.baseUrl, transport: config.transport })];

  return {
    deps,
    middlewareFactories,
    createDomainModules,
    close: async () => {},
  };
}
