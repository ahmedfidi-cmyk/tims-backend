import type { Clock, PortfolioRepository, PortfolioState, Signal, SignalRepository, TradeRecord, TradeRepository } from './types.js';

export class InMemorySignalRepository implements SignalRepository {
  private readonly byId = new Map<string, Signal>();
  async create(signal: Signal): Promise<Signal> {
    this.byId.set(signal.signalId, { ...signal });
    return { ...signal };
  }
  async findByDate(tradeDate: string): Promise<Signal | null> {
    for (const s of this.byId.values()) if (s.tradeDate === tradeDate) return { ...s };
    return null;
  }
  async findById(signalId: string): Promise<Signal | null> {
    const s = this.byId.get(signalId);
    return s ? { ...s } : null;
  }
  async listRecent(limit: number): Promise<Signal[]> {
    return [...this.byId.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
  }
}

export class InMemoryPortfolioRepository implements PortfolioRepository {
  private readonly byId = new Map<string, PortfolioState>();
  async get(portfolioId: string): Promise<PortfolioState | null> {
    const p = this.byId.get(portfolioId);
    return p ? { ...p } : null;
  }
  async save(state: PortfolioState): Promise<PortfolioState> {
    this.byId.set(state.portfolioId, { ...state });
    return { ...state };
  }
}

export class InMemoryTradeRepository implements TradeRepository {
  private readonly byId = new Map<string, TradeRecord>();
  async create(trade: TradeRecord): Promise<TradeRecord> {
    this.byId.set(trade.tradeId, { ...trade });
    return { ...trade };
  }
  async findBySignal(signalId: string): Promise<TradeRecord | null> {
    for (const t of this.byId.values()) if (t.signalId === signalId) return { ...t };
    return null;
  }
  async listRecent(limit: number): Promise<TradeRecord[]> {
    return [...this.byId.values()].sort((a, b) => b.closedAt.getTime() - a.closedAt.getTime()).slice(0, limit);
  }
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
