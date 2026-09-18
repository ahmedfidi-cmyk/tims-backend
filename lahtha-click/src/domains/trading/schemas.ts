import { z } from 'zod';

export const recordTradeSchema = z.object({
  outcome: z.enum(['win', 'loss', 'breakeven']),
  /** Integer cents (decimal-safe) — negative for a loss. */
  realizedPnlUsdCents: z.number().int(),
});
