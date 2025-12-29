import type { ServerConfig, StorageContext, StorageExtra } from '../../src/types.js';

export function createStorageContext(config: Pick<ServerConfig, 'storageDir' | 'baseUrl' | 'transport'>): StorageContext {
  return {
    storageDir: config.storageDir,
    baseUrl: config.baseUrl,
    transport: config.transport,
  };
}

export function createStorageExtra(config: Pick<ServerConfig, 'storageDir' | 'baseUrl' | 'transport'>): StorageExtra {
  return { storageContext: createStorageContext(config) };
}
