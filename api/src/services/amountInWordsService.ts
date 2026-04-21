// Indian-locale "amount in words" helper. Written for receipt PDFs (PRD §9.6)
// and unit-tested for the typical boundary cases (0, 1, 99, 100, 1k, 1L, 1Cr).

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty',
  'Ninety',
];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n] ?? '';
  const t = Math.floor(n / 10);
  const u = n % 10;
  const tens = TENS[t] ?? '';
  return u === 0 ? tens : `${tens} ${ONES[u] ?? ''}`;
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h > 0) parts.push(`${ONES[h]} Hundred`);
  if (rest > 0) parts.push(twoDigits(rest));
  return parts.join(' ');
}

/**
 * Convert a non-negative integer to Indian-format English words.
 * Supports up to 99 Crore 99 Lakh 99 Thousand 999 i.e. up to 999,99,99,999.
 * Negative inputs are rejected.
 */
export function numberToIndianWords(n: number): string {
  if (!Number.isFinite(n) || Math.floor(n) !== n) {
    throw new Error(`numberToIndianWords requires a finite integer, got ${n}`);
  }
  if (n < 0) {
    throw new Error(`numberToIndianWords requires a non-negative integer, got ${n}`);
  }
  if (n === 0) return 'Zero';

  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1_000);
  const hundred = n % 1_000;

  const parts: string[] = [];
  if (crore > 0) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh > 0) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand > 0) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred > 0) parts.push(threeDigits(hundred));
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Convert integer paise to an Indian-format rupees+paise words string.
 * Example: 540050 → "Five Thousand Four Hundred Rupees and Fifty Paise Only".
 */
export function paiseToIndianWords(paise: number): string {
  if (!Number.isFinite(paise) || Math.floor(paise) !== paise) {
    throw new Error(`paiseToIndianWords requires a finite integer, got ${paise}`);
  }
  if (paise < 0) {
    throw new Error(`paiseToIndianWords requires a non-negative integer, got ${paise}`);
  }
  const rupees = Math.floor(paise / 100);
  const remainder = paise % 100;
  const rupeeWords = numberToIndianWords(rupees);
  if (remainder === 0) {
    return `${rupeeWords} Rupees Only`;
  }
  return `${rupeeWords} Rupees and ${twoDigits(remainder)} Paise Only`;
}

const INR_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPaiseAsRupees(paise: number): string {
  return INR_FORMATTER.format(paise / 100);
}
