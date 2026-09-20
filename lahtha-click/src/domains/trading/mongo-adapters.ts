// Mongoose repositories for the trading domain's journal (signals, portfolio, trades).

import mongoose, { Schema, type Model } from 'mongoose';
import type { PortfolioRepository, PortfolioState, Signal, SignalRepository, TradeRecord, TradeRepository } from './types.js';

const signalSchema = new Schema<Signal>(
  {
    signalId: { type: String, required: true, unique: true },
    tradeDate: { type: String, required: true, unique: true },
    symbol: { type: String, required: true },
    direction: { type: String, required: true, enum: ['spot_long', 'futures_long'] },
    leverage: { type: Number, required: true },
    entryLow: { type: Number, required: true },
    entryHigh: { type: Number, required: true },
    takeProfit: { type: Number, required: true },
    stopLoss: { type: Number, required: true },
    riskRewardRatio: { type: Number, required: true },
    allocationPct: { type: Number, required: true },
    justification: { type: [String], required: true },
    compositeScore: { type: Number, required: true },
    createdAt: { type: Date, required: true },
  },
  { collection: 'trading_signals', versionKey: false },
);
signalSchema.index({ createdAt: -1 });

const SignalModel: Model<Signal> = (mongoose.models.TradingSignal as Model<Signal>) ?? mongoose.model<Signal>('TradingSignal', signalSchema);

export class MongoSignalRepository implements SignalRepository {
  async create(signal: Signal): Promise<Signal> {
    const doc = await SignalModel.create(signal);
    return doc.toObject() as Signal;
  }
  async findByDate(tradeDate: string): Promise<Signal | null> {
    return SignalModel.findOne({ tradeDate }).lean<Signal>().exec();
  }
  async findById(signalId: string): Promise<Signal | null> {
    return SignalModel.findOne({ signalId }).lean<Signal>().exec();
  }
  async listRecent(limit: number): Promise<Signal[]> {
    return SignalModel.find().sort({ createdAt: -1 }).limit(limit).lean<Signal[]>().exec();
  }
}

const portfolioSchema = new Schema<PortfolioState>(
  {
    portfolioId: { type: String, required: true, unique: true },
    equityUsdCents: { type: Number, required: true },
    startingEquityUsdCents: { type: Number, required: true },
    targetEquityUsdCents: { type: Number, required: true },
    peakEquityUsdCents: { type: Number, required: true },
    tradeCount: { type: Number, required: true },
    wins: { type: Number, required: true },
    losses: { type: Number, required: true },
    executionPaused: { type: Boolean, required: true, default: false },
    updatedAt: { type: Date, required: true },
  },
  { collection: 'trading_portfolio', versionKey: false },
);

const PortfolioModel: Model<PortfolioState> =
  (mongoose.models.TradingPortfolio as Model<PortfolioState>) ?? mongoose.model<PortfolioState>('TradingPortfolio', portfolioSchema);

export class MongoPortfolioRepository implements PortfolioRepository {
  async get(portfolioId: string): Promise<PortfolioState | null> {
    return PortfolioModel.findOne({ portfolioId }).lean<PortfolioState>().exec();
  }
  async save(state: PortfolioState): Promise<PortfolioState> {
    const doc = await PortfolioModel.findOneAndUpdate({ portfolioId: state.portfolioId }, { $set: state }, { new: true, upsert: true })
      .lean<PortfolioState>()
      .exec();
    return doc!;
  }
}

const tradeSchema = new Schema<TradeRecord>(
  {
    tradeId: { type: String, required: true, unique: true },
    signalId: { type: String, required: true, unique: true },
    outcome: { type: String, required: true, enum: ['win', 'loss', 'breakeven'] },
    realizedPnlUsdCents: { type: Number, required: true },
    equityAfterUsdCents: { type: Number, required: true },
    closedAt: { type: Date, required: true },
    closedByUserId: { type: String, required: true },
  },
  { collection: 'trading_trades', versionKey: false },
);
tradeSchema.index({ closedAt: -1 });

const TradeModel: Model<TradeRecord> = (mongoose.models.TradingTrade as Model<TradeRecord>) ?? mongoose.model<TradeRecord>('TradingTrade', tradeSchema);

export class MongoTradeRepository implements TradeRepository {
  async create(trade: TradeRecord): Promise<TradeRecord> {
    const doc = await TradeModel.create(trade);
    return doc.toObject() as TradeRecord;
  }
  async findBySignal(signalId: string): Promise<TradeRecord | null> {
    return TradeModel.findOne({ signalId }).lean<TradeRecord>().exec();
  }
  async listRecent(limit: number): Promise<TradeRecord[]> {
    return TradeModel.find().sort({ closedAt: -1 }).limit(limit).lean<TradeRecord[]>().exec();
  }
}
