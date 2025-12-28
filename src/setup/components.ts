import type { PromptModule, ResourceModule, ToolModule } from '@mcpeasy/server';
import * as promptFactories from '../mcp/prompts/index.ts';
import * as toolFactories from '../mcp/tools/index.ts';
export function createMcpComponents(): {
  tools: ToolModule[];
  resources: ResourceModule[];
  prompts: PromptModule[];
} {
  const tools = Object.values(toolFactories).map((factory) => factory());
  const prompts = Object.values(promptFactories).map((factory) => factory());

  return {
    tools,
    resources: [],
    prompts,
  };
}
