#!/usr/bin/env node

// Checks --version/--help/`version` via the dependency-free version-help module before ever
// touching index.js, which statically re-exports the mcp/fonts/setup/schemas namespaces
// (pdfkit, @napi-rs/canvas, liquidjs, @modelcontextprotocol/sdk, express et al.) -- importing
// index.js at all, even without calling anything in it, evaluates that whole graph.
import { handleVersionHelp } from '../dist/esm/setup/version-help.js';

const result = handleVersionHelp(process.argv.slice(2));
if (result.handled) {
  console.log(result.output);
  process.exit(0);
}

const main = (await import('../dist/esm/index.js')).default;
main(process.argv.slice(2), 'mcp-pdf').catch((err) => {
  console.error(err);
  process.exit(-1);
});
