/**
 * Date formatting and template helpers for resume generation
 */

import type { FormattingOptions } from './ir/types.ts';
import { registerHelper } from './template.ts';

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Default formatting options (all values required)
 */
export const DEFAULT_FORMATTING: Required<FormattingOptions> = {
  dateFormat: 'MMM YYYY',
  dateSeparator: ' - ',
  presentText: 'Present',
  contactSeparator: ' | ',
};

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
 * Format a date range (startDate - endDate)
 */
export function formatDateRange(startDate: string | undefined | null, endDate: string | undefined | null, options: FormattingOptions = {}): string {
  const format = options.dateFormat || DEFAULT_FORMATTING.dateFormat;
  const separator = options.dateSeparator || DEFAULT_FORMATTING.dateSeparator;
  const presentText = options.presentText || DEFAULT_FORMATTING.presentText;

  const start = formatDate(startDate, format);
  const end = endDate ? formatDate(endDate, format) : presentText;

  if (!start && !end) return '';
  if (!start) return end;
  if (!end) return start;

  return `${start}${separator}${end}`;
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
 * Register template helpers for formatting
 *
 * LiquidJS filter usage:
 * - {{ startDate | formatDate: "MMM YYYY" }}
 * - {{ startDate | formatDateRange: endDate }}
 * - {{ startDate | tenure: endDate }}
 */
export function registerFormattingHelpers(options: FormattingOptions = {}): void {
  const mergedOptions = { ...DEFAULT_FORMATTING, ...options };

  // {{ date | formatDate }} or {{ date | formatDate: "MMMM YYYY" }}
  registerHelper('formatDate', (_context, dateValue, format) => {
    const dateFormat = format || mergedOptions.dateFormat;
    return formatDate(dateValue, dateFormat);
  });

  // {{ startDate | formatDateRange: endDate }}
  registerHelper('formatDateRange', (_context, startValue, endValue) => {
    return formatDateRange(startValue, endValue, mergedOptions);
  });

  // {{ startDate | tenure: endDate }}
  registerHelper('tenure', (_context, startValue, endValue) => {
    return formatTenure(startValue, endValue);
  });
}
