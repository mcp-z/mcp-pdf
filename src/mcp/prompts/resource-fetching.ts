import type { PromptModule } from '@mcpeasy/server';

export default function createPrompt() {
  const config = {
    title: 'Fetching PDF Resources',
    description: 'How to fetch generated PDF binary data via MCP resources',
    argsSchema: {} as const,
  };

  return {
    name: 'resource-fetching',
    config,
    handler: async () => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                'You can create PDFs with pdf-create (complex layouts with flexbox) or pdf-create-resume (JSON Resume format).',
                'After a tool runs you receive a line: Resource: mcp://<uuid>.',
                'Fetch the binary via ReadResource using that URI when needed; do NOT request local filesystem paths.',
                'Only extract or embed large PDF text into the model when the user explicitly asks for analysis or summary.',
              ].join('\n'),
            },
          },
        ],
      };
    },
  } satisfies PromptModule;
}
