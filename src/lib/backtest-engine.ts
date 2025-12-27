import {
    Candle,
    Trade,
    Position,
    Signal,
    BacktestConfig,
    BacktestResult,
    StrategyParams,
    DEFAULT_BACKTEST_CONFIG
} from './types';
import { Strategy } from './strategy-base';
import { calculateMetrics } from './metrics/performance';

export class BacktestEngine {
    private config: BacktestConfig;
    private candles: Candle[] = [];
    private currentIndex: number = 0;
    private position: Position | null = null;
    private trades: Trade[] = [];
    private equity: number;
    private equityCurve: { timestamp: number; equity: number }[] = [];
    private tradeIdCounter: number = 0;

    constructor(config: Partial<BacktestConfig> = {}) {
        this.config = { ...DEFAULT_BACKTEST_CONFIG, ...config };
        this.equity = this.config.initialCapital;
    }

    /**
     * Run backtest on provided candle data with a strategy
     */
    run<T extends StrategyParams>(
        candles: Candle[],
        strategy: Strategy<T>
    ): BacktestResult {
        if (candles.length === 0) {
            throw new Error('No candle data provided');
        }

        // Reset state
        this.candles = candles;
        this.currentIndex = 0;
        this.position = null;
        this.trades = [];
        this.equity = this.config.initialCapital;
        this.equityCurve = [];
        this.tradeIdCounter = 0;

        // Initialize strategy
        strategy.init(this.candles, this.config);

        // Process each candle
        for (this.currentIndex = 0; this.currentIndex < this.candles.length; this.currentIndex++) {
            const candle = this.candles[this.currentIndex];

            // Check stop loss / take profit
            this.checkExitConditions(candle);

            // Get strategy signal
            const signal = strategy.onCandle(
                this.currentIndex,
                this.getHistoricalCandles(),
                this.position
            );

            // Execute signal
            if (signal) {
                this.executeSignal(signal, candle);
            }

            // Update equity curve
            this.updateEquityCurve(candle);
        }

        // Close any open position at end
        if (this.position) {
            const lastCandle = this.candles[this.candles.length - 1];
            this.closePosition(lastCandle.close, lastCandle.timestamp, 'End of backtest');
        }

        // Finalize strategy
        strategy.onComplete(this.trades);

        // Calculate metrics
        const metrics = calculateMetrics(
            this.trades,
            this.equityCurve,
            this.config.initialCapital,
            candles[0].timestamp,
            candles[candles.length - 1].timestamp
        );

        return {
            strategy: strategy.name,
            params: strategy.params as StrategyParams,
            config: this.config,
            trades: this.trades,
            equityCurve: this.equityCurve,
            metrics,
            startDate: candles[0].timestamp,
            endDate: candles[candles.length - 1].timestamp,
            candleCount: candles.length,
        };
    }

    /**
     * Get historical candles up to current index
     */
    private getHistoricalCandles(): Candle[] {
        return this.candles.slice(0, this.currentIndex + 1);
    }

    /**
     * Execute trading signal
     */
    private executeSignal(signal: Signal, candle: Candle): void {
        switch (signal.type) {
            case 'buy':
                if (this.position?.direction === 'short') {
                    this.closePosition(candle.close, candle.timestamp, 'Reverse to long');
                }
                if (!this.position) {
                    this.openPosition('long', candle, signal);
                }
                break;

            case 'sell':
                if (this.position?.direction === 'long') {
                    this.closePosition(candle.close, candle.timestamp, 'Reverse to short');
                }
                if (!this.position) {
                    this.openPosition('short', candle, signal);
                }
                break;

            case 'close':
                if (this.position) {
                    this.closePosition(candle.close, candle.timestamp, signal.reason || 'Signal close');
                }
                break;
        }
    }

    /**
     * Open a new position
     */
    private openPosition(
        direction: 'long' | 'short',
        candle: Candle,
        signal: Signal
    ): void {
        // Calculate position size
        const maxSize = this.equity * this.config.maxPositionSize * this.config.leverage;
        const size = signal.size
            ? Math.min(signal.size, maxSize)
            : maxSize;

        // Apply slippage and commission
        const slippage = this.config.slippage * 0.01; // Convert pips to price
        const entryPrice = direction === 'long'
            ? candle.close + slippage
            : candle.close - slippage;

        this.position = {
            id: `pos-${++this.tradeIdCounter}`,
            direction,
            entryTime: candle.timestamp,
            entryPrice,
            size,
            stopLoss: signal.stopLoss,
            takeProfit: signal.takeProfit,
        };
    }

    /**
     * Close current position
     */
    private closePosition(exitPrice: number, exitTime: number, reason?: string): void {
        if (!this.position) return;

        // Apply slippage
        const slippage = this.config.slippage * 0.01;
        const adjustedExitPrice = this.position.direction === 'long'
            ? exitPrice - slippage
            : exitPrice + slippage;

        // Calculate PnL
        const priceDiff = this.position.direction === 'long'
            ? adjustedExitPrice - this.position.entryPrice
            : this.position.entryPrice - adjustedExitPrice;

        const grossPnl = priceDiff * (this.position.size / this.position.entryPrice);
        const commission = this.position.size * this.config.commission * 2; // Entry + exit
        const netPnl = grossPnl - commission;
        const pnlPercent = (netPnl / this.config.initialCapital) * 100;

        // Create trade record
        const trade: Trade = {
            id: this.position.id,
            entryTime: this.position.entryTime,
            exitTime,
            entryPrice: this.position.entryPrice,
            exitPrice: adjustedExitPrice,
            direction: this.position.direction,
            size: this.position.size,
            pnl: netPnl,
            pnlPercent,
            stopLoss: this.position.stopLoss,
            takeProfit: this.position.takeProfit,
            commission,
        };

        this.trades.push(trade);
        this.equity += netPnl;
        this.position = null;
    }

    /**
     * Check if stop loss or take profit is hit
     */
    private checkExitConditions(candle: Candle): void {
        if (!this.position) return;

        const { stopLoss, takeProfit, direction } = this.position;

        if (direction === 'long') {
            // Check stop loss
            if (stopLoss && candle.low <= stopLoss) {
                this.closePosition(stopLoss, candle.timestamp, 'Stop loss hit');
                return;
            }
            // Check take profit
            if (takeProfit && candle.high >= takeProfit) {
                this.closePosition(takeProfit, candle.timestamp, 'Take profit hit');
                return;
            }
        } else {
            // Check stop loss
            if (stopLoss && candle.high >= stopLoss) {
                this.closePosition(stopLoss, candle.timestamp, 'Stop loss hit');
                return;
            }
            // Check take profit
            if (takeProfit && candle.low <= takeProfit) {
                this.closePosition(takeProfit, candle.timestamp, 'Take profit hit');
                return;
            }
        }
    }

    /**
     * Update equity curve with current equity
     */
    private updateEquityCurve(candle: Candle): void {
        let currentEquity = this.equity;

        // Add unrealized PnL if position is open
        if (this.position) {
            const priceDiff = this.position.direction === 'long'
                ? candle.close - this.position.entryPrice
                : this.position.entryPrice - candle.close;

            const unrealizedPnl = priceDiff * (this.position.size / this.position.entryPrice);
            currentEquity += unrealizedPnl;
        }

        this.equityCurve.push({
            timestamp: candle.timestamp,
            equity: currentEquity,
        });
    }

    /**
     * Get current configuration
     */
    getConfig(): BacktestConfig {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    setConfig(config: Partial<BacktestConfig>): void {
        this.config = { ...this.config, ...config };
    }
}

/**
 * Convenience function to run a backtest
 */
export function runBacktest<T extends StrategyParams>(
    candles: Candle[],
    strategy: Strategy<T>,
    config?: Partial<BacktestConfig>
): BacktestResult {
    const engine = new BacktestEngine(config);
    return engine.run(candles, strategy);
}
