/**
 * Format an integer halalat amount as a SAR price string.
 * 500000 halalat -> "5,000.00"
 */
export function formatSar(halalat: number): string {
  const sar = halalat / 100;
  return sar.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Compute the platform commission for an order amount.
 * Mirrors lahtha-click/src/config/commission.ts. Capped at 5%.
 */
export const COMMISSION_RATE_BPS = 500;
const MAX_RATE_BPS = 500;

export function commissionHalalat(amountHalalat: number): number {
  if (COMMISSION_RATE_BPS > MAX_RATE_BPS) {
    throw new Error('commission rate exceeds platform max');
  }
  return Math.floor((amountHalalat * COMMISSION_RATE_BPS) / 10000);
}
