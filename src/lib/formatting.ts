/**
 * Field templates and rendering for resume generation.
 *
 * Field templates use LiquidJS to render field combinations.
 * Handlers use these for field-level rendering while maintaining structural layout.
 */

import type { FieldTemplates } from './ir/types.js';
import { registerFilter, render } from './template.js';

/**
 * Default field templates
 */
export const DEFAULT_FIELD_TEMPLATES: Required<FieldTemplates> = {
  location: '{{ city }}{% if region %}, {{ region }}{% endif %}',
  dateRange: "{{ start | date: 'MMM YYYY' }}{% if start %} – {% endif %}{{ end | date: 'MMM YYYY' | default: 'Present' }}",
  degree: '{{ studyType }}{% if area %}, {{ area }}{% endif %}',
  contactLine: "{{ items | join: ' | ' }}",
  credential: '{{ title | default: name }}{% if awarder %}, {{ awarder }}{% endif %}{% if issuer %}, {{ issuer }}{% endif %}{% if publisher %}, {{ publisher }}{% endif %}',
  language: '{{ language }}{% if fluency %} ({{ fluency }}){% endif %}',
  skill: "{{ name }}: {{ keywords | join: ', ' }}",
};

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Parse a date string (YYYY-MM-DD or YYYY-MM) into components
 */
function parseDate(dateStr: string): { year: number; month: number; day?: number } | null {
  if (!dateStr) return null;

  // Handle YYYY-MM-DD
  const fullMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (fullMatch) {
    const [, yearStr, monthStr, dayStr] = fullMatch;
    if (yearStr && monthStr && dayStr) {
      return {
        year: parseInt(yearStr, 10),
        month: parseInt(monthStr, 10),
        day: parseInt(dayStr, 10),
      };
    }
  }

  // Handle YYYY-MM
  const partialMatch = dateStr.match(/^(\d{4})-(\d{2})$/);
  if (partialMatch) {
    const [, yearStr, monthStr] = partialMatch;
    if (yearStr && monthStr) {
      return {
        year: parseInt(yearStr, 10),
        month: parseInt(monthStr, 10),
      };
    }
  }

  // Handle YYYY only
  const yearMatch = dateStr.match(/^(\d{4})$/);
  if (yearMatch) {
    const [, yearStr] = yearMatch;
    if (yearStr) {
      return {
        year: parseInt(yearStr, 10),
        month: 1, // Default to January
      };
    }
  }

  return null;
}

/**
 * Format a date according to the format string
 *
 * Supported tokens:
 * - YYYY: 4-digit year (2020)
 * - YY: 2-digit year (20)
 * - MMMM: Full month name (January)
 * - MMM: Short month name (Jan)
 * - MM: 2-digit month (01)
 * - M: 1-digit month (1)
 * - DD: 2-digit day (05)
 * - D: 1-digit day (5)
 */
export function formatDate(dateStr: string | undefined | null, format: string): string {
  if (!dateStr) return '';

  const parsed = parseDate(dateStr);
  if (!parsed) return dateStr; // Return as-is if can't parse

  const { year, month, day } = parsed;

  let result = format;

  // Year tokens
  result = result.replace(/YYYY/g, String(year));
  result = result.replace(/YY/g, String(year).slice(-2));

  // Month tokens (order matters - check longer patterns first)
  result = result.replace(/MMMM/g, MONTH_NAMES_FULL[month - 1] || '');
  result = result.replace(/MMM/g, MONTH_NAMES_SHORT[month - 1] || '');
  result = result.replace(/MM/g, String(month).padStart(2, '0'));
  result = result.replace(/M(?![a-zA-Z])/g, String(month)); // M not followed by letter

  // Day tokens (if we have day info)
  if (day !== undefined) {
    result = result.replace(/DD/g, String(day).padStart(2, '0'));
    result = result.replace(/D(?![a-zA-Z])/g, String(day));
  } else {
    // Remove day tokens if no day
    result = result.replace(/DD/g, '');
    result = result.replace(/D(?![a-zA-Z])/g, '');
  }

  return result.trim();
}

/**
 * Calculate tenure in years and months between two dates
 */
export function calculateTenure(startDate: string | undefined | null, endDate: string | undefined | null): { years: number; months: number; totalMonths: number } | null {
  if (!startDate) return null;

  const start = parseDate(startDate);
  if (!start) return null;

  let end: { year: number; month: number };
  if (endDate) {
    const parsed = parseDate(endDate);
    if (!parsed) return null;
    end = parsed;
  } else {
    // Use current date
    const now = new Date();
    end = { year: now.getFullYear(), month: now.getMonth() + 1 };
  }

  let totalMonths = (end.year - start.year) * 12 + (end.month - start.month);
  if (totalMonths < 0) totalMonths = 0;

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  return { years, months, totalMonths };
}

/**
 * Format tenure as a human-readable string
 */
export function formatTenure(startDate: string | undefined | null, endDate: string | undefined | null): string {
  const tenure = calculateTenure(startDate, endDate);
  if (!tenure) return '';

  const { years, months } = tenure;

  if (years === 0 && months === 0) return '';
  if (years === 0) return `${months} mo`;
  if (months === 0) return years === 1 ? '1 yr' : `${years} yrs`;

  const yrStr = years === 1 ? '1 yr' : `${years} yrs`;
  return `${yrStr} ${months} mo`;
}

/**
 * Merge user templates with defaults
 */
export function mergeFieldTemplates(userTemplates?: FieldTemplates): Required<FieldTemplates> {
  return { ...DEFAULT_FIELD_TEMPLATES, ...userTemplates };
}

/**
 * Render a field template with the given context
 */
export function renderField(template: string, context: Record<string, unknown>): string {
  return render(template, context).trim();
}

// Flag to track if filters are registered
let filtersRegistered = false;

/**
 * Register LiquidJS filters for field templates.
 * Call once at startup.
 */
export function registerFieldFilters(): void {
  if (filtersRegistered) return;
  filtersRegistered = true;

  // {{ value | date: 'MMM YYYY' }} - format a date
  registerFilter('date', (value: unknown, format?: unknown) => {
    if (!value) return '';
    const formatStr = typeof format === 'string' ? format : 'MMM YYYY';
    return formatDate(String(value), formatStr);
  });

  // {{ value | default: 'fallback' }} - provide default if empty
  registerFilter('default', (value: unknown, fallback?: unknown) => {
    if (value === null || value === undefined || value === '') {
      return fallback ?? '';
    }
    return value;
  });

  // {{ startDate | tenure: endDate }} - calculate tenure
  registerFilter('tenure', (startValue: unknown, endValue?: unknown) => {
    const start = startValue ? String(startValue) : undefined;
    const end = endValue ? String(endValue) : undefined;
    return formatTenure(start, end);
  });
}
