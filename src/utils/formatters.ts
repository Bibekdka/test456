/**
 * Helper utility functions for formatting currency, dates, and numbers.
 */

/**
 * Format a number as Indian Rupee (INR) currency or plain localized number.
 */
export function formatINR(amount: number, includeSymbol = true): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  if (!includeSymbol) {
    return safeAmount.toLocaleString('en-IN');
  }
  return `₹${safeAmount.toLocaleString('en-IN')}`;
}

/**
 * Format currency with compact display (e.g. ₹1.2L, ₹50K, ₹2.5Cr).
 */
export function formatCompactINR(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(safeAmount);
  const sign = safeAmount < 0 ? '-' : '';

  if (abs >= 1_00_00_000) {
    return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  }
  if (abs >= 1_00_000) {
    return `${sign}₹${(abs / 1_00_000).toFixed(1)}L`;
  }
  if (abs >= 1_000) {
    return `${sign}₹${(abs / 1_000).toFixed(1)}k`;
  }
  return `${sign}₹${abs.toLocaleString('en-IN')}`;
}

/**
 * Safely parse a numeric string into a float, defaulting to 0 or fallback value.
 */
export function safeParseFloat(val: any, fallback = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  const parsed = parseFloat(val);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Clean strings by stripping bracketed details like "(Main Site)".
 */
export function cleanEntityName(name?: string): string {
  if (!name) return '';
  return name.replace(/\s*\([^)]*\)/g, '').trim();
}

/**
 * Extract phone digits only.
 */
export function extractDigits(phone?: string): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}
