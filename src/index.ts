import { buildConfig } from './config.ts';
import { createHTTPServer } from './setup/http.ts';
import { createStdioServer } from './setup/stdio.ts';
import type { ServerConfig } from './types.ts';

export { composeMiddleware, createFileServingRouter } from '@mcpeasy/server';
export { buildConfig, parseConfig } from './config.ts';
export { type CharacterValidationResult, hasEmoji, needsUnicodeFont, validateTextForFont } from './lib/fonts.ts';
export { createMcpComponents } from './setup/components.ts';
export { createHTTPServer } from './setup/http.ts';
export {
  type CommonRuntime,
  createDefaultRuntime,
  type DomainModules,
  type MiddlewareFactory,
  type RuntimeDeps,
  type RuntimeOverrides,
} from './setup/runtime.ts';
export { createStdioServer } from './setup/stdio.ts';
export type { ServerConfig } from './types.ts';

export async function startServer(config: ServerConfig): Promise<void> {
  const result = config.transport.type === 'stdio' ? await createStdioServer(config) : await createHTTPServer(config);

  process.on('SIGINT', async () => {
    await result.close();
    process.exit(0);
  });

  result.logger.info(`Server started with ${config.transport.type} transport`);
  await new Promise(() => {});
}

export default async function main(): Promise<void> {
  const config = buildConfig();
  await startServer(config);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}
