import * as fs from 'fs';
import moduleRoot from 'module-root-sync';
import * as path from 'path';
import * as url from 'url';
import { parseArgs } from 'util';

// Kept dependency-free (fs/path/url/module-root-sync only) so `--version`/`--help`
// resolve nothing beyond Node startup: config.ts's parseConfig pulls in @mcp-z/server.
const pkg = JSON.parse(fs.readFileSync(path.join(moduleRoot(url.fileURLToPath(import.meta.url)), 'package.json'), 'utf-8'));

const HELP_TEXT = `
Usage: mcp-pdf [options]

MCP server for PDF document generation and processing.

Options:
  --version, -v          Show version number
  --help, -h             Show this help message
  --base-url=<url>       Base URL for HTTP file serving
  --log-level=<level>    Logging level (default: info)
  --resource-store-uri=<uri>    Resource store URI for file storage (default: file://~/.mcp-z/mcp-pdf/files)

Environment Variables:
  BASE_URL               Base URL for HTTP file serving (optional)
  LOG_LEVEL              Default logging level (optional)
  RESOURCE_STORE_URI            Resource store URI (optional, file://)

Examples:
  mcp-pdf                           # Use default settings
  mcp-pdf --port=3000               # HTTP transport on port 3000
  mcp-pdf --resource-store-uri=file:///tmp/pdfs      # Custom resource store URI
  LOG_LEVEL=debug mcp-pdf           # Set log level via env var
`.trim();

/** Package metadata read from package.json, resolved relative to this file. */
export function readPkg(): { name: string; version: string } {
  return pkg;
}

/**
 * Handle --version/--help flags before config parsing.
 * These must work without requiring any configuration or heavy dependency.
 */
export function handleVersionHelp(args: string[]): { handled: boolean; output?: string } {
  const { values } = parseArgs({
    args,
    options: {
      version: { type: 'boolean', short: 'v' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: false,
    allowPositionals: true,
  });

  if (values.version) return { handled: true, output: pkg.version };
  if (values.help) return { handled: true, output: HELP_TEXT };
  return { handled: false };
}
