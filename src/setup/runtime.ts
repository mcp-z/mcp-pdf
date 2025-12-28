import type { Logger, MiddlewareLayer, PromptModule, ResourceModule, ToolModule } from '@mcpeasy/server';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';
import type { ServerConfig } from '../types.ts';
import { createMcpComponents } from './components.ts';

export interface RuntimeDeps {
  config: ServerConfig;
  logger: Logger;
}

export type DomainModules = {
  tools: ToolModule[];
  resources: ResourceModule[];
  prompts: PromptModule[];
};

export type MiddlewareFactory = (deps: RuntimeDeps) => MiddlewareLayer;

export interface CommonRuntime {
  deps: RuntimeDeps;
  middlewareFactories: MiddlewareFactory[];
  createDomainModules: (deps: RuntimeDeps) => DomainModules;
  close: () => Promise<void>;
}

export interface RuntimeOverrides {
  middlewareFactories?: MiddlewareFactory[];
  createDomainModules?: (deps: RuntimeDeps) => DomainModules;
}

function buildLogger(config: ServerConfig): Logger {
  const hasStdio = config.transport.type === 'stdio';
  const logsPath = path.join(config.baseDir, 'logs', `${config.name}.log`);
  if (hasStdio) fs.mkdirSync(path.dirname(logsPath), { recursive: true });

  return pino({ level: config.logLevel ?? 'info' }, hasStdio ? pino.destination({ dest: logsPath, sync: false }) : pino.destination(1));
}

export async function createDefaultRuntime(config: ServerConfig, overrides?: RuntimeOverrides): Promise<CommonRuntime> {
  const logger = buildLogger(config);
  const deps: RuntimeDeps = { config, logger };

  const createDomainModules = overrides?.createDomainModules ?? (() => createMcpComponents(config));
  const middlewareFactories = overrides?.middlewareFactories ?? [];

  const close = async () => {};

  return {
    deps,
    middlewareFactories,
    createDomainModules,
    close,
  };
}
