import assert from 'assert/strict';
import { parseConfig } from '../../src/config.ts';

describe('Config parsing', () => {
  describe('BASE_URL parsing', () => {
    it('parses BASE_URL env var', () => {
      const config = parseConfig([], {
        BASE_URL: 'https://api.example.com',
      });
      assert.strictEqual(config.baseUrl, 'https://api.example.com');
    });

    it('parses --base-url CLI arg', () => {
      const config = parseConfig(['--base-url=https://api.example.com'], {});
      assert.strictEqual(config.baseUrl, 'https://api.example.com');
    });

    it('CLI arg overrides env var', () => {
      const config = parseConfig(['--base-url=https://cli.example.com'], {
        BASE_URL: 'https://env.example.com',
      });
      assert.strictEqual(config.baseUrl, 'https://cli.example.com');
    });

    it('baseUrl is undefined when not provided', () => {
      const config = parseConfig([], {});
      assert.strictEqual(config.baseUrl, undefined);
    });
  });

  describe('storageDir parsing', () => {
    it('uses STORAGE_DIR env var', () => {
      const config = parseConfig([], {
        STORAGE_DIR: '/custom/path',
      });
      assert.ok(config.storageDir.endsWith('/custom/path'));
    });

    it('defaults to ~/.mcp-z/pdf/files when not provided', () => {
      const config = parseConfig([], {});
      assert.ok(config.storageDir.includes('.mcp-z'));
      assert.ok(config.storageDir.includes('pdf'));
    });

    it('expands tilde in path', () => {
      const config = parseConfig([], {
        STORAGE_DIR: '~/my-pdfs',
      });
      assert.ok(!config.storageDir.startsWith('~'));
      assert.ok(config.storageDir.includes('my-pdfs'));
    });
  });

  describe('logLevel parsing', () => {
    it('parses LOG_LEVEL env var', () => {
      const config = parseConfig([], {
        LOG_LEVEL: 'debug',
      });
      assert.strictEqual(config.logLevel, 'debug');
    });

    it('parses --log-level CLI arg', () => {
      const config = parseConfig(['--log-level=warn'], {});
      assert.strictEqual(config.logLevel, 'warn');
    });

    it('CLI arg overrides env var', () => {
      const config = parseConfig(['--log-level=error'], {
        LOG_LEVEL: 'debug',
      });
      assert.strictEqual(config.logLevel, 'error');
    });

    it('defaults to info when not provided', () => {
      const config = parseConfig([], {});
      assert.strictEqual(config.logLevel, 'info');
    });
  });

  describe('transport parsing', () => {
    it('defaults to stdio transport', () => {
      const config = parseConfig([], {});
      assert.strictEqual(config.transport.type, 'stdio');
    });

    it('parses --port for HTTP transport', () => {
      const config = parseConfig(['--port=3457'], {});
      assert.strictEqual(config.transport.type, 'http');
      assert.strictEqual(config.transport.port, 3457);
    });

    it('parses PORT env var for HTTP transport', () => {
      const config = parseConfig([], { PORT: '3457' });
      assert.strictEqual(config.transport.type, 'http');
      assert.strictEqual(config.transport.port, 3457);
    });
  });
});
