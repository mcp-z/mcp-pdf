# Quality Guidelines

These are quality guidelines for this package.

**THIS IS NOT AN ENTERPRISE REPOSITORY.** This is a small, open-source community project that must remain simple and approachable. Avoid multi-class architectures, dependency injection, abstract factories, and over-engineered solutions that would intimidate contributors or create maintenance burdens.

## AI AGENT CHECKLIST
Before proposing any solution, ask:
- Does this create a new class in test code? → REJECT
- Does this create a new class in production? → ALLOWED - choose appropriate paradigm for the problem
- Does this span multiple files? → REJECT
- Does this add shared infrastructure or frameworks? → REJECT
- Does this maintain backward compatibility? → REJECT - use breaking changes instead
- Can this be solved with local variables/functions? → EVALUATE based on context

## CLASS USAGE MATRIX

| Context | Classes Allowed | Examples |
|---------|----------------|----------|
| Type Definitions | ✅ Yes | `interface AuthConfig`, `type TokenResponse` |
| Production Logic | ✅ Yes | Business logic classes when appropriate for the domain |
| Test Code | ❌ No | Use local variables/arrays |
| Shared Infrastructure | ❌ No | Use local constants/functions |

## CONTEXT SEPARATION NOTE
**Test restrictions do NOT apply to production code.** The prohibition on classes in test code is to maintain simplicity and prevent test framework over-engineering. Production code should use the most appropriate paradigm for the problem.

## REJECTED PATTERNS (Auto-reject any proposal containing):
❌ `class TestEnvironmentValidator` (test context)
❌ `class TestDataManager` (test context)
❌ `class TestPrerequisites` (test context)
❌ Centralized validation systems
❌ Multi-phase implementation plans
❌ New test infrastructure or frameworks
❌ Over-engineered multi-class architectures
❌ Architectural diagrams or "architectural plans"
❌ Abstractions that would confuse open-source contributors
❌ **Backward compatibility layers or legacy code support**
❌ **Migration utilities that preserve old patterns**
❌ **Wrapper functions for deprecated APIs**

## ENFORCEMENT OF REJECTED PATTERNS
**AUTO-REJECT**: Any proposal containing these patterns will be IMMEDIATELY REJECTED without consideration:
- Any `class` keyword in test files (T10, T11)
- Centralized validation systems (U2)
- Multi-phase implementation plans (U2)
- New test infrastructure or frameworks (T1, T2)
- Over-engineered multi-class architectures (U1)
- **Backward compatibility layers or legacy code support (U14)**
- **Migration utilities that preserve old patterns (U14)**
- **Wrapper functions for deprecated APIs (U14)**

## COMMON AI PITFALLS
AI agents commonly misinterpret:
- "Helper functions" ≠ "Helper classes"
- "Testing standards" ≠ "Testing frameworks"
- "Type definitions" ≠ "Class definitions"


# DETAILED QUALITY RULES

## UNIVERSAL RULES (Apply to all code)

### U1. Production Paradigm Selection

## Intent
Code should use the paradigm (functional vs class-based) that best serves the problem domain without over-engineering, maintaining the project's approachable nature for open-source contributors.

## Category Pattern
This encompasses violations where paradigm choice:
- Creates unnecessary complexity for the problem being solved
- Follows patterns inappropriate for the domain's natural structure
- Intimidates contributors with over-engineered abstractions

## Recognition Signals
- Signal: Paradigm mismatch with domain characteristics
  Examples: Classes for pure transformations, functions for stateful business logic
  But also: Over-abstracted patterns, unnecessary design patterns

- Signal: Complexity that doesn't serve the domain
  Examples: Multiple inheritance levels, abstract factories for simple operations
  But also: Functional compositions that obscure business logic

## Diverse Examples (Non-Exhaustive)

### Example 1: Appropriate Functional Approach
```typescript
// ✅ COMPLIANT: Stateless transformation suits functional approach
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

### Example 2: Appropriate Class Approach
```typescript
// ✅ COMPLIANT: Stateful service benefits from encapsulation
export class EmailService {
  constructor(private readonly transport: Transport) {}
  async send(message: Message): Promise<void> { /* maintains state and behavior */ }
}
```

### Example 3: Over-Engineering Violation
```typescript
// ❌ VIOLATION: Unnecessary abstraction for simple operation
abstract class ValidatorFactory {
  abstract createEmailValidator(): IEmailValidator;
}
// VIOLATION REASON: Simple validation doesn't need this complexity
```

## Generalization Guidance
Ask yourself:
1. Does this paradigm choice make the code easier to understand and maintain?
2. Would a new contributor immediately understand why this approach was chosen?
3. Does the complexity serve the actual problem domain?

**Escalation**: For paradigm selection in complex business domains, consult the architect-reviewer agent.

## Anti-Patterns (What This Rule Does NOT Cover)
- Using classes for legitimate business domain modeling
- Functional approaches for appropriate transformations
- Simple utility functions that don't need state

---

### U2. Critical Constraints

## Intent
Development should remain focused on solving specific problems within existing boundaries rather than expanding infrastructure or creating dependencies that burden the community project.

## ABSOLUTE REQUIREMENTS (Non-Negotiable)
- **NO CENTRALIZED FRAMEWORKS** or shared infrastructure
- **NO CI/CD PIPELINE CHANGES** unless explicitly requested
- **IMPLEMENT CHANGES IN EXISTING FILES ONLY**
- **USE LOCAL CONSTANTS**, not global configs

## Category Pattern
This encompasses violations where changes:
- Introduce shared infrastructure that requires maintenance
- Create dependencies between previously independent components
- Expand the project's operational complexity beyond its community scope

## Recognition Signals
- Signal: Infrastructure creation or modification
  Examples: New build pipelines, shared frameworks, deployment changes
  But also: Global configuration systems, cross-cutting concerns

- Signal: Multi-file solution when local solution exists
  Examples: Spanning multiple packages, creating new modules for simple problems
  But also: Shared utilities that could be local functions

## Diverse Examples (Non-Exhaustive)

### Example 1: Constraint Violation - Infrastructure
```typescript
// ❌ VIOLATION: Creates shared infrastructure burden
class GlobalConfigManager {
  static configure() { /* manages global state */ }
}
// VIOLATION REASON: Introduces maintenance burden and coupling
```

### Example 2: Compliant Local Solution
```typescript
// ✅ COMPLIANT: Local solution within existing boundaries
function processEmails(emails: Email[], config: ProcessConfig) {
  // Handles requirements locally without shared infrastructure
}
```

### Example 3: Constraint Violation - Multi-file Expansion
```typescript
// ❌ VIOLATION: Creating new files for simple functionality
// auth/new-validator.ts, shared/new-utils.ts, config/new-settings.ts
// VIOLATION REASON: Could be solved within existing files
```

## Generalization Guidance
Ask yourself:
1. Can this be solved within existing files and boundaries?
2. Does this create new maintenance responsibilities for the community?
3. Would this make the project harder for new contributors to understand?

## Anti-Patterns (What This Rule Does NOT Cover)
- Working within existing files to solve problems
- Using existing shared utilities that already exist
- Local constants and functions within current scope

## U2 CRITICAL CONSTRAINT ENFORCEMENT
**ABSOLUTE PROHIBITION**: No recommendations for creating documentation, processes, CI/CD, or shared tooling.
**ONLY ALLOWED**: Fix violations within existing files using existing tools.
**Escalation**: For infrastructure vs. local solution questions, consult the architect-reviewer agent.

## Enforcement Note
**ANY proposal violating the ABSOLUTE REQUIREMENTS will be IMMEDIATELY REJECTED.**

---

### U3. Functional Cohesion in File Organization

## Intent
Files should group functionality that consumers would logically expect to find together, making the codebase predictable and maintainable without forcing developers to hunt through multiple files for related operations.

## Category Pattern
This encompasses violations where file organization:
- Groups unrelated functionality that serves different purposes
- Uses generic names that don't indicate the file's specific domain
- Forces consumers to import from multiple files for a single logical operation

## Recognition Signals
- Signal: Generic utility collections
  Examples: utils.ts, helpers.ts, common.ts, misc.ts
  But also: Files named after implementation details rather than purpose

- Signal: Functionally unrelated groupings
  Examples: Authentication + email formatting in same file, database utilities + UI helpers
  But also: Similar-looking functions that serve completely different use cases

## Diverse Examples (Non-Exhaustive)

### Example 1: Generic Utility Anti-Pattern
```typescript
// ❌ VIOLATION: utils.ts - what does this file actually do?
export function formatDate(date: Date): string { ... }
export function validateEmail(email: string): boolean { ... }
export function retryOperation<T>(fn: () => T): Promise<T> { ... }
// VIOLATION REASON: Unrelated functions with no cohesive purpose
```

### Example 2: Purpose-Based Organization
```typescript
// ✅ COMPLIANT: email-validation.ts - clear domain
export function validateEmailFormat(email: string): boolean { ... }
export function normalizeEmailAddress(email: string): string { ... }
export function extractEmailDomain(email: string): string { ... }
```

### Example 3: Migration Approach
```typescript
// ✅ COMPLIANT: Move functions to purpose-specific files
// Don't duplicate or create backward compatibility - break old references
```

## Generalization Guidance
Ask yourself:
1. If I needed [specific functionality], would I logically look in this file?
2. Do these functions serve the same high-level purpose or domain?
3. Would a new contributor understand this file's scope from its name?

**Escalation**: For file naming and grouping decisions, consult the architect-reviewer agent.

## Anti-Patterns (What This Rule Does NOT Cover)
- Files with clear, specific purposes even if they have multiple functions
- Domain-specific modules that naturally group related operations
- Temporary files during active development before final organization

---

### U4. TypeScript API Design

## Intent
Public APIs should make valid usage patterns self-evident through type design, reducing runtime errors and improving developer experience through clear interfaces.

## Category Pattern
This encompasses violations where API design:
- Forces consumers to guess at valid parameter combinations
- Allows invalid states to be represented in the type system
- Creates confusion about expected usage patterns

## Recognition Signals
- Signal: Unclear valid parameter combinations
  Examples: Optional parameters that are actually required together, union types without clear constraints
  But also: APIs that accept "any" when specific types would guide usage

- Signal: Interface inconsistency across related operations
  Examples: Similar operations with different parameter patterns, inconsistent naming conventions
  But also: Type definitions that don't reflect actual usage requirements

## Diverse Examples (Non-Exhaustive)

### Example 1: Self-Evident Interface
```typescript
// ✅ COMPLIANT: Valid parameters are clear from types
interface EmailConfig {
  readonly transport: 'smtp' | 'sendmail';
  readonly auth: SmtpAuth | SendmailAuth;
}
```

### Example 2: Confusing Optional Parameters
```typescript
// ❌ VIOLATION: When is clientId required?
interface AuthOptions {
  provider?: 'google' | 'microsoft';
  clientId?: string;
  scope?: string[];
}
// VIOLATION REASON: Valid combinations aren't clear from types
```

### Example 3: Shared Implementation Pattern
```typescript
// ✅ COMPLIANT: Classes implement types-only package interface
// @mcpeasy/oauth
export interface IAuthProvider {
  authenticate(options: AuthOptions): Promise<AuthResult>;
}

// @mcpeasy/oauth-google
export class GoogleAuthProvider implements IAuthProvider {
  authenticate(options: GoogleAuthOptions): Promise<AuthResult> { ... }
}
```

## Generalization Guidance
Ask yourself:
1. Can a developer understand valid usage just from the types?
2. Do the types prevent common misuse patterns?
3. Would similar operations have consistent interfaces?

## Anti-Patterns (What This Rule Does NOT Cover)
- Complex internal implementations with simple public interfaces
- Domain-specific type constraints that serve business logic
- Types that accurately reflect inherently complex business rules

---

### U5. Code Lifecycle Management

## Intent
The codebase should contain only actively used, non-duplicated code to reduce maintenance burden and prevent confusion about which implementation to use or modify.

## Category Pattern
This encompasses violations where code:
- Exists but serves no active purpose in the current system
- Duplicates functionality that already exists elsewhere
- Creates maintenance burden through deprecated or unused artifacts

## Recognition Signals
- Signal: Code artifacts with no active consumption
  Examples: Unused exports, functions with no callers, deprecated files
  But also: Dead import paths, commented code that should be deleted

- Signal: Multiple implementations of the same logical operation
  Examples: Duplicate utility functions, multiple versions of similar logic
  But also: Wrapper functions that just re-export library functionality

## Diverse Examples (Non-Exhaustive)

### Example 1: Deprecated File Removal
```typescript
// ❌ VIOLATION: File with DEPRECATED comment still exists
// src/old-auth.ts
// DEPRECATED: Use new auth system instead
export function authenticate() { ... }
// VIOLATION REASON: Should be deleted, not marked deprecated
```

### Example 2: Direct Library Usage
```typescript
// ❌ VIOLATION: Unnecessary re-export wrapper
export { someFunction } from 'third-party-library';

// ✅ COMPLIANT: Import directly from library
import { someFunction } from 'third-party-library';
```

### Example 3: Duplicate Code Elimination
```typescript
// ❌ VIOLATION: Same logic in multiple places
// file1.ts: function validateEmail() { ... }
// file2.ts: function checkEmailFormat() { ... } // same implementation
// VIOLATION REASON: Choose one location and use consistently
```

## Generalization Guidance
Ask yourself:
1. Is this code actively used in the current system?
2. Does this duplicate functionality that exists elsewhere?
3. Would removing this code simplify maintenance without losing functionality?

## Anti-Patterns (What This Rule Does NOT Cover)
- Similar functions that serve genuinely different purposes
- Code that appears unused but serves critical system functions
- Temporary duplication during active refactoring work

---

### U6. Type Safety Over Runtime Guards

## Intent
Code should rely on TypeScript's type system to prevent invalid states rather than using runtime checks that indicate missing type safety, improving both performance and developer confidence.

## Category Pattern
This encompasses violations where runtime guards:
- Protect against conditions that proper typing would prevent
- Indicate missing or weak type contracts between components
- Create defensive programming patterns that bypass compile-time safety

## Recognition Signals
- Signal: Optional chaining where types should guarantee presence
  Examples: ctx?.google?.auth when ctx should have google.auth guaranteed
  But also: Excessive null checks for values that types should ensure exist

- Signal: Runtime type checking for compile-time type issues
  Examples: typeof checks for known parameter types, instanceof for typed objects
  But also: Complex validation logic that types could handle

## Diverse Examples (Non-Exhaustive)

### Example 1: Unnecessary Optional Chaining
```typescript
// ❌ VIOLATION: Types should guarantee this structure exists
function processAuth(ctx: AuthContext) {
  if (ctx?.google?.auth) { // Types should make this check unnecessary
    return ctx.google.auth.token;
  }
}
// VIOLATION REASON: AuthContext type should guarantee google.auth exists
```

### Example 2: Strict Type Contract
```typescript
// ✅ COMPLIANT: Types guarantee structure, no guards needed
interface AuthContext {
  readonly google: {
    readonly auth: GoogleAuth;
  };
}

function processAuth(ctx: AuthContext) {
  return ctx.google.auth.token; // No guards needed
}
```

### Example 3: Appropriate Error Handling vs Guards
```typescript
// ✅ COMPLIANT: Handle legitimate runtime conditions
function processApiResponse(response: ApiResponse) {
  if (response.status === 'error') { // Business logic condition
    throw new Error(response.message);
  }
  return response.data;
}
```

## Generalization Guidance
Ask yourself:
1. Should the type system prevent this condition from occurring?
2. Is this guard protecting against a type system failure or a business logic condition?
3. Would better type design eliminate the need for this runtime check?

## Anti-Patterns (What This Rule Does NOT Cover)
- Guards for legitimate business logic conditions (API errors, user input validation)
- Runtime checks for external data that can't be typed at compile time
- Error handling for network conditions and external system failures

---

### U7. Static Import Dependencies

## Intent
Module dependencies should be explicit and statically analyzable to enable better tooling, bundling optimization, and dependency understanding without runtime surprises.

## Category Pattern
This encompasses violations where imports:
- Hide dependencies until runtime execution
- Make static analysis and bundling optimization impossible
- Create unclear dependency graphs that are hard to reason about

## Recognition Signals
- Signal: Runtime-dependent import resolution
  Examples: await import(), conditional imports based on runtime values
  But also: Dynamic import paths constructed from variables

- Signal: Lazy loading where static imports would work
  Examples: Dynamic imports for modules that are always needed
  But also: Conditional imports for code that should be tree-shaken instead

## Diverse Examples (Non-Exhaustive)

### Example 1: Dynamic Import Anti-Pattern
```typescript
// ❌ VIOLATION: Dynamic import for always-needed dependency
async function processEmail(email: Email) {
  const { validateEmail } = await import('./email-validator.ts');
  return validateEmail(email);
}
// VIOLATION REASON: email-validator is always needed, should be static
```

### Example 2: Static Import Pattern
```typescript
// ✅ COMPLIANT: Clear, static dependency
import { validateEmail } from './email-validator.ts';

function processEmail(email: Email) {
  return validateEmail(email);
}
```

### Example 3: Legitimate Dynamic Import
```typescript
// ✅ COMPLIANT: Truly conditional feature loading
async function loadAdvancedFeatures() {
  if (config.enableAdvancedMode) {
    const { AdvancedProcessor } = await import('./advanced-features.ts');
    return new AdvancedProcessor();
  }
}
```

## Generalization Guidance
Ask yourself:
1. Are these dependencies always needed when this module runs?
2. Would static analysis tools be able to understand this dependency?
3. Is the dynamic nature serving a real performance or architectural need?

## Anti-Patterns (What This Rule Does NOT Cover)
- Dynamic imports for truly optional features or plugins
- Conditional loading based on runtime environment capabilities
- Lazy loading for large modules that may not be needed

---

### U8. Consistent File Naming

## Intent
File names should follow consistent conventions that make them easy to find, sort, and organize within any operating system or tool environment.

## Category Pattern
This encompasses violations where file naming:
- Uses inconsistent casing conventions within the project
- Creates file system compatibility issues across different operating systems
- Makes files difficult to locate or organize systematically

## Recognition Signals
- Signal: Mixed naming conventions within project
  Examples: some-file.ts mixed with someFile.ts or some_file.ts
  But also: Inconsistent patterns for similar file types

- Signal: Platform-specific naming issues
  Examples: Case sensitivity problems, special characters
  But also: Names that conflict with reserved words or system conventions

## Diverse Examples (Non-Exhaustive)

### Example 1: Consistent Hyphenated Convention
```typescript
// ✅ COMPLIANT: Consistent hyphenated naming
email-validator.ts
auth-provider.ts
connection-manager.ts
```

### Example 2: Mixed Convention Violation
```typescript
// ❌ VIOLATION: Inconsistent naming patterns
emailValidator.ts
auth-provider.ts
connection_manager.ts
// VIOLATION REASON: Should pick one convention and apply consistently
```

### Example 3: Migration Approach
```typescript
// ✅ COMPLIANT: Rename files and update imports
// OLD: authProvider.ts → NEW: auth-provider.ts
// Update all import statements, don't copy content
```

## Generalization Guidance
Ask yourself:
1. Does this file name follow the project's established naming convention?
2. Would this name work consistently across different operating systems?
3. Can developers easily predict how to name similar files?

## Anti-Patterns (What This Rule Does NOT Cover)
- Following external library or framework naming requirements
- Temporary files during active development
- Generated files that follow tool-specific conventions

---

### U9. Meaningful Comments

## Intent
Comments should provide valuable context that isn't obvious from the code itself, helping maintainers understand decisions and complexity without cluttering the codebase with redundant information.

## Category Pattern
This encompasses violations where comments:
- State what the code obviously does rather than why or how decisions were made
- Become outdated and misleading as code evolves
- Add noise without providing valuable context for maintainers

## Recognition Signals
- Signal: Self-evident descriptions
  Examples: // Set variable to true, // Call function with parameter
  But also: Comments that just restate the function name or obvious operations

- Signal: Outdated or incorrect information
  Examples: Comments that describe old implementations, wrong parameter descriptions
  But also: TODO comments for completed work, outdated API references

## Diverse Examples (Non-Exhaustive)

### Example 1: Self-Evident Comment Violation
```typescript
// ❌ VIOLATION: Comment adds no value
// Set isAuthenticated to true
const isAuthenticated = true;

// ❌ VIOLATION: Just restates the obvious
// Loop through emails array
for (const email of emails) { ... }
// VIOLATION REASON: Code is self-explanatory
```

### Example 2: Valuable Context Comment
```typescript
// ✅ COMPLIANT: Explains non-obvious business logic
// Gmail API requires 100ms delay between requests to avoid rate limiting
await delay(100);

// ✅ COMPLIANT: Documents important constraint
// Must validate before processing - invalid emails crash the service
if (!isValidEmail(email)) throw new Error('Invalid email format');
```

### Example 3: Brief Current Comments
```typescript
// ✅ COMPLIANT: Concise explanation of complex logic
// Convert OAuth scope array to space-separated string per RFC 6749
const scopeString = scope.join(' ');
```

## Generalization Guidance
Ask yourself:
1. Does this comment explain something that isn't obvious from reading the code?
2. Would a new developer need this information to understand or modify the code safely?
3. Is this comment current and accurate with the existing implementation?

## Anti-Patterns (What This Rule Does NOT Cover)
- API documentation comments for public interfaces
- Comments explaining complex algorithms or business rules
- Temporary debugging comments during active development

---

### U10. Concise Code Formatting

## Intent
Code should be formatted consistently and compactly to maximize readability within reasonable line lengths while avoiding unnecessary syntax that doesn't add clarity.

## Category Pattern
This encompasses violations where formatting:
- Uses unnecessary verbosity that doesn't improve readability
- Inconsistently applies formatting rules within the codebase
- Creates excessive line breaks or whitespace that reduces information density

## Recognition Signals
- Signal: Unnecessary braces for simple statements
  Examples: Single-line if statements wrapped in braces, simple expressions over-formatted
  But also: Inconsistent brace usage for similar code patterns

- Signal: Excessive line length or unnecessary breaks
  Examples: Lines that could fit comfortably but are broken arbitrarily
  But also: Complex expressions that should be broken but aren't


## Generalization Guidance
Ask yourself:
1. Does this formatting make the code easier to read and understand?
2. Is the formatting consistent with similar code patterns in the project?
3. Does the line length balance readability with information density?

## Anti-Patterns (What This Rule Does NOT Cover)
- Multi-line formatting for genuinely complex expressions
- Consistent formatting that follows established project patterns
- Breaking lines for readability when expressions are actually complex

---

### U11. Node.js Type Stripping Configuration

## Intent
The project should use Node.js built-in TypeScript support to minimize build complexity and external dependencies while maintaining type safety during development.

## Category Pattern
This encompasses violations where TypeScript compilation:
- Introduces unnecessary build processes or external compilation tools
- Creates complex configuration that obscures the simple type-stripping approach
- Adds dependencies that Node.js already provides natively

## Recognition Signals
- Signal: Complex build processes for TypeScript
  Examples: webpack configs, babel setups, custom build scripts for TS compilation
  But also: Build tools that duplicate Node.js native capabilities

- Signal: Configuration that doesn't match Node.js type stripping requirements
  Examples: emit: true, incorrect module resolution settings
  But also: Configurations that prevent proper ESM module handling

## Diverse Examples (Non-Exhaustive)

### Example 1: Correct Type Stripping Config
```json
// ✅ COMPLIANT: Uses Node.js built-in type stripping
{
  "compilerOptions": {
    "noEmit": true,
    "target": "esnext",
    "module": "nodenext",
    "rewriteRelativeImportExtensions": true,
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true
  }
}
```

### Example 2: Complex Build Process Violation
```json
// ❌ VIOLATION: Unnecessary build complexity
{
  "scripts": {
    "build": "webpack --config webpack.config.js",
    "compile": "tsc && babel dist --out-dir lib"
  }
}
// VIOLATION REASON: Node.js can run TypeScript directly
```

### Example 3: Incorrect Emit Configuration
```json
// ❌ VIOLATION: Conflicting with type-stripping approach
{
  "compilerOptions": {
    "noEmit": false,
    "outDir": "dist",
    "target": "es2020"
  }
}
// VIOLATION REASON: Should use noEmit: true for type stripping
```

## Generalization Guidance
Ask yourself:
1. Does this configuration use Node.js native TypeScript capabilities?
2. Are we introducing build complexity that Node.js already handles?
3. Will this configuration work with Node.js type stripping requirements?

## Anti-Patterns (What This Rule Does NOT Cover)
- Configurations required for specific deployment environments
- Type checking configurations that don't affect runtime
- Editor-specific TypeScript configurations

---

### U12. Module Boundary Preservation

## Intent
Package boundaries should be respected through explicit imports to maintain clear architectural separation and prevent coupling that would make packages difficult to extract or reuse.

## Category Pattern
This encompasses violations where imports:
- Bypass package boundaries through relative path traversal
- Create implicit coupling between packages that should be independent
- Make package extraction or reorganization difficult

## Recognition Signals
- Signal: Relative paths between packages
  Examples: ../other-package/src/file.ts, ../../shared/utils.ts from different packages
  But also: Direct file system access that bypasses package.json exports

- Signal: Internal implementation access across packages
  Examples: Importing from src/ directories of other packages directly
  But also: Bypassing public APIs to access private implementation details

## Diverse Examples (Non-Exhaustive)

### Example 1: Relative Path Violation
```typescript
// ❌ VIOLATION: Crosses package boundary with relative path
// From @mcpeasy/oauth-google/src/client.ts
import { helper } from '../../auth-core/src/internal/helper.ts';
// VIOLATION REASON: Should use explicit package import
```

### Example 2: Explicit Package Import
```typescript
// ✅ COMPLIANT: Respects package boundaries
// From @mcpeasy/oauth-google/src/client.ts
import { AuthHelper } from '@mcpeasy/oauth';
```

### Example 3: Internal Package Structure
```typescript
// ✅ COMPLIANT: Relative imports within same package
// From @mcpeasy/oauth-google/src/client.ts
import { validateConfig } from './config-validator.ts';
import { TokenManager } from '../token/manager.ts';
```

## Generalization Guidance
Ask yourself:
1. Does this import cross package boundaries through the file system?
2. Would this import break if the target package were extracted to a separate repository?
3. Am I accessing a public API or bypassing it to reach internal implementation?

## Anti-Patterns (What This Rule Does NOT Cover)
- Relative imports within the same package structure
- Importing from packages through their public package.json exports
- Dependencies explicitly declared in package.json

---

### U13. TypeScript Type System Preservation

## Intent
Code should leverage TypeScript's type system to prevent errors at compile time rather than circumventing type safety, maintaining confidence in code correctness and refactoring safety.

## Category Pattern
This encompasses violations where code:
- Bypasses TypeScript's type checking through escape hatches without justification
- Uses patterns that eliminate compile-time error detection
- Creates situations where types lie about runtime behavior

## Recognition Signals
- Signal: Type system escape hatches without clear justification
  Examples: any types, type assertions (as SomeType), @ts-ignore directives
  But also: Non-null assertions (!) where types should guarantee non-null

- Signal: Types that don't match runtime behavior
  Examples: Interface definitions that don't reflect actual data structure
  But also: Optional properties that are actually always present

**Escalation**: For complex typing scenarios not covered in documentation, consult the `typescript-pro` agent.

## Diverse Examples (Non-Exhaustive)

### Example 1: Unjustified Type Escape
```typescript
// ❌ VIOLATION: Using 'any' instead of proper typing
function processApiResponse(response: any): UserData {
  return response.user; // No type safety
}
// VIOLATION REASON: Should type the response structure
```

### Example 2: Proper Type Definition
```typescript
// ✅ COMPLIANT: Leverages type system for safety
interface ApiResponse {
  readonly user: UserData;
  readonly status: 'success' | 'error';
}

function processApiResponse(response: ApiResponse): UserData {
  return response.user; // Type safe
}
```

### Example 3: Justified Type Assertion
```typescript
// ✅ COMPLIANT: Type assertion with clear justification
// We know this is HTMLInputElement because we just created it
const input = document.createElement('input') as HTMLInputElement;
```

## Generalization Guidance
Ask yourself:
1. Does this preserve TypeScript's ability to catch errors at compile time?
2. Is there a type-safe way to express this pattern?
3. Would someone reading this code understand why type safety was bypassed?

**Escalation**: For complex typing scenarios not covered in documentation, consult the `typescript-pro` agent.

## Anti-Patterns (What This Rule Does NOT Cover)
- Type assertions for legitimate compiler limitations
- Using any for genuinely dynamic content from external sources
- Temporary type escapes during active migration work

---

### U14. Breaking Changes Over Compatibility

## ABSOLUTE REQUIREMENT (Non-Negotiable)
**NO BACKWARD COMPATIBILITY** - This project does not have customers yet. All changes must be breaking changes that eliminate old patterns completely.

## Intent
Code should evolve cleanly through breaking changes rather than maintaining backward compatibility layers that create complexity and technical debt. Since this is a pre-customer project, we prioritize clean architecture over compatibility.

## STRICT ENFORCEMENT
**IMMEDIATELY REJECT any proposal that**:
- Maintains old API signatures alongside new ones
- Creates migration paths or transition periods
- Adds feature flags for gradual rollouts
- Preserves deprecated patterns "for compatibility"
- Suggests "we can support both approaches"

## Category Pattern
This encompasses violations where changes:
- Add compatibility layers to support old APIs or data formats
- Create migration paths that maintain multiple ways of doing the same thing
- Preserve deprecated patterns that should be eliminated
- Suggest gradual transitions instead of clean breaks

## Recognition Signals
- Signal: Backward compatibility preservation
  Examples: Supporting both old and new API signatures, data migration utilities
  But also: Deprecated function wrappers, version detection logic

- Signal: Gradual migration complexity
  Examples: Feature flags for new behavior, dual implementation paths
  But also: Migration utilities that preserve old state

- Signal: "Support both" language
  Examples: "We can support both old and new formats", "Let's maintain compatibility while..."
  But also: Any suggestion of maintaining multiple code paths for the same functionality

## Diverse Examples (Non-Exhaustive)

### Example 1: Clean Breaking Change
```typescript
// ✅ COMPLIANT: Clean API evolution
// OLD: function authenticate(user, pass)
// NEW: function authenticate(credentials: credentials)
function authenticate(credentials: credentials): Promise<AuthResult> {
  // Single implementation, no backward compatibility
}
```

### Example 2: Compatibility Layer Violation
```typescript
// ❌ VIOLATION: Maintains old API for compatibility
function authenticate(
  userOrCredentials: string | credentials,
  password?: string
): Promise<AuthResult> {
  // Complex logic to support both old and new patterns
}
// VIOLATION REASON: Should break cleanly to new pattern
```

### Example 3: Migration Utility Violation
```typescript
// ❌ VIOLATION: Creates migration path that preserves old patterns
function migrateOldConfig(oldConfig: LegacyConfig): NewConfig {
  // Don't do this - just regenerate from scratch
}
// VIOLATION REASON: Delete old data, regenerate with new format
```

### Example 4: Data Format Evolution
```typescript
// ✅ COMPLIANT: Generate new data to new format
// Delete existing user.json files - don't migrate them
// Regenerate tokens with new structure when needed
const tokenData = {
  version: 2, // New format only
  accessToken: token.access,
  expiresAt: token.expires
};
```

### Example 5: API Breaking Change
```typescript
// ✅ COMPLIANT: Clean break to new API
// OLD: authenticate(username, password)
// NEW: authenticate(credentials)
function authenticate(credentials: credentials): Promise<AuthResult> {
  // Single implementation - no backward compatibility
  // Update all callers to use new signature
}
```

## Generalization Guidance
Ask yourself:
1. Does this change require maintaining multiple ways of doing the same thing?
2. Would it be simpler to break cleanly and regenerate/recreate affected data?
3. Is backward compatibility adding complexity that burdens the community project?

## Anti-Patterns (What This Rule Does NOT Cover)
- Clean API evolution that doesn't maintain compatibility layers
- Supporting external standards that require specific formats
- Temporary duplication during active migration work

---

### U15. Environment Variable Extraction Boundaries

## Intent
Environment variables should be extracted predictably at system boundaries to make configuration dependencies explicit, with conditional extraction allowed only when runtime configuration determines which variable set applies.

## Category Pattern
This encompasses violations where environment variable extraction:
- Occurs unpredictably throughout library code rather than at clear boundaries
- Hides configuration requirements behind defaults or optional parameters
- Bypasses the principle except when configuration legitimately determines variable sets

## Recognition Signals
- Signal: Environment access scattered throughout codebase
  Examples: process.env in utility functions, middleware accessing ENV directly
  But also: Configuration spread across multiple modules, implicit environment coupling

- Signal: Non-deterministic extraction patterns
  Examples: Optional parameters with env defaults, lazy environment access
  But also: Environment variables accessed on demand rather than at startup

- Signal: Legitimate conditional extraction pattern
  Examples: Feature flags determining which configuration variables to load
  But also: Environment-based feature flags that load different configurations

## Diverse Examples (Non-Exhaustive)

### Example 1: Top-Level Extraction Pattern
```typescript
// ✅ COMPLIANT: Extract all env vars at entry point
const API_KEY = requiredEnv('API_KEY');
const DB_HOST = requiredEnv('DB_HOST');
// Pass as explicit parameters to functions
```

### Example 2: Scattered Extraction Violation
```typescript
// ❌ VIOLATION: Hidden environment dependency
function queryDatabase() {
  const host = process.env.DB_HOST; // Unpredictable extraction
}
// VIOLATION REASON: Should receive config explicitly
```

### Example 3: Legitimate Conditional Pattern
```typescript
// ✅ COMPLIANT: Configuration determines variable set
const STORAGE_MODE = requiredEnv('STORAGE_MODE');
const config = STORAGE_MODE === 'file'
  ? { path: requiredEnv('FILE_PATH') }
  : { uri: requiredEnv('DATABASE_URI') };
```

## Generalization Guidance
Ask yourself:
1. Are environment variables extracted predictably at system boundaries?
2. Does conditional extraction serve a legitimate configuration-driven purpose?
3. Would configuration dependencies be obvious to someone reading the code?

**Context**: Universal

**Escalation**: For complex environment patterns and Docker/MCP configurations, consult the architect agent for environment.md guidance.

## Anti-Patterns (What This Rule Does NOT Cover)
- Top-level extraction at entry points (always acceptable)
- Conditional extraction based on configuration mode (feature flag pattern)
- Explicit configuration objects passed through the system

---

### U16. Fix Root Issues Over Ignoring

## Fixed Requirement
**Fix underlying issues instead of using "// biome-ignore" comments.**

## Intent
Code quality issues should be resolved at their source rather than suppressed through tool directives, ensuring the codebase maintains consistent standards and doesn't accumulate technical debt.

## Category Pattern
This encompasses violations where quality tools:
- Are silenced through ignore directives rather than fixing underlying issues
- Accumulate exceptions that indicate systematic problems
- Create inconsistent code quality across the codebase

## Recognition Signals
- Signal: Tool ignore directives instead of fixes
  Examples: // biome-ignore, // eslint-disable, @ts-ignore without clear justification
  But also: Accumulated exceptions that suggest tooling misconfiguration

- Signal: Suppressing legitimate quality concerns
  Examples: Disabling rules that catch real issues, ignoring performance warnings
  But also: Using ignore directives as shortcuts during development

## Diverse Examples (Non-Exhaustive)

### Example 1: Fixing Instead of Ignoring
```typescript
// ❌ VIOLATION: Suppressing instead of fixing
// biome-ignore lint/complexity/noExtraBooleanCast: legacy code
if (!!isAuthenticated) { ... }

// ✅ COMPLIANT: Fix the underlying issue
if (isAuthenticated) { ... }
```

### Example 2: Legitimate Tool Configuration
```typescript
// ✅ COMPLIANT: Configuration-level adjustment when appropriate
// biome.json - project-wide rule adjustment for valid architectural reasons
{
  "rules": {
    "complexity": {
      "noExtraBooleanCast": "off"
    }
  }
}
```

### Example 3: Temporary Development Exceptions
```typescript
// ✅ COMPLIANT: Justified temporary exception during development
// TODO: Implement proper type definition for external API
const response = await fetch(url) as any; // Will be typed when API contract is stable
```

## Generalization Guidance
Ask yourself:
1. Does this ignore directive address a real architectural need or avoid fixing a fixable issue?
2. Could this be resolved through proper implementation rather than suppression?
3. Would fixing this issue improve overall code quality?

## Anti-Patterns (What This Rule Does NOT Cover)
- Justified exceptions for external library compatibility issues
- Project-wide configuration changes for valid architectural reasons
- Temporary exceptions during active development with clear resolution plans

---

### U17. Focused Public APIs

## Intent
Packages should export only the functionality that external consumers actually need, keeping APIs small and focused to reduce maintenance burden and prevent unintended coupling.

## Category Pattern
This encompasses violations where exports:
- Include internal utilities or implementation details not meant for external use
- Create convenience aliases that duplicate functionality
- Export everything "just in case" rather than based on actual usage

## Recognition Signals
- Signal: Exporting internal implementation details
  Examples: Helper functions meant for internal use, configuration objects, debug utilities
  But also: Intermediate types or interfaces that consumers shouldn't directly use

- Signal: Convenience exports that duplicate functionality
  Examples: Re-exporting third-party libraries, alias functions that just wrap other exports
  But also: Multiple ways to access the same functionality

## Diverse Examples (Non-Exhaustive)

### Example 1: Focused Export
```typescript
// ✅ COMPLIANT: Only export what consumers need
export { authenticate } from './auth.ts';
export { type AuthConfig, type AuthResult } from './types.ts';
```

### Example 2: Over-Exporting Violation
```typescript
// ❌ VIOLATION: Exporting internal utilities
export { authenticate } from './auth.ts';
export { validateConfig } from './internal/config-validator.ts'; // Internal detail
export { debugLogger } from './utils/debug.ts'; // Development utility
export { retryWithBackoff } from './utils/retry.ts'; // Generic utility
// VIOLATION REASON: Consumers don't need internal implementation details
```

### Example 3: Convenience Re-export Violation
```typescript
// ❌ VIOLATION: Unnecessary convenience wrapper
export { fetch } from 'node-fetch'; // Just use the library directly
export const httpClient = fetch; // Alias serves no purpose
// VIOLATION REASON: Consumers should import from original library
```

## Generalization Guidance
Ask yourself:
1. Do external consumers actually need this functionality?
2. Is this exposing implementation details that might change?
3. Does this export add value or just create alternative ways to do the same thing?

## Anti-Patterns (What This Rule Does NOT Cover)
- Exporting legitimate public API functions and types
- Essential utilities that multiple consumers genuinely need
- Type definitions required for API contracts

---

### U18. Simplified Package Exports

## Intent
Package exports should remain simple with a single main export unless the package serves genuinely distinct domains, avoiding complexity that fragments related functionality.

## Package Export Requirements

✅ **ALLOWED**: Main export only: `"exports": { ".": { "import": "./src/index.ts" } }`
❌ **FORBIDDEN**: Single-purpose exports: "./auth", "./client", "./types" for functionality that belongs in main export

**Exception criteria**: Additional exports allowed ONLY when:
1. Package serves 2+ completely separate use cases (e.g., client + server)
2. AND consuming packages would import fundamentally different functionality
3. AND tree-shaking benefit is significant (>50% code reduction)

## Category Pattern
This encompasses violations where package exports:
- Create artificial separation of functionality that belongs together
- Fragment APIs that consumers would naturally use as a unit
- Add complexity without meaningful architectural or performance benefits

## Recognition Signals
- Signal: Multiple exports for single-purpose functionality
  Examples: Separate /auth, /client, /types exports for one authentication system
  But also: Splitting related operations across different export paths

- Signal: Exports that don't meet distinct domain criteria
  Examples: Convenience paths that don't serve fundamentally different use cases
  But also: Exports that provide minimal tree-shaking benefit

## Diverse Examples (Non-Exhaustive)

### Example 1: Simple Main Export
```json
// ✅ COMPLIANT: Single main export for focused package
{
  "exports": {
    ".": { "import": "./src/index.ts" }
  }
}
```

### Example 2: Unnecessary Export Fragmentation
```json
// ❌ VIOLATION: Artificial separation of related functionality
{
  "exports": {
    ".": { "import": "./src/index.ts" },
    "./auth": { "import": "./src/auth.ts" },
    "./client": { "import": "./src/client.ts" },
    "./types": { "import": "./src/types.ts" }
  }
}
// VIOLATION REASON: Auth, client, and types are part of one system
```

### Example 3: Legitimate Multiple Domains
```json
// ✅ COMPLIANT: Genuinely distinct domains with significant tree-shaking benefit
{
  "exports": {
    ".": { "import": "./src/index.ts" },
    "./server": { "import": "./src/server/index.ts" },
    "./client": { "import": "./src/client/index.ts" }
  }
}
// Different deployment environments, >50% code reduction
```

## Generalization Guidance
Ask yourself:
1. Do these exports serve fundamentally different use cases or deployment environments?
2. Would consumers typically import from multiple exports for a single feature?
3. Does the separation provide meaningful tree-shaking benefit (>50% code reduction)?

## Anti-Patterns (What This Rule Does NOT Cover)
- Single main exports that include all package functionality
- Legitimate separation for server vs client deployment environments
- Exports that provide significant performance benefits through code splitting

---

### U19. TypeScript Module Extensions

## Intent
Internal imports should use .ts extensions to work correctly with Node.js type stripping and modern module resolution without requiring build steps.

## Category Pattern
This encompasses violations where imports:
- Use extension patterns that don't work with Node.js native TypeScript support
- Create module resolution ambiguity that requires build tooling to resolve
- Prevent proper ESM module handling in Node.js environment

## Recognition Signals
- Signal: Missing or incorrect extensions for TypeScript files
  Examples: import './module' without .ts, import './file.js' for TypeScript sources
  But also: Inconsistent extension usage across the project

- Signal: Extension patterns that break Node.js type stripping
  Examples: Extensions that require transformation, paths that don't resolve correctly
  But also: Import patterns that work only with specific build tools

## Diverse Examples (Non-Exhaustive)

### Example 1: Correct TypeScript Extensions
```typescript
// ✅ COMPLIANT: .ts extensions for internal TypeScript imports
import { validateEmail } from './email-validator.ts';
import { AuthProvider } from '../auth/provider.ts';
import { type UserData } from './types.ts';
```

### Example 2: Missing Extension Violation
```typescript
// ❌ VIOLATION: Missing extension breaks Node.js module resolution
import { validateEmail } from './email-validator'; // No extension
import { AuthProvider } from '../auth/provider'; // No extension
// VIOLATION REASON: Node.js type stripping requires explicit .ts extensions
```

### Example 3: External Package Imports
```typescript
// ✅ COMPLIANT: External packages don't need extensions
import { someFunction } from '@mcpeasy/some-module';
import { fetch } from 'node-fetch';
```

## Generalization Guidance
Ask yourself:
1. Will this import work with Node.js native TypeScript type stripping?
2. Does this import require build tooling to resolve correctly?
3. Is the extension consistent with the project's TypeScript setup?

## Anti-Patterns (What This Rule Does NOT Cover)
- Imports from external npm packages (no extensions needed)
- Standard library imports that follow Node.js conventions
- Dynamic imports that follow different resolution rules

---

### U20. Local-First Solutions

## Intent
Problems should be solved with local, contained solutions rather than shared infrastructure, keeping the community project approachable and avoiding maintenance burdens that span multiple files or systems.

## Category Pattern
This encompasses violations where solutions:
- Create shared infrastructure when local solutions would work
- Add complexity that spans multiple files for problems solvable locally
- Introduce dependencies or abstractions that burden the community project

## Recognition Signals
- Signal: Multi-file solutions for single-file problems
  Examples: Creating utilities, helpers, or shared modules for simple operations
  But also: Abstractions that serve only one or two call sites

- Signal: Infrastructure creation for simple problems
  Examples: Configuration systems, shared state management, centralized utilities
  But also: Frameworks or patterns that require understanding across multiple areas

## Diverse Examples (Non-Exhaustive)

### Example 1: Local Variable Solution
```typescript
// ✅ COMPLIANT: Simple local solution
function processEmails(emails: Email[]) {
  const results: ProcessResult[] = []; // Local tracking
  for (const email of emails) {
    const result = processOne(email);
    results.push(result);
  }
  return results;
}
```

### Example 2: Over-Engineered Infrastructure Violation
```typescript
// ❌ VIOLATION: Creates shared infrastructure for simple problem
// shared/result-tracker.ts
export class ResultTracker {
  private results: Map<string, ProcessResult> = new Map();
  track(id: string, result: ProcessResult) { ... }
  getResults(): ProcessResult[] { ... }
}
// VIOLATION REASON: Simple local array would suffice
```

### Example 3: Appropriate Containment
```typescript
// ✅ COMPLIANT: Solve within current context
function authenticateUser(credentials: Credentials) {
  // Local validation logic here instead of shared validator system
  if (!credentials.username || !credentials.password) {
    throw new Error('Username and password required');
  }
  return authenticate(credentials);
}
```

## Generalization Guidance
Ask yourself:
1. Can this be solved within the current file with local variables or functions?
2. Would a shared solution create maintenance burden for future contributors?
3. Is the complexity of a shared solution justified by the problem size?

## Anti-Patterns (What This Rule Does NOT Cover)
- Using existing shared utilities that already exist in the codebase
- Local solutions that genuinely need to be shared across many files
- Domain logic that naturally requires coordination across components

---

### U21. Standard Development Automation

## Intent
Code quality should be maintained through automated tooling that runs consistently, catching issues early and maintaining consistent formatting and dependency health across the project.

## Category Pattern
This encompasses violations where automation:
- Isn't run regularly, allowing quality issues to accumulate
- Fails silently without addressing underlying issues
- Creates inconsistent code standards across different parts of the project

## Recognition Signals
- Signal: Inconsistent formatting or style across files
  Examples: Mixed indentation, inconsistent import ordering, variable formatting patterns
  But also: Outdated dependencies, unused packages, inconsistent package.json formatting

- Signal: Quality tool failures that aren't addressed
  Examples: Lint errors that are ignored, dependency warnings that accumulate
  But also: Format differences that suggest tools aren't being run

## Diverse Examples (Non-Exhaustive)

### Example 1: Standard Automation Commands
```bash
# ✅ COMPLIANT: Run these commands regularly and fix all errors
tsds validate
```

### Example 2: Ignoring Tool Output Violation
```typescript
// ❌ VIOLATION: Letting automation failures accumulate
// Format command shows differences but they're not applied
// Depcheck shows unused dependencies but they're not removed
// VIOLATION REASON: Automation is only valuable if issues are fixed
```

### Example 3: Consistent Quality Standards
```typescript
// ✅ COMPLIANT: All files follow same formatting and dependency standards
// No mixed styles, no unused imports, dependencies up to date
```

## Generalization Guidance
Ask yourself:
1. Are these automation tools being run regularly to maintain quality?
2. When tools report issues, are those issues being fixed rather than ignored?
3. Does the codebase show consistent application of quality standards?

## Anti-Patterns (What This Rule Does NOT Cover)
- Running automation tools that are properly configured for the project
- Addressing legitimate tool failures through proper fixes
- Maintaining consistent quality standards across the codebase

---

### U22. MCP Stdio Communication Integrity

## Intent
MCP (Model Context Protocol) servers must maintain clean stdio communication channels for JSON-RPC protocol compliance, preventing console output that corrupts protocol messages and breaks client-server communication.

## Category Pattern
This encompasses violations where code:
- Outputs to console streams that interfere with MCP JSON-RPC communication
- Uses console fallbacks that corrupt stdio transport
- Creates debug or warning output outside proper logging channels

## Recognition Signals
- Signal: Console output in MCP server code
  Examples: console.log(), console.warn(), console.error() in production code
  But also: console casting as logger (console as unknown as Logger)

- Signal: Fallback patterns that bypass logger
  Examples: logger?.warn() || console.warn(), conditional console usage
  But also: Debug output that doesn't respect MCP transport requirements

## Diverse Examples (Non-Exhaustive)

### Example 1: Proper Logger Usage
```typescript
// ✅ COMPLIANT: Use logger without console fallbacks
function processQuery(query: string, logger: Logger) {
  if (pageSize !== safePageSize && logger) {
    logger.warn('Page size bounded for API safety', { requested: pageSize, applied: safePageSize });
    // No fallback to console - would corrupt MCP stdio communication
  }
}
```

### Example 2: Console Output Violation
```typescript
// ❌ VIOLATION: Console output corrupts MCP JSON-RPC protocol
function buildQuery(params: QueryParams) {
  if (params.invalid) {
    console.warn(`Invalid parameter: ${params.invalid}`); // Breaks MCP stdio
  }
}
// VIOLATION REASON: Console output interferes with JSON-RPC protocol
```

### Example 3: Console Casting Violation
```typescript
// ❌ VIOLATION: Console casting bypasses proper logging
const log = (logger ?? (console as unknown as Logger)) as Logger;
log.warn('Something happened'); // Corrupts stdio if logger is undefined
// VIOLATION REASON: Should use conditional logging instead
```

## Generalization Guidance
Ask yourself:
1. Does this output go to console streams that could interfere with MCP communication?
2. Is there a fallback to console when logger is unavailable?
3. Would this code work correctly in an MCP stdio transport environment?

## Anti-Patterns (What This Rule Does NOT Cover)
- Proper logger usage with conditional checks
- Debug output in development tools that don't use MCP transport
- Test output that explicitly doesn't use MCP stdio communication

---

### U23. Defensive Code Pattern Boundaries

## Intent
Code should implement security measures and error handling for real threats while avoiding theoretical defensive patterns that add complexity without addressing actual risk vectors in the deployment context.

## Category Pattern
This encompasses violations where defensive patterns:
- Solve theoretical attack vectors that don't apply to the actual deployment context
- Implement rate limiting or retry workarounds for provider API quotas
- Create retry logic for failure modes that should fail fast

## Recognition Signals
- Signal: Rate limiting or quota workarounds
  Examples: Per-process rate limiting, retry logic for 429 responses, artificial delays to "avoid" quotas
  Principle: Don't implement workarounds - analyze the situation and consult with humans before implementing solutions

- Signal: Defensive patterns without clear threat model
  Examples: Authentication rate limiting for AI agents with valid credentials, complex error handling for scenarios that should fail fast
  Principle: Address real threats in the actual deployment context

## Diverse Examples (Non-Exhaustive)

### Example 1: Legitimate Rate Limit Detection
```typescript
// ✅ COMPLIANT: Detect and classify rate limit errors appropriately
function handleApiError(error: ApiError): never {
  if (error.status === 429) {
    throw new RateLimitError('API rate limit exceeded', error);
  }
  throw error;
}
```

### Example 2: Prohibited Rate Limit Workaround
```typescript
// ❌ VIOLATION: Implementing rate limit workarounds
class TokenRateLimiter {
  private requests = new Map<string, number>();

  async checkLimit(clientId: string): Promise<boolean> {
    const count = this.requests.get(clientId) || 0;
    if (count > 60) return false; // Don't implement artificial limits
    this.requests.set(clientId, count + 1);
    return true;
  }
}
// VIOLATION REASON: Don't implement workarounds - analyze and consult humans
```

### Example 3: Prohibited Retry Logic
```typescript
// ❌ VIOLATION: Retrying rate limit errors
async function requestWithRetry(request: () => Promise<Response>): Promise<Response> {
  try {
    return await request();
  } catch (error) {
    if (error.status === 429) {
      await delay(1000);
      return requestWithRetry(request); // Don't retry rate limits
    }
    throw error;
  }
}
// VIOLATION REASON: Fail fast on 429 - don't implement workarounds
```

### Example 4: Appropriate Network Retry
```typescript
// ✅ COMPLIANT: Retry transient errors, fail fast on rate limits
async function requestWithBackoff(request: () => Promise<Response>): Promise<Response> {
  try {
    return await request();
  } catch (error) {
    if (error.status === 429) {
      throw error; // Fail fast - let caller handle appropriately
    }
    if (error.status >= 500) {
      await exponentialBackoff();
      return requestWithBackoff(request); // Network errors can recover
    }
    throw error;
  }
}
```

## Generalization Guidance

When encountering rate limiting or quota issues:
1. Do NOT implement workarounds (delays, retries, artificial limits)
2. Analyze the actual usage patterns and error frequency
3. Consult with humans before implementing any solution
4. Request quota increases from providers if needed

When evaluating defensive patterns:
- Identify the actual threat model and deployment context
- Only implement defenses for real, applicable threats
- Fail fast on errors that should not be retried
- Consult with humans before adding complex error handling
## Anti-Patterns (What This Rule Does NOT Cover)
- Rate limit detection and error classification (always appropriate)
- Network retry for 5xx errors that can recover
- Authentication and input validation for actual security threats

---

## TEST CODE RULES (Apply only to test/ files)

### T1. Real Service Integration Testing

## Intent
Tests should surface real issues by integrating with actual services rather than hiding problems behind mocks, enabling quick identification and resolution of root causes.

## Category Pattern
This encompasses violations where tests:
- Hide real service issues behind simulation layers
- Create false confidence through mocked behavior that doesn't match reality
- Prevent discovery of integration problems that would occur in production

## Recognition Signals
- Signal: Artificial service simulation
  Examples: Mock HTTP responses, stubbed API calls, dryRun modes that skip real operations
  But also: Test doubles that don't reflect actual service behavior

- Signal: Error suppression that hides real issues
  Examples: try/catch blocks that silence legitimate API errors
  But also: Compatibility layers that work around real service problems

## Diverse Examples (Non-Exhaustive)

### Example 1: Real API Integration
```typescript
// ✅ COMPLIANT: Test calls real Gmail API
test('create and delete label', async () => {
  const gmail = await createGmailClient();
  const label = await gmail.labels.create({ name: 'test-label-' + Date.now() });
  expect(label.id).toBeTruthy();
  await gmail.labels.delete({ id: label.id });
});
```

### Example 2: Mock API Violation
```typescript
// ❌ VIOLATION: Mock hides real service behavior
const mockGmail = {
  labels: {
    create: jest.fn().mockResolvedValue({ id: 'fake-id' }),
    delete: jest.fn().mockResolvedValue({})
  }
};
// VIOLATION REASON: Doesn't test real API integration
```

### Example 3: Error Suppression Violation
```typescript
// ❌ VIOLATION: Hiding legitimate API errors
test('gmail operations', async () => {
  try {
    await gmail.labels.create({ name: 'test' });
  } catch (error) {
    // Silently ignore errors instead of investigating
    console.log('Ignoring API error');
  }
});
// VIOLATION REASON: Should investigate and fix root cause
```

## Generalization Guidance
Ask yourself:
1. Does this test verify real service behavior or simulated behavior?
2. Would this test catch issues that would occur when using real services?
3. Are errors being properly investigated rather than worked around?

## Anti-Patterns (What This Rule Does NOT Cover)
- Testing internal logic that doesn't require external services
- Using real services with proper cleanup and isolation
- Investigating and fixing errors rather than suppressing them

---

### T2. Local Test Data Management

## Intent
Test data should be managed locally and cleaned up reliably without creating testing infrastructure that becomes a maintenance burden or obscures test logic.

## Category Pattern
This encompasses violations where test data management:
- Creates abstraction layers that hide what tests actually do
- Introduces shared state or dependencies between tests
- Makes tests harder to understand, debug, or run in isolation

## Recognition Signals
- Signal: Test abstraction that hides operations
  Examples: TestDataManager classes, cleanup frameworks, shared test state
  But also: Helper functions that do too much, test utilities that maintain state

- Signal: Cross-test dependencies or shared lifecycle
  Examples: Global cleanup hooks, shared test databases, test data that persists
  But also: Tests that depend on execution order, cleanup that affects other tests

## Diverse Examples (Non-Exhaustive)

### Example 1: Simple Local Management
```typescript
// ✅ COMPLIANT: Local, visible, simple tracking
test('email operations', async () => {
  const createdEmails: string[] = [];
  try {
    const email = await api.createEmail({ subject: 'test' });
    createdEmails.push(email.id);
    // Test logic is visible and clear
  } finally {
    for (const id of createdEmails) await api.deleteEmail(id);
  }
});
```

### Example 2: Over-Abstracted Management Violation
```typescript
// ❌ VIOLATION: Creates testing framework complexity
class TestEmailManager {
  private created: Set<string> = new Set();
  async createTestEmail(): Promise<Email> {
    const email = await api.createEmail({ subject: 'test' });
    this.created.add(email.id);
    return email;
  }
  async cleanup() { /* complex cleanup logic */ }
}
// VIOLATION REASON: Hides what tests actually do
```

### Example 3: Acceptable Helper Function
```typescript
// ✅ COMPLIANT: Focused utility in test/lib/, no hidden state
// test/lib/email-helpers.ts
export async function createTempEmail(api: EmailAPI, subject: string): Promise<Email> {
  return api.createEmail({ subject, labels: ['temp-test'] });
}
```

## Generalization Guidance
Ask yourself:
1. Can I understand what this test does just by reading the test function?
2. Would this test still work if copied to a different file?
3. Does the cleanup/management add clarity or hide important operations?

## Anti-Patterns (What This Rule Does NOT Cover)
- Simple helper functions for common operations (create/delete, wait/poll)
- Local arrays and variables for tracking test data
- Self-contained tests that manage their own lifecycle

---

### T3. One-to-One Test File Mapping

## Intent
Test organization should mirror source code structure to make it easy to find tests for any given functionality and ensure comprehensive coverage without navigation complexity.

## Category Pattern
This encompasses violations where test organization:
- Scatters tests for one source file across multiple test files
- Groups unrelated tests based on arbitrary organizational schemes
- Makes it difficult to find or run tests for specific functionality

## Recognition Signals
- Signal: Multiple test files for one source file
  Examples: auth.test.ts, auth-validation.test.ts, auth-errors.test.ts for one auth.ts
  But also: Test files organized by test type rather than source code structure

- Signal: Mixed functionality tests in single files
  Examples: Testing multiple unrelated source files in one test file
  But also: Organizational schemes that don't match source structure

## Diverse Examples (Non-Exhaustive)

### Example 1: One-to-One Mapping
```typescript
// ✅ COMPLIANT: Clear mapping between source and tests
// src/email-validator.ts → test/email-validator.test.ts
// src/auth/provider.ts → test/auth/provider.test.ts
```

### Example 2: Scattered Test Files Violation
```typescript
// ❌ VIOLATION: Multiple test files for one source file
// src/auth.ts maps to:
// test/auth-basic.test.ts
// test/auth-errors.test.ts
// test/auth-integration.test.ts
// VIOLATION REASON: Should use describe blocks in one file
```

### Example 3: Proper Test Organization
```typescript
// ✅ COMPLIANT: Use describe blocks for scenarios
// test/auth.test.ts
describe('Authentication', () => {
  describe('basic auth flow', () => { ... });
  describe('error handling', () => { ... });
  describe('integration scenarios', () => { ... });
});
```

## Generalization Guidance
Ask yourself:
1. Is there a clear, predictable mapping between source files and test files?
2. Can I easily find all tests for a specific piece of functionality?
3. Would someone looking for tests know exactly which file to check?

## Anti-Patterns (What This Rule Does NOT Cover)
- Using describe blocks to organize scenarios within a single test file
- Having one test file per source file even if some source files have no tests
- Clear mapping that follows source code structure

---

### T4. Consistent Test Dependencies and Patterns

## Intent
Tests should use consistent patterns for setup and dependencies, making it easy for contributors to understand and maintain test code across the project.

## Category Pattern
This encompasses violations where tests:
- Use inconsistent setup patterns that make tests hard to understand
- Don't follow established project conventions for test dependencies
- Create confusion about how to structure new tests

## Recognition Signals
- Signal: Mixed test setup patterns
  Examples: Some tests use createMiddleware(), others use different setup approaches
  But also: Inconsistent patterns for similar test scenarios

- Signal: Weak typing in test code
  Examples: Using any types, untyped test data, missing type assertions
  But also: Test patterns that don't leverage TypeScript's type safety

## Diverse Examples (Non-Exhaustive)

### Example 1: Consistent Context Creation
```typescript
// ✅ COMPLIANT: Uses established createMiddleware() pattern
test('tool operations', async () => {
  const {withAuth} = await createMiddleware();
  const tool = createTool();
  const wrappedTool = withAuth.forTool(tool);
  // Strongly typed middleware with all necessary setup
});
```

### Example 2: Inconsistent Setup Violation
```typescript
// ❌ VIOLATION: Different test uses ad-hoc setup
test('tool operations', async () => {
  const config = { clientId: 'test', secret: 'test' }; // Manual setup
  const client = new Client(config);
  // VIOLATION REASON: Should use createMiddleware() like other tests
});
```

### Example 3: Strong Test Typing
```typescript
// ✅ COMPLIANT: Strongly typed test data and assertions
interface TestEmailData {
  readonly subject: string;
  readonly body: string;
}

test('email processing', async () => {
  const testEmail: TestEmailData = {
    subject: 'Test Subject',
    body: 'Test Body'
  };
  const result = await processEmail(testEmail);
  expect(result.processed).toBe(true);
});
```

## Generalization Guidance
Ask yourself:
1. Does this test follow the same patterns as similar tests in the project?
2. Would a new contributor understand how to structure a similar test?
3. Is the test using strong typing consistent with the project's TypeScript standards?

## Anti-Patterns (What This Rule Does NOT Cover)
- Tests that follow established project patterns consistently
- Strongly typed test code that leverages TypeScript
- Setup patterns that are consistent across similar test scenarios

---

### T5. Meaningful Test Coverage After Stabilization

## Intent
Test coverage should focus on providing value after the API surface has stabilized, rather than creating tests that become maintenance burdens during active development.

## Category Pattern
This encompasses violations where testing:
- Creates comprehensive test suites for APIs that are still changing frequently
- Focuses on test coverage metrics rather than meaningful verification
- Tests implementation details that are likely to change during development

## Recognition Signals
- Signal: Extensive testing of unstable APIs
  Examples: Full test suites for experimental features, testing internal implementation details
  But also: Tests that break frequently due to ongoing API changes

- Signal: Coverage-driven rather than value-driven testing
  Examples: Testing every function just to achieve coverage targets
  But also: Tests that don't verify meaningful behavior

## Diverse Examples (Non-Exhaustive)

### Example 1: Stable API Testing
```typescript
// ✅ COMPLIANT: Test stable, public API after completing stabilization work
test('email authentication flow', async () => {
  // Tests established, stable authentication API
  const auth = await authenticateEmailProvider(credentials);
  expect(auth.isValid).toBe(true);
});
```

### Example 2: Premature Testing Violation
```typescript
// ❌ VIOLATION: Testing unstable implementation during active development
test('internal email parser helper', () => {
  // Testing private implementation that's still being developed
  const parser = new EmailParserInternal();
  // VIOLATION REASON: Implementation is likely to change
});
```

### Example 3: Value-Focused Testing
```typescript
// ✅ COMPLIANT: Tests meaningful user-facing behavior
test('complete email workflow', async () => {
  // Tests end-to-end behavior that provides real value
  const email = await sendEmail(recipient, message);
  const delivered = await verifyDelivery(email.id);
  expect(delivered).toBe(true);
});
```

## Generalization Guidance
Ask yourself:
1. Is the API surface stable enough that tests won't need frequent updates?
2. Does this test verify meaningful behavior rather than just achieving coverage?
3. Would this test provide value in catching real regressions?

## Anti-Patterns (What This Rule Does NOT Cover)
- Testing stable, public APIs that provide real value
- End-to-end tests that verify complete workflows
- Tests that catch meaningful regressions in stable functionality

---

### T6. Failure Investigation Over Test Disabling

## Intent
Test failures should lead to investigation and fixes rather than test modification, ensuring tests continue to surface real issues and maintain confidence in system reliability.

## Category Pattern
This encompasses violations where test failures:
- Are resolved by modifying tests rather than investigating root causes
- Lead to test disabling rather than fixing underlying issues
- Result in reduced test coverage instead of improved system reliability

## Recognition Signals
- Signal: Test modification to avoid failures
  Examples: Changing assertions to match current behavior, adding guards to prevent failures
  But also: Weakening test conditions to avoid investigating real issues

- Signal: Test disabling for convenience
  Examples: Skipping tests due to environment issues, disabling flaky tests
  But also: Removing tests that expose real system problems

## Diverse Examples (Non-Exhaustive)

### Example 1: Proper Failure Investigation
```typescript
// ✅ COMPLIANT: Test failure leads to root cause investigation
test('email delivery confirmation', async () => {
  const email = await sendEmail(recipient, message);
  // If this fails, investigate why delivery confirmation isn't working
  expect(email.deliveryStatus).toBe('confirmed');
});
```

### Example 2: Test Weakening Violation
```typescript
// ❌ VIOLATION: Weakening test to avoid investigating failure
test('email delivery confirmation', async () => {
  const email = await sendEmail(recipient, message);
  // Changed from 'confirmed' to avoid investigating delivery issues
  expect(email.deliveryStatus).toMatch(/confirmed|pending/);
});
// VIOLATION REASON: Should investigate why confirmation isn't working
```

### Example 3: Environment Fix Rather Than Test Skip
```typescript
// ✅ COMPLIANT: Fix environment rather than skip test
test('gmail integration', async () => {
  // Instead of { skip: !process.env.GMAIL_TOKEN }
  // Fix the environment setup and investigate configuration issues
  const gmail = await createGmailClient();
  expect(gmail).toBeTruthy();
});
```

## Generalization Guidance
Ask yourself:
1. Does this test failure indicate a real system issue that should be investigated?
2. Would fixing the root cause improve overall system reliability?
3. Is test modification hiding a problem that should be solved?

## Anti-Patterns (What This Rule Does NOT Cover)
- Investigating and fixing real system issues exposed by test failures
- Improving test design based on better understanding of requirements
- Temporary test adjustments during active investigation of root causes

---

### T7. Explicit Environment Requirements

## Intent
Tests should fail fast and clearly when environment configuration is incorrect, making it obvious what needs to be fixed rather than working around configuration issues.

## Category Pattern
This encompasses violations where tests:
- Hide configuration issues behind conditional skipping
- Work around missing environment setup instead of surfacing problems
- Create unclear failure modes that don't indicate what needs to be fixed

## Recognition Signals
- Signal: Conditional test skipping based on environment
  Examples: { skip: !ENV_VAR }, tests that silently pass when misconfigured
  But also: Tests that work around missing configuration instead of failing clearly

- Signal: Unclear failure modes for configuration issues
  Examples: Tests that fail with generic errors when environment is wrong
  But also: Tests that partially work with incorrect configuration

## Diverse Examples (Non-Exhaustive)

### Example 1: Clear Environment Requirement
```typescript
// ✅ COMPLIANT: Fail fast with clear error for missing config
test('gmail operations', async () => {
  const clientId = requiredEnv('GMAIL_CLIENT_ID'); // Throws clear error
  const context = await createGmailContext({ clientId });
  // Test proceeds with proper configuration
});
```

### Example 2: Silent Skip Violation
```typescript
// ❌ VIOLATION: Hides configuration issues
test('gmail operations', async () => {
  if (!process.env.GMAIL_CLIENT_ID) {
    test.skip(); // Silently skips instead of surfacing configuration problem
    return;
  }
});
// VIOLATION REASON: Should fail clearly to surface configuration issues
```

### Example 3: Proper Configuration Validation
```typescript
// ✅ COMPLIANT: Test validates required configuration exists
function requiredEnv(key: string): string {
  if (!process.env[key]) {
    throw new Error(`Environment variable ${key} is required for this test`);
  }
  return process.env[key];
}
```

## Generalization Guidance
Ask yourself:
1. Does this test clearly indicate what configuration is missing when it fails?
2. Would someone running this test understand how to fix configuration issues?
3. Is the test surfacing real configuration problems rather than hiding them?

## Anti-Patterns (What This Rule Does NOT Cover)
- Tests that fail clearly with helpful error messages for configuration issues
- Environment validation that makes requirements explicit
- Clear documentation of what environment setup is needed for tests

---

### T8. Secure Test Data Storage

## Intent
Test data should be stored in designated areas to prevent accidental commits of sensitive information and maintain clear separation between test artifacts and source code.

## Category Pattern
This encompasses violations where test data:
- Is created in source code directories where it might be accidentally committed
- Contains or could contain sensitive information that shouldn't be in version control
- Lacks clear separation between temporary test artifacts and permanent project files

## Recognition Signals
- Signal: Test data files in source directories
  Examples: Creating files in src/, auth/, or other production code areas during tests
  But also: Test artifacts scattered throughout the project structure

- Signal: Potential for sensitive data exposure
  Examples: Test files that could contain real credentials, PII, or tokens
  But also: Test data that persists across test runs in unsecured locations

## Diverse Examples (Non-Exhaustive)

### Example 1: Proper Test Data Location
```typescript
// ✅ COMPLIANT: Test data in designated areas
test('file processing', async () => {
  const testFile = path.join(STORE_DIR, 'test-data.json'); // Uses STORE_DIR
  await writeTestData(testFile, sampleData);
  // Test operations...
  await fs.unlink(testFile); // Cleanup
});
```

### Example 2: Source Directory Violation
```typescript
// ❌ VIOLATION: Creating test data in source code area
test('config processing', async () => {
  const configFile = './src/test-config.json'; // Wrong location
  await fs.writeFile(configFile, JSON.stringify(testConfig));
  // VIOLATION REASON: Could be accidentally committed with source code
});
```

### Example 3: Temporary Directory Usage
```typescript
// ✅ COMPLIANT: Using proper temporary areas
test('data processing', async () => {
  const tempDir = path.join('.tmp', 'test-' + Date.now());
  await fs.mkdir(tempDir, { recursive: true });
  // Test operations in temporary area
  await fs.rm(tempDir, { recursive: true }); // Cleanup
});
```

## Generalization Guidance
Ask yourself:
1. Could this test data be accidentally committed to version control?
2. Is test data clearly separated from production source code?
3. Would this test data location create security or privacy concerns?

## Anti-Patterns (What This Rule Does NOT Cover)
- Using designated test data directories (.tmp/, STORE_DIR)
- Test data that is clearly temporary and properly cleaned up
- Test configurations that don't contain sensitive information

---

### T9. Self-Contained Portable Tests

## Intent
Tests should be self-contained and moveable, not dependent on shared infrastructure or cross-file dependencies that would break if the test were copied to a different location.

## Category Pattern
This encompasses violations where tests:
- Depend on shared test infrastructure that exists outside the test file
- Have hidden dependencies on other test files or global setup
- Would break if copied to a different project or directory structure

## Recognition Signals
- Signal: Dependencies on shared test infrastructure
  Examples: Global test setup, shared state, test utilities that maintain state
  But also: Implicit dependencies on test execution order or global configuration

- Signal: Cross-file test dependencies
  Examples: Tests that depend on other tests running first, shared test data
  But also: Tests that rely on global state set by other test files

## Diverse Examples (Non-Exhaustive)

### Example 1: Self-Contained Test
```typescript
// ✅ COMPLIANT: All dependencies explicit and local
test('email validation', async () => {
  // All setup within the test
  const emailValidator = new EmailValidator();
  const testEmail = 'test@example.com';

  const result = emailValidator.validate(testEmail);
  expect(result.isValid).toBe(true);

  // No external dependencies or cleanup needed
});
```

### Example 2: Shared Infrastructure Violation
```typescript
// ❌ VIOLATION: Depends on global test setup
test('user authentication', async () => {
  // Relies on global testUser set up elsewhere
  const result = await authenticateUser(globalTestUser); // Hidden dependency
  expect(result.success).toBe(true);
});
// VIOLATION REASON: Wouldn't work if copied to different project
```

### Example 3: Portable Test with Local Setup
```typescript
// ✅ COMPLIANT: Self-contained with explicit setup
test('gmail operations', async () => {
  // All setup explicit and local
  const credentials = {
    clientId: requiredEnv('GMAIL_CLIENT_ID'),
    clientSecret: requiredEnv('GMAIL_CLIENT_SECRET')
  };

  const gmail = await createGmailClient(credentials);
  // Test operations...

  // Cleanup is also local and explicit
  await gmail.cleanup();
});
```

## Generalization Guidance
Ask yourself:
1. Would this test work if copied to a completely different project?
2. Are all dependencies explicit and contained within the test file?
3. Does this test rely on any global state or shared infrastructure?

## Anti-Patterns (What This Rule Does NOT Cover)
- Tests that explicitly import and use required dependencies
- Self-contained tests that include all necessary setup and cleanup
- Tests that use only local variables and explicit dependencies

---

### T10. Function-Based Test Organization

## Absolute Requirement
**NEVER create classes for test validation, data management, or tracking within test files.**

## Intent
Test code should avoid class-based organization that can lead to over-engineering and instead use simple functions and variables that keep tests understandable and maintainable.

## Category Pattern
This encompasses violations where test organization:
- Uses class structures that add complexity without providing benefit
- Creates object-oriented patterns that obscure test logic
- Introduces abstraction layers that make tests harder to understand

## Recognition Signals
- Signal: Class-based test organization
  Examples: Test classes, class-based test utilities, object-oriented test patterns
  But also: Class instances used for test state management or validation

- Signal: Over-engineered test structure
  Examples: Inheritance hierarchies in tests, abstract test classes
  But also: Complex test organization that requires understanding OOP patterns

## VIOLATION REMEDIATION (T10/T11)
**PRINCIPLE**: Test classes indicate over-engineering. Remove entirely, use existing production validation or simple inline logic instead.
**Escalation**: For test helper categorization and edge cases, consult the test-automator agent.

## Diverse Examples (Non-Exhaustive)

### Example 1: Simple Function-Based Test
```typescript
// ✅ COMPLIANT: Simple, clear test organization
test('email processing', async () => {
  const testEmails = ['test1@example.com', 'test2@example.com'];
  const results = [];

  for (const email of testEmails) {
    const result = await processEmail(email);
    results.push(result);
  }

  expect(results.every(r => r.success)).toBe(true);
});
```

### Example 2: Class-Based Test Violation
```typescript
// ❌ VIOLATION: Unnecessary class structure in tests
class EmailTestSuite {
  private testData: Email[] = [];

  async setupTestEmails() { ... }
  async validateResults() { ... }
  async cleanup() { ... }
}
// VIOLATION REASON: Simple variables and functions would be clearer
```

### Example 3: Simple Helper Functions (When Needed)
```typescript
// ✅ COMPLIANT: Simple helper functions in test/lib/ if needed
// test/lib/email-helpers.ts
export async function createTestEmail(subject: string): Promise<Email> {
  return { id: generateId(), subject, body: 'Test body' };
}

// Used simply in tests without class structure
test('email operations', async () => {
  const email = await createTestEmail('Test Subject');
  // Simple, clear test logic
});
```

## Generalization Guidance
Ask yourself:
1. Does this test organization use simple, understandable patterns?
2. Would a new contributor immediately understand the test structure?
3. Is class structure adding value or just complexity?

## Anti-Patterns (What This Rule Does NOT Cover)
- Simple functions and variables for test organization
- Helper functions that don't maintain state or add complexity
- Clear, functional test patterns that are easy to understand

---

### T11. Simple Test Implementation Patterns

## Absolute Requirement
**NEVER use `class` keyword in test files unless explicitly required for interface/type definitions.**

## Intent
Test implementation should use the simplest patterns possible, avoiding class-based patterns or complex abstractions that make tests harder to understand and maintain.

## Category Pattern
This encompasses violations where test implementation:
- Uses class keyword when simple functions and variables would work
- Creates complex abstractions that obscure what tests actually do
- Introduces patterns that require advanced language knowledge to understand

## Recognition Signals
- Signal: Class keyword usage in test files
  Examples: `class TestValidator`, `class TestHelper`, any class instantiation in tests
  But also: Object-oriented patterns that could be replaced with functions

- Signal: Complex test abstractions
  Examples: Test frameworks, validation classes, state management classes
  But also: Patterns that require understanding inheritance, polymorphism, or other OOP concepts

## VIOLATION REMEDIATION (T10/T11)
**PRINCIPLE**: Test classes indicate over-engineering. Remove entirely, use existing production validation or simple inline logic instead.
**Escalation**: For test helper categorization and edge cases, consult the test-automator agent.

## Diverse Examples (Non-Exhaustive)

### Example 1: Simple Variable Tracking
```typescript
// ✅ COMPLIANT: Simple variables for test state
test('email operations', async () => {
  const createdEmails: string[] = []; // Simple array tracking

  try {
    const email = await createEmail('test');
    createdEmails.push(email.id);
    // Test logic...
  } finally {
    for (const id of createdEmails) await deleteEmail(id);
  }
});
```

### Example 2: Class-Based Test Implementation Violation
```typescript
// ❌ VIOLATION: Using class in test implementation
class TestEmailValidator {
  validate(email: string): boolean { ... }
  cleanup(): void { ... }
}

test('email validation', () => {
  const validator = new TestEmailValidator(); // Class instantiation
  // VIOLATION REASON: Simple function would be clearer
});
```

### Example 3: Simple Replacement Approach
```typescript
// ✅ COMPLIANT: Replace test classes with existing solutions
test('email validation', () => {
  // Instead of custom validator class, use existing validation
  const isValid = validateEmail('test@example.com'); // Use standard function
  expect(isValid).toBe(true);
});
```

## Generalization Guidance
Ask yourself:
1. Can this be implemented with simple functions and variables?
2. Would a contributor with basic JavaScript knowledge understand this pattern?
3. Is the class structure providing real benefit or just adding complexity?

**Replacement Strategy**: When removing test classes, don't create functional equivalents. Instead:
- Use `test/lib/*` utilities for allowed helper categories
- Use simple inline code for local operations

## Anti-Patterns (What This Rule Does NOT Cover)
- Simple functions and variables for test implementation
- Using existing standard libraries and utilities
- Clear, functional patterns that avoid class-based complexity

---

### T12. Test File Location and Structure

## Intent
Test files should be located in predictable directories that mirror source structure and prevent confusion about which domain they test, making it easy to find and run tests for specific functionality.

## Category Pattern
This encompasses violations where test placement:
- Creates confusion about which code domain the test covers
- Places tests in locations that don't mirror source structure
- Mixes tests for different services or domains
- Creates ambiguity about test ownership and scope

## Recognition Signals
- Signal: Tests placed outside domain-specific test directories
  Examples: Test files in package root, tests in wrong package directory
  But also: Integration tests that span multiple domains without clear ownership

- Signal: Test structure that doesn't mirror source organization
  Examples: Flat test organization when source has clear hierarchy
  But also: Test files grouped by test type rather than source code structure

- Signal: Cross-domain test confusion
  Examples: Gmail tests in Outlook test directory, generic tests without domain context
  But also: Shared test utilities that could belong to multiple domains

## Diverse Examples (Non-Exhaustive)

### Example 1: Correct Test Placement
```typescript
// ✅ COMPLIANT: Tests mirror source structure
// Source: src/mcp/tools/message-search.ts
// Test:   test/unit/mcp/tools/message-search.test.ts
// Clear domain ownership and mirrored structure
```

### Example 2: Root-Level Test Violation
```typescript
// ❌ VIOLATION: Test in wrong location
// Root level: message-search.test.ts
// VIOLATION REASON: Test should be in test/unit/ directory with proper organization
```

### Example 3: Integration Test
```typescript
// ✅ COMPLIANT: Integration test with clear scope
// test/integration/api-validation.integration.test.ts
// Tests cross-cutting functionality with clear purpose
```

### Example 4: Shared Test Utilities Location
```typescript
// ✅ COMPLIANT: Shared utilities in appropriate location
// test/lib/create-middleware.ts - Common test setup utilities
// test/lib/create-extra.ts - Test context helpers
```

## Generalization Guidance
Ask yourself:
1. Would someone immediately know which code domain this test covers from its location?
2. Does the test directory structure mirror the source code organization?
3. If this is an integration test, is its scope and ownership clear?

**Context**: Test-Only

**Escalation**: For complex test organization scenarios and cross-domain integration patterns, consult the test-automator agent.

## Anti-Patterns (What This Rule Does NOT Cover)
- Tests that are clearly placed in domain-specific directories
- Integration tests with explicit scope and ownership
- Test utilities that are appropriately scoped to their domain

---

## EXPERT ESCALATION FRAMEWORK

When implementation decisions require interpretation of quality principles, escalate to specialized agents rather than making arbitrary choices.

### ESCALATION TRIGGERS
- File/package structure decisions that could go multiple ways
- "Multiple domain" determinations for package exports
- Entry point classification for non-standard startup files
- Purpose-based naming when function scope is unclear
- Test helper categorization for edge cases

### ESCALATION THRESHOLDS
- **2+ viable interpretations** of a rule → Escalate
- **Cross-cutting concerns** across multiple rules → Escalate
- **Novel patterns** not covered in examples → Escalate
- **"It depends" responses** to rule questions → Escalate

### AGENT ESCALATION MATRIX
| Situation | Agent Type | Analysis Required |
|-----------|------------|-------------------|
| Entry point classification | `architect-reviewer` | Analyze file role against U15 principles |
| Package export boundaries | `architect-reviewer` | Evaluate domain separation per U18 criteria |
| File naming/grouping | `architect-reviewer` | Apply U3 cohesive grouping principles |
| Test infrastructure scope | `test-automator` | Assess helper necessity against T2 rules |
| Test file organization | `test-automator` | Apply T12 test placement principles to complex scenarios |
| Type safety thresholds | `typescript-pro` | Evaluate U13 .d.ts creation triggers |
| Environment configuration | `architect` | Evaluate patterns per `docs/environments.md` |

### ESCALATION PROMPT TEMPLATE
"Analyze [specific situation] against QUALITY.md rule [UX/TX]. Apply the existing principles to determine the correct approach. If the situation reveals a gap in the rules, recommend specific guidance to add."

### POST-ESCALATION ACTIONS
1. **Document the decision** in code comments referencing the analysis
2. **Update QUALITY.md** if the analysis reveals missing guidance
3. **Create precedent** for similar future cases

## ENFORCEMENT

Any proposal that creates new classes, frameworks, or centralized infrastructure for simple code quality fixes will be IMMEDIATELY REJECTED. This is an open-source community project - keep solutions simple enough that any contributor can understand and maintain them. Agents must implement the simplest possible solution within existing files. Violations of the CRITICAL CONSTRAINTS or use of REJECTED PATTERNS will result in automatic rejection of the entire proposal.