import { Payer, Labour } from '../types';
import { cleanEntityName, extractDigits } from './formatters';

export interface PayerResolutionResult {
  id: string;
  name: string;
  role?: string;
  phone?: string;
  notes?: string;
  isRegisteredPayer: boolean;
  isLabourMember: boolean;
}

/**
 * Check if two phone strings match using last 6+ digits matching or exact comparison.
 */
export function isPhoneDigitsMatch(digitsA?: string, digitsB?: string): boolean {
  if (!digitsA || !digitsB) return false;
  const cleanA = extractDigits(digitsA);
  const cleanB = extractDigits(digitsB);
  if (cleanA.length < 6 || cleanB.length < 6) return false;
  return cleanA === cleanB || cleanA.endsWith(cleanB) || cleanB.endsWith(cleanA);
}

/**
 * Find a matching registered Payer or Labour member from a raw reference string or phone number.
 */
export function matchPayerOrLabour(
  rawRef: string,
  payers: Payer[] = [],
  labours: Labour[] = []
): { registeredPayer?: Payer; labourMember?: Labour } {
  const cleanRef = cleanEntityName(rawRef);
  if (!cleanRef) return {};

  const targetLower = cleanRef.toLowerCase();
  const targetFirstName = targetLower.split(' ')[0];
  const rawDigits = extractDigits(rawRef);

  // 1. Check registered payers
  const registeredPayer = payers.find(p => {
    const pIdLower = p.id.toLowerCase();
    const pNameClean = cleanEntityName(p.name).toLowerCase();
    const pFirstName = pNameClean.split(' ')[0];
    const pPhoneDigits = extractDigits(p.phone);

    const phoneMatches = isPhoneDigitsMatch(rawDigits, pPhoneDigits);

    return p.id === rawRef || 
           pIdLower === targetLower || 
           pNameClean === targetLower ||
           phoneMatches ||
           (targetLower.length >= 3 && pNameClean.includes(targetLower)) ||
           (pNameClean.length >= 3 && targetLower.includes(pNameClean)) ||
           (targetFirstName.length >= 3 && pFirstName === targetFirstName);
  });

  if (registeredPayer) {
    return { registeredPayer };
  }

  // 2. Check labour registry
  const labourMember = labours.find(l => {
    const lIdLower = l.id.toLowerCase();
    const lNameClean = cleanEntityName(l.name).toLowerCase();
    const lFirstName = lNameClean.split(' ')[0];
    const lPhoneDigits = extractDigits(l.contact || l.phone);

    const phoneMatches = isPhoneDigitsMatch(rawDigits, lPhoneDigits);

    return l.id === rawRef || 
           lIdLower === targetLower || 
           lNameClean === targetLower ||
           phoneMatches ||
           (targetLower.length >= 3 && lNameClean.includes(targetLower)) ||
           (lNameClean.length >= 3 && targetLower.includes(lNameClean)) ||
           (targetFirstName.length >= 3 && lFirstName === targetFirstName);
  });

  return { labourMember };
}

/**
 * Parse partner support notation from description or notes if present.
 */
export function parsePartnerSupportName(text?: string): string | null {
  if (!text) return null;
  const match = text.match(/\(🤝 Partner Support:\s*([^)]+)\)/i);
  return match && match[1] ? match[1].trim() : null;
}
