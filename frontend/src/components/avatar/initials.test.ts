import { describe, expect, it } from 'vitest';
import { initials } from './initials';

describe('initials', () => {
  it('takes the first letters like a messenger avatar', () => {
    expect(initials('Rewe')).toBe('R');
    expect(initials('dm')).toBe('D');
    expect(initials('Media Markt')).toBe('MM');
    expect(initials('PayPal')).toBe('PP');
    expect(initials('MediaMarkt')).toBe('MM');
    expect(initials('  amazon prime video ')).toBe('AP');
    expect(initials('H&M')).toBe('HM');
    expect(initials('Ärztehaus')).toBe('Ä');
    expect(initials('')).toBe('?');
    expect(initials('😀 Spaß')).toBe('😀S');
  });
});
