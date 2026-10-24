import { describe, expect, it } from 'vitest';
import { formatTokens } from './format';

describe('formatTokens', () => {
  it('leaves small numbers as they are', () => {
    expect(formatTokens(0)).toBe('0');
    expect(formatTokens(42)).toBe('42');
    expect(formatTokens(999)).toBe('999');
  });

  it('shortens thousands and millions with one decimal at most', () => {
    expect(formatTokens(3817)).toBe('3.8K');
    expect(formatTokens(12_000)).toBe('12K');
    expect(formatTokens(1_250_000)).toBe('1.3M');
  });
});
