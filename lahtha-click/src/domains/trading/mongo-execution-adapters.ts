import mongoose, { Schema, type Model } from 'mongoose';
import type { ExecutionRecord, ExecutionRepository } from './execution-types.js';

const executionSchema = new Schema<ExecutionRecord>(
  {
    executionId: { type: String, required: true, unique: true },
    signalId: { type: String, required: true, unique: true },
    symbol: { type: String, required: true },
    direction: { type: String, required: true, enum: ['spot_long', 'futures_long'] },
    environment: { type: String, required: true, enum: ['testnet', 'mainnet'] },
    status: { type: String, required: true, enum: ['placed', 'failed', 'closed'] },
    notionalUsd: { type: Number, required: true },
    executedQty: { type: Number, required: true },
    executedPrice: { type: Number, required: true },
    entryOrderId: { type: String, required: true },
    takeProfitOrderId: { type: String, default: null },
    stopLossOrderId: { type: String, default: null },
    outcome: { type: String, enum: ['take_profit', 'stop_loss'], default: null },
    exitPrice: { type: Number, default: null },
    errorMessage: { type: String, default: null },
    createdAt: { type: Date, required: true },
    closedAt: { type: Date, default: null },
  },
  { collection: 'trading_executions', versionKey: false },
);
executionSchema.index({ status: 1, createdAt: -1 });

const ExecutionModel: Model<ExecutionRecord> =
  (mongoose.models.TradingExecution as Model<ExecutionRecord>) ?? mongoose.model<ExecutionRecord>('TradingExecution', executionSchema);

export class MongoExecutionRepository implements ExecutionRepository {
  async create(record: ExecutionRecord): Promise<ExecutionRecord> {
    const doc = await ExecutionModel.create(record);
    return doc.toObject() as ExecutionRecord;
  }
  async findBySignal(signalId: string): Promise<ExecutionRecord | null> {
    return ExecutionModel.findOne({ signalId }).lean<ExecutionRecord>().exec();
  }
  async update(record: ExecutionRecord): Promise<ExecutionRecord> {
    const doc = await ExecutionModel.findOneAndUpdate({ executionId: record.executionId }, { $set: record }, { new: true })
      .lean<ExecutionRecord>()
      .exec();
    return doc!;
  }
  async listRecent(limit: number): Promise<ExecutionRecord[]> {
    return ExecutionModel.find().sort({ createdAt: -1 }).limit(limit).lean<ExecutionRecord[]>().exec();
  }
  async listOpen(limit: number): Promise<ExecutionRecord[]> {
    return ExecutionModel.find({ status: 'placed' }).sort({ createdAt: -1 }).limit(limit).lean<ExecutionRecord[]>().exec();
  }
}
