import type { Clock, Payment, PaymentRepository, PaymentStatus } from './types.js';

export class InMemoryPaymentRepository implements PaymentRepository {
  private readonly byId = new Map<string, Payment>();
  async create(payment: Payment): Promise<Payment> {
    this.byId.set(payment.paymentId, { ...payment });
    return { ...payment };
  }
  async findByIntent(intentId: string): Promise<Payment | null> {
    for (const p of this.byId.values()) if (p.intentId === intentId) return { ...p };
    return null;
  }
  async setStatus(paymentId: string, status: PaymentStatus): Promise<void> {
    const p = this.byId.get(paymentId);
    if (p) {
      p.status = status;
      p.updatedAt = new Date();
    }
  }
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
