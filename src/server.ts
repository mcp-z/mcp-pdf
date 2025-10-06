import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { purgeOldPdfs } from './lib/cache-clean.ts';
import { loadConfig, type PdfServerConfig } from './lib/config.ts';
import { registerPdfPrompts } from './prompts/pdf-instructions.ts';
import { registerResourceHandlers } from './resources/register-resources.ts';
import { registerCreatePdfTool } from './tools/create-pdf.ts';
import { registerCreateSimplePdfTool } from './tools/create-simple-pdf.ts';
import { registerGenerateResumePdfTool } from './tools/generate-resume-pdf.ts';

export function createServer(config?: PdfServerConfig): McpServer {
  // Load config from environment only if not provided (for testing)
  const serverConfig = config || loadConfig();

  const server = new McpServer({ name: 'mcp-pdf', version: '0.2.1' });

  // Purge old cached PDFs (one-time on startup)
  if (serverConfig.purgeHours > 0) {
    purgeOldPdfs(serverConfig.storageDir, serverConfig.purgeHours);
  }

  // Register resources + prompts
  registerResourceHandlers(server, serverConfig);
  registerPdfPrompts(server);

  // Register tools
  registerCreatePdfTool(server, serverConfig);
  registerCreateSimplePdfTool(server, serverConfig);
  registerGenerateResumePdfTool(server, serverConfig);

  return server;
}
