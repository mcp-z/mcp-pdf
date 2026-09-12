# @mcp-z/mcp-pdf

Create PDF documents and layouts, render pages to PNG, and measure text through MCP. The server runs locally and requires no API key.

Requires Node.js >=22.13. The examples use `npx`, included with npm, to run this server and `@mcp-z/cli`.

## Transports

MCP supports stdio and HTTP.

Both transports support the 2025 and 2026-07-28 protocol revisions. The 2026 revision is stateless, so clients using it send no `initialize` handshake or session ID.

Save one of these configurations as `.mcp.json` in the directory where you will run the commands.

**Stdio**
```json
{
  "mcpServers": {
    "pdf": {
      "command": "npx",
      "args": ["-y", "@mcp-z/mcp-pdf"]
    }
  }
}
```

**HTTP**
```json
{
  "mcpServers": {
    "pdf": {
      "type": "http",
      "url": "http://localhost:9010/mcp",
      "start": {
        "command": "npx",
        "args": ["-y", "@mcp-z/mcp-pdf", "--port=9010"]
      }
    }
  }
}
```

`start` is an extension used by `npx @mcp-z/cli up` to launch HTTP servers for you. The MCP endpoint is `/mcp`.

## First use

```bash
# List tools
npx -y @mcp-z/cli inspect --servers pdf --tools

# Create a simple PDF
npx -y @mcp-z/cli call-tool pdf pdf-document '{"content":[{"type":"text","text":"Hello from MCP"}]}'
```

The tool returns a file URI and metadata for the generated PDF. See the [complete tool reference](https://github.com/mcp-z/mcp-pdf/blob/master/TOOLS.md) for parameters and examples.

## Tool summary

| Tool | Use |
|---|---|
| `pdf-document` | Flowing documents with automatic pagination |
| `pdf-layout` | Precisely positioned layouts such as slides and flyers |
| `pdf-resume` | JSON Resume documents |
| `pdf-image` | Render PDF pages to PNG |
| `text-measure` | Measure text before layout |

## External resources

None.

## Prompts

1. resource-fetching

## Resources

- PDFKit Documentation
- JSON Resume Schema
- JSON Resume Editor

## Documentation

[API Docs](https://mcp-z.github.io/mcp-pdf)
