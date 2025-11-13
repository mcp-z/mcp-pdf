import type { Logger } from '@mcpeasy/server';
import { createFileServingRouter, registerPrompts, registerTools, setupHttpServer, setupStdioServer } from '@mcpeasy/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import cors from 'cors';
import express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';
import createPdfPrompt from './prompts/pdf-instructions.ts';
import createPdfTool from './tools/create-pdf.ts';
import createSimplePdfTool from './tools/create-simple-pdf.ts';
import createResumePdfTool from './tools/generate-resume-pdf.ts';
import type { ServerConfig } from './types.ts';

// ===== Main Entry Point =====
export async function createServer(config: ServerConfig) {
  const { logger } = await setupShared(config);
  const hasStdio = config.transport.type === 'stdio';
  return hasStdio ? await createStdioServer(config, { logger }) : await createHttpServer(config, { logger });
}

// ===== Helper: Shared Infrastructure =====
async function setupShared(config: ServerConfig) {
  const hasStdio = config.transport.type === 'stdio';
  const logsPath = path.join(config.baseDir, 'logs', `${config.name}.log`);
  if (hasStdio) fs.mkdirSync(path.dirname(logsPath), { recursive: true });

  const logger = pino({ level: config.logLevel || 'info' }, hasStdio ? pino.destination({ dest: logsPath, sync: false }) : pino.destination(1));

  return { logger };
}

// ===== stdio-ONLY Setup (Complete Path) =====
async function createStdioServer(config: ServerConfig, shared: { logger: Logger }) {
  const { logger } = shared;

  // Create MCP components (shared logic)
  const { tools, prompts } = createMcpComponents(config, undefined); // stdio doesn't need transport parameter

  // Create and register MCP server
  const mcpServer = new McpServer({ name: config.name, version: config.version });
  registerTools(mcpServer, tools);
  registerPrompts(mcpServer, prompts);

  // Setup stdio transport
  logger.info('Starting mcp-pdf MCP server');
  const { cleanup } = await setupStdioServer({
    serverFactory: () => mcpServer,
    logger,
  });

  return { mcpServer, cleanup, logger };
}

// ===== HTTP-ONLY Setup (Complete Path) =====
async function createHttpServer(config: ServerConfig, shared: { logger: Logger }) {
  const { logger } = shared;

  // ✅ Create Express app ONLY for HTTP
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Serve PDF files via HTTP endpoint using shared file serving router
  const fileRouter = createFileServingRouter(
    { storageDir: config.storageDir },
    {
      contentType: 'application/pdf',
      contentDisposition: 'attachment',
    }
  );
  app.use('/files', fileRouter);

  logger.debug('Created Express app for HTTP transport with PDF file serving');

  // Create MCP components (shared logic)
  const { tools, prompts } = createMcpComponents(config, config.transport);

  // Create and register MCP server
  const mcpServer = new McpServer({ name: config.name, version: config.version });
  registerTools(mcpServer, tools);
  registerPrompts(mcpServer, prompts);

  // Setup HTTP transport
  logger.info('Starting mcp-pdf MCP server');

  // Validate port for HTTP transport
  if (!config.transport.port) {
    throw new Error('Port is required for HTTP transport');
  }

  const { httpServer, cleanup } = await setupHttpServer({
    serverFactory: () => mcpServer,
    logger,
    app,
    port: config.transport.port,
  });

  return { httpServer, mcpServer, cleanup, logger };
}

// ===== Shared: Create MCP Components =====
function createMcpComponents(config: ServerConfig, transport: import('@mcpeasy/server').TransportConfig | undefined) {
  // Create tools with transport awareness
  const tools = [createPdfTool(config, transport), createSimplePdfTool(config, transport), createResumePdfTool(config, transport)];
  const prompts = [createPdfPrompt()];

  return { tools, prompts };
}
