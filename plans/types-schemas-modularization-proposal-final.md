# Final Types and Schemas Modularization Proposal

## Key Feedback Implementation

**Consolidate all reusable types into `src/types.ts`** - there's insufficient volume to justify a `src/types/*` directory structure.

## Final Proposed Structure

```
src/
├── types.ts                     # Single file for all reusable types
├── schemas/
│   ├── index.ts                 # Main exports  
│   ├── content.ts               # Reusable content schemas
│   ├── layout.ts                # Reusable layout schemas
│   └── resume.ts                # Reusable resume schemas
│
└── constants.ts                # Keep existing constants
```

## What Will Be Moved to `src/types.ts`

### From pdf-document.ts:
- `FlowingContentItem` type (reusable)

### From pdf-layout.ts:
- `BaseContentItem` type (reusable)
- `ContentItem` type (reusable) 
- `GroupItem` interface (reusable)

### From pdf-resume.ts:
- No additional types (all are covered by existing IR types in `src/lib/ir/types.ts`)

## What Will Be Moved to `src/schemas/`

### Content Schemas (`src/schemas/content.ts`):
```typescript
// From pdf-document.ts
export const flowingContentItemSchema = z.union([...]);

// From pdf-layout.ts  
export const positionedTextSchema = textBaseSchema.extend({ ... });
export const baseContentItemSchema = z.union([...]);
```

### Layout Schemas (`src/schemas/layout.ts`):
```typescript
// From pdf-layout.ts
export const sizeSchema = z.union([z.number(), z.string().regex(/^\d+(\.\d+)?%$/)]);
export const borderSchema = z.object({ color: z.string(), width: z.number() });
export const paddingSchema = z.union([z.number(), z.object({ ... })]);
```

### Resume Schemas (`src/schemas/resume.ts`):
```typescript
// From pdf-resume.ts
export const sectionConfigSchema = z.object({ ... });
export const dividerConfigSchema = z.object({ ... });
export const fieldTemplatesSchema = z.object({ ... });
export const columnConfigSchema = z.object({ ... });
```

## What Stays in Tool Files

### pdf-document.ts:
- `inputSchema` (tool-specific)
- `outputSchema` (tool-specific)  
- `FlowingContentItem` type removed (moved to src/types.ts)
- `flowingContentItemSchema` removed (moved to src/schemas/content.ts)

### pdf-layout.ts:
- `inputSchema` (tool-specific)
- `outputSchema` (tool-specific)
- `layoutSchema` (tool-specific)
- `BaseContentItem` type removed (moved to src/types.ts)
- `ContentItem` type removed (moved to src/types.ts)
- `GroupItem` interface removed (moved to src/types.ts)
- All layout schemas removed (moved to src/schemas/)

### pdf-resume.ts:
- `inputSchema` (tool-specific)
- `outputSchema` (tool-specific)
- `layoutSchema` (tool-specific)
- `stylingSchema` (tool-specific)
- All resume schemas removed (moved to src/schemas/)

## Implementation Steps

1. **Move reusable types to `src/types.ts`**:
   ```typescript
   // src/types.ts additions
   export type FlowingContentItem = z.infer<typeof flowingContentItemSchema>;
   export type BaseContentItem = z.infer<typeof baseContentItemSchema>;
   export type ContentItem = BaseContentItem | GroupItem;
   export interface GroupItem { ... }
   ```

2. **Create schema files in `src/schemas/`**:
   - `content.ts` - reusable content schemas
   - `layout.ts` - reusable layout schemas  
   - `resume.ts` - reusable resume schemas

3. **Update `src/schemas/index.ts`**:
   ```typescript
   export * from './content.ts';
   export * from './layout.ts';
   export * from './resume.ts';
   ```

4. **Update tool file imports**:
   ```typescript
   // In tool files
   import { FlowingContentItem } from '../../types.ts';
   import { flowingContentItemSchema } from '../../schemas/content.ts';
   
   // Tool-specific schemas stay here
   const inputSchema = z.object({ ... });
   ```

## Benefits

1. **Simplified Structure**: Single `src/types.ts` file for all reusable types
2. **Organized Schemas**: Logical grouping in `src/schemas/` directory
3. **Better Reusability**: Types and schemas can be imported where needed
4. **Cleaner Tool Files**: Tools focus on their specific functionality
5. **Easy Maintenance**: Centralized type definitions

## No Breaking Changes

- All tool-specific input/output schemas remain unchanged
- Tool functionality remains identical
- Backward compatibility maintained through proper exports
- Import paths only change for reusable types/schemas

This final proposal balances simplicity (single types.ts file) with organization (structured schemas directory) while respecting the tool-specific nature of input/output schemas.