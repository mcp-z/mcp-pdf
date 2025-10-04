# @mcp-z/mcp-pdf

MCP server for creative PDF generation. AI agents and users work together to create anything from simple documents to artistic masterpieces—all powered by PDFKit.

## Why This Exists

PDFs shouldn't be boring. This server gives AI agents the power to generate professional documents, creative projects, and everything in between. Color emoji support (😀 🎉 🚀), full Unicode (你好 مرحبا Привет), and direct PDFKit access mean the only limit is imagination.

Projects range from Bob Ross-style paintings and space-themed documents to practical invoices and resumes. It's for professionals and fun seekers alike.

## Features

- **Creative Freedom** - Colors, shapes, positioning, emoji—build anything
- **Pure JavaScript** - No native dependencies, works everywhere
- **Emoji & Unicode** - Color emoji as images, full international text support
- **Three Tools** - Simple text, advanced layouts, or JSON Resume format
- **PDFKit Wrapper** - Minimal abstraction over PDFKit's powerful API

## Installation

```bash
npm install -g @mcp-z/mcp-pdf
```

Or use directly:

```bash
npx @mcp-z/mcp-pdf
```

## Quick Start

Add to `claude_desktop_config.json`:

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

## Security Model

This server writes PDFs to a sandboxed directory to prevent path traversal attacks:

- **Default location**: `~/.mcp-pdf/`
- **Custom location**: Set `PDF_OUTPUT_DIR` environment variable
- **Filename sanitization**: Blocks `..`, `/`, and unsafe characters
- **No path parameters**: Tools accept only filenames, not full paths

All generated PDFs are written to the configured output directory with sanitized filenames.

### Custom Output Directory

To override the default location, set the `PDF_OUTPUT_DIR` environment variable:

```json
{
  "mcpServers": {
    "pdf": {
      "command": "npx",
      "args": ["-y", "@mcp-z/mcp-pdf"],
      "env": {
        "PDF_OUTPUT_DIR": "/Users/yourname/Documents/PDFs"
      }
    }
  }
}
```

## Where to Find This Server

Published on multiple MCP registries and package managers:

- **[npm](https://www.npmjs.com/package/@mcp-z/mcp-pdf)** - `@mcp-z/mcp-pdf`
- **[MCP Official Registry](https://modelcontextprotocol.io/registry)** - `io.github.kmalakoff/mcp-pdf`
- **[Smithery](https://smithery.ai/server/@mcp-z/mcp-pdf)** - One-click install via Smithery CLI
- **[Awesome MCP Servers](https://mcpservers.org/)** - Community curated list (pending approval)
- **[Cline Marketplace](https://github.com/cline/mcp-marketplace)** - Built-in to Cline IDE (coming soon)
- **[GitHub Repository](https://github.com/mcp-z/mcp-pdf)** - Source code and issues

## What You Can Create

- **Professional** - Resumes, invoices, reports, certificates
- **Creative** - Flyers, posters, artistic documents, themed designs
- **Practical** - Letters, notices, forms, documentation
- **Experimental** - Bob Ross paintings, space themes, progressive effects
- **Anything** - If it's a PDF, you can build it

## Examples

### 1. Simple Text Document

Start simple with plain text:

```typescript
create-simple-pdf({
  filename: "letter.pdf",
  text: "Dear Customer,\n\nThank you for your business.\n\nBest regards,\nACME Corp",
  title: "Customer Thank You"
})
```

### 2. Styled Document with Colors

Add visual style with colors and formatting:

```typescript
create-pdf({
  filename: "notice.pdf",
  content: [
    {
      type: "heading",
      text: "Community Notice",
      fontSize: 24,
      color: "#2C5F8D",
      align: "center"
    },
    {
      type: "text",
      text: "Pool maintenance scheduled for this weekend.",
      fontSize: 12,
      moveDown: 2
    },
    {
      type: "text",
      text: "Questions? Contact the front desk.",
      color: "#666666"
    }
  ]
})
```

### 3. Certificate with Shapes

Combine shapes and text for visual impact:

```typescript
create-pdf({
  filename: "certificate.pdf",
  pageSetup: {
    backgroundColor: "#FFF8DC"
  },
  content: [
    // Gold border
    {
      type: "rect",
      x: 50,
      y: 50,
      width: 512,
      height: 692,
      strokeColor: "#DAA520",
      lineWidth: 3
    },
    // Title
    {
      type: "heading",
      text: "Certificate of Achievement",
      fontSize: 32,
      color: "#DAA520",
      align: "center",
      y: 200
    },
    // Recipient
    {
      type: "text",
      text: "Presented to",
      fontSize: 14,
      align: "center",
      moveDown: 2
    },
    {
      type: "heading",
      text: "Alex Quantum",
      fontSize: 28,
      color: "#003366",
      align: "center"
    }
  ]
})
```

### 4. Professional Resume

Handle complex structured data with JSON Resume:

```typescript
generate-resume-pdf({
  filename: "john-doe-resume.pdf",
  resume: {
    basics: {
      name: "John Doe",
      label: "Software Engineer",
      email: "john@example.com",
      phone: "(555) 123-4567",
      summary: "Experienced software engineer with 5+ years building scalable web applications.",
      location: {
        city: "San Francisco",
        region: "CA"
      }
    },
    work: [
      {
        name: "Tech Corp",
        position: "Senior Software Engineer",
        startDate: "2021-03",
        highlights: [
          "Built real-time notification system",
          "Reduced API response time by 60%",
          "Mentored 5 junior engineers"
        ]
      }
    ],
    skills: [
      {
        name: "Languages",
        keywords: ["TypeScript", "JavaScript", "Python"]
      }
    ]
  }
})
```

## Creative Possibilities

This tool has been used to create:

- **Bob Ross-style paintings** - Layered shapes with colors creating landscape art
- **Space-themed documents** - Stars, gradients, and cosmic effects
- **Apartment notices** - Creative community announcements with visual flair
- **Progressive effects** - Font tapering, color gradients, animated-style layouts

The examples above show practical starting points, but agents can combine shapes, colors, positioning, and text to create virtually anything. The `create-pdf` tool provides direct access to PDFKit's capabilities.

## Available Tools

### `generate-resume-pdf`

Generate professional resumes from JSON Resume format.

**Parameters:**
- `filename` (string, optional) - Filename for the PDF (defaults to "resume.pdf")
- `resume` (object, required) - [JSON Resume schema](https://jsonresume.org/schema)

**Resume Schema Sections:**
- `basics` - Name, contact, summary, location
- `work` - Work experience with highlights
- `education` - Degrees and institutions
- `projects` - Personal/professional projects
- `skills` - Skills grouped by category
- `awards`, `certificates`, `languages`, `volunteer`, `publications`, `interests`, `references`

See the resume example above for structure.

---

### `create-simple-pdf`

Create basic text PDFs quickly.

**Parameters:**
- `filename` (string, optional) - Filename for the PDF (defaults to "document.pdf")
- `text` (string, required) - Text content
- `title` (string, optional) - Document metadata title

---

### `create-pdf`

Advanced PDF creation with full layout control.

**Parameters:**
- `filename` (string, optional) - Filename for the PDF (defaults to "document.pdf")
- `title` (string, optional) - Document metadata
- `author` (string, optional) - Document metadata
- `pageSetup` (object, optional) - Page configuration
- `content` (array, required) - Content items

**Page Setup:**
```typescript
pageSetup: {
  size: [612, 792],  // [width, height] in points (default: Letter)
  margins: { top: 72, bottom: 72, left: 72, right: 72 },
  backgroundColor: "#FFFFFF"
}
```

**Content Types:**

**Text & Headings:**
```typescript
{
  type: "text",  // or "heading"
  text: "Content here",
  fontSize: 12,
  bold: true,
  color: "#000000",
  align: "left",  // "left", "center", "right", "justify"
  x: 100,  // optional positioning
  y: 200,
  oblique: 15,  // italic slant in degrees
  characterSpacing: 1,
  moveDown: 1,  // spacing after (line heights)
  underline: true,
  strike: true
}
```

**Shapes:**
```typescript
// Rectangle
{
  type: "rect",
  x: 50,
  y: 50,
  width: 200,
  height: 100,
  fillColor: "#FF0000",
  strokeColor: "#000000",
  lineWidth: 2
}

// Circle
{
  type: "circle",
  x: 300,  // center X
  y: 400,  // center Y
  radius: 50,
  fillColor: "#00FF00",
  strokeColor: "#000000",
  lineWidth: 1
}

// Line
{
  type: "line",
  x1: 100,
  y1: 100,
  x2: 500,
  y2: 100,
  strokeColor: "#0000FF",
  lineWidth: 2
}
```

**Images & Pages:**
```typescript
// Image
{
  type: "image",
  imagePath: "/path/to/image.png",
  width: 200,
  height: 150,
  x: 100,  // optional positioning
  y: 200
}

// Page Break
{
  type: "pageBreak"
}
```

## Emoji & Unicode Support

### Color Emoji ✅

True color emoji render as inline PNG images:

```json
{
  "basics": {
    "name": "John Doe 👨‍💻",
    "summary": "Developer 💻 passionate about clean code ✨"
  }
}
```

Emoji like 😀 🎉 🚀 👋 appear in full color. The emoji font (NotoColorEmoji.ttf) downloads automatically on install.

### Unicode ✅

Full international text support:
- **CJK**: Chinese (你好), Japanese (こんにちは), Korean (안녕하세요)
- **Scripts**: Arabic (مرحبا), Cyrillic (Привет), Hebrew, Thai
- **Symbols**: Greek (Ξ Δ Ω), geometric (△ ○ ◆), dingbats (✓ ✗ ➤)

## Resources

- [PDFKit Documentation](http://pdfkit.org/) - Full PDFKit API reference
- [JSON Resume Schema](https://jsonresume.org/schema) - Resume format documentation
- [JSON Resume Editor](https://jsonresume.org/getting-started/) - Online resume builder

## Requirements

Node.js >= 16

## License

MIT
