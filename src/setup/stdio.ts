import { composeMiddleware, registerPrompts, registerResources, registerTools, setupStdioTransport } from '@mcpeasy/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerConfig } from '../types.ts';
import { createDefaultRuntime, type RuntimeOverrides } from './runtime.ts';

export async function createStdioServer(config: ServerConfig, overrides?: RuntimeOverrides) {
  const runtime = await createDefaultRuntime(config, overrides);
  const modules = runtime.createDomainModules(runtime.deps);
  const layers = runtime.middlewareFactories.map((factory) => factory(runtime.deps));
  const composed = composeMiddleware(modules, layers);
  const logger = runtime.deps.logger;

  const mcpServer = new McpServer({ name: config.name, version: config.version });
  registerTools(mcpServer, composed.tools);
  registerResources(mcpServer, composed.resources);
  registerPrompts(mcpServer, composed.prompts);

  logger.info(`Starting ${config.name} MCP server (stdio)`);
  const transport = await setupStdioTransport(mcpServer);
  logger.info('stdio transport ready');
  const cleanup = async () => {
    logger.info('Shutting down stdio transport...');
    await transport.close();
  };

  return {
    mcpServer,
    logger,
    cleanup: async () => {
      await cleanup();
      await runtime.cleanup();
    },
  };
}
