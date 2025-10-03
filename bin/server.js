#!/usr/bin/env node

// biome-ignore lint/security/noGlobalEval: dual esm and cjs
if (typeof require === 'undefined') eval("import('../dist/esm/index.js').then((mod) => mod.default()).catch((err) => { console.error('Failed to start server:', err); process.exit(1); });");
else require('../dist/cjs/index.js')();
