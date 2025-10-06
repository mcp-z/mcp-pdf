import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerPdfPrompts(server: McpServer) {
  server.registerPrompt(
    'pdf-instructions',
    {
      title: 'How to use PDF tools effectively',
      description: 'Guidance for creating PDFs and fetching binary data via resources',
      argsSchema: {},
    },
    async () => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                'You can create PDFs with create-pdf (complex layouts) or create-simple-pdf (plain text).',
                'After a tool runs you receive a line: Resource: mcp://<uuid>.',
                'Fetch the binary via ReadResource using that URI when needed; do NOT request local filesystem paths.',
                'Only extract or embed large PDF text into the model when the user explicitly asks for analysis or summary.',
              ].join('\n'),
            },
          },
        ],
      };
    }
  );
}
