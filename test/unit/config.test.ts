import assert from 'assert/strict';
import { parseServerConfig } from '../../src/lib/config.ts';

describe('Config parsing', () => {
  describe('BASE_URL parsing', () => {
    it('parses BASE_URL env var', () => {
      const config = parseServerConfig([], {
        BASE_URL: 'https://api.example.com',
      });
      assert.strictEqual(config.baseUrl, 'https://api.example.com');
    });

    it('parses --base-url CLI arg', () => {
      const config = parseServerConfig(['--base-url=https://api.example.com'], {});
      assert.strictEqual(config.baseUrl, 'https://api.example.com');
    });

    it('CLI arg overrides env var', () => {
      const config = parseServerConfig(['--base-url=https://cli.example.com'], {
        BASE_URL: 'https://env.example.com',
      });
      assert.strictEqual(config.baseUrl, 'https://cli.example.com');
    });

    it('baseUrl is undefined when not provided', () => {
      const config = parseServerConfig([], {});
      assert.strictEqual(config.baseUrl, undefined);
    });
  });

  describe('storageDir parsing', () => {
    it('uses PDF_STORAGE_DIR env var', () => {
      const config = parseServerConfig([], {
        PDF_STORAGE_DIR: '/custom/path',
      });
      assert.ok(config.storageDir.endsWith('/custom/path'));
    });

    it('defaults to ~/.mcp-pdf when not provided', () => {
      const config = parseServerConfig([], {});
      assert.ok(config.storageDir.includes('.mcp-pdf'));
    });

    it('expands tilde in path', () => {
      const config = parseServerConfig([], {
        PDF_STORAGE_DIR: '~/my-pdfs',
      });
      assert.ok(!config.storageDir.startsWith('~'));
      assert.ok(config.storageDir.includes('my-pdfs'));
    });
  });

  describe('logLevel parsing', () => {
    it('parses LOG_LEVEL env var', () => {
      const config = parseServerConfig([], {
        LOG_LEVEL: 'debug',
      });
      assert.strictEqual(config.logLevel, 'debug');
    });

    it('parses --log-level CLI arg', () => {
      const config = parseServerConfig(['--log-level=warn'], {});
      assert.strictEqual(config.logLevel, 'warn');
    });

    it('CLI arg overrides env var', () => {
      const config = parseServerConfig(['--log-level=error'], {
        LOG_LEVEL: 'debug',
      });
      assert.strictEqual(config.logLevel, 'error');
    });

    it('defaults to info when not provided', () => {
      const config = parseServerConfig([], {});
      assert.strictEqual(config.logLevel, 'info');
    });
  });

  describe('transport parsing', () => {
    it('defaults to stdio transport', () => {
      const config = parseServerConfig([], {});
      assert.strictEqual(config.transport.type, 'stdio');
    });

    it('parses --port for HTTP transport', () => {
      const config = parseServerConfig(['--port=3457'], {});
      assert.strictEqual(config.transport.type, 'http');
      assert.strictEqual(config.transport.port, 3457);
    });

    it('parses PORT env var for HTTP transport', () => {
      const config = parseServerConfig([], { PORT: '3457' });
      assert.strictEqual(config.transport.type, 'http');
      assert.strictEqual(config.transport.port, 3457);
    });
  });
});
