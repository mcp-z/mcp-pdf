import { type McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Variables } from '@modelcontextprotocol/sdk/shared/uriTemplate.js';
import type { BlobResourceContents, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import type { PdfServerConfig } from '../lib/config.ts';

const template = new ResourceTemplate('mcp-pdf://{id}', { list: undefined });

export function registerResourceHandlers(server: McpServer, config: PdfServerConfig) {
  server.resource(
    'pdf-document',
    template,
    {
      description: 'Generated PDF document',
      mimeType: 'application/pdf',
    },
    async (uri: URL, params: Variables): Promise<ReadResourceResult> => {
      const idParam = params.id;
      const id = Array.isArray(idParam) ? idParam[0] : idParam;
      if (!id) {
        throw new Error('Missing ID parameter in resource URI');
      }

      const dir = resolve(config.storageDir);
      const filePath = join(dir, `${id}.pdf`);

      if (!existsSync(filePath)) {
        throw new Error(`PDF not found: ${id}`);
      }

      try {
        const data = readFileSync(filePath);

        const blobContent: BlobResourceContents = {
          uri: uri.href,
          mimeType: 'application/pdf',
          blob: data.toString('base64'),
          size: data.length, // Raw size in bytes before base64 encoding
        };

        return {
          contents: [blobContent],
        };
      } catch (_error) {
        throw new Error(`Failed to read PDF: ${id}`);
      }
    }
  );
}
