import { describe, expect, it } from 'vitest';
import { formatPhoneForDisplay, normalizePhone } from '../services/phone.js';
import { isTasteful, redactPhone, sanitizeCopy, sanitizeText } from '../lib/sanitize.js';

describe('normalizePhone', () => {
  it.each([
    ['0803 123 4567', '+2348031234567'],
    ['+234 803 123 4567', '+2348031234567'],
    ['2348031234567', '+2348031234567'],
    ['+44 20 7946 0958', '+442079460958'],
    ['+1 (415) 555-2671', '+14155552671'],
  ])('normalises %s', (input, expected) => {
    const result = normalizePhone(input);
    expect(result.ok && result.e164).toBe(expected);
  });

  it.each(['', '   ', '12', 'not a number', '0000000000'])('rejects %j', (input) => {
    expect(normalizePhone(input).ok).toBe(false);
  });

  it('formats for display without changing the stored value', () => {
    expect(formatPhoneForDisplay('+2348031234567')).toMatch(/\+234/);
  });
});

describe('sanitisation', () => {
  it('strips markup and control characters', () => {
    expect(sanitizeText('<b>Hello</b>   world\u0007', 100)).toBe('Hello world');
    expect(sanitizeText('**bold** and `code`', 100)).toBe('bold and code');
  });

  it('enforces length limits', () => {
    expect(sanitizeText('x'.repeat(900), 100)).toHaveLength(100);
  });

  it('flags appearance judgment', () => {
    expect(isTasteful('You look attractive in those colours.')).toBe(false);
    expect(isTasteful('Your body shape suits this silhouette.')).toBe(false);
    expect(isTasteful('Your earth tones give the look a clear story.')).toBe(true);
  });

  it('rejects copy that mentions seeing the person', () => {
    const result = sanitizeCopy({
      summary: 'In the photo you look great, and your face is framed by warm tones which suits you well.',
      strengths: ['You look wonderful in this light.', 'Your body shape is flattered.'],
      experiments: [
        { title: 'Try colour', detail: 'Add one more earth tone to your outfit next week and notice the effect.' },
        { title: 'Try layers', detail: 'Layer a jacket over the same base to change the silhouette entirely.' },
      ],
      conversationStarter: 'What drew you to this look today?',
    });
    expect(result).toBeNull();
  });

  it('redacts phone numbers for logs', () => {
    expect(redactPhone('+2348031234567')).not.toContain('8031234567');
    expect(redactPhone('+2348031234567')).toMatch(/567\]$/);
  });
});
