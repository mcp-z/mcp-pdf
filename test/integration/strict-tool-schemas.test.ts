/**
 * Reaches only the in-process HTTP server on 127.0.0.1.
 * Tool schemas as clients receive them must suit strict function-calling validators. Moonshot (Kimi) rejects
 * a tool whose schema has a non-object `items` ("items must be an object"), as zod emits for tuples.
 */

import { setup } from '@mcp-z/mcp-pdf';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import assert from 'assert';
import { mkdirSync } from 'fs';
import { safeRmSync } from 'fs-remove-compat';
import getPort from 'get-port';
import * as path from 'path';
import { createTestConfig } from '../lib/create-test-config.ts';

function nonObjectItems(schema: unknown, at: string): string[] {
  if (Array.isArray(schema)) return schema.flatMap((value, i) => nonObjectItems(value, `${at}[${i}]`));
  if (schema === null || typeof schema !== 'object') return [];
  return Object.entries(schema).flatMap(([key, value]) => {
    const here = `${at}.${key}`;
    const bad = key === 'items' && (value === null || typeof value !== 'object' || Array.isArray(value)) ? [here] : [];
    return [...bad, ...nonObjectItems(value, here)];
  });
}

describe('tool schemas for strict clients', () => {
  const testOutputDir = path.join(process.cwd(), '.tmp', 'strict-tool-schemas');
  const testStorageDir = path.join(testOutputDir, 'storage');
  let close: () => Promise<void>;
  let url: string;

  before(async () => {
    mkdirSync(testStorageDir, { recursive: true });
    const port = await getPort();
    const server = await setup.createHTTPServer(createTestConfig(testOutputDir, testStorageDir, { type: 'http', port }));
    close = server.close;
    url = `http://127.0.0.1:${port}/mcp`;
  });

  after(async () => {
    await close();
    safeRmSync(testOutputDir, { recursive: true, force: true });
  });

  it('still accept a custom page size as [width, height] and reject other lengths', async () => {
    const client = new Client({ name: 'strict-schema-test-client', version: '1.0.0' });
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(url)));
      for (const tool of ['pdf-document', 'pdf-layout']) {
        const content = [{ type: 'text', text: 'Sized' }];
        const result = await client.callTool({ name: tool, arguments: { content, pageSetup: { size: [300, 400] } } });
        const uri = (result.structuredContent as { uri?: string } | undefined)?.uri ?? (result.structuredContent as { result?: { uri: string } })?.result?.uri;
        assert.ok(uri, `${tool} returns a uri: ${JSON.stringify(result)}`);
        const pdf = Buffer.from(await (await fetch(uri)).arrayBuffer()).toString('latin1');
        assert.match(pdf, /\/MediaBox \[0 0 300 400\]/, `${tool} page is 300x400`);

        const rejected = await client.callTool({ name: tool, arguments: { content, pageSetup: { size: [300, 400, 500] } } });
        assert.strictEqual(rejected.isError, true, `${tool} rejects three numbers`);
      }
    } finally {
      await client.close();
    }
  });

  it('give every `items` an object schema', async () => {
    const client = new Client({ name: 'strict-schema-test-client', version: '1.0.0' });
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(url)));
      const { tools } = await client.listTools();
      assert.ok(tools.length > 0);
      const problems = tools.flatMap((tool) => nonObjectItems(tool.inputSchema, tool.name));
      assert.deepStrictEqual(problems, []);
    } finally {
      await client.close();
    }
  });
});
