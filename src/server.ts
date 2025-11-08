import { registerPrompts, registerTools, setupTransports } from '@mcpeasy/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import cors from 'cors';
import express from 'express';
import * as fs from 'fs';
import moduleRoot from 'module-root-sync';
import * as path from 'path';
import pino from 'pino';
import * as url from 'url';
import { extractOriginalFilename } from './lib/output-handler.ts';
import createPdfPrompt from './prompts/pdf-instructions.ts';
import createPdfTool from './tools/create-pdf.ts';
import createSimplePdfTool from './tools/create-simple-pdf.ts';
import createResumePdfTool from './tools/generate-resume-pdf.ts';
import type { ServerConfig } from './types.ts';

const pkg = JSON.parse(fs.readFileSync(path.join(moduleRoot(url.fileURLToPath(import.meta.url), { keyExists: 'name' }), 'package.json'), 'utf-8'));

export async function createServer(config: ServerConfig) {
  // Setup logging (file for stdio, stdout for others)
  const hasStdio = config.transports.some((t) => t.type === 'stdio');
  const logsPath = path.join(process.cwd(), '.mcp-z', 'logs', 'mcp-pdf.log');
  if (hasStdio) fs.mkdirSync(path.dirname(logsPath), { recursive: true });
  const logger = pino({ level: config.logLevel || 'info' }, hasStdio ? pino.destination({ dest: logsPath, sync: false }) : pino.destination(1));

  // Create Express app IF HTTP/WS transports present
  const needsHttpServer = config.transports.some((t) => t.type === 'http' || t.type === 'ws');
  let app: express.Application | undefined;

  if (needsHttpServer) {
    app = express();
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));

    // Serve PDF files via HTTP endpoint
    app.get('/files/:filename', (req, res) => {
      const storedFilename = req.params.filename;
      const filePath = path.join(config.storageDir, storedFilename);
      logger.debug(`File request: ${storedFilename}, path: ${filePath}, exists: ${fs.existsSync(filePath)}`);

      if (!fs.existsSync(filePath)) {
        logger.warn(`File not found: ${filePath}`);
        res.status(404).send('File not found');
        return;
      }

      try {
        const data = fs.readFileSync(filePath);
        const originalFilename = extractOriginalFilename(storedFilename);
        res.contentType('application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${originalFilename}"`);
        res.send(data);
        logger.debug(`Served file: ${storedFilename} as "${originalFilename}"`);
      } catch (error) {
        logger.error(`Error reading file: ${error}`);
        res.status(500).send('Error reading file');
      }
    });

    logger.debug('Created Express app for HTTP/WS transports with file serving');
  }

  // Factory function to create and configure MCP server instances
  // Receives transport info from setupTransports
  const createMcpServer = (transport?: import('@mcpeasy/server').TransportConfig) => {
    // Create tools with transport awareness
    const tools = [createPdfTool(config, transport), createSimplePdfTool(config, transport), createResumePdfTool(config, transport)];
    const prompts = [createPdfPrompt()];

    const server = new McpServer({ name: pkg.name, version: pkg.version });
    registerTools(server, tools);
    registerPrompts(server, prompts);
    return server;
  };

  // Setup all transports
  logger.info('Starting mcp-pdf MCP server');
  const { mcpServer, httpServers, cleanup } = await setupTransports(config.transports, {
    serverFactory: createMcpServer,
    logger,
    app,
    serviceName: 'pdf',
  });

  return {
    httpServers,
    mcpServer,
    cleanup,
    logger,
  };
}
