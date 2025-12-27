import { Strategy, sma, crossover, crossunder, atr } from '../lib/strategy-base';
import { Candle, Position, Signal, StrategyParams } from '../lib/types';

export interface SMACrossoverParams extends StrategyParams {
    fastPeriod: number;
    slowPeriod: number;
    useAtrStopLoss: boolean;
    atrMultiplier: number;
    atrPeriod: number;
}

export const DEFAULT_SMA_PARAMS: SMACrossoverParams = {
    fastPeriod: 10,
    slowPeriod: 30,
    useAtrStopLoss: true,
    atrMultiplier: 2,
    atrPeriod: 14,
};

/**
 * SMA Crossover Strategy
 * 
 * Classic dual moving average crossover strategy:
 * - Buy when fast SMA crosses above slow SMA
 * - Sell when fast SMA crosses below slow SMA
 * - Optional ATR-based stop loss
 */
export class SMACrossoverStrategy extends Strategy<SMACrossoverParams> {
    readonly name = 'SMA Crossover';

    private fastSMA: number[] = [];
    private slowSMA: number[] = [];
    private atrValues: number[] = [];

    constructor(params: Partial<SMACrossoverParams> = {}) {
        super({ ...DEFAULT_SMA_PARAMS, ...params } as SMACrossoverParams);
    }

    protected onInit(): void {
        const closes = this.candles.map(c => c.close);
        this.fastSMA = sma(closes, this.params.fastPeriod);
        this.slowSMA = sma(closes, this.params.slowPeriod);

        if (this.params.useAtrStopLoss) {
            this.atrValues = atr(this.candles, this.params.atrPeriod);
        }
    }

    onCandle(index: number, _history: Candle[], position: Position | null): Signal | null {
        // Need enough data for the slow SMA
        if (index < this.params.slowPeriod) {
            return null;
        }

        const candle = this.candles[index];
        const currentATR = this.atrValues[index] || 0;

        // Check for crossover (buy signal)
        if (crossover(this.fastSMA, this.slowSMA, index)) {
            const stopLoss = this.params.useAtrStopLoss && currentATR > 0
                ? candle.close - (currentATR * this.params.atrMultiplier)
                : undefined;

            return {
                type: 'buy',
                stopLoss,
                reason: `Fast SMA (${this.params.fastPeriod}) crossed above Slow SMA (${this.params.slowPeriod})`,
            };
        }

        // Check for crossunder (sell signal)
        if (crossunder(this.fastSMA, this.slowSMA, index)) {
            // Close long position if exists
            if (position?.direction === 'long') {
                return {
                    type: 'close',
                    reason: `Fast SMA (${this.params.fastPeriod}) crossed below Slow SMA (${this.params.slowPeriod})`,
                };
            }

            // Open short position
            const stopLoss = this.params.useAtrStopLoss && currentATR > 0
                ? candle.close + (currentATR * this.params.atrMultiplier)
                : undefined;

            return {
                type: 'sell',
                stopLoss,
                reason: `Fast SMA (${this.params.fastPeriod}) crossed below Slow SMA (${this.params.slowPeriod})`,
            };
        }

        return null;
    }

    clone(params: SMACrossoverParams): SMACrossoverStrategy {
        return new SMACrossoverStrategy(params);
    }
}
