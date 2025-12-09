/**
 * Template engine using LiquidJS
 * Supports: {{ field }}, {{ field | filter }}, {% if %}, {% for %}
 */

import { Liquid } from 'liquidjs';

// Singleton Liquid engine instance
const engine = new Liquid({
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
  try {
    return engine.parseAndRenderSync(template, context);
  } catch (error) {
    // On error, return template as-is for debugging
    console.error('Template render error:', error);
    return template;
  }
}

/**
 * Compile a template for repeated use (returns render function)
 */
export function compile(template: string): (context: Record<string, unknown>) => string {
  const tpl = engine.parse(template);
  return (context) => {
    try {
      return engine.renderSync(tpl, context);
    } catch (error) {
      console.error('Template render error:', error);
      return template;
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
