import { describe, it, expect } from 'vitest';
import { isValidImei, luhnValid, normalizeImei } from '../src/domains/lahtha/inventory/imei.js';
import { isKnownModel, modelNameFor, listModels } from '../src/domains/lahtha/inventory/model-catalog.js';
import { deriveDeviceState } from '../src/domains/lahtha/inventory/device-state.js';

/** Append a Luhn check digit to a 14-digit base → a valid 15-digit IMEI. */
export function withLuhn(base14: string): string {
  let sum = 0;
  let double = true; // the digit immediately left of the check digit is doubled
  for (let i = base14.length - 1; i >= 0; i--) {
    let d = base14.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return base14 + String((10 - (sum % 10)) % 10);
}

describe('IMEI validation', () => {
  it('accepts a Luhn-valid 15-digit IMEI', () => {
    const imei = withLuhn('49015420323751');
    expect(imei).toHaveLength(15);
    expect(isValidImei(imei)).toBe(true);
  });

  it('rejects a wrong checksum', () => {
    const valid = withLuhn('49015420323751');
    const lastDigit = valid.charCodeAt(14) - 48;
    const broken = valid.slice(0, 14) + String((lastDigit + 1) % 10);
    expect(isValidImei(broken)).toBe(false);
  });

  it('rejects non-15-digit or non-numeric input', () => {
    expect(isValidImei('123')).toBe(false);
    expect(isValidImei('49015420323751a')).toBe(false);
    expect(isValidImei('4901542032375180')).toBe(false); // 16 digits
  });

  it('luhnValid matches a known good number', () => {
    expect(luhnValid('490154203237518')).toBe(true);
  });

  it('normalizes spaces and dashes', () => {
    expect(normalizeImei(' 49-015 420-323751 8 ')).toBe('490154203237518');
  });
});

describe('model catalog', () => {
  it('knows seeded model codes and resolves names', () => {
    expect(isKnownModel('A3105')).toBe(true);
    expect(modelNameFor('A3105')).toBe('iPhone 17 Pro');
  });
  it('rejects unknown codes', () => {
    expect(isKnownModel('Z0000')).toBe(false);
    expect(modelNameFor('Z0000')).toBeNull();
  });
  it('lists the catalog', () => {
    expect(listModels().length).toBeGreaterThan(0);
  });
});

describe('device state (derived)', () => {
  it('maps current owner type to a lifecycle state', () => {
    expect(deriveDeviceState('vendor')).toBe('with_vendor');
    expect(deriveDeviceState('lahtha_custody')).toBe('in_custody');
    expect(deriveDeviceState('customer')).toBe('sold');
    expect(deriveDeviceState('dealer')).toBe('with_dealer');
    expect(deriveDeviceState(null)).toBe('unowned');
  });
});
