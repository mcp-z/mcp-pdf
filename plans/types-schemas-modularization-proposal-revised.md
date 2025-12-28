# Revised Types and Schemas Modularization Proposal

## Key Correction from Feedback

**DO NOT move tool-specific input/output schemas** - these should remain in their respective tool files. The focus should be on:
- Reusable types that are used across multiple tools
- Shared schemas that can be imported and reused
- Common interfaces and type definitions

## Current State Analysis

### Tool-Specific Items (WILL NOT MOVE)
- `inputSchema` in pdf-document.ts
- `outputSchema` in pdf-document.ts  
- `inputSchema` in pdf-layout.ts
- `outputSchema` in pdf-layout.ts
- `inputSchema` in pdf-resume.ts
- `outputSchema` in pdf-resume.ts

### Reusable Items (CAN MOVE)

#### From pdf-document.ts:
- `flowingContentItemSchema` - reusable content item schema
- `FlowingContentItem` type - reusable type

#### From pdf-layout.ts:
- `sizeSchema` - reusable size definition
- `borderSchema` - reusable border definition  
- `paddingSchema` - reusable padding definition
- `positionedTextSchema` - reusable text with positioning
- `BaseContentItem` type - reusable base content type
- `GroupItem` interface - reusable group type
- `ContentItem` type - reusable content union type

#### From pdf-resume.ts:
- `sectionConfigSchema` - reusable section configuration
- `dividerConfigSchema` - reusable divider configuration
- `fieldTemplatesSchema` - reusable field templates
- `columnConfigSchema` - reusable column configuration

#### Already Shared (in good location):
- `textBaseSchema` in pdf-core.ts
- `pdfOutputSchema` in pdf-core.ts
- Typography types in src/lib/types/typography.ts
- IR types in src/lib/ir/types.ts
- Yoga resume types in src/lib/yoga-resume/types.ts

## Revised Modularization Plan

### Guiding Principles

1. **Focus on Reusability**: Only move types/schemas that are used across multiple tools
2. **Keep Tool-Specific Items**: Input/output schemas stay in tool files
3. **Improve Organization**: Group related reusable types together
4. **Maintain Backward Compatibility**: Ensure existing code continues to work

### Proposed Structure

```
src/
├── types/
│   ├── index.ts                  # Main exports
│   ├── content.ts               # Reusable content item types
│   └── layout.ts                # Reusable layout types
│
├── schemas/
│   ├── index.ts                 # Main exports  
│   ├── content.ts               # Reusable content schemas
│   ├── layout.ts                # Reusable layout schemas
│   └── resume.ts                 # Reusable resume schemas
│
└── constants.ts                # Keep existing constants
```

### Specific Changes

#### 1. Create Content Types (`src/types/content.ts`)
```typescript
// Move reusable content types here
export type FlowingContentItem = ...
export type BaseContentItem = ...
export type ContentItem = ...
export interface GroupItem { ... }
```

#### 2. Create Layout Types (`src/types/layout.ts`)
```typescript
// Move reusable layout types here
export type Size = number | string;
export interface Border { ... }
export type Padding = number | { top?: number; right?: number; bottom?: number; left?: number };
```

#### 3. Create Content Schemas (`src/schemas/content.ts`)
```typescript
// Move reusable content schemas here
export const flowingContentItemSchema = z.union([...]);
export const positionedTextSchema = textBaseSchema.extend({ ... });
export const baseContentItemSchema = z.union([...]);
```

#### 4. Create Layout Schemas (`src/schemas/layout.ts`)
```typescript
// Move reusable layout schemas here
export const sizeSchema = z.union([z.number(), z.string().regex(/^\d+(\.\d+)?%$/)]);
export const borderSchema = z.object({ ... });
export const paddingSchema = z.union([...]);
```

#### 5. Create Resume Schemas (`src/schemas/resume.ts`)
```typescript
// Move reusable resume schemas here
export const sectionConfigSchema = z.object({ ... });
export const dividerConfigSchema = z.object({ ... });
export const fieldTemplatesSchema = z.object({ ... });
export const columnConfigSchema = z.object({ ... });
```

#### 6. Update Tool Files to Import Reusable Types
```typescript
// In pdf-document.ts
import { FlowingContentItem } from '../../types/content.ts';
import { flowingContentItemSchema } from '../../schemas/content.ts';

// Tool-specific input/output schemas stay here
const inputSchema = z.object({ ... });
```

#### 7. Update Exports
```typescript
// src/types/index.ts
export * from './content.ts';
export * from './layout.ts';

// src/schemas/index.ts  
export * from './content.ts';
export * from './layout.ts';
export * from './resume.ts';
```

### What Stays in Tool Files

1. **pdf-document.ts**:
   - `inputSchema` (tool-specific)
   - `outputSchema` (tool-specific)
   - Tool configuration and handler

2. **pdf-layout.ts**:
   - `inputSchema` (tool-specific)
   - `outputSchema` (tool-specific)
   - `layoutSchema` (tool-specific layout config)
   - Tool configuration and handler

3. **pdf-resume.ts**:
   - `inputSchema` (tool-specific)
   - `outputSchema` (tool-specific)
   - `layoutSchema` (tool-specific layout config)
   - `stylingSchema` (tool-specific styling)
   - Tool configuration and handler

### Implementation Steps

1. **Create new type files** in `src/types/` directory
2. **Create new schema files** in `src/schemas/` directory
3. **Move only reusable types/schemas** to new files
4. **Update imports** in tool files to use new modular structure
5. **Update exports** for easy access
6. **Test** to ensure no functionality is broken

### Benefits

1. **Better Organization**: Clear separation between reusable and tool-specific code
2. **Improved Reusability**: Common types can be imported where needed
3. **Easier Maintenance**: Changes to shared types are centralized
4. **Cleaner Tool Files**: Tools focus on their specific functionality
5. **Backward Compatibility**: No breaking changes to tool interfaces

### Risks and Mitigations

1. **Circular Dependencies**: Careful organization and import structure
2. **Testing Complexity**: Comprehensive testing of imports and exports
3. **Refactoring Errors**: Step-by-step implementation with testing at each stage

## Next Steps

1. Get approval on this revised proposal
2. Implement the modularization step by step
3. Test thoroughly to ensure no regressions
4. Update documentation as needed