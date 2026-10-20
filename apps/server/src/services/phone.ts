import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

export type PhoneResult = { ok: true; e164: string; country: string } | { ok: false; message: string };

/**
 * Validates internationally and normalises to E.164.
 * Nigeria is the default region (so "0803 123 4567" works), but any
 * international number with a country code is accepted.
 */
export function normalizePhone(raw: string, defaultCountry: CountryCode = 'NG'): PhoneResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, message: 'Enter a phone number.' };
  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (!parsed) return { ok: false, message: 'That does not look like a phone number.' };
  if (!parsed.isValid()) return { ok: false, message: 'That number failed validation. Check the digits and country code.' };
  if (parsed.getType && ['PREMIUM_RATE', 'SHARED_COST'].includes(String(parsed.getType()))) {
    return { ok: false, message: 'Premium-rate numbers cannot be saved.' };
  }
  return { ok: true, e164: parsed.number, country: parsed.country ?? defaultCountry };
}

/** +2348012345678 -> +234 801 234 5678, for display only. */
export function formatPhoneForDisplay(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}
