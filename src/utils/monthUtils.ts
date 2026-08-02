/**
 * Utility functions for extracting unique months, formatting month keys,
 * filtering records by month, and sorting records by monthly order / date / amount.
 */

export interface MonthOption {
  key: string;        // "2026-02"
  label: string;      // "February 2026"
  year: number;       // 2026
  monthIndex: number; // 0-indexed (0 = Jan)
}

export type LedgerSortOrder = 
  | 'newest'        // Date descending
  | 'oldest'        // Date ascending
  | 'monthly_desc'  // Monthly order descending (e.g. Feb 2026 -> Jan 2026)
  | 'monthly_asc'   // Monthly order ascending (e.g. Jan 2026 -> Feb 2026)
  | 'amount_high'   // Amount descending
  | 'amount_low';   // Amount ascending

/**
 * Format a YYYY-MM string to human-readable month label (e.g., "February 2026")
 */
export function formatMonthLabel(monthKey: string): string {
  if (!monthKey || monthKey === 'all') return 'All Months';
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return monthKey;

  const date = new Date(year, month - 1, 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

/**
 * Extract sorted list of unique months (YYYY-MM) from an array of records.
 */
export function extractUniqueMonths<T>(
  items: T[],
  getDate: (item: T) => string | undefined | null
): MonthOption[] {
  const map = new Map<string, MonthOption>();

  items.forEach((item) => {
    const rawDate = getDate(item);
    if (!rawDate || typeof rawDate !== 'string') return;
    const match = rawDate.match(/^(\d{4})-(\d{2})/);
    if (!match) return;

    const monthKey = `${match[1]}-${match[2]}`;
    if (!map.has(monthKey)) {
      const year = parseInt(match[1], 10);
      const monthIndex = parseInt(match[2], 10) - 1;
      const label = formatMonthLabel(monthKey);
      map.set(monthKey, {
        key: monthKey,
        label,
        year,
        monthIndex
      });
    }
  });

  // Sort months descending by default (most recent first)
  return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
}

/**
 * Filter items by selected month key ("all" or "YYYY-MM").
 */
export function filterRecordsByMonth<T>(
  items: T[],
  getDate: (item: T) => string | undefined | null,
  selectedMonth: string
): T[] {
  if (!selectedMonth || selectedMonth === 'all') return items;
  return items.filter((item) => {
    const dateStr = getDate(item);
    return dateStr ? dateStr.startsWith(selectedMonth) : false;
  });
}

/**
 * Sort items based on selected sort order.
 */
export function sortRecords<T>(
  items: T[],
  getDate: (item: T) => string | undefined | null,
  getAmount: (item: T) => number = () => 0,
  sortOrder: LedgerSortOrder = 'newest'
): T[] {
  const sorted = [...items];

  return sorted.sort((a, b) => {
    const dateA = getDate(a) || '';
    const dateB = getDate(b) || '';
    const amtA = getAmount(a) || 0;
    const amtB = getAmount(b) || 0;

    switch (sortOrder) {
      case 'oldest':
        return dateA.localeCompare(dateB);

      case 'monthly_asc': {
        const monthA = dateA.substring(0, 7);
        const monthB = dateB.substring(0, 7);
        if (monthA !== monthB) {
          return monthA.localeCompare(monthB);
        }
        return dateA.localeCompare(dateB);
      }

      case 'monthly_desc': {
        const monthA = dateA.substring(0, 7);
        const monthB = dateB.substring(0, 7);
        if (monthA !== monthB) {
          return monthB.localeCompare(monthA);
        }
        return dateB.localeCompare(dateA);
      }

      case 'amount_high':
        return amtB - amtA || dateB.localeCompare(dateA);

      case 'amount_low':
        return amtA - amtB || dateB.localeCompare(dateA);

      case 'newest':
      default:
        return dateB.localeCompare(dateA);
    }
  });
}
