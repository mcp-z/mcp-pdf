/**
 * Reusable layout schemas for PDF tools.
 * These schemas define the structure for layout-related configuration.
 */

import { z } from 'zod';
import type { BaseContentItem } from './content.js';
import { baseContentItemSchema } from './content.js';

// Size schema - number or percentage string
export const sizeSchema = z.union([z.number(), z.string().regex(/^\d+(\.\d+)?%$/)]);

// Border schema
export const borderSchema = z.object({
  color: z.string(),
  width: z.number(),
});

// Padding schema - number or object
export const paddingSchema = z.union([
  z.number(),
  z.object({
    top: z.number().optional(),
    right: z.number().optional(),
    bottom: z.number().optional(),
    left: z.number().optional(),
  }),
]);

// Group schema - flexbox container with children
// Using z.lazy for recursive type
export const groupSchema: z.ZodType<GroupItem> = z.lazy(() =>
  z.object({
    type: z.literal('group'),

    // Positioning
    page: z.number().int().min(1).optional().describe('Target page (default: 1). Pages are created as needed.'),
    position: z.enum(['absolute', 'relative']).optional().describe('Positioning strategy: absolute (exact coordinates) or relative (flexbox flow). Default: absolute for root items, relative for children.'),
    left: z.number().optional().describe('Horizontal position in points from page left edge.'),
    top: z.number().optional().describe('Vertical position in points from page top edge.'),

    // Size
    width: sizeSchema.optional().describe('Width in points or percentage (e.g., "50%")'),
    height: sizeSchema.optional().describe('Height in points or percentage (e.g., "50%")'),

    // Flexbox layout
    direction: z.enum(['column', 'row']).optional().default('column').describe('Flex direction: column (default) or row'),
    gap: z.number().optional().describe('Gap between children in points'),
    flex: z.number().optional().describe('Flex grow factor (1 = equal share of remaining space)'),
    justify: z.enum(['start', 'center', 'end', 'space-between', 'space-around']).optional().describe('Main axis alignment'),
    alignItems: z.enum(['start', 'center', 'end', 'stretch']).optional().describe('Cross axis alignment for children'),

    // Self-positioning
    align: z.enum(['start', 'center', 'end']).optional().describe('Self alignment within parent. Use align: "center" to center this group.'),

    // Visual
    padding: paddingSchema.optional().describe('Inner spacing between group border and content.'),
    background: z.string().optional().describe('Background fill color'),
    border: borderSchema.optional().describe('Border with color and width'),

    // Children
    children: z.array(z.union([baseContentItemSchema, groupSchema])).describe('Nested content items'),
  })
);

// Group item interface
export interface GroupItem {
  type: 'group';
  page?: number;
  position?: 'absolute' | 'relative';
  left?: number;
  top?: number;
  width?: number | string;
  height?: number | string;
  direction?: 'column' | 'row';
  gap?: number;
  flex?: number;
  justify?: 'start' | 'center' | 'end' | 'space-between' | 'space-around';
  alignItems?: 'start' | 'center' | 'end' | 'stretch';
  align?: 'start' | 'center' | 'end';
  padding?: number | { top?: number; right?: number; bottom?: number; left?: number };
  background?: string;
  border?: { color: string; width: number };
  children: ContentItem[];
}

// Full content item schema including groups
export const contentItemSchema = z.union([baseContentItemSchema, groupSchema]);

// Content item type
export type ContentItem = BaseContentItem | GroupItem;

// Base content item type (re-exported for convenience)
// Note: BaseContentItem is defined and exported in content.ts to avoid duplication

// Layout configuration schema
export const layoutSchema = z
  .object({
    overflow: z.enum(['auto', 'warn']).optional().default('auto').describe("Overflow behavior: 'auto' = normal (default), 'warn' = log warning if content exceeds page bounds"),
  })
  .optional()
  .describe('Layout configuration for overflow handling');
