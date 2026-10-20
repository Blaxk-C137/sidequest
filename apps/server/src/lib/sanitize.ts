/**
 * Defence-in-depth for AI-generated copy. Structured output already constrains
 * the shape, but text still comes back from a model: strip markup, control
 * characters and any phrasing we never want attributed to BlaXaura.
 */
const MAX_LENGTHS = { summary: 600, strength: 200, title: 64, detail: 280, starter: 200 } as const;

const BANNED = [
  /\battractive\b/i,
  /\bbeauty\s+(score|rating)\b/i,
  /\byou\s+look\b/i,
  /\byour\s+(body|face|weight|figure|skin\s+colou?r)\b/i,
  /\b(lose|gain)\s+weight\b/i,
  /\bhotness\b/i,
  /\bunattractive\b/i,
  /\bfat\b/i,
  /\bugly\b/i,
  /\bneed(s)?\s+to\s+(fix|improve)\s+your\s+(body|face|weight)\b/i,
];

export function sanitizeText(input: string, maxLength: number): string {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[*_`#>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
    .trim();
}

export function isTasteful(text: string): boolean {
  return !BANNED.some((pattern) => pattern.test(text));
}

export type SanitizedCopy = {
  summary: string;
  strengths: string[];
  experiments: { title: string; detail: string }[];
  conversationStarter: string;
};

/** Returns null when the model produced anything we will not display. */
export function sanitizeCopy(copy: SanitizedCopy): SanitizedCopy | null {
  const out: SanitizedCopy = {
    summary: sanitizeText(copy.summary, MAX_LENGTHS.summary),
    strengths: copy.strengths.slice(0, 2).map((s) => sanitizeText(s, MAX_LENGTHS.strength)),
    experiments: copy.experiments.slice(0, 2).map((e) => ({
      title: sanitizeText(e.title, MAX_LENGTHS.title),
      detail: sanitizeText(e.detail, MAX_LENGTHS.detail),
    })),
    conversationStarter: sanitizeText(copy.conversationStarter, MAX_LENGTHS.starter),
  };
  const everything = [out.summary, ...out.strengths, ...out.experiments.map((e) => `${e.title} ${e.detail}`), out.conversationStarter];
  if (out.strengths.length !== 2 || out.experiments.length !== 2) return null;
  if (out.summary.length < 40) return null;
  if (!everything.every(isTasteful)) return null;
  return out;
}

/** Phone numbers and emails must never reach server logs. */
export function redactPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return '[redacted]';
  return `[redacted +${'•'.repeat(Math.max(0, digits.length - 3))}${digits.slice(-3)}]`;
}

export function scrubLogPayload(payload: unknown): unknown {
  if (typeof payload === 'string') {
    return payload.replace(/(\+?\d[\d\s-]{7,}\d)/g, (match) => redactPhone(match));
  }
  return payload;
}
