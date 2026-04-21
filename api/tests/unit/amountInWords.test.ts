import { describe, expect, it } from 'vitest';
import {
  formatPaiseAsRupees,
  numberToIndianWords,
  paiseToIndianWords,
} from '../../src/services/amountInWordsService.js';

describe('numberToIndianWords', () => {
  it('handles zero', () => {
    expect(numberToIndianWords(0)).toBe('Zero');
  });

  it('handles small single digits', () => {
    expect(numberToIndianWords(1)).toBe('One');
    expect(numberToIndianWords(9)).toBe('Nine');
  });

  it('handles teens', () => {
    expect(numberToIndianWords(11)).toBe('Eleven');
    expect(numberToIndianWords(19)).toBe('Nineteen');
  });

  it('handles tens', () => {
    expect(numberToIndianWords(20)).toBe('Twenty');
    expect(numberToIndianWords(99)).toBe('Ninety Nine');
  });

  it('handles hundreds', () => {
    expect(numberToIndianWords(100)).toBe('One Hundred');
    expect(numberToIndianWords(999)).toBe('Nine Hundred Ninety Nine');
  });

  it('handles thousands', () => {
    expect(numberToIndianWords(1000)).toBe('One Thousand');
    expect(numberToIndianWords(12345)).toBe(
      'Twelve Thousand Three Hundred Forty Five',
    );
  });

  it('handles Indian Lakh grouping', () => {
    expect(numberToIndianWords(100000)).toBe('One Lakh');
    expect(numberToIndianWords(1234567)).toBe(
      'Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven',
    );
  });

  it('handles Crore grouping', () => {
    expect(numberToIndianWords(10_000_000)).toBe('One Crore');
    expect(numberToIndianWords(99_99_99_999)).toBe(
      'Ninety Nine Crore Ninety Nine Lakh Ninety Nine Thousand Nine Hundred Ninety Nine',
    );
  });

  it('rejects negative', () => {
    expect(() => numberToIndianWords(-1)).toThrow();
  });

  it('rejects non-integer', () => {
    expect(() => numberToIndianWords(1.5)).toThrow();
  });
});

describe('paiseToIndianWords', () => {
  it('formats whole rupees with "Only"', () => {
    expect(paiseToIndianWords(100)).toBe('One Rupees Only');
    expect(paiseToIndianWords(500000)).toBe('Five Thousand Rupees Only');
  });

  it('includes paise fraction when non-zero', () => {
    expect(paiseToIndianWords(540050)).toBe(
      'Five Thousand Four Hundred Rupees and Fifty Paise Only',
    );
  });

  it('handles zero paise', () => {
    expect(paiseToIndianWords(0)).toBe('Zero Rupees Only');
  });
});

describe('formatPaiseAsRupees', () => {
  it('renders rupees with Indian locale grouping', () => {
    const out = formatPaiseAsRupees(100000);
    expect(out).toContain('1,000');
    expect(out).toMatch(/₹/);
  });

  it('includes two decimal places for paise remainder', () => {
    const out = formatPaiseAsRupees(150050);
    expect(out).toMatch(/1,500\.50/);
  });
});
