/**
 * Template engine using LiquidJS
 * Supports: {{ field }}, {{ field | filter }}, {% if %}, {% for %}
 */

import { Liquid } from 'liquidjs';
import { escapeMarkdown } from './markdown.ts';

// Templates produce markdown: every inserted value is escaped to render as written, unless piped through `raw`.
const engine = new Liquid({
  outputEscape: (value: unknown) => escapeMarkdown(String(value ?? '')),
  strictFilters: false,
  strictVariables: false,
  trimTagLeft: false,
  trimTagRight: false,
  trimOutputLeft: false,
  trimOutputRight: false,
});

/**
 * Type for custom helper functions (LiquidJS filter style)
 * In LiquidJS: {{ value | filterName: arg1, arg2 }}
 * fn receives: (context, value, arg1, arg2)
 */
export type HelperFn = (context: Record<string, unknown>, value: string, ...args: string[]) => unknown;

/**
 * Register a custom filter
 */
export function registerFilter(name: string, fn: (value: unknown, ...args: unknown[]) => unknown): void {
  engine.registerFilter(name, fn);
}

/**
 * Register a custom helper as a LiquidJS filter
 * Usage: {{ value | helperName: arg1, arg2 }}
 */
export function registerHelper(name: string, fn: HelperFn): void {
  engine.registerFilter(name, (value: unknown, ...args: unknown[]) => {
    // Pass empty context for filter usage, value as second param
    return fn({}, String(value ?? ''), ...args.map((a) => String(a ?? '')));
  });
}

/**
 * Render a template string with the given context
 */
export function render(template: string, context: Record<string, unknown>): string {
  return compile(template)(context);
}

function invalidTemplate(template: string, error: unknown): Error {
  return new Error(`Invalid template "${template}": ${error instanceof Error ? error.message : String(error)}`);
}

/**
 * Compile a template for repeated use (returns render function)
 * Throws naming the template when it cannot be parsed or rendered
 */
export function compile(template: string): (context: Record<string, unknown>) => string {
  let tpl: ReturnType<typeof engine.parse>;
  try {
    tpl = engine.parse(template);
  } catch (error) {
    throw invalidTemplate(template, error);
  }
  return (context) => {
    try {
      return engine.renderSync(tpl, context);
    } catch (error) {
      throw invalidTemplate(template, error);
    }
  };
}

// Register built-in filters
registerFilter('uppercase', (v) => String(v ?? '').toUpperCase());
registerFilter('lowercase', (v) => String(v ?? '').toLowerCase());
registerFilter('capitalize', (v) => {
  const s = String(v ?? '');
  return s.charAt(0).toUpperCase() + s.slice(1);
});
registerFilter('trim', (v) => String(v ?? '').trim());
registerFilter('join', (v, separator) => {
  if (Array.isArray(v)) {
    return v.join(String(separator ?? ', '));
  }
  return String(v ?? '');
});
