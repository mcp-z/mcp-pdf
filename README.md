# @mcp-z/mcp-pdf

Docs: https://mcp-z.github.io/mcp-pdf
PDF generation MCP server for documents, layouts, and image export.

## Common uses

- Generate PDFs from text or layouts
- Render PDF pages as images
- Measure text before layout

## Transports

MCP supports stdio and HTTP.

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

`start` is an extension used by `npx @mcp-z/cli up` to launch HTTP servers for you.

## Authentication

No OAuth or API keys required.

## How to use

```bash
# List tools
mcp-z inspect --servers pdf --tools

# Create a simple PDF
mcp-z call pdf pdf-document '{"content":["Hello from MCP"]}'
```

## Available tools

### pdf-resume

Generate professional resumes from JSON Resume format.

Parameters:

- `filename` (string, optional) - Filename for the PDF (defaults to "resume.pdf")
- `resume` (object, required) - JSON Resume schema
- `sections` (object, optional) - Section ordering and field templates
- `layout` (object, optional) - Spatial arrangement (single-column or two-column)
- `styling` (object, optional) - Typography and spacing options
- `font` (string, optional) - Custom font
- `pageSize` (string, optional) - Page size (default: "LETTER")
- `backgroundColor` (string, optional) - Page background color

Resume schema sections:

- `basics` - Name, contact, summary, location
- `work` - Work experience with highlights
- `education` - Degrees and institutions
- `projects` - Personal/professional projects
- `skills` - Skills grouped by category
- `awards`, `certificates`, `languages`, `volunteer`, `publications`, `interests`, `references`

#### Section configuration

Control which sections appear and in what order using `sections.sections`:

```ts
await client.callTool('pdf-resume', {
  resume: { /* JSON Resume data */ },
  sections: {
    sections: [
      { source: 'basics', render: 'header' },
      { source: 'basics.summary', title: 'Summary' },
      { source: 'work', title: 'Experience' },
      { source: 'skills', title: 'Skills' },
      { source: 'education', title: 'Education' }
    ]
  }
});
```

Section config properties:

- `source` (string, required) - Path to data in resume schema (e.g., `basics`, `work`, `meta.customField`)
- `render` (string, optional) - Built-in renderer. Use `header` explicitly or to force a renderer
- `title` (string, optional) - Section heading (omit for no title)
- `template` (string, optional) - LiquidJS template for custom rendering

Available renderers:

- `header` - Name + contact line from basics (never auto-inferred)
- `entry-list` - Arrays with position/institution/organization
- `keyword-list` - Arrays with `keywords`
- `language-list` - Arrays with `language`
- `credential-list` - Arrays with awarder/issuer/publisher
- `reference-list` - Arrays with `reference`
- `text` - String or string array

Example: custom section order with meta fields

```ts
await client.callTool('pdf-resume', {
  resume: {
    basics: { name: 'Jane Doe', email: 'jane@example.com' },
    work: [{ /* ... */ }],
    meta: { valueProp: 'Full-stack engineer with 10+ years experience...' }
  },
  sections: {
    sections: [
      { source: 'basics', render: 'header' },
      { source: 'meta.valueProp', title: 'Value Proposition' },
      { source: 'work', title: 'Experience' }
    ]
  }
});
```

#### Field templates

Field templates use LiquidJS syntax to customize how fields are rendered.

Available field templates:

- `location` - `{{ city }}{% if region %}, {{ region }}{% endif %}`
- `dateRange` - `{{ start | date: 'MMM YYYY' }} - {{ end | date: 'MMM YYYY' | default: 'Present' }}`
- `degree` - `{{ studyType }}{% if area %}, {{ area }}{% endif %}`
- `credential` - `{{ title | default: name }}{% if awarder %}, {{ awarder }}{% endif %}`
- `language` - `{{ language }}{% if fluency %} ({{ fluency }}){% endif %}`
- `skill` - `{{ name }}: {{ keywords | join: ', ' }}`
- `contactLine` - `{{ items | join: ' | ' }}`

Date format tokens:

- `YYYY`, `YY`, `MMMM`, `MMM`, `MM`, `M`, `DD`, `D`

Available filters:

- `date` - Format a date string
- `default` - Fallback for empty values
- `tenure` - Calculate duration
- `join` - Join array elements

Example: French resume

```ts
await client.callTool('pdf-resume', {
  filename: 'cv-francais.pdf',
  resume: { /* JSON Resume data */ },
  sections: {
    fieldTemplates: {
      dateRange: "{{ start | date: 'MM/YYYY' }} - {{ end | date: 'MM/YYYY' | default: 'Present' }}",
      location: '{{ city }}'
    }
  }
});
```

Example: verbose date format

```ts
await client.callTool('pdf-resume', {
  filename: 'resume.pdf',
  resume: { /* JSON Resume data */ },
  sections: {
    fieldTemplates: {
      dateRange: "{{ start | date: 'MMMM YYYY' }} to {{ end | date: 'MMMM YYYY' | default: 'Present' }}"
    }
  }
});
```

#### Two-column resume layout

```ts
await client.callTool('pdf-resume', {
  filename: 'two-column-resume.pdf',
  resume: {
    basics: {
      name: 'Jane Doe',
      label: 'Product Designer',
      email: 'jane@example.com'
    },
    work: [{
      name: 'Design Studio',
      position: 'Lead Designer',
      startDate: '2019-03',
      highlights: ['Redesigned product UI', 'Increased conversion by 25%']
    }],
    skills: [
      { name: 'Design', keywords: ['Figma', 'Sketch', 'Adobe XD'] },
      { name: 'Frontend', keywords: ['HTML', 'CSS', 'React'] }
    ],
    languages: [
      { language: 'English', fluency: 'Native' },
      { language: 'Spanish', fluency: 'Intermediate' }
    ]
  },
  layout: {
    style: 'two-column',
    gap: 30,
    columns: {
      left: { width: '30%', sections: ['skills', 'languages'] },
      right: { width: '70%', sections: ['work'] }
    }
  }
});
```

Layout options:

- `style` - "single-column" (default) or "two-column"
- `gap` - Space between columns in points (default: 30)
- `columns.left.width` - Left column width (percentage or points)
- `columns.left.sections` - Section source paths for left column
- `columns.right.width` - Right column width
- `columns.right.sections` - Section source paths for right column

### pdf-layout

Create a PDF with precise positioning and Yoga flexbox layout.

Parameters:

- `filename` (string, optional) - Filename for the PDF (defaults to "document.pdf")
- `title` (string, optional) - Document metadata
- `author` (string, optional) - Document metadata
- `pageSetup` (object, optional) - Page configuration
- `content` (array, required) - Content items
- `layout` (object, optional) - Layout options

Page setup:

```ts
pageSetup: {
  size: [612, 792],
  margins: { top: 72, bottom: 72, left: 72, right: 72 },
  backgroundColor: '#FFFFFF'
}
```

Content types:

Text and headings:

```ts
{
  type: 'text',
  text: 'Content here',
  fontSize: 12,
  bold: true,
  color: '#000000',
  align: 'left',
  x: 100,
  y: 200,
  oblique: 15,
  characterSpacing: 1,
  moveDown: 1,
  underline: true,
  strike: true
}
```

Shapes:

```ts
{ type: 'rect', x: 50, y: 50, width: 200, height: 100, fillColor: '#FF0000', strokeColor: '#000000', lineWidth: 2 }
{ type: 'circle', x: 300, y: 400, radius: 50, fillColor: '#00FF00', strokeColor: '#000000', lineWidth: 1 }
{ type: 'line', x1: 100, y1: 100, x2: 500, y2: 100, strokeColor: '#0000FF', lineWidth: 2 }
```

Images and pages:

```ts
{ type: 'image', imagePath: '/path/to/image.png', width: 200, height: 150, x: 100, y: 200 }
{ type: 'pageBreak' }
```

#### Flexbox layout engine

Use `type: 'group'` to create flexbox containers:

```ts
{
  type: 'group',
  direction: 'row',
  gap: 20,
  flex: 1,
  justify: 'center',
  alignItems: 'center',
  align: 'center',
  width: 300,
  height: 200,
  padding: 15,
  background: '#f5f5f5',
  border: { color: '#333', width: 1 },
  children: [
    { type: 'text', text: 'Child 1' },
    { type: 'text', text: 'Child 2' }
  ]
}
```

Common layout patterns:

Two equal columns:

```ts
{
  type: 'group',
  direction: 'row',
  gap: 20,
  children: [
    { type: 'group', flex: 1, children: [{ type: 'text', text: 'Left' }] },
    { type: 'group', flex: 1, children: [{ type: 'text', text: 'Right' }] }
  ]
}
```

Three columns with proportions (1:2:1):

```ts
{
  type: 'group',
  direction: 'row',
  gap: 15,
  children: [
    { type: 'group', flex: 1, children: [/* ... */] },
    { type: 'group', flex: 2, children: [/* ... */] },
    { type: 'group', flex: 1, children: [/* ... */] }
  ]
}
```

Centered card:

```ts
{
  type: 'group',
  width: 300,
  align: 'center',
  border: { color: '#333', width: 2 },
  padding: 20,
  children: [
    { type: 'heading', text: 'Card Title', align: 'center' },
    { type: 'text', text: 'Card content here' }
  ]
}
```

Space between items:

```ts
{
  type: 'group',
  direction: 'row',
  justify: 'space-between',
  children: [
    { type: 'text', text: 'Left' },
    { type: 'text', text: 'Right' }
  ]
}
```

Mixed positioning:

```ts
await client.callTool('pdf-layout', {
  layout: { overflow: 'auto' },
  content: [
    { type: 'heading', text: 'TITLE', x: 54, y: 50 },
    {
      type: 'group',
      direction: 'row',
      gap: 20,
      x: 54,
      y: 100,
      children: [
        { type: 'group', flex: 1, children: [/* ... */] },
        { type: 'group', flex: 1, children: [/* ... */] }
      ]
    },
    { type: 'text', text: 'Footer', x: 54, y: 700 }
  ]
});
```

Complete flyer example:

```ts
await client.callTool('pdf-layout', {
  pageSetup: { backgroundColor: '#fffef5' },
  content: [
    { type: 'heading', text: 'SUMMER FESTIVAL 2024', align: 'center', fontSize: 28, y: 50 },
    { type: 'text', text: 'July 15-17 | Central Park', align: 'center', y: 90 },
    {
      type: 'group',
      direction: 'row',
      gap: 20,
      x: 54,
      y: 130,
      children: [
        {
          type: 'group',
          flex: 1,
          border: { color: '#2196f3', width: 2 },
          padding: 15,
          children: [
            { type: 'heading', text: 'MUSIC', align: 'center', fontSize: 18 },
            { type: 'text', text: 'Live bands all weekend' },
            { type: 'text', text: '- Main Stage' },
            { type: 'text', text: '- Acoustic Tent' }
          ]
        },
        {
          type: 'group',
          flex: 1,
          border: { color: '#4caf50', width: 2 },
          padding: 15,
          children: [
            { type: 'heading', text: 'FOOD', align: 'center', fontSize: 18 },
            { type: 'text', text: '50+ local vendors' },
            { type: 'text', text: '- Food Court' },
            { type: 'text', text: '- Craft Beers' }
          ]
        }
      ]
    },
    {
      type: 'group',
      width: 300,
      align: 'center',
      y: 400,
      border: { color: '#ff9800', width: 2 },
      padding: 15,
      background: '#fff8e1',
      children: [
        { type: 'heading', text: 'TICKETS', align: 'center', fontSize: 16 },
        { type: 'text', text: 'Early Bird: $25', align: 'center' },
        { type: 'text', text: 'At Door: $35', align: 'center' }
      ]
    }
  ]
});
```

#### Emoji and Unicode support

Color emoji render as inline images. Unicode text is supported across major scripts.

```json
{
  "basics": {
    "name": "John Doe",
    "summary": "Developer passionate about clean code"
  }
}
```

### pdf-document

Create a flowing PDF document with automatic pagination.

### pdf-image

Render PDF pages to PNG images for previews or export.

### text-measure

Measure text width and height before layout.

## Tools

1. pdf-document
2. pdf-image
3. pdf-layout
4. pdf-resume
5. text-measure

## External resources

None.

## Prompts

1. resource-fetching

## Resources

- PDFKit Documentation
- JSON Resume Schema
- JSON Resume Editor
