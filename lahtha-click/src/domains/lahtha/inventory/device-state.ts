// Device lifecycle state — pure, DERIVED from the current owner rather than
// stored on the device (imei-inventory-schema.md: avoid a drifting status column).
// W3 models registration/ownership; listing/sold-via-listing arrive with later
// workstreams (checkout, auctions).

export const OWNER_TYPES = ['vendor', 'customer', 'dealer', 'lahtha_custody'] as const;
export type OwnerType = (typeof OWNER_TYPES)[number];

export const ACQUISITION_TYPES = [
  'initial_registration',
  'purchase',
  'auction_win',
  'transfer_in',
] as const;
export type AcquisitionType = (typeof ACQUISITION_TYPES)[number];

export type DeviceState =
  | 'unowned'
  | 'with_vendor'
  | 'in_custody'
  | 'sold'
  | 'with_dealer';

/** Coarse lifecycle state derived from the current owner's type. */
export function deriveDeviceState(currentOwnerType: OwnerType | null): DeviceState {
  switch (currentOwnerType) {
    case 'vendor':
      return 'with_vendor';
    case 'lahtha_custody':
      return 'in_custody';
    case 'customer':
      return 'sold';
    case 'dealer':
      return 'with_dealer';
    case null:
      return 'unowned';
  }
}
