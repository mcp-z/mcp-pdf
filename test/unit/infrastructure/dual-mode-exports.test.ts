import assert from 'assert';
import { createRequire } from 'module';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

describe('PDF Server Dual-Mode Exports', () => {
  it('should load successfully in CommonJS mode', () => {
    // Tests dual ESM/CJS exports for cross-platform compatibility
    const serverPath = path.resolve(__dirname, '../../../dist/cjs/index.js');

    // This will throw if there are any import/export issues
    const pdfServer = require(serverPath);

    // Verify expected exports
    assert.ok(pdfServer, 'PDF server module should export something');
    assert.strictEqual(typeof pdfServer.createStdioServer, 'function', 'Should export createStdioServer function');
    assert.strictEqual(typeof pdfServer.createHTTPServer, 'function', 'Should export createHTTPServer function');
    assert.strictEqual(typeof pdfServer.default, 'function', 'Should export default main function for bin script');

    // PDF-specific exports
    assert.strictEqual(typeof pdfServer.hasEmoji, 'function', 'Should export hasEmoji function');
    assert.strictEqual(typeof pdfServer.needsUnicodeFont, 'function', 'Should export needsUnicodeFont function');
    assert.strictEqual(typeof pdfServer.validateTextForFont, 'function', 'Should export validateTextForFont function');
  });

  it('should have working dual-mode __filename pattern', () => {
    // Test your dual-mode pattern works
    const filename = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url);
    const dirname = path.dirname(filename);

    assert.ok(filename.endsWith('.test.ts'), 'Should resolve correct filename');
    assert.ok(dirname.includes('test/unit'), 'Should resolve correct dirname');
  });

  it('should work with Node.js built-in namespace imports', () => {
    // Test that Node.js built-ins work as expected
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const url = require('url');

    assert.strictEqual(typeof fs.readFileSync, 'function');
    assert.strictEqual(typeof path.join, 'function');
    assert.strictEqual(typeof os.homedir, 'function');
    assert.strictEqual(typeof url.fileURLToPath, 'function');
  });
});
