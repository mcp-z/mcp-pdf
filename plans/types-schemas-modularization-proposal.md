# Types and Schemas Modularization Proposal

## Current State Analysis

The codebase currently has types and schemas embedded in various files, particularly in the MCP tool files. Here's what I found:

### Embedded Types and Schemas

1. **pdf-document.ts**: Contains `flowingContentItemSchema` and related types
2. **pdf-layout.ts**: Contains `sizeSchema`, `borderSchema`, `paddingSchema`, `positionedTextSchema`, `baseContentItemSchema`, `groupSchema`, `contentItemSchema`, `layoutSchema`, and related types
3. **pdf-resume.ts**: Contains `resumeInputSchema`, `sectionConfigSchema`, `dividerConfigSchema`, `fieldTemplatesSchema`, `sectionsConfigSchema`, `columnConfigSchema`, `layoutSchema`, `stylingSchema`, and related types

### Already Modularized

1. **src/types.ts**: Contains server configuration types
2. **src/constants.ts**: Contains page size and margin types
3. **src/lib/pdf-core.ts**: Contains `textBaseSchema`, `pdfOutputSchema`, and related types
4. **src/lib/types/typography.ts**: Contains comprehensive typography types
5. **src/lib/ir/types.ts**: Contains IR (Intermediate Representation) types
6. **src/lib/yoga-resume/types.ts**: Contains Yoga layout types

## Proposed Modularization Plan

### Guiding Principles

1. **Modularity**: Group related types and schemas together
2. **Reusability**: Make types available for import across the codebase
3. **Separation of Concerns**: Keep tool-specific types separate from shared types
4. **Backward Compatibility**: Don't break existing imports
5. **Clear Organization**: Use logical grouping and naming

### Proposed Structure

```
src/
├── types/
│   ├── index.ts                  # Main exports
│   ├── server.ts                # Server-related types (move from src/types.ts)
│   ├── pdf.ts                   # General PDF types
│   ├── content.ts               # Content item types
│   └── layout.ts                # Layout-related types
│
├── schemas/
│   ├── index.ts                 # Main exports
│   ├── pdf-document.ts         # PDF document schemas
│   ├── pdf-layout.ts           # PDF layout schemas  
│   ├── pdf-resume.ts            # PDF resume schemas
│   ├── content.ts               # Shared content schemas
│   └── common.ts                # Common schemas
│
└── constants.ts                # Keep existing constants
```

### Specific Changes

#### 1. Move Server Types
- Move server-related types from `src/types.ts` to `src/types/server.ts`
- Keep `src/types.ts` as a compatibility layer that re-exports from the new structure

#### 2. Create Content Types
- Create `src/types/content.ts` for shared content item types
- Move `FlowingContentItem` from pdf-document
- Move `BaseContentItem`, `ContentItem` from pdf-layout
- Create shared interfaces for text, heading, image, etc.

#### 3. Create Layout Types  
- Create `src/types/layout.ts` for layout-related types
- Move layout configuration types from pdf-layout and pdf-resume
- Move positioning and sizing types

#### 4. Create PDF Document Schemas
- Create `src/schemas/pdf-document.ts`
- Move `flowingContentItemSchema` and `inputSchema` from pdf-document tool
- Export types for tool usage

#### 5. Create PDF Layout Schemas
- Create `src/schemas/pdf-layout.ts`
- Move `sizeSchema`, `borderSchema`, `paddingSchema`, `positionedTextSchema`, `baseContentItemSchema`, `groupSchema`, `contentItemSchema`, `layoutSchema` from pdf-layout tool
- Export types for tool usage

#### 6. Create PDF Resume Schemas
- Create `src/schemas/pdf-resume.ts`
- Move `resumeInputSchema`, `sectionConfigSchema`, `dividerConfigSchema`, `fieldTemplatesSchema`, `sectionsConfigSchema`, `columnConfigSchema`, `layoutSchema`, `stylingSchema` from pdf-resume tool
- Export types for tool usage

#### 7. Create Shared Content Schemas
- Create `src/schemas/content.ts`
- Move `textBaseSchema` from pdf-core (keep in pdf-core for now as it's used there)
- Create shared schemas that can be reused across tools

#### 8. Update Exports
- Update `src/schemas/index.ts` to export all schemas
- Create `src/types/index.ts` to export all types
- Ensure backward compatibility

### Implementation Steps

1. **Create new type files** in `src/types/` directory
2. **Create new schema files** in `src/schemas/` directory  
3. **Move types and schemas** from tool files to appropriate new files
4. **Update imports** in tool files to use the new modular structure
5. **Update exports** to maintain backward compatibility
6. **Test** to ensure no functionality is broken

### Benefits

1. **Better Organization**: Clear separation of concerns
2. **Improved Reusability**: Types can be imported where needed
3. **Easier Maintenance**: Changes to shared types are centralized
4. **Better Type Safety**: Consistent type usage across the codebase
5. **Cleaner Tool Files**: Tools focus on functionality, not type definitions

### Risks and Mitigations

1. **Breaking Changes**: Maintain backward compatibility through re-exports
2. **Circular Dependencies**: Careful organization and import structure
3. **Performance Impact**: Minimal - TypeScript compilation should be unaffected
4. **Testing Complexity**: Comprehensive testing of imports and exports

## Next Steps

1. Get approval on this proposal
2. Implement the modularization step by step
3. Test thoroughly to ensure no regressions
4. Update documentation as needed