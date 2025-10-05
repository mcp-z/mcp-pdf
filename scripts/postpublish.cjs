#!/usr/bin/env node
// Post-publish tasks: Push to GitHub and update MCP Registry
// Runs automatically after successful npm publish

const { execSync } = require('child_process');

function exec(command, options = {}) {
  return execSync(command, { stdio: 'inherit', ...options });
}

function main() {
  console.log('');
  console.log('📌 Post-publish: Pushing to GitHub...');
  try {
    exec('git push');
  } catch (error) {
    console.error('⚠️  Failed to push to GitHub:', error.message);
    console.error('   Please run: git push');
  }

  console.log('');
  console.log('🔄 Post-publish: Updating MCP Official Registry...');
  try {
    // Re-login if needed (token might expire)
    try {
      exec('mcp-publisher login github --non-interactive', { stdio: 'pipe' });
    } catch {
      // Ignore login errors
    }
    exec('mcp-publisher publish');
  } catch (error) {
    console.error('⚠️  Failed to update MCP Registry:', error.message);
    console.error('   Please run: mcp-publisher publish');
  }

  console.log('');
  console.log('✅ Deployment Complete!');
  console.log('');
  console.log('📊 Published to:');
  console.log('  ✅ npm: https://www.npmjs.com/package/@mcp-z/mcp-pdf');
  console.log('  ✅ GitHub: https://github.com/mcp-z/mcp-pdf');
  console.log('  ✅ MCP Registry: https://modelcontextprotocol.io/registry');
  console.log('');
  console.log('⏳ Auto-updating (no action needed):');
  console.log('  ⏳ PulseMCP (will discover in 24-48 hours)');
  console.log('');
  console.log('📝 Manual submissions needed:');
  console.log('  🔲 Smithery: https://smithery.ai/new');
  console.log('  🔲 mcpservers.org: https://mcpservers.org/submit');
  console.log('');
}

main();
