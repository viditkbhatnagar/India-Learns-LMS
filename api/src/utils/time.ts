const UNITS = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
} as const;

type Unit = keyof typeof UNITS;

/**
 * Parse `'15m' | '14d' | '900s' | '2h'` into milliseconds.
 * Throws if the input doesn't match the expected shape.
 */
export function parseTtl(input: string): number {
  const match = /^(\d+)([smhd])$/.exec(input.trim());
  if (!match || !match[1] || !match[2]) {
    throw new Error(`Invalid TTL string: ${input}`);
  }
  const value = Number(match[1]);
  const unit = match[2] as Unit;
  return value * UNITS[unit];
}
