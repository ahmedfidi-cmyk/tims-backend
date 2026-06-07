// IMEI validation — pure. The DB index only enforces the 15-digit shape; the
// Luhn checksum is enforced here in code (per imei-inventory-schema.md §validation).

const IMEI_RE = /^\d{15}$/;

/** True if a string is 15 digits AND passes the Luhn checksum. */
export function isValidImei(imei: string): boolean {
  if (!IMEI_RE.test(imei)) return false;
  return luhnValid(imei);
}

/** Luhn (mod-10) checksum over a numeric string. */
export function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  // Walk right-to-left, doubling every second digit.
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48; // '0' = 48
    if (d < 0 || d > 9) return false;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Trim/normalize a candidate IMEI (strip spaces and dashes). */
export function normalizeImei(raw: string): string {
  return raw.replace(/[\s-]/g, '');
}
