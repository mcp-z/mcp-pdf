import { randomBytes } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import PDFDocument from 'pdfkit';
import { z } from 'zod/v3';
import { jsonResumeSchema } from './json-resume-schema.ts';
import { registerEmojiFont } from './lib/emoji-renderer.ts';
import { hasEmoji, setupFonts, validateTextForFont } from './lib/fonts.ts';
import { renderTextWithEmoji } from './lib/pdf-helpers.ts';
import { generateResumePDFBuffer } from './resume-generator.ts';

// Export utility functions for emoji/Unicode detection and character validation
export { type CharacterValidationResult, hasEmoji, needsUnicodeFont, validateTextForFont } from './lib/fonts.ts';

// Helper to generate unique PDF IDs
function generatePdfId(): string {
  return randomBytes(8).toString('hex');
}

// Create and configure the MCP server
function createPdfServer(): McpServer {
  const server = new McpServer({
    name: 'mcp-pdf',
    version: '0.2.1',
  });

  // Register tool: create-pdf
  server.registerTool(
    'create-pdf',
    {
      title: 'Create PDF',
      description:
        'Create a PDF document with text, images, shapes, and full layout control. Supports progressive enhancement from simple documents to complex designs.\n\n' +
        '**Key Features:**\n' +
        '• Unicode support: Chinese, Japanese, Korean, Arabic, emoji - auto-detects system fonts\n' +
        '• Page setup (custom size, margins, background color)\n' +
        '• Text with colors, fonts, positioning, and styling (oblique, spacing, etc.)\n' +
        '• Shapes (rectangles, circles, lines) for visual design\n' +
        '• Emoji rendering with inline image support\n\n' +
        '**Common Patterns:**\n\n' +
        '1. **Simple Document** (no pageSetup needed):\n' +
        '   [{"type": "heading", "text": "Title"}, {"type": "text", "text": "Body"}]\n\n' +
        '2. **Styled Document** (add colors/background):\n' +
        '   pageSetup: {"backgroundColor": "#F5F5F5"}\n' +
        '   content: [{"type": "heading", "text": "Title", "color": "#4A90E2"}]\n\n' +
        '3. **Custom Layout** (letterhead, certificates):\n' +
        '   [{"type": "rect", "x": 0, "y": 0, "width": 612, "height": 80, "fillColor": "navy"},\n' +
        '    {"type": "heading", "text": "Company", "color": "white", "y": 25, "align": "center"}]\n\n' +
        '4. **Algorithmic Design** (tapering fonts, progressive layouts):\n' +
        '   Calculate values in a loop, then pass to tool:\n' +
        '   for (let i = 0; i < lines.length; i++) {\n' +
        '     const progress = i / lines.length;\n' +
        '     const fontSize = 8 + (progress * 16); // 8pt → 24pt\n' +
        '     content.push({"type": "text", "text": lines[i], "fontSize": fontSize});\n' +
        '   }\n\n' +
        '**Coordinate System:**\n' +
        '• Origin (0, 0) is top-left corner\n' +
        '• Letter size page: 612 x 792 points (8.5" x 11")\n' +
        '• 72 points = 1 inch\n\n' +
        '**Tips:**\n' +
        '• Use "align": "center" for centered text (works with or without "width")\n' +
        '• Use "x" to manually position (calculate as: (pageWidth - textWidth) / 2 for centering)\n' +
        '• Colors: hex ("#FFD700") or named ("gold", "navy", "black")\n' +
        '• Oblique: true for default slant, or number for degrees (15 = italic look)\n' +
        '• All pageSetup and visual styling fields are optional - defaults match standard documents',
      inputSchema: {
        filename: z.string().optional().describe('Optional filename for the PDF (defaults to "document.pdf")'),
        title: z.string().optional().describe('Document title metadata'),
        author: z.string().optional().describe('Document author metadata'),
        font: z
          .string()
          .optional()
          .describe(
            'Font for the PDF (optional - defaults to "auto").\n\n' +
              '**Default**: "auto" auto-detects Unicode fonts on macOS/Linux/Windows. Works for Chinese, Japanese, Korean, Arabic, emoji, and all languages.\n\n' +
              'Advanced options:\n' +
              '• Built-in: Helvetica, Times-Roman, Courier - ASCII/Latin only, no Chinese support\n' +
              '• Custom: Absolute path to TTF/OTF font file for special needs\n\n' +
              '**You can omit this parameter** - auto-detection works for 99% of use cases.'
          ),
        pageSetup: z
          .object({
            size: z.tuple([z.number(), z.number()]).optional().describe('Page size [width, height] in points (default: [612, 792] = Letter)'),
            margins: z
              .object({
                top: z.number().describe('Top margin in points'),
                bottom: z.number().describe('Bottom margin in points'),
                left: z.number().describe('Left margin in points'),
                right: z.number().describe('Right margin in points'),
              })
              .optional()
              .describe('Page margins in points (default: {top: 72, bottom: 72, left: 72, right: 72})'),
            backgroundColor: z.string().optional().describe('Page background color (hex like #000000 or named color like "black")'),
          })
          .optional()
          .describe('Optional page setup configuration'),
        content: z
          .array(
            z.union([
              z.object({
                type: z.literal('text').describe('Text content'),
                text: z.string().optional().describe('Text content'),
                fontSize: z.number().optional().describe('Font size in points (default: 12)'),
                bold: z.boolean().optional().describe('Use bold font'),
                color: z.string().optional().describe('Text color (hex like #FFD700 or named color like "gold", default: black)'),

                // Positioning
                x: z.number().optional().describe('X position'),
                y: z.number().optional().describe('Y position'),

                // Layout & Alignment
                align: z.enum(['left', 'center', 'right', 'justify']).optional().describe('Text alignment (default: left)'),
                indent: z.number().optional().describe('First line indent in points'),
                lineGap: z.number().optional().describe('Space between lines in points'),
                paragraphGap: z.number().optional().describe('Space between paragraphs in points'),
                width: z.number().optional().describe('Text wrapping width in points'),

                // Spacing Control
                moveDown: z.number().optional().describe('Lines to move down after this item (0 = no spacing)'),

                // Text Styling
                underline: z.boolean().optional().describe('Underline text'),
                strike: z.boolean().optional().describe('Strikethrough text'),
                oblique: z.union([z.boolean(), z.number()]).optional().describe('Slant text (true or angle in degrees)'),
                link: z.string().optional().describe('URL to link this text to'),
                characterSpacing: z.number().optional().describe('Letter spacing in points'),
                wordSpacing: z.number().optional().describe('Word spacing in points'),

                // Advanced
                continued: z.boolean().optional().describe('Text continues inline with next item'),
                lineBreak: z.boolean().optional().describe('Enable line wrapping (default: true)'),
              }),
              z.object({
                type: z.literal('heading').describe('Heading content'),
                text: z.string().optional().describe('Text content'),
                fontSize: z.number().optional().describe('Font size in points (default: 24)'),
                bold: z.boolean().optional().describe('Use bold font (default: true)'),
                color: z.string().optional().describe('Text color (hex like #FFD700 or named color like "gold", default: black)'),

                // Positioning
                x: z.number().optional().describe('X position'),
                y: z.number().optional().describe('Y position'),

                // Layout & Alignment
                align: z.enum(['left', 'center', 'right', 'justify']).optional().describe('Text alignment (default: left)'),
                indent: z.number().optional().describe('First line indent in points'),
                lineGap: z.number().optional().describe('Space between lines in points'),
                paragraphGap: z.number().optional().describe('Space between paragraphs in points'),
                width: z.number().optional().describe('Text wrapping width in points'),

                // Spacing Control
                moveDown: z.number().optional().describe('Lines to move down after this item (0 = no spacing)'),

                // Text Styling
                underline: z.boolean().optional().describe('Underline text'),
                strike: z.boolean().optional().describe('Strikethrough text'),
                oblique: z.union([z.boolean(), z.number()]).optional().describe('Slant text (true or angle in degrees)'),
                link: z.string().optional().describe('URL to link this text to'),
                characterSpacing: z.number().optional().describe('Letter spacing in points'),
                wordSpacing: z.number().optional().describe('Word spacing in points'),

                // Advanced
                continued: z.boolean().optional().describe('Text continues inline with next item'),
                lineBreak: z.boolean().optional().describe('Enable line wrapping (default: true)'),
              }),
              z.object({
                type: z.literal('image').describe('Image content'),
                imagePath: z.string().describe('Path to image file'),
                x: z.number().optional().describe('X position'),
                y: z.number().optional().describe('Y position'),
                width: z.number().optional().describe('Image width'),
                height: z.number().optional().describe('Image height'),
              }),
              z.object({
                type: z.literal('rect').describe('Rectangle shape'),
                x: z.number().describe('X position (top-left corner)'),
                y: z.number().describe('Y position (top-left corner)'),
                width: z.number().describe('Width in points'),
                height: z.number().describe('Height in points'),
                fillColor: z.string().optional().describe('Fill color (hex like #FFD700 or named color)'),
                strokeColor: z.string().optional().describe('Stroke/border color'),
                lineWidth: z.number().optional().describe('Stroke width in points (default: 1)'),
              }),
              z.object({
                type: z.literal('circle').describe('Circle shape'),
                x: z.number().describe('Center X position'),
                y: z.number().describe('Center Y position'),
                radius: z.number().describe('Radius in points'),
                fillColor: z.string().optional().describe('Fill color (hex like #FFD700 or named color)'),
                strokeColor: z.string().optional().describe('Stroke/border color'),
                lineWidth: z.number().optional().describe('Stroke width in points (default: 1)'),
              }),
              z.object({
                type: z.literal('line').describe('Line shape'),
                x1: z.number().describe('Start X position'),
                y1: z.number().describe('Start Y position'),
                x2: z.number().describe('End X position'),
                y2: z.number().describe('End Y position'),
                strokeColor: z.string().optional().describe('Line color (default: black)'),
                lineWidth: z.number().optional().describe('Line width in points (default: 1)'),
              }),
              z.object({
                type: z.literal('pageBreak').describe('Page break'),
              }),
            ])
          )
          .describe('Array of content items to add to the PDF'),
      } as any,
    },
    async (args: any) => {
      const { filename = 'document.pdf', title, author, font, pageSetup, content } = args;
      try {
        // Create PDF document with optional page setup
        const docOptions: any = {
          info: {
            ...(title && { Title: title }),
            ...(author && { Author: author }),
          },
        };

        if (pageSetup?.size) {
          docOptions.size = pageSetup.size;
        }
        if (pageSetup?.margins) {
          docOptions.margins = pageSetup.margins;
        }

        const doc = new PDFDocument(docOptions);

        // Capture PDF in memory
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        const pdfPromise = new Promise<Buffer>((resolve, reject) => {
          doc.on('end', () => resolve(Buffer.concat(chunks)));
          doc.on('error', reject);
        });

        // Draw background if specified
        if (pageSetup?.backgroundColor) {
          const pageSize = pageSetup?.size || [612, 792];
          doc.rect(0, 0, pageSize[0], pageSize[1]).fill(pageSetup.backgroundColor);
        }

        // Check if content has emoji
        const contentText = JSON.stringify(content);
        const containsEmoji = hasEmoji(contentText);
        const emojiAvailable = containsEmoji ? registerEmojiFont() : false;

        // Setup fonts
        const fonts = await setupFonts(doc, font);
        const { regular: regularFont, bold: boldFont } = fonts;

        // Validate content for unsupported characters
        const warnings: string[] = [];
        for (const item of content) {
          if ((item.type === 'text' || item.type === 'heading') && item.text) {
            const font = item.bold ? boldFont : regularFont;
            const validation = validateTextForFont(item.text, font);
            if (validation.hasUnsupportedCharacters) {
              warnings.push(...validation.warnings);
            }
          }
        }

        // Helper to draw background on new pages
        const drawBackgroundOnPage = () => {
          if (pageSetup?.backgroundColor) {
            const currentY = doc.y;
            const currentX = doc.x;
            const pageSize = pageSetup?.size || [612, 792];
            doc.rect(0, 0, pageSize[0], pageSize[1]).fill(pageSetup.backgroundColor);
            doc.x = currentX;
            doc.y = currentY;
          }
        };

        // Add event listener for new pages
        doc.on('pageAdded', drawBackgroundOnPage);

        // Process content items
        for (const item of content) {
          switch (item.type) {
            case 'text': {
              const fontSize = item.fontSize ?? 12;
              const font = item.bold ? boldFont : regularFont;

              // Set text color if specified
              if (item.color) {
                doc.fillColor(item.color);
              }

              // Build options object - pass through all PDFKit text options
              const options: any = {};
              if (item.x !== undefined) options.x = item.x;
              if (item.y !== undefined) options.y = item.y;
              if (item.align !== undefined) options.align = item.align;
              if (item.indent !== undefined) options.indent = item.indent;
              if (item.lineGap !== undefined) options.lineGap = item.lineGap;
              if (item.paragraphGap !== undefined) options.paragraphGap = item.paragraphGap;
              if (item.width !== undefined) options.width = item.width;
              if (item.underline !== undefined) options.underline = item.underline;
              if (item.strike !== undefined) options.strike = item.strike;
              if (item.oblique !== undefined) options.oblique = item.oblique;
              if (item.link !== undefined) options.link = item.link;
              if (item.characterSpacing !== undefined) options.characterSpacing = item.characterSpacing;
              if (item.wordSpacing !== undefined) options.wordSpacing = item.wordSpacing;
              if (item.continued !== undefined) options.continued = item.continued;
              if (item.lineBreak !== undefined) options.lineBreak = item.lineBreak;

              renderTextWithEmoji(doc, item.text ?? '', fontSize, font, emojiAvailable, options);

              // Reset color to black after rendering
              if (item.color) {
                doc.fillColor('black');
              }

              // Handle spacing control
              if (item.moveDown !== undefined) {
                doc.moveDown(item.moveDown);
              }
              break;
            }

            case 'heading': {
              const fontSize = item.fontSize ?? 24;
              const font = item.bold !== false ? boldFont : regularFont;

              // Set text color if specified
              if (item.color) {
                doc.fillColor(item.color);
              }

              // Build options object - pass through all PDFKit text options
              const options: any = {};
              if (item.x !== undefined) options.x = item.x;
              if (item.y !== undefined) options.y = item.y;
              if (item.align !== undefined) options.align = item.align;
              if (item.indent !== undefined) options.indent = item.indent;
              if (item.lineGap !== undefined) options.lineGap = item.lineGap;
              if (item.paragraphGap !== undefined) options.paragraphGap = item.paragraphGap;
              if (item.width !== undefined) options.width = item.width;
              if (item.underline !== undefined) options.underline = item.underline;
              if (item.strike !== undefined) options.strike = item.strike;
              if (item.oblique !== undefined) options.oblique = item.oblique;
              if (item.link !== undefined) options.link = item.link;
              if (item.characterSpacing !== undefined) options.characterSpacing = item.characterSpacing;
              if (item.wordSpacing !== undefined) options.wordSpacing = item.wordSpacing;
              if (item.continued !== undefined) options.continued = item.continued;
              if (item.lineBreak !== undefined) options.lineBreak = item.lineBreak;

              renderTextWithEmoji(doc, item.text ?? '', fontSize, font, emojiAvailable, options);

              // Reset color to black after rendering
              if (item.color) {
                doc.fillColor('black');
              }

              // Handle spacing control
              if (item.moveDown !== undefined) {
                doc.moveDown(item.moveDown);
              }
              break;
            }

            case 'image': {
              if (!item.imagePath) {
                throw new Error('imagePath is required for image type');
              }

              const options: Record<string, unknown> = {};
              if (item.width !== undefined) options.width = item.width;
              if (item.height !== undefined) options.height = item.height;

              if (item.x !== undefined && item.y !== undefined) {
                doc.image(item.imagePath, item.x, item.y, options);
              } else {
                doc.image(item.imagePath, options);
              }
              break;
            }

            case 'rect': {
              doc.rect(item.x, item.y, item.width, item.height);

              if (item.fillColor && item.strokeColor) {
                if (item.lineWidth) doc.lineWidth(item.lineWidth);
                doc.fillAndStroke(item.fillColor, item.strokeColor);
              } else if (item.fillColor) {
                doc.fill(item.fillColor);
              } else if (item.strokeColor) {
                if (item.lineWidth) doc.lineWidth(item.lineWidth);
                doc.stroke(item.strokeColor);
              }

              // Reset to black for text
              doc.fillColor('black');
              break;
            }

            case 'circle': {
              doc.circle(item.x, item.y, item.radius);

              if (item.fillColor && item.strokeColor) {
                if (item.lineWidth) doc.lineWidth(item.lineWidth);
                doc.fillAndStroke(item.fillColor, item.strokeColor);
              } else if (item.fillColor) {
                doc.fill(item.fillColor);
              } else if (item.strokeColor) {
                if (item.lineWidth) doc.lineWidth(item.lineWidth);
                doc.stroke(item.strokeColor);
              }

              // Reset to black for text
              doc.fillColor('black');
              break;
            }

            case 'line': {
              if (item.lineWidth) doc.lineWidth(item.lineWidth);
              doc
                .moveTo(item.x1, item.y1)
                .lineTo(item.x2, item.y2)
                .stroke(item.strokeColor || 'black');
              break;
            }

            case 'pageBreak': {
              doc.addPage();
              break;
            }
          }
        }

        // Finalize PDF
        doc.end();

        // Wait for PDF to be generated
        const pdfBuffer = await pdfPromise;

        // Generate unique ID for this PDF
        const pdfId = generatePdfId();
        const uri = `mcp+mem://pdf/${pdfId}`;
        const base64 = pdfBuffer.toString('base64');

        // Build response with warnings if any
        const warningText = warnings.length > 0 ? `\n\n⚠️  Character Warnings:\n${warnings.map((w) => `• ${w}`).join('\n')}` : '';
        const responseText = `PDF created successfully (${pdfBuffer.length} bytes)${warningText}`;

        return {
          content: [
            {
              type: 'resource' as const,
              resource: {
                uri,
                name: filename,
                mimeType: 'application/pdf',
                blob: base64,
              },
            },
            {
              type: 'text' as const,
              text: responseText,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error creating PDF: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register tool: create-simple-pdf
  server.registerTool(
    'create-simple-pdf',
    {
      title: 'Create Simple PDF',
      description: 'Create a simple PDF with just text content. A simplified version of create-pdf for basic use cases. Supports emoji rendering.',
      inputSchema: {
        filename: z.string().optional().describe('Optional filename for the PDF (defaults to "document.pdf")'),
        text: z.string().describe('Text content for the PDF'),
        title: z.string().optional().describe('Document title metadata'),
      } as any,
    },
    async (args: any) => {
      const { filename = 'document.pdf', text, title } = args;
      try {
        const doc = new PDFDocument({
          info: {
            ...(title && { Title: title }),
          },
        });

        // Capture PDF in memory
        const chunks: Buffer[] = [];
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        const pdfPromise = new Promise<Buffer>((resolve, reject) => {
          doc.on('end', () => resolve(Buffer.concat(chunks)));
          doc.on('error', reject);
        });

        // Check for emoji and register font if needed
        const containsEmoji = hasEmoji(text);
        const emojiAvailable = containsEmoji ? registerEmojiFont() : false;

        // Setup fonts
        const fonts = await setupFonts(doc);
        const { regular: regularFont } = fonts;

        // Render text with emoji support
        renderTextWithEmoji(doc, text, 12, regularFont, emojiAvailable);
        doc.end();

        // Wait for PDF to be generated
        const pdfBuffer = await pdfPromise;

        // Generate unique ID for this PDF
        const pdfId = generatePdfId();
        const uri = `mcp+mem://pdf/${pdfId}`;
        const base64 = pdfBuffer.toString('base64');

        return {
          content: [
            {
              type: 'resource' as const,
              resource: {
                uri,
                name: filename,
                mimeType: 'application/pdf',
                blob: base64,
              },
            },
            {
              type: 'text' as const,
              text: `PDF created successfully (${pdfBuffer.length} bytes)`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error creating PDF: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Register tool: generate-resume-pdf
  server.registerTool(
    'generate-resume-pdf',
    {
      title: 'Generate Resume PDF',
      description: 'Generate a professional resume PDF from JSON Resume format. Follows the standard JSON Resume schema (https://jsonresume.org/schema). Supports basics, work, education, projects, skills, awards, certificates, languages, and more. Includes customizable styling options.',
      inputSchema: {
        filename: z.string().optional().describe('Optional filename for the PDF (defaults to "resume.pdf")'),
        resume: jsonResumeSchema.describe('Resume data in JSON Resume format'),
        font: z
          .string()
          .optional()
          .describe(
            'Font for the PDF. Defaults to "auto" (system font detection).\n\n' +
              'Options:\n' +
              '• Built-in: Helvetica, Times-Roman, Courier (+ Bold/Italic variants)\n' +
              '• URL: https://cdn.../font.woff2 (for Unicode/emoji support)\n' +
              '• Path: /System/Library/Fonts/Arial.ttf\n' +
              '• "auto": Auto-detect Unicode-capable system font\n\n' +
              'Built-in fonts only support ASCII. For Unicode, use a font URL or path.\n' +
              'Find Unicode fonts at https://fontsource.org'
          ),
        styling: z
          .object({
            fontSize: z
              .object({
                name: z.number().optional().describe('Name/title font size (default: 24)'),
                label: z.number().optional().describe('Job title/label font size (default: 12)'),
                heading: z.number().optional().describe('Section heading font size (default: 18)'),
                subheading: z.number().optional().describe('Subsection heading font size (default: 14)'),
                body: z.number().optional().describe('Body text font size (default: 10)'),
                contact: z.number().optional().describe('Contact info font size (default: 10)'),
              })
              .optional()
              .describe('Font size overrides for different text elements'),
            spacing: z
              .object({
                afterName: z.number().optional().describe('Space after name (default: 0.3)'),
                afterLabel: z.number().optional().describe('Space after label (default: 0.3)'),
                afterContact: z.number().optional().describe('Space after contact info (default: 0.5)'),
                afterHeading: z.number().optional().describe('Space after section headings (default: 0.5)'),
                afterSubheading: z.number().optional().describe('Space after subsection headings (default: 0.3)'),
                afterText: z.number().optional().describe('Space after body text (default: 0.3)'),
                betweenSections: z.number().optional().describe('Space between major sections (default: 0.5)'),
              })
              .optional()
              .describe('Spacing overrides (in moveDown units)'),
            alignment: z
              .object({
                header: z.enum(['left', 'center', 'right']).optional().describe('Header alignment (default: center)'),
              })
              .optional()
              .describe('Text alignment overrides'),
            margins: z
              .object({
                top: z.number().optional().describe('Top margin in points (default: 50)'),
                bottom: z.number().optional().describe('Bottom margin in points (default: 50)'),
                left: z.number().optional().describe('Left margin in points (default: 50)'),
                right: z.number().optional().describe('Right margin in points (default: 50)'),
              })
              .optional()
              .describe('Page margin overrides'),
          })
          .optional()
          .describe('Optional styling customization for the resume layout'),
      } as any,
    },
    async (args: any) => {
      const { filename = 'resume.pdf', resume, font, styling } = args;
      try {
        const pdfBuffer = await generateResumePDFBuffer(resume, font, styling);

        // Generate unique ID for this PDF
        const pdfId = generatePdfId();
        const uri = `mcp+mem://pdf/${pdfId}`;
        const base64 = pdfBuffer.toString('base64');

        return {
          content: [
            {
              type: 'resource' as const,
              resource: {
                uri,
                name: filename,
                mimeType: 'application/pdf',
                blob: base64,
              },
            },
            {
              type: 'text' as const,
              text: `Resume PDF generated successfully (${pdfBuffer.length} bytes)`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error generating resume PDF: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}

// Production entry point - exported as default for bin script
export default async function main(): Promise<void> {
  const server = createPdfServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Auto-start when run directly
if (import.meta.main) {
  main().catch((error) => {
    console.error('Failed to start PDF server:', error);
    process.exit(1);
  });
}
