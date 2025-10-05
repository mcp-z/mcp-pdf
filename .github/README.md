# GitHub Actions Configuration

This directory contains CI/CD workflows and configuration for automated publishing.

## server.json

This file is the **template** for MCP registry publishing. It is **only used by GitHub Actions** and should never be used locally.

### Why it uses placeholder versions

The version fields contain `"0.0.0-auto"` which serves as a placeholder. The actual version is injected dynamically by the GitHub Actions workflow from `package.json`.

### How it works

1. Developer runs `npm version patch` (updates only package.json)
2. Developer runs `npm publish` and `git push --follow-tags`
3. GitHub Actions workflow triggers on the version tag
4. Workflow reads version from package.json (e.g., "1.2.0")
5. Workflow runs: `jq --arg v "$VER" '.version = $v | .packages[].version = $v' server.json > server.effective.json`
6. Workflow publishes `server.effective.json` to MCP registry
7. Temporary file is discarded (never committed)

### Why this file is in .github/

- It's purely a CI/CD artifact
- Keeping it here makes it clear it's not for local use
- If someone tries `mcp-publisher publish` from the repo root, it will fail (no server.json found)
- This enforces using the automated GitHub Actions workflow

### Manual publishing

Manual publishing is intentionally disabled. If you try:

```bash
# This will fail - no server.json in root
mcp-publisher publish

# This will also fail - 0.0.0-auto is not valid
mcp-publisher publish --manifest .github/server.json
```

**This is by design.** All MCP registry publishing should go through GitHub Actions to ensure consistency and proper versioning.

## Workflow Files

- `publish-mcp.yml` - Automatically publishes to MCP registry after npm publish
