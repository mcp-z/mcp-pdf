import { composeMiddleware, connectHttp, createFileServingRouter, registerPrompts, registerResources, registerTools } from '@mcpeasy/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import cors from 'cors';
import express from 'express';
import type { ServerConfig } from '../types.ts';
import { createDefaultRuntime, type RuntimeOverrides } from './runtime.ts';

export async function createHTTPServer(config: ServerConfig, overrides?: RuntimeOverrides) {
  const runtime = await createDefaultRuntime(config, overrides);
  const modules = runtime.createDomainModules(runtime.deps);
  const layers = runtime.middlewareFactories.map((factory) => factory(runtime.deps));
  const composed = composeMiddleware(modules, layers);
  const logger = runtime.deps.logger;
  const port = config.transport.port;
  if (!port) throw new Error('Port is required for HTTP transport');

  const mcpServer = new McpServer({ name: config.name, version: config.version });
  registerTools(mcpServer, composed.tools);
  registerResources(mcpServer, composed.resources);
  registerPrompts(mcpServer, composed.prompts);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  const fileRouter = createFileServingRouter(
    { storageDir: config.storageDir },
    {
      contentType: 'application/pdf',
      contentDisposition: 'attachment',
    }
  );
  app.use('/files', fileRouter);

  logger.info(`Starting ${config.name} MCP server (http)`);
  const { close, httpServer } = await connectHttp(mcpServer, { logger, app, port });
  logger.info('http transport ready');

  return {
    httpServer,
    mcpServer,
    logger,
    close: async () => {
      await close();
      await runtime.close();
    },
  };
}
