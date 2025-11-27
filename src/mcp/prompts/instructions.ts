export default function createPrompt() {
  const config = {
    title: 'How to use PDF tools effectively',
    description: 'Guidance for creating PDFs and fetching binary data via resources',
    argsSchema: {} as const,
  };

  return {
    name: 'instructions',
    config,
    handler: async () => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                'You can create PDFs with pdf-create (complex layouts) or pdf-create-simple (plain text).',
                'After a tool runs you receive a line: Resource: mcp://<uuid>.',
                'Fetch the binary via ReadResource using that URI when needed; do NOT request local filesystem paths.',
                'Only extract or embed large PDF text into the model when the user explicitly asks for analysis or summary.',
              ].join('\n'),
            },
          },
        ],
      };
    },
  } satisfies { name: string; config: unknown; handler: unknown };
}
