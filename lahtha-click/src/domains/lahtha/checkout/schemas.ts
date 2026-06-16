// Zod schemas — validation boundary for the checkout API.

import { z } from 'zod';
import { FULFILLMENT_TYPES } from './order-state.js';

export const placeOrderSchema = z.object({
  deviceId: z.string().trim().min(1),
  fulfillmentType: z.enum(FULFILLMENT_TYPES),
  subtotalHalalat: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
});
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

export const placeFromListingSchema = z.object({
  listingId: z.string().trim().min(1),
  fulfillmentType: z.enum(FULFILLMENT_TYPES),
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
});
export type PlaceFromListingInput = z.infer<typeof placeFromListingSchema>;

export const paymentEventSchema = z.object({
  outcome: z.enum(['captured', 'failed']),
  paymentRef: z.string().trim().min(1).max(256),
});
export type PaymentEventInput = z.infer<typeof paymentEventSchema>;

export const shipSchema = z.object({
  shippingRef: z.string().trim().min(1).max(256),
});
export type ShipInput = z.infer<typeof shipSchema>;
