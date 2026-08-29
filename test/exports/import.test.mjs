import main, { fonts, setup } from '@mcp-z/mcp-pdf';
import assert from 'assert';

describe('exports .mjs', () => {
  it('named exports resolve', () => {
    assert.equal(typeof main, 'function');
    for (const fn of [setup.createStdioServer, setup.createHTTPServer]) assert.equal(typeof fn, 'function');
    for (const fn of [fonts.hasEmoji, fonts.needsUnicodeFont, fonts.validateTextForFont]) assert.equal(typeof fn, 'function');
  });
});
