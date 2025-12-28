import type { Logger } from '@mcpeasy/server';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';
import type { CommonRuntime, RuntimeDeps, RuntimeOverrides, ServerConfig } from '../types.ts';
import { createMcpComponents } from './components.ts';

export function createLogger(config: ServerConfig): Logger {
  const hasStdio = config.transport.type === 'stdio';
  const logsPath = path.join(config.baseDir, 'logs', `${config.name}.log`);
  if (hasStdio) fs.mkdirSync(path.dirname(logsPath), { recursive: true });

  return pino({ level: config.logLevel ?? 'info' }, hasStdio ? pino.destination({ dest: logsPath, sync: false }) : pino.destination(1));
}

export async function createDefaultRuntime(config: ServerConfig, overrides?: RuntimeOverrides): Promise<CommonRuntime> {
  const logger = createLogger(config);
  const deps: RuntimeDeps = { config, logger };

  const createDomainModules = overrides?.createDomainModules ?? (() => createMcpComponents(config));
  const middlewareFactories = overrides?.middlewareFactories ?? [];

  return {
    deps,
    middlewareFactories,
    createDomainModules,
    close: async () => {},
  };
}
