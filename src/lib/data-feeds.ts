/**
 * Real-Time Data Feeds
 * 
 * Provides simulated and real-time XAU/USD price data
 * with WebSocket-like interface for live updates.
 */

import { Candle } from './types';

export interface Tick {
    timestamp: number;
    bid: number;
    ask: number;
    last: number;
    volume: number;
}

export interface LiveCandle extends Candle {
    isComplete: boolean;
}

export type TickHandler = (tick: Tick) => void;
export type CandleHandler = (candle: LiveCandle) => void;

export interface DataFeedConfig {
    symbol: string;
    interval: number; // Candle interval in milliseconds
    spread: number; // Simulated spread in price units
    volatility: number; // Price volatility factor
    basePrice: number; // Starting price
}

export const DEFAULT_FEED_CONFIG: DataFeedConfig = {
    symbol: 'XAUUSD',
    interval: 60000, // 1 minute candles
    spread: 0.30,
    volatility: 0.0002, // 0.02% per tick
    basePrice: 2650.00
};

/**
 * Simulated Real-Time Price Generator
 * 
 * Uses geometric Brownian motion for realistic price simulation.
 */
export class SimulatedDataFeed {
    private config: DataFeedConfig;
    private currentPrice: number;
    private tickInterval: number | null = null;
    private candleInterval: number | null = null;
    private tickHandlers: TickHandler[] = [];
    private candleHandlers: CandleHandler[] = [];
    private currentCandle: LiveCandle | null = null;
    private isRunning: boolean = false;
    private tickCount: number = 0;

    constructor(config: Partial<DataFeedConfig> = {}) {
        this.config = { ...DEFAULT_FEED_CONFIG, ...config };
        this.currentPrice = this.config.basePrice;
    }

    /**
     * Generate next price using random walk with mean reversion
     */
    private generateNextPrice(): number {
        // Random walk with slight mean reversion to base price
        const drift = (this.config.basePrice - this.currentPrice) * 0.0001;
        const randomShock = (Math.random() - 0.5) * 2 * this.config.volatility;
        const change = this.currentPrice * (drift + randomShock);

        this.currentPrice = Math.max(
            this.config.basePrice * 0.9, // Don't go below 90% of base
            Math.min(this.config.basePrice * 1.1, this.currentPrice + change) // Don't go above 110%
        );

        return this.currentPrice;
    }

    /**
     * Generate a tick
     */
    private generateTick(): Tick {
        const price = this.generateNextPrice();
        const halfSpread = this.config.spread / 2;

        this.tickCount++;

        return {
            timestamp: Date.now(),
            bid: price - halfSpread,
            ask: price + halfSpread,
            last: price + (Math.random() - 0.5) * this.config.spread,
            volume: Math.floor(Math.random() * 100) + 1
        };
    }

    /**
     * Start live data feed
     */
    start(tickFrequencyMs: number = 1000): void {
        if (this.isRunning) return;

        this.isRunning = true;
        this.currentCandle = null;

        // Start tick generation
        this.tickInterval = window.setInterval(() => {
            const tick = this.generateTick();

            // Update current candle
            this.updateCandle(tick);

            // Notify tick handlers
            this.tickHandlers.forEach(handler => handler(tick));
        }, tickFrequencyMs);

        // Check candle completion
        this.candleInterval = window.setInterval(() => {
            if (this.currentCandle) {
                const elapsed = Date.now() - this.currentCandle.timestamp;
                if (elapsed >= this.config.interval) {
                    // Complete current candle
                    this.currentCandle.isComplete = true;
                    this.candleHandlers.forEach(handler => handler({ ...this.currentCandle! }));

                    // Start new candle
                    this.currentCandle = null;
                }
            }
        }, 1000);
    }

    /**
     * Update current candle with new tick
     */
    private updateCandle(tick: Tick): void {
        if (!this.currentCandle) {
            // Start new candle
            this.currentCandle = {
                timestamp: Date.now(),
                open: tick.last,
                high: tick.last,
                low: tick.last,
                close: tick.last,
                volume: tick.volume,
                isComplete: false
            };
        } else {
            // Update existing candle
            this.currentCandle.high = Math.max(this.currentCandle.high, tick.last);
            this.currentCandle.low = Math.min(this.currentCandle.low, tick.last);
            this.currentCandle.close = tick.last;
            this.currentCandle.volume = (this.currentCandle.volume || 0) + tick.volume;
        }

        // Notify handlers of partial candle update
        this.candleHandlers.forEach(handler => handler({ ...this.currentCandle! }));
    }

    /**
     * Stop live data feed
     */
    stop(): void {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
        if (this.candleInterval) {
            clearInterval(this.candleInterval);
            this.candleInterval = null;
        }
        this.isRunning = false;
    }

    /**
     * Subscribe to tick updates
     */
    onTick(handler: TickHandler): () => void {
        this.tickHandlers.push(handler);
        return () => {
            this.tickHandlers = this.tickHandlers.filter(h => h !== handler);
        };
    }

    /**
     * Subscribe to candle updates
     */
    onCandle(handler: CandleHandler): () => void {
        this.candleHandlers.push(handler);
        return () => {
            this.candleHandlers = this.candleHandlers.filter(h => h !== handler);
        };
    }

    /**
     * Get current status
     */
    getStatus(): { running: boolean; price: number; tickCount: number; symbol: string } {
        return {
            running: this.isRunning,
            price: this.currentPrice,
            tickCount: this.tickCount,
            symbol: this.config.symbol
        };
    }

    /**
     * Get current candle
     */
    getCurrentCandle(): LiveCandle | null {
        return this.currentCandle ? { ...this.currentCandle } : null;
    }

    /**
     * Set price manually (for testing)
     */
    setPrice(price: number): void {
        this.currentPrice = price;
    }
}

/**
 * Paper Trading Simulator
 */
export interface PaperPosition {
    id: string;
    direction: 'long' | 'short';
    entryPrice: number;
    entryTime: number;
    size: number;
    stopLoss?: number;
    takeProfit?: number;
    unrealizedPnl: number;
}

export interface PaperTrade {
    id: string;
    direction: 'long' | 'short';
    entryPrice: number;
    exitPrice: number;
    entryTime: number;
    exitTime: number;
    size: number;
    pnl: number;
}

export class PaperTradingSimulator {
    private balance: number;
    private initialBalance: number;
    private positions: PaperPosition[] = [];
    private trades: PaperTrade[] = [];
    private idCounter: number = 0;

    constructor(initialBalance: number = 10000) {
        this.initialBalance = initialBalance;
        this.balance = initialBalance;
    }

    /**
     * Open a new position
     */
    openPosition(
        direction: 'long' | 'short',
        currentPrice: number,
        size: number,
        stopLoss?: number,
        takeProfit?: number
    ): PaperPosition {
        const position: PaperPosition = {
            id: `pos_${++this.idCounter}`,
            direction,
            entryPrice: currentPrice,
            entryTime: Date.now(),
            size,
            stopLoss,
            takeProfit,
            unrealizedPnl: 0
        };

        this.positions.push(position);
        return position;
    }

    /**
     * Close a position
     */
    closePosition(positionId: string, currentPrice: number): PaperTrade | null {
        const posIdx = this.positions.findIndex(p => p.id === positionId);
        if (posIdx === -1) return null;

        const position = this.positions[posIdx];
        const pnl = this.calculatePnl(position, currentPrice);

        const trade: PaperTrade = {
            id: `trade_${++this.idCounter}`,
            direction: position.direction,
            entryPrice: position.entryPrice,
            exitPrice: currentPrice,
            entryTime: position.entryTime,
            exitTime: Date.now(),
            size: position.size,
            pnl
        };

        this.balance += pnl;
        this.trades.push(trade);
        this.positions.splice(posIdx, 1);

        return trade;
    }

    /**
     * Update positions with current price
     */
    updatePositions(currentPrice: number): void {
        for (const position of this.positions) {
            position.unrealizedPnl = this.calculatePnl(position, currentPrice);

            // Check stop loss and take profit
            if (position.stopLoss) {
                const slHit = position.direction === 'long'
                    ? currentPrice <= position.stopLoss
                    : currentPrice >= position.stopLoss;
                if (slHit) {
                    this.closePosition(position.id, position.stopLoss);
                }
            }

            if (position.takeProfit) {
                const tpHit = position.direction === 'long'
                    ? currentPrice >= position.takeProfit
                    : currentPrice <= position.takeProfit;
                if (tpHit) {
                    this.closePosition(position.id, position.takeProfit);
                }
            }
        }
    }

    /**
     * Calculate P&L for a position
     */
    private calculatePnl(position: PaperPosition, currentPrice: number): number {
        const priceDiff = currentPrice - position.entryPrice;
        const multiplier = position.direction === 'long' ? 1 : -1;
        return priceDiff * position.size * multiplier;
    }

    /**
     * Get account state
     */
    getAccountState(): {
        balance: number;
        equity: number;
        unrealizedPnl: number;
        positions: PaperPosition[];
        trades: PaperTrade[];
        profitPercent: number;
    } {
        const unrealizedPnl = this.positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
        const equity = this.balance + unrealizedPnl;

        return {
            balance: this.balance,
            equity,
            unrealizedPnl,
            positions: [...this.positions],
            trades: [...this.trades],
            profitPercent: ((equity - this.initialBalance) / this.initialBalance) * 100
        };
    }

    /**
     * Reset simulator
     */
    reset(): void {
        this.balance = this.initialBalance;
        this.positions = [];
        this.trades = [];
    }
}
