/**
 * Reusable content schemas for PDF tools.
 * These schemas define the structure for content items that can be shared across tools.
 */

import { z } from 'zod';
import { textBaseSchema } from '../lib/pdf-core.js';

// Flowing content items - no position properties, content flows naturally
export const flowingContentItemSchema = z.union([
  textBaseSchema.extend({ type: z.literal('text') }),
  textBaseSchema.extend({ type: z.literal('heading') }),
  z.object({
    type: z.literal('image'),
    imagePath: z.string().describe('Path to image file'),
    width: z.number().optional().describe('Image width in points (default: natural width, max: page width)'),
    height: z.number().optional().describe('Image height in points (default: natural height or aspect-ratio scaled)'),
    align: z.enum(['left', 'center', 'right']).optional().describe('Image alignment (default: left)'),
  }),
  z.object({
    type: z.literal('divider'),
    color: z.string().optional().describe('Divider color (default: #cccccc)'),
    thickness: z.number().optional().describe('Divider thickness in points (default: 1)'),
    marginTop: z.number().optional().describe('Space above divider in points (default: 10)'),
    marginBottom: z.number().optional().describe('Space below divider in points (default: 10)'),
  }),
  z.object({
    type: z.literal('spacer'),
    height: z.number().describe('Vertical space in points'),
  }),
  z
    .object({
      type: z.literal('pageBreak'),
    })
    .describe('Force a page break'),
]);

// Positioned text schema (extends text base with position properties)
export const positionedTextSchema = textBaseSchema.extend({
  page: z.number().int().min(1).optional().describe('Target page (default: 1). Pages are created as needed.'),
  position: z.enum(['absolute', 'relative']).optional().describe('Positioning strategy: absolute (exact coordinates) or relative (flexbox flow). Default: absolute for root items, relative for children.'),
  left: z.number().optional().describe('Horizontal position in points from page left edge.'),
  top: z.number().optional().describe('Vertical position in points from page top edge.'),
});

// Base content items (without group to avoid circular reference)
export const baseContentItemSchema = z.union([
  positionedTextSchema.extend({ type: z.literal('text') }),
  positionedTextSchema.extend({ type: z.literal('heading') }),
  z.object({
    type: z.literal('image'),
    imagePath: z.string().describe('Path to image file'),
    page: z.number().int().min(1).optional().describe('Target page (default: 1). Pages are created as needed.'),
    left: z.number().optional().describe('Horizontal position in points from page left edge.'),
    top: z.number().optional().describe('Vertical position in points from page top edge.'),
    width: z.number().optional().describe('Image width in points (default: natural width)'),
    height: z.number().optional().describe('Image height in points (default: natural height or aspect-ratio scaled)'),
  }),
  z.object({
    type: z.literal('rect'),
    page: z.number().int().min(1).optional().describe('Target page (default: 1). Pages are created as needed.'),
    left: z.number().describe('Horizontal position in points from page left edge.'),
    top: z.number().describe('Vertical position in points from page top edge.'),
    width: z.number().describe('Width in points'),
    height: z.number().describe('Height in points'),
    fillColor: z.string().optional().describe('Fill color (default: no fill)'),
    strokeColor: z.string().optional().describe('Stroke color (default: no stroke)'),
    lineWidth: z.number().optional().describe('Stroke width in points (default: 1)'),
  }),
  z.object({
    type: z.literal('circle'),
    page: z.number().int().min(1).optional().describe('Target page (default: 1). Pages are created as needed.'),
    left: z.number().describe('Center horizontal position in points from page left edge.'),
    top: z.number().describe('Center vertical position in points from page top edge.'),
    radius: z.number().describe('Radius in points'),
    fillColor: z.string().optional().describe('Fill color (default: no fill)'),
    strokeColor: z.string().optional().describe('Stroke color (default: no stroke)'),
    lineWidth: z.number().optional().describe('Stroke width in points (default: 1)'),
  }),
  z.object({
    type: z.literal('line'),
    page: z.number().int().min(1).optional().describe('Target page (default: 1). Pages are created as needed.'),
    x1: z.number().describe('Start X coordinate in points'),
    y1: z.number().describe('Start Y coordinate in points'),
    x2: z.number().describe('End X coordinate in points'),
    y2: z.number().describe('End Y coordinate in points'),
    strokeColor: z.string().optional().describe('Line color (default: black)'),
    lineWidth: z.number().optional().describe('Line width in points (default: 1)'),
  }),
]);

// Type exports
export type FlowingContentItem = z.infer<typeof flowingContentItemSchema>;
export type BaseContentItem = z.infer<typeof baseContentItemSchema>;
