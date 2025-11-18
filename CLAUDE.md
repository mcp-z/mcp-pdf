# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Commands
- **Build**: `npm run build` (compiles TypeScript to dist/ with ESM/CJS dual exports using ts-dev-stack)
- **Test**: `npm test` (runs all test types across all workspaces: unit + integration)
- **Test Unit**: `npm run test:unit` (fast unit tests only)
- **Test Integration**: `npm run test:integration` (cross-service integration tests)
- **Format**: `npm run format` (Biome formatter and linter with auto-fix)

### Package Commands
- **Build**: `npm run build` (compiles TypeScript to dist/ with ESM/CJS dual exports)
- **All Tests**: `npm test` (runs all tests - unit + integration)
- **Unit Tests**: `npm run test:unit` (fast unit tests only)
- **Integration Tests**: `npm run test:integration` (cross-service tests)
- **Test Setup**: `npm run test:setup` (OAuth token generation, service packages only)

### Pre-Commit Requirements
Run before committing: `tsds validate`

## Architecture Overview

### Key Design Patterns

**MCP Server Architecture**: All servers follow identical patterns with dual transport (stdio + HTTP), direct authentication, and consistent tool registration patterns.

**Authentication Flow**: Direct OAuth2/MSAL with each service managing its own auth state. Services use AccountManager for multi-account support and AccessTokenProvider pattern for auth client abstraction.

**Testing Philosophy**: Service-backed unit tests using real provider APIs via dependency injection. Tests require valid credentials in `.env.test` files and use `createMiddleware()` helper for auth setup.

**Testing Hierarchy**: All packages follow consistent testing structure:
- `test:unit` - Fast isolated tests with real service APIs
- `test:integration` - Cross-service tests
- `test` - Runs unit + integration sequentially

### Critical Quality Rules

**From QUALITY.md - Auto-reject any proposals with**:
- Centralized validation systems
- New test infrastructure/frameworks

**From TypeScript guidelines**:
- No `any` types in new code
- Use discriminated unions for query parameters
- Add type guards for external data
- Create typed error boundaries instead of catching `unknown`
- Use branded types for different ID types

### Swappable Store Pattern

**Store Interface Architecture**: The project implements swappable storage backends using `Keyv` from the keyv ecosystem for consistent async key-value operations.

**Implementation Pattern**:
```typescript
import type { Keyv } from 'keyv';
import { KeyvFile } from 'keyv-file';

function createStore<T>(name: string): Keyv<T> {
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (encryptionKey) {
    // Deployer provided encryption key - use encrypted DuckDB storage
    const KeyvDuckDB = require('keyv-duckdb');
    return new Keyv<T>({ store: new KeyvDuckDB(`/var/lib/app/${name}.duckdb`, { encryptionKey }) });
  } else {
    // No encryption key - use plain text file storage
    return new Keyv<T>({ store: new KeyvFile({ filename: `./dev-data/${name}.json` }) });
  }
}
```

**Key Principles**:
- Always code against the `Keyv` interface from the keyv ecosystem
- Use compound keys for O(1) direct access: `resource:provider:identifier`
- Leverage keyv's built-in iterator for key enumeration
- Encryption is **optional** - deployers choose based on their security requirements
- KeyvFile for simplicity/debugging, keyv-duckdb with encryption for security
- Both stores implement the standard keyv storage adapter interface
- Test compatibility across both implementations

### Token Storage Architecture

**Package-Local Token Storage**: Each package uses a local `.tokens/` directory for OAuth token storage with Keyv-based management.

**Key Principles**:
- **Local Storage**: Tokens stored in `.tokens/store.json` within package root
- **Keyv Storage**: Uses `Keyv` with `KeyvFile` backend for consistent key-value operations
- **Simple Structure**: Single token store file per package
- **Gitignored**: `.tokens/` directory is excluded from version control

**Token Storage Location**:
```
<package-root>/
└── .tokens/
    └── store.json   # Keyv-managed token storage
```

**Token Store Setup**:
```typescript
import Keyv from 'keyv';
import { KeyvFile } from 'keyv-file';
import * as path from 'path';

const tokenStorePath = path.join(process.cwd(), '.tokens/store.json');
const tokenStore = new Keyv({
  store: new KeyvFile({ filename: tokenStorePath }),
});
```

**Tool Handler Pattern**:
```typescript
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

async function handler(params: In, extra: EnrichedExtra): Promise<CallToolResult> {
  try {
    const result = await apiCall();
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: result,
    };
  } catch (error) {
    if (error instanceof McpError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new McpError(ErrorCode.InternalError, `Error: ${message}`);
  }
}
```

### Tool Development Pattern

**MCP Tool Checklist** (from docs/testing.md):
- Define `inputSchema` and `outputSchema` inline with `as const`
- Use `.min(1)` for required string fields
- Snake_case filenames, hyphenated tool names (`{service}-{resource}-{action}`)
- Return `structuredContent: { result: <branch> }`
- **Type safety**: Always use `type Out` with explicit branch annotations
- Inject deps via `register({ logger, google.auth, microsoft.auth })`
- Map provider errors to canonical codes

**Tool Handler Pattern** (MANDATORY):
All tool handlers MUST use McpError for all error conditions:

```typescript
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

const config = {
  inputSchema: z.object({ /* ... */ }) as const,
  outputSchema: z.object({
    type: z.literal('success'),
    item: ItemSchema,
  }),
};

type In = z.infer<typeof config.inputSchema>;
type Out = z.infer<typeof config.outputSchema>;

async function handler(params: In, extra: EnrichedExtra): Promise<CallToolResult> {
  try {
    const result = await apiCall();

    // Return with inline structuredContent
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: result,
    };
  } catch (error) {
    // Re-throw McpError as-is
    if (error instanceof McpError) {
      throw error;
    }

    // Wrap other errors in McpError
    const message = error instanceof Error ? error.message : String(error);
    logger.error('tool.error', { error: message });

    throw new McpError(ErrorCode.InternalError, `Error: ${message}`, {
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

export default function createTool(): ToolModule {
  return { name, config, handler } as any;
}
```

**Why This Matters**:
- **MCP compliance**: McpError is the official SDK error type
- **Consistent error handling**: All errors flow through the same mechanism
- **Better tooling support**: MCP clients understand McpError structure
- **No helper dependencies**: Explicit, self-contained error handling

**Test Structure**:
```typescript
// Use this pattern for all tool tests
import assert from 'assert';
import { createMiddleware, createExtra } from '../lib/create-middleware.ts';

it('tool behaves as expected (service-backed)', async () => {
  const middleware = await createMiddleware(); // Validates credentials, throws if missing
  const tool = createTool();
  const wrappedTool = middleware.withAuth(tool);
  const result = await wrappedTool.handler({ /* validated inputs */ }, createExtra());
  assert.ok(result.structuredContent);
});
```

### Integration Testing Infrastructure

**Test Helper Pattern**: Use the standard test helpers in `test/lib/` directory:

```typescript
import { createMiddleware, createExtra } from './lib/create-middleware.ts';

describe('tool tests', () => {
  let middleware: Awaited<ReturnType<typeof createMiddleware>>;

  before(async () => {
    // Creates auth middleware with single-account validation
    middleware = await createMiddleware();
  });

  it('executes tool with auth', async () => {
    const tool = createTool();
    const wrappedTool = middleware.withAuth(tool);
    const handler = wrappedTool.handler;

    const result = await handler(
      { id: 'test-id', fields: 'id,name' },
      createExtra()  // Creates EnrichedExtra with placeholder auth
    );

    assert.ok(result.structuredContent);
  });
});
```

**Key Test Helpers** (in `test/lib/`):
- **`createMiddleware()`** - Sets up auth middleware with token store validation
- **`createExtra()`** - Creates `EnrichedExtra` test context with placeholder auth and silent logger
- **`buildConfig()`** - Parses server config from CLI args with test defaults

**Generic Server Examples** (in `test/lib/servers/`):
- **`echo-server-stdio.ts`** - Stdio transport with tools, resources, and prompts
- **`echo-server-http.ts`** - HTTP transport with Express integration

**Server Setup Pattern** (from generic examples):
```typescript
import { setupStdioServer, registerTools } from '@mcpeasy/server';

const serverFactory = () => {
  const mcpServer = new McpServer({ name: 'echo', version: '1.0.0' });
  registerTools(mcpServer, [echoTool]);
  return mcpServer;
};

await setupStdioServer(serverFactory);
```

**See also**: `docs/typescript.md` for comprehensive TypeScript guidelines and type safety patterns

## Environment Setup

**Required Node Version**: >=24 (uses native TypeScript support)
**Native TypeScript Execution**: Node.js 24+ can execute `.ts` files directly without flags - DO NOT use `--experimental-strip-types` flag
**Package Manager**: npm with workspaces (no-hoist as specified in .npmrc)
**TypeScript**: Strict mode with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
**Formatter**: Biome with 320 line width, single quotes, trailing commas

### TypeScript Execution
- **CORRECT**: `node script.ts` (native type stripping in Node 24+)
- **WRONG**: `node --experimental-strip-types script.ts` (flag no longer needed)
- All code should use direct `.ts` file execution without additional flags
- This applies to scripts, test runners, and all TypeScript execution

### Workspace Dependencies
- Workspace packages reference internal deps by package name
- External deps: MCP SDK, Express, Google APIs, Microsoft Graph, Zod v4
- Dev tools: TypeScript 5.9+, Biome, Node types

## Testing Requirements

**Environment**: Tests load `.env.test` files automatically
**No Mocking**: Use real provider API calls as stable dependencies
**Package-Local Tokens**: Use package-local `.tokens/store.json` for token storage
**Cleanup**: Always cleanup created resources in `finally` blocks
**Assertions**: Assert on `structuredContent`, not `content[0].text`

**Integration Tests**: Place in `test/integration/` directory

### Temporary Directory Standard (MANDATORY)

**CRITICAL VIOLATION: Using `os.tmpdir()` is prohibited per QUALITY.md rule T8 (Secure Test Data Storage)**

**Rule**: All temporary test files and directories MUST use `.tmp/` in the package root, never `os.tmpdir()`.

**Why This Matters**:
- **Security**: Prevents accidental exposure of test data outside project boundaries
- **Isolation**: Keeps test artifacts within project structure for easy cleanup
- **Gitignore**: `.tmp/` is already in `.gitignore`, system temp directories are not
- **Consistency**: All developers see test artifacts in predictable locations

**WRONG ❌**:
```typescript
// VIOLATION: Using system temp directory
import * as os from 'os';
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
```

**CORRECT ✅**:
```typescript
// Use .tmp/ in package root
const tempDir = path.join('.tmp', `test-${Date.now()}`);
await fs.promises.mkdir(tempDir, { recursive: true });
```

**References**:
- QUALITY.md Rule T8: Secure Test Data Storage (line 2133)
- QUALITY.md Example (line 2181): Uses `.tmp/` pattern

### Single-Account Testing Strategy

**Rule**: Unit tests use single-account validation via test helpers

**Why This Matters**:
- **Determinism**: Tests need predictable account selection to avoid flakiness
- **Simplicity**: Tests focus on tool logic, not account management complexity
- **Portability**: Single-account tests work everywhere with minimal setup

**DO**:
- Use `createMiddleware()` which validates single-account setup internally
- Keep tests focused on tool behavior and API integration
- Generate single test account via `npm run test:setup`

**DO NOT**:
- Create multiple test accounts for unit tests
- Bypass single-account validation in test middleware
- Assume all tests need multi-account support

**References**:
- Test helpers: `test/lib/create-middleware.ts`
- Generic server examples: `test/lib/servers/`

### Critical Test Configuration Rules

**NEVER use hardcoded values or magic numbers in tests** - this is a project-wide coding standard violation that causes subtle bugs and wasted debugging time.


**OAuth Client Configuration**:

Most packages use **LoopbackOAuthProvider**:
- Interactive OAuth with ephemeral loopback server (RFC 8252)
- Dynamically generates redirect URIs using OS-assigned ports
- NO redirect URI environment variable needed
- Required env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (optional for public clients)
- Headless mode: Set `headless: true` to return auth_url descriptor instead of opening browser

**When writing tests:**
- Use `HEADLESS=true` to prevent browser popups
- Check `test/lib/create-middleware.ts` for actual patterns used
- See `.env.test.example` for required environment variables

**Common Test Configuration Pitfalls**:

1. **Default values in tests** - WRONG: `process.env.VAR || 'default-value'`
   - Symptom: Tests pass with invalid config, hiding real issues
   - Fix: Use `requiredEnv()` to fail fast with clear error messages
   - Rationale: Defaults hide problems - better to fail immediately

2. **Headless mode in OAuth tests** - WRONG: Not setting `headless: true`
   - Symptom: Tests open browsers and hang waiting for OAuth callbacks
   - Fix: Always set `headless: true` in test configurations
   - OAuth clients return `auth_url` descriptors instead of opening browsers

**Test Environment File Structure**:
```bash
.env.test          # Package test configuration
.env.test.example  # Example for new contributors
```

**When Adding New Test Config**:
1. Add required env var to `.env.test` file
2. Document WHY the value is what it is (not just WHAT it is)
3. Use `requiredEnv()` at test file boundary
4. No defaults - fail fast if config missing
5. Update `.env.test.example` to guide new contributors



-------------
# AI Agent Collaboration Guide

## Purpose
This guide helps AI agents be effective coding collaborators on the MCP-Z project. The primary objective is successful software development - writing quality code, fixing bugs, implementing features, and maintaining the codebase. File organization is one small practical concern among many.

## Before You Start

**Required Reading:**
1. Read `CONTRIBUTING.md` (in each package)
2. Read `QUALITY.md` (in each package)
3. Understand the project's architecture, conventions, and quality principles
4. Summarize your understanding (2-3 sentences) before beginning work

## Plan Implementation Workflow

**MANDATORY: All agents must follow this structured workflow for implementing plans.**

### Three-Stage Plan Management

1. **`.agents/plans/`** - New plans ready for implementation
   - Check this directory for assigned work
   - Plans must contain detailed checklists
   - Move to in-progress when starting work

2. **`.agents/in-progress/`** - Plans currently being worked on
   - Move plans here when starting implementation
   - Update checklists periodically during work
   - Only move to done after human approval

3. **`.agents/done/`** - Completed plans
   - Plans can only be moved here after human confirmation
   - Must include final review and quality check
   - All checklist items must be addressed

### Plan Requirements

**Every plan MUST include:**
- Detailed implementation checklist
- Clear acceptance criteria
- QUALITY.md compliance assessment
- List of any non-mandatory items that may be skipped

**During implementation:**
- Check off completed items regularly
- Update progress in checklist
- Document any blockers or issues discovered
- Prepare final review summary

### Mandatory Human-in-the-Loop Quality Gates

**CRITICAL: No plan moves to `.agents/done/` without explicit human approval.**

**Final review must include:**
1. **QUALITY.md compliance check** - Identify any violations
2. **Backward compatibility checkpoint** - Confirm NO backward compatibility layers, migration utilities, or legacy support was added
3. **Non-mandatory items discussion** - List items not completed and why
4. **Quality gap assessment** - Flag any potential issues for human decision
5. **Human approval required** - Agent must request explicit confirmation before marking done

**Why this matters:** Agents excel at identifying problems but may misinterpret quality requirements or propose undesired solutions. Human oversight ensures quality decisions align with project goals.

## Project Setup & Tooling

**CRITICAL: Read this section carefully to avoid wasting time with wrong tools**

### This is a Standalone Package
- **Always use npm commands**: `npm install`, `npm run <script>`
- **Independent repository**: This package has its own git repository
- **Dependencies**: Uses npm for dependency management

### Build System
- **ts-dev-stack** is used for TypeScript compilation with dual ESM/CJS exports
- **Build command**: `npm run build` compiles to `dist/` directory
- **Package exports**: Exports from `dist/esm/index.js` and `dist/cjs/index.js`

### Core Commands
```bash
# Build package (compiles TypeScript to dist/)
npm run build

# Formatting and linting
npm run format

# Testing
npm test                    # Run all tests (unit + integration)
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:setup         # Generate OAuth tokens (if applicable)

# Quality checks (run before committing)
tsds validate
```

### CRITICAL: Always Use package.json Scripts

**NEVER run commands manually with environment variables** - Always use the scripts defined in `package.json`.

**WRONG:**
```bash
NODE_ENV=test npm test                    # ❌ Manual env vars
GOOGLE_CLIENT_ID=test@example.com npm test  # ❌ Manual env vars
```

**CORRECT:**
```bash
npm run test:setup   # ✅ Uses package's .env.test automatically (in individual packages)
npm test             # ✅ Environment configured via --env-file
npm run test:unit    # ✅ Package.json handles all configuration
```

**Why this matters:**
- Package.json scripts use `--env-file=.env.test` to load package-local configurations
- All required environment variables (NODE_ENV, CLIENT_IDs, etc.) are already configured
- Manual env vars can override or conflict with file-based configuration, causing subtle bugs
- Violates project principle: "Use scripts in package.json to avoid configuration issues"

**Environment files:**
- `.env.test` - Package-local test configuration
- `.env.test.example` - Example configuration for new contributors

**Exception**: Only pass environment variables when explicitly documented in CLAUDE.md or when debugging a specific issue with human approval.

### TypeScript Configuration
- Uses ts-dev-stack for dual ESM/CJS compilation with type definitions
- Import TypeScript files with `.ts` extensions in source code
- All packages export compiled `.js` files with `.d.ts` type definitions
- See `docs/typescript.md` for detailed TypeScript guidelines

## Core Principles for Successful Collaboration

### 1. Code Quality First
- Follow the project's established patterns and conventions
- Write clean, maintainable code that other contributors can understand
- Respect the "simple, approachable community project" philosophy
- Avoid over-engineering - this isn't an enterprise repository

### 2. Understand the Context
- Read existing code before making changes
- Follow established patterns in the codebase
- Use the project's preferred paradigms (functional vs class-based) appropriately
- Maintain consistency with surrounding code

### 3. Test Thoughtfully
- Write tests for stable APIs after implementation stabilizes
- Use real service integration, not mocks
- Keep tests simple, self-contained, and portable
- **Test placement**: Place tests in domain-specific directories that mirror source structure (see QUALITY.md rule T12 for details)
- Follow the project's testing conventions in `docs/testing.md`

### 4. Collaborate Effectively
- Communicate clearly about what you're doing and why
- When fixing bugs, investigate root causes rather than symptoms
- **ABSOLUTELY NO BACKWARD COMPATIBILITY** - This project has no customers yet, always use breaking changes to clean up architecture
- **MANDATORY: Seek human approval before marking any plan as complete**
- **NEVER independently decide quality trade-offs** - always involve humans in quality decisions
- Run quality checks before completing work:
  ```bash
  tsds validate
  ```

### 5. Quality Decision Authority
- **Agents identify quality issues** - Use QUALITY.md to find problems and violations
- **Humans decide solutions** - Present options but don't implement quality fixes without approval
- **No autonomous quality trade-offs** - Quality decisions require human oversight
- **Challenge assumptions** - If quality rules seem unclear or conflicting, ask for clarification

## Practical Considerations

### File Organization - MANDATORY
**NEVER create reports, analysis, or documentation files in the package root or source directories.**

**ALL AI-generated files MUST go in `.agents/` directory:**
- `.agents/plans/` - New plans ready for implementation
- `.agents/in-progress/` - Plans currently being worked on
- `.agents/done/` - Completed plans (human-approved)
- `.agents/reports/` - QA reports, analysis, test results, code reviews, security reviews
- `.agents/reviews/` - Code reviews, security reviews
- `.agents/temp/` - Temporary working files

**Examples of files that MUST go in `.agents/`:**
- Any `.md` files you create (reports, analysis, documentation)
- JSON/YAML analysis files
- Test result summaries
- Security audit reports
- Performance analysis
- Code review documents

**WRONG:** Creating files like `analysis.md`, `report.json`, `review.md` in project root
**CORRECT:** Creating `.agents/reports/analysis.md`, `.agents/reports/review.md`

- Use relative paths: `.agents/` directory in package root
- Never create documentation files in source code directories unless explicitly requested

### Code Modifications
- **Always prefer editing existing files** over creating new ones
- Only create new source files when absolutely necessary
- Keep solutions local and contained within existing boundaries
- Don't create shared infrastructure or frameworks

### TypeScript Best Practices
- Use `.ts` extensions for internal imports
- Leverage TypeScript's type system - avoid `any` and type escapes
- Follow the project's Node.js type stripping configuration
- Reference `docs/typescript.md` for detailed guidelines

### Environment and Configuration
- Access environment variables only at entry points (test files, src/index.ts, scripts)
- Library code should receive configuration explicitly as parameters
- Never create shared configuration classes or systems
- Use `requiredEnv()` pattern for clear error messages

### Test File Organization
**Quick reference** - For complete guidance see QUALITY.md rule T12:

- **Domain-specific placement**: Tests go in `test/` directories within package
- **Mirror source structure**: `src/mcp/tools/file.ts` → `test/unit/mcp/tools/file.test.ts`
- **Never in root**: No test files in package root - always in appropriate test directory
- **Integration tests**: Place in `test/integration/` with clear scope
- **Shared utilities**: Place in `test/lib/` directory

**Escalation**: Complex test organization → consult test-automator agent

## Working with the Codebase

### Making Changes
1. **Understand first** - Read the relevant code and tests
2. **Follow patterns** - Use existing conventions and approaches
3. **Stay focused** - Solve the specific problem without expanding scope
4. **Test properly** - Verify changes work with real services
5. **Check quality** - Run formatters and linters before finishing
6. **Human approval required** - Present final review and wait for confirmation before marking complete

### Common Pitfalls to Avoid
- **Creating backward compatibility layers** - NEVER maintain old APIs, data formats, or patterns
- **Suggesting migration utilities** - Delete old data, regenerate with new patterns
- **Supporting "both approaches"** - Always break cleanly to new architecture
- Creating test infrastructure or frameworks
- Adding centralized validation systems
- Over-abstracting simple problems
- Using mocks instead of real service integration
- Adding unnecessary package exports

### When in Doubt
- Consult the QUALITY.md escalation framework for complex decisions
- Keep solutions simple and understandable
- Focus on solving the immediate problem
- Maintain the project's approachable nature for community contributors

## Summary

Your primary role is to help with coding tasks - implementing features, fixing bugs, refactoring code, and maintaining quality. Follow the project's established patterns, keep solutions simple, and focus on delivering working software that solves real problems.

Remember: You're a coding collaborator, not a documentation generator. Focus on the code, and keep any supplementary materials organized appropriately.