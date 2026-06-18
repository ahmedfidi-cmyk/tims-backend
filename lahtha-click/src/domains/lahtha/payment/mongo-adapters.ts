import mongoose, { Schema, type Model } from 'mongoose';
import type { Payment, PaymentRepository, PaymentStatus } from './types.js';
import { CheckoutService, OrderNotFoundError } from '../checkout/checkout.service.js';
import type { CheckoutPaymentPort } from './types.js';

const paymentSchema = new Schema<Payment>(
  {
    paymentId: { type: String, required: true, unique: true },
    orderId: { type: String, required: true },
    provider: { type: String, required: true },
    intentId: { type: String, required: true, unique: true },
    amountHalalat: { type: Number, required: true },
    status: { type: String, required: true, enum: ['created', 'captured', 'failed'] },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  { collection: 'payments', versionKey: false },
);
paymentSchema.index({ orderId: 1 });

const PaymentModel: Model<Payment> =
  (mongoose.models.Payment as Model<Payment>) ?? mongoose.model<Payment>('Payment', paymentSchema);

export class MongoPaymentRepository implements PaymentRepository {
  async create(payment: Payment): Promise<Payment> {
    const doc = await PaymentModel.create(payment);
    return doc.toObject() as Payment;
  }
  async findByIntent(intentId: string): Promise<Payment | null> {
    return PaymentModel.findOne({ intentId }).lean<Payment>().exec();
  }
  async setStatus(paymentId: string, status: PaymentStatus): Promise<void> {
    await PaymentModel.updateOne({ paymentId }, { $set: { status, updatedAt: new Date() } }).exec();
  }
}

/** Adapts CheckoutService to the payment domain's CheckoutPaymentPort. */
export class CheckoutServicePaymentPort implements CheckoutPaymentPort {
  constructor(private readonly checkout: CheckoutService) {}
  async getOrder(orderId: string) {
    try {
      const o = await this.checkout.getOrder(orderId);
      return { orderId: o.orderId, buyerUserId: o.buyerUserId, status: o.status, totalHalalat: o.totalHalalat };
    } catch (err) {
      if (err instanceof OrderNotFoundError) return null;
      throw err;
    }
  }
  async applyPaymentResult(orderId: string, outcome: 'captured' | 'failed', paymentRef: string): Promise<void> {
    await this.checkout.applyPaymentResult(orderId, outcome, paymentRef);
  }
}
