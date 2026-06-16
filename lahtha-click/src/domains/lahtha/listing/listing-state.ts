// Listing lifecycle — pure. A vendor's priced offer for a device.
//   active --sell--> sold        (set when an order against it completes)
//   active --withdraw--> withdrawn (vendor pulls the offer)

export const LISTING_STATUSES = ['active', 'sold', 'withdrawn'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_ACTIONS = { SELL: 'SELL', WITHDRAW: 'WITHDRAW' } as const;
export type ListingAction = (typeof LISTING_ACTIONS)[keyof typeof LISTING_ACTIONS];

export const INITIAL_LISTING_STATUS: ListingStatus = 'active';

export class InvalidListingTransition extends Error {
  constructor(public readonly from: ListingStatus, public readonly action: ListingAction) {
    super(`Cannot ${action} a listing in status ${from}`);
    this.name = 'InvalidListingTransition';
  }
}

export function nextListingStatus(from: ListingStatus, action: ListingAction): ListingStatus {
  if (from === 'active' && action === LISTING_ACTIONS.SELL) return 'sold';
  if (from === 'active' && action === LISTING_ACTIONS.WITHDRAW) return 'withdrawn';
  throw new InvalidListingTransition(from, action);
}

export function isPurchasable(status: ListingStatus): boolean {
  return status === 'active';
}
