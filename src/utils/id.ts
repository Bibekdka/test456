/**
 * Safe unique ID generator using Web Crypto API randomUUID with timestamp/random fallback.
 */
export function generateId(prefix?: string): string {
  let uuid: string;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    uuid = crypto.randomUUID();
  } else {
    // Fallback if crypto.randomUUID is unsupported in older browser environments
    uuid = 'xxxx-xxxx-4xxx-yxxx-xxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  return prefix ? `${prefix}_${uuid.slice(0, 8)}` : uuid;
}
