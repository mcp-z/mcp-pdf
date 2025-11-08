import type { PromptModule } from '@mcpeasy/server';
import type { z } from 'zod/v3';

export default function createPrompt(): PromptModule {
  const config = {
    title: 'How to use PDF tools effectively',
    description: 'Guidance for creating PDFs and fetching binary data via resources',
    argsSchema: {} as const,
  };

  type Args = z.infer<z.ZodObject<typeof config.argsSchema>>;

  return {
    name: 'pdf-instructions',
    config,
    handler: async (_args: Args) => {
      return {
        messages: [
          {
            role: 'user',
            text: [
              'You can create PDFs with create-pdf (complex layouts) or create-simple-pdf (plain text).',
              'After a tool runs you receive a line: Resource: mcp://<uuid>.',
              'Fetch the binary via ReadResource using that URI when needed; do NOT request local filesystem paths.',
              'Only extract or embed large PDF text into the model when the user explicitly asks for analysis or summary.',
            ].join('\n'),
          },
        ],
      };
    },
  };
}
