import { buildConfig } from './lib/config.ts';
import { createServer } from './server.ts';
import type { ServerConfig } from './types.ts';

// Export utilities for direct programmatic use
export { type CharacterValidationResult, hasEmoji, needsUnicodeFont, validateTextForFont } from './lib/fonts.ts';
// Re-export for programmatic use (tests, scripts, etc.)
export { createServer } from './server.ts';
export type { ServerConfig } from './types.ts';

// Exported server lifecycle
export async function startServer(config: ServerConfig): Promise<void> {
  const result = await createServer(config);

  // Install SIGINT handler for graceful shutdown
  process.on('SIGINT', async () => {
    await result.cleanup();
    process.exit(0);
  });

  // Log startup message using pino (goes to file for stdio transport)
  result.logger.info(`Server started with ${config.transports.length} transport(s)`);

  // Keep process alive indefinitely
  await new Promise(() => {});
}

// Production entry point - exported as default for bin script
export default async function main(): Promise<void> {
  const config = buildConfig();
  await startServer(config);
}

// Auto-start for direct execution
if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}
