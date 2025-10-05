# Contributing to @mcp-z/mcp-pdf

Thank you for your interest in contributing! This guide covers the development workflow, testing, and release process.

## Development Setup

### Prerequisites

- Node.js >= 16
- npm (comes with Node.js)
- Git

### Getting Started

1. Clone the repository:
```bash
git clone https://github.com/mcp-z/mcp-pdf.git
cd mcp-pdf
```

2. Install dependencies:
```bash
npm install
```

This will automatically download the Noto Color Emoji font (~15MB) needed for emoji support.

3. Build the project:
```bash
npm run build
```

### Development Scripts

- **`npm run build`** - Type check and build both ESM and CJS outputs
- **`npm run typecheck`** - Run TypeScript type checking only
- **`npm test`** - Run the test suite
- **`npm run format`** - Format code with Biome

## Project Scripts Explained

The project uses three automated scripts in the `scripts/` directory, all written in CommonJS:

### `postinstall.cjs`
**When it runs:** Automatically after `npm install` (on end user machines)

**What it does:** Downloads the Noto Color Emoji font file (~15MB) from GitHub if it doesn't already exist. This font enables color emoji rendering in PDFs without bundling a large font file in the package.

**User impact:** End users see a brief download message on first install. If the download fails, emoji rendering won't work, but the package still functions for regular text.

### `version.cjs`
**When it runs:** Automatically when you run `npm version patch/minor/major`

**What it does:** Syncs the version number from `package.json` to `server.json`, keeping both files in sync. The MCP registry uses `server.json` to track the package version.

**Developer impact:** You don't need to manually update version numbers in multiple places.

### `postpublish.cjs`
**When it runs:** Automatically after successful `npm publish`

**What it does:** 
1. Pushes the version commit and tags to GitHub
2. Updates the MCP Official Registry via `mcp-publisher`
3. Displays helpful links and manual submission reminders

**Developer impact:** One `npm publish` command handles deployment to npm, GitHub, and the MCP registry.

## Release Workflow

### Publishing a New Version

We use npm's native lifecycle hooks for a streamlined two-command deployment:

```bash
# Step 1: Bump the version (auto-syncs server.json)
npm version patch  # or: minor, major

# Step 2: Publish to npm (auto-pushes to GitHub and updates MCP registry)
npm publish --otp=<your-2fa-code>
```

That's it! The lifecycle hooks handle everything automatically.

### What Happens During Publish

When you run `npm publish`, the following happens automatically:

1. **prepublishOnly hook** runs `npm run build` (type checks and builds the package)
2. npm publishes the package to the npm registry
3. **postpublish hook** runs `scripts/postpublish.cjs`:
   - Pushes the version commit and tag to GitHub
   - Updates the MCP Official Registry via `mcp-publisher publish`
   - Shows success message with registry links

### Manual Submissions After Publishing

After automated deployment, you may want to manually submit to:

- **[Smithery](https://smithery.ai/new)** - If there are major feature changes
- **[mcpservers.org](https://mcpservers.org/submit)** - One-time submission for new listings

### Registries That Auto-Update (No Action Needed)

- **[PulseMCP](https://www.pulsemcp.com/servers)** - Auto-discovers from npm within 24-48 hours
- **[MCP Official Registry](https://modelcontextprotocol.io/registry)** - Updated automatically via postpublish hook

### Check Registry Status

Verify where the package is published:
- **npm**: https://www.npmjs.com/package/@mcp-z/mcp-pdf
- **MCP Official**: https://modelcontextprotocol.io/registry
- **GitHub**: https://github.com/mcp-z/mcp-pdf
- **Smithery**: https://smithery.ai/server/@mcp-z/mcp-pdf
- **PulseMCP**: https://www.pulsemcp.com/servers
- **Awesome MCP**: https://mcpservers.org/

## Testing

Run the test suite:

```bash
npm test
```

Test across multiple Node.js versions:

```bash
npm run test:engines
```

## Code Style

This project uses [Biome](https://biomejs.dev/) for linting and formatting. Run the formatter:

```bash
npm run format
```

The formatter runs with `--unsafe` mode to auto-fix issues. Code style is enforced to maintain consistency.

## Project Structure

```
mcp-pdf/
├── src/              # TypeScript source code
│   ├── index.ts      # Main MCP server implementation
│   └── lib/          # PDF generation helpers
├── scripts/          # Automated lifecycle scripts (all .cjs)
├── bin/              # Executable entry point
├── test/             # Test suite
├── dist/             # Built output (ESM + CJS)
└── .fonts/           # Downloaded emoji font (gitignored)
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `npm test`
5. Format code: `npm run format`
6. Commit with a clear message
7. Push to your fork and submit a pull request

## Questions or Issues?

- **Bug reports**: [GitHub Issues](https://github.com/mcp-z/mcp-pdf/issues)
- **Feature requests**: [GitHub Issues](https://github.com/mcp-z/mcp-pdf/issues)
- **Questions**: Open a discussion or issue

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
