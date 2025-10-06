import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.ts';

// Export utilities for direct programmatic use
export { type CharacterValidationResult, hasEmoji, needsUnicodeFont, validateTextForFont } from './lib/fonts.ts';
export { createServer } from './server.ts';

// Default export for bin script
export default async function start(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Auto-start when run directly
if (import.meta.main) {
  start().catch((error) => {
    console.error('Failed to start PDF server:', error);
    process.exit(1);
  });
}
