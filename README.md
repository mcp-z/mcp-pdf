# @mcpeasy/server-pdf

[![npm](https://img.shields.io/npm/v/@mcpeasy/server-pdf.svg)](https://www.npmjs.com/package/@mcpeasy/server-pdf)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/node/v/@mcpeasy/server-pdf.svg)](https://nodejs.org)
[![npm downloads](https://img.shields.io/npm/dm/@mcpeasy/server-pdf.svg)](https://www.npmjs.com/package/@mcpeasy/server-pdf)

MCP server for creative PDF generation with full emoji, Unicode, and offline support

## Why This Exists

PDFs shouldn't be boring. This server gives AI agents the power to create professional documents and creative projects with full emoji (😀 🎉 🚀), Unicode (你好 مرحبا Привет), and direct PDFKit access.

From practical invoices and resumes to creative artwork—if it's a PDF, you can build it.

## Features

- **Full Emoji & Unicode** - Color emoji as inline images, complete international text support
- **Offline Ready** - Works without internet after first install, perfect for local LLMs
- **Creative Freedom** - Colors, shapes, positioning—build anything from invoices to art
- **Three Specialized Tools** - Simple text, advanced layouts, or JSON Resume format
- **Zero Dependencies** - Pure JavaScript, no brew install, no system configuration
- **Smart Context Management** - Returns resource URIs instead of embedding PDFs in context

## Installation

### Option 1: Global Install (Recommended)

```bash
# npm
npm install -g @mcpeasy/server-pdf

# yarn
yarn global add @mcpeasy/server-pdf

# pnpm
pnpm add -g @mcpeasy/server-pdf
```

Then add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pdf": {
      "command": "server-pdf"
    }
  }
}
```

### Option 2: Direct Usage (No Install)

```bash
npx -y @mcpeasy/server-pdf
```

Config:

```json
{
  "mcpServers": {
    "pdf": {
      "command": "npx",
      "args": ["-y", "@mcpeasy/server-pdf"]
    }
  }
}
```

**Note:** On first install, emoji font (~15MB) downloads automatically. After that, works completely offline.

## Configuration Reference

See [server.json](./server.json) for the complete list of:
- Environment variables
- CLI arguments
- Default values

The `server.json` file follows the official [MCP Server Schema](https://static.modelcontextprotocol.io/schemas/2025-10-17/server.schema.json).

### Example Configuration

```json
{
  "mcpServers": {
    "server-pdf": {
      "command": "npx",
      "args": ["-y", "server-pdf"],
      "env": {
        "STORAGE_DIR": "~/.server-pdf"
      }
    }
  }
}
```

---

## Quick Start

Once installed, create your first PDF:

```typescript
// Ask Claude:
"Create a simple PDF with the text 'Hello World!'"

// Claude will use the pdf-create-simple tool
// Result: server-pdf://abc123 (resource URI)

// View the PDF:
"Show me that PDF"

// Claude retrieves the PDF content via the resource URI
```

✅ Your PDF is at `~/.server-pdf/` ready to use!

---

## Where to Find This Server

Published on multiple MCP registries and package managers:

- **[npm](https://www.npmjs.com/package/@mcpeasy/server-pdf)** - `@mcpeasy/server-pdf`
- **[MCP Official Registry](https://modelcontextprotocol.io/registry)** - `io.github.kmalakoff/server-pdf`
- **[Smithery](https://smithery.ai/server/@mcpeasy/server-pdf)** - One-click install via Smithery CLI
- **[Awesome MCP Servers](https://mcpservers.org/)** - Community curated list
- **[Cline Marketplace](https://github.com/cline/mcp-marketplace)** - Built-in to Cline IDE (coming soon)
- **[GitHub Repository](https://github.com/mcp-z/server-pdf)** - Source code and issues

---

## Works Everywhere

Runs anywhere Node.js >=16 runs. No Python, no Cairo, no Homebrew—just npm install and go. Once installed, works completely offline with cached fonts.

## How It Works

### Resource URIs (No Context Bloat)

When you create a PDF, the server returns a resource URI instead of embedding the PDF content:

```
Create PDF → Returns: server-pdf://uuid (just the URI, not the PDF)
```

This keeps PDFs out of the LLM's context until explicitly needed. PDFs are only loaded when you specifically request them via their resource URI.

### Security Model

This server writes PDFs to a sandboxed directory to prevent path traversal attacks:

- **Default location**: `~/.server-pdf/`
- **Custom location**: Set `STORAGE_DIR` environment variable
- **Filename sanitization**: Blocks `..`, `/`, and unsafe characters
- **No path parameters**: Tools accept only filenames, not full paths
- **Server isolation**: Never writes outside its storage directory

All generated PDFs are written to the configured storage directory with sanitized filenames.

### Storage Directory

PDFs are stored in `~/.server-pdf` by default. This works everywhere - local, containers, remote servers.

Most users should just use the default. No configuration needed.

---

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
pdf-create-simple({
  filename: "letter.pdf",
  text: "Dear Customer,\n\nThank you for your business.\n\nBest regards,\nACME Corp",
  title: "Customer Thank You"
})
```

### 2. Styled Document with Colors

Add visual style with colors and formatting:

```typescript
pdf-create({
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
pdf-create({
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
pdf-create-resume({
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

Beyond standard documents, this tool creates artistic PDFs through layered shapes, gradients, and effects. Examples include Bob Ross-style landscape paintings, space-themed documents with stars and cosmic effects, and visually striking community notices.

The `pdf-create` tool provides direct access to PDFKit's capabilities for combining shapes, colors, positioning, and text into virtually anything.

## Available Tools

### `pdf-create-resume`

Generate professional resumes from JSON Resume format.

**Parameters:**
- `filename` (string, optional) - Filename for the PDF (defaults to "resume.pdf")
- `resume` (object, required) - [JSON Resume schema](https://jsonresume.org/schema)
- `sections` (object, optional) - Section ordering and field templates
- `layout` (object, optional) - Spatial arrangement (single-column or two-column)
- `styling` (object, optional) - Typography and spacing options

**Resume Schema Sections:**
- `basics` - Name, contact, summary, location
- `work` - Work experience with highlights
- `education` - Degrees and institutions
- `projects` - Personal/professional projects
- `skills` - Skills grouped by category
- `awards`, `certificates`, `languages`, `volunteer`, `publications`, `interests`, `references`

See the resume example above for structure.

#### Field Templates

Field templates use [LiquidJS](https://liquidjs.com/) syntax to customize how individual fields are rendered. This allows complete control over date formats, location display, and other field-level formatting.

**Available Field Templates:**

| Template | Description | Default |
|----------|-------------|---------|
| `location` | Location display | `{{ city }}{% if region %}, {{ region }}{% endif %}` |
| `dateRange` | Date range format | `{{ start \| date: 'MMM YYYY' }} – {{ end \| date: 'MMM YYYY' \| default: 'Present' }}` |
| `degree` | Education degree | `{{ studyType }}{% if area %}, {{ area }}{% endif %}` |
| `credential` | Certificates/awards | `{{ title \| default: name }}{% if awarder %}, {{ awarder }}{% endif %}` |
| `language` | Language proficiency | `{{ language }}{% if fluency %} ({{ fluency }}){% endif %}` |
| `skill` | Skill keywords | `{{ name }}: {{ keywords \| join: ', ' }}` |
| `contactLine` | Contact info line | `{{ items \| join: ' \| ' }}` |

**Date Format Tokens:**

The `date` filter supports these tokens (NOT strftime syntax):

| Token | Output | Example |
|-------|--------|---------|
| `YYYY` | 4-digit year | 2024 |
| `YY` | 2-digit year | 24 |
| `MMMM` | Full month name | January |
| `MMM` | Short month name | Jan |
| `MM` | 2-digit month | 01 |
| `M` | 1-digit month | 1 |
| `DD` | 2-digit day | 05 |
| `D` | 1-digit day | 5 |

**Available Filters:**

| Filter | Description | Example |
|--------|-------------|---------|
| `date` | Format a date string | `{{ start \| date: 'MMM YYYY' }}` |
| `default` | Fallback for empty values | `{{ end \| default: 'Present' }}` |
| `tenure` | Calculate duration | `{{ start \| tenure: end }}` |
| `join` | Join array elements | `{{ keywords \| join: ', ' }}` |

**Example: French Resume**

```typescript
pdf-create-resume({
  filename: "cv-francais.pdf",
  resume: { /* JSON Resume data */ },
  sections: {
    fieldTemplates: {
      dateRange: "{{ start | date: 'MM/YYYY' }} – {{ end | date: 'MM/YYYY' | default: 'Présent' }}",
      location: "{{ city }}"
    }
  }
})
```

**Example: Verbose Date Format**

```typescript
pdf-create-resume({
  filename: "resume.pdf",
  resume: { /* JSON Resume data */ },
  sections: {
    fieldTemplates: {
      dateRange: "{{ start | date: 'MMMM YYYY' }} to {{ end | date: 'MMMM YYYY' | default: 'Present' }}"
    }
  }
})
// Output: "January 2020 to December 2023"
```

### Two-Column Resume Layout

Create professional two-column resumes with a sidebar:

```typescript
pdf-create-resume({
  filename: "two-column-resume.pdf",
  resume: {
    basics: {
      name: "Jane Doe",
      label: "Product Designer",
      email: "jane@example.com"
    },
    work: [{
      name: "Design Studio",
      position: "Lead Designer",
      startDate: "2019-03",
      highlights: ["Redesigned product UI", "Increased conversion by 25%"]
    }],
    skills: [
      { name: "Design", keywords: ["Figma", "Sketch", "Adobe XD"] },
      { name: "Frontend", keywords: ["HTML", "CSS", "React"] }
    ],
    languages: [
      { language: "English", fluency: "Native" },
      { language: "Spanish", fluency: "Intermediate" }
    ]
  },
  layout: {
    style: "two-column",
    gap: 30,
    columns: {
      left: {
        width: "30%",
        sections: ["skills", "languages"]
      },
      right: {
        width: "70%",
        sections: ["work"]
      }
    }
  }
})
```

**Layout Options:**
- `style` - "single-column" (default) or "two-column"
- `gap` - Space between columns in points (default: 30)
- `columns.left.width` - Left column width as percentage ("30%") or points (150)
- `columns.left.sections` - Section source paths for left column
- `columns.right.width` - Right column width
- `columns.right.sections` - Section source paths for right column

Sections not assigned to a column default to the right column. The header always spans the full width at the top.

---

### `pdf-create-simple`

Create basic text PDFs quickly.

**Parameters:**
- `filename` (string, optional) - Filename for the PDF (defaults to "document.pdf")
- `text` (string, required) - Text content
- `title` (string, optional) - Document metadata title

---

### `pdf-create`

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

---

## Flexbox Layout Engine

The `pdf-create` tool includes a flexbox layout engine powered by [Yoga](https://www.yogalayout.dev/) (Facebook's layout engine used in React Native). This allows you to create complex multi-column layouts without manual coordinate math.

### Groups: Flexbox Containers

Use `type: "group"` to create flexbox containers:

```typescript
{
  type: "group",

  // Flexbox properties
  direction: "row",      // "column" (default) or "row"
  gap: 20,               // Space between children (points)
  flex: 1,               // Flex grow factor
  justify: "center",     // Main axis: "start", "center", "end", "space-between", "space-around"
  alignItems: "center",  // Cross axis: "start", "center", "end", "stretch"

  // Self-positioning
  align: "center",       // Center this group in its parent

  // Size
  width: 300,            // Points or percentage ("50%")
  height: 200,

  // Visual
  padding: 15,           // Or { top, right, bottom, left }
  background: "#f5f5f5",
  border: { color: "#333", width: 1 },

  // Nested content
  children: [
    { type: "text", text: "Child 1" },
    { type: "text", text: "Child 2" }
  ]
}
```

### Common Layout Patterns

**Two Equal Columns:**
```typescript
{
  type: "group",
  direction: "row",
  gap: 20,
  children: [
    { type: "group", flex: 1, children: [{ type: "text", text: "Left" }] },
    { type: "group", flex: 1, children: [{ type: "text", text: "Right" }] }
  ]
}
```

**Three Columns with Proportions (1:2:1):**
```typescript
{
  type: "group",
  direction: "row",
  gap: 15,
  children: [
    { type: "group", flex: 1, children: [...] },  // 25%
    { type: "group", flex: 2, children: [...] },  // 50%
    { type: "group", flex: 1, children: [...] }   // 25%
  ]
}
```

**Centered Card:**
```typescript
{
  type: "group",
  width: 300,
  align: "center",  // Centers horizontally on page
  border: { color: "#333", width: 2 },
  padding: 20,
  children: [
    { type: "heading", text: "Card Title", align: "center" },
    { type: "text", text: "Card content here" }
  ]
}
```

**Space Between Items:**
```typescript
{
  type: "group",
  direction: "row",
  justify: "space-between",
  children: [
    { type: "text", text: "Left" },
    { type: "text", text: "Right" }
  ]
}
```

### Mixed Positioning

You can mix flexbox groups with absolute-positioned elements:

```typescript
pdf-create({
  layout: { mode: "fixed" },
  content: [
    // Absolute positioned header
    { type: "heading", text: "TITLE", x: 54, y: 50 },

    // Flexbox group at specific position
    {
      type: "group",
      direction: "row",
      gap: 20,
      x: 54,
      y: 100,
      children: [
        { type: "group", flex: 1, children: [...] },
        { type: "group", flex: 1, children: [...] }
      ]
    },

    // Absolute positioned footer
    { type: "text", text: "Footer", x: 54, y: 700 }
  ]
})
```

### Complete Flyer Example

```typescript
pdf-create({
  layout: { mode: "fixed" },
  pageSetup: { backgroundColor: "#fffef5" },
  content: [
    // Header
    {
      type: "heading",
      text: "SUMMER FESTIVAL 2024",
      align: "center",
      fontSize: 28,
      y: 50
    },
    {
      type: "text",
      text: "July 15-17 | Central Park",
      align: "center",
      y: 90
    },
    // Two-column content
    {
      type: "group",
      direction: "row",
      gap: 20,
      x: 54,
      y: 130,
      children: [
        {
          type: "group",
          flex: 1,
          border: { color: "#2196f3", width: 2 },
          padding: 15,
          children: [
            { type: "heading", text: "MUSIC", align: "center", fontSize: 18 },
            { type: "text", text: "Live bands all weekend" },
            { type: "text", text: "- Main Stage" },
            { type: "text", text: "- Acoustic Tent" }
          ]
        },
        {
          type: "group",
          flex: 1,
          border: { color: "#4caf50", width: 2 },
          padding: 15,
          children: [
            { type: "heading", text: "FOOD", align: "center", fontSize: 18 },
            { type: "text", text: "50+ local vendors" },
            { type: "text", text: "- Food Court" },
            { type: "text", text: "- Craft Beers" }
          ]
        }
      ]
    },
    // Centered ticket box
    {
      type: "group",
      width: 300,
      align: "center",
      y: 400,
      border: { color: "#ff9800", width: 2 },
      padding: 15,
      background: "#fff8e1",
      children: [
        { type: "heading", text: "TICKETS", align: "center", fontSize: 16 },
        { type: "text", text: "Early Bird: $25", align: "center" },
        { type: "text", text: "At Door: $35", align: "center" }
      ]
    }
  ]
})
```

---

## Emoji & Unicode Support

**Color Emoji** - True color emoji render as inline PNG images. Emoji like 😀 🎉 🚀 👋 appear in full color. The emoji font (NotoColorEmoji.ttf) downloads automatically on install.

```json
{
  "basics": {
    "name": "John Doe 👨‍💻",
    "summary": "Developer 💻 passionate about clean code ✨"
  }
}
```

**Unicode** - Complete international text support including Chinese (你好), Japanese (こんにちは), Korean (안녕하세요), Arabic (مرحبا), Cyrillic (Привет), Hebrew, Thai, Greek (Ξ Δ Ω), and geometric symbols (△ ○ ◆).

## Resources

- [PDFKit Documentation](http://pdfkit.org/) - Full PDFKit API reference
- [JSON Resume Schema](https://jsonresume.org/schema) - Resume format documentation
- [JSON Resume Editor](https://jsonresume.org/getting-started/) - Online resume builder

## Requirements

Node.js >= 16

## Contributing

Interested in contributing? See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, testing, and release workflow.

## License

MIT
