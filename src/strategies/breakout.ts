import { Strategy, highest, lowest, atr } from '../lib/strategy-base';
import { Candle, Position, Signal, StrategyParams } from '../lib/types';

export interface BreakoutParams extends StrategyParams {
    lookbackPeriod: number;
    atrPeriod: number;
    atrMultiplier: number;
    takeProfitRatio: number;
    waitForClose: boolean; // Wait for candle close to confirm breakout
}

export const DEFAULT_BREAKOUT_PARAMS: BreakoutParams = {
    lookbackPeriod: 20,
    atrPeriod: 14,
    atrMultiplier: 1.5,
    takeProfitRatio: 2,
    waitForClose: true,
};

/**
 * Breakout Strategy
 * 
 * Price channel breakout strategy:
 * - Buy when price breaks above highest high of lookback period
 * - Sell when price breaks below lowest low of lookback period
 * - Uses ATR for position sizing and risk management
 */
export class BreakoutStrategy extends Strategy<BreakoutParams> {
    readonly name = 'Breakout';

    private highestHighs: number[] = [];
    private lowestLows: number[] = [];
    private atrValues: number[] = [];
    private lastBreakoutDirection: 'up' | 'down' | null = null;

    constructor(params: Partial<BreakoutParams> = {}) {
        super({ ...DEFAULT_BREAKOUT_PARAMS, ...params } as BreakoutParams);
    }

    protected onInit(): void {
        const highs = this.candles.map(c => c.high);
        const lows = this.candles.map(c => c.low);

        // Use highest of previous candles (excluding current)
        this.highestHighs = highest(highs, this.params.lookbackPeriod);
        this.lowestLows = lowest(lows, this.params.lookbackPeriod);
        this.atrValues = atr(this.candles, this.params.atrPeriod);
        this.lastBreakoutDirection = null;
    }

    onCandle(index: number, _history: Candle[], position: Position | null): Signal | null {
        if (index < this.params.lookbackPeriod + 1) {
            return null;
        }

        const candle = this.candles[index];
        const prevCandle = this.candles[index - 1];
        const currentATR = this.atrValues[index] || 0;

        // Use previous candle's channel levels (not including current candle)
        const channelHigh = this.highestHighs[index - 1];
        const channelLow = this.lowestLows[index - 1];

        if (isNaN(channelHigh) || isNaN(channelLow)) {
            return null;
        }

        // Upside breakout
        const isUpBreakout = this.params.waitForClose
            ? candle.close > channelHigh && prevCandle.close <= channelHigh
            : candle.high > channelHigh && prevCandle.high <= channelHigh;

        if (isUpBreakout && this.lastBreakoutDirection !== 'up') {
            this.lastBreakoutDirection = 'up';

            // Close short position if exists
            if (position?.direction === 'short') {
                return { type: 'close', reason: 'Upside breakout - reversing position' };
            }

            if (!position) {
                const riskAmount = currentATR * this.params.atrMultiplier;

                return {
                    type: 'buy',
                    stopLoss: candle.close - riskAmount,
                    takeProfit: candle.close + (riskAmount * this.params.takeProfitRatio),
                    reason: `Price broke above ${this.params.lookbackPeriod}-period high (${channelHigh.toFixed(2)})`,
                };
            }
        }

        // Downside breakout
        const isDownBreakout = this.params.waitForClose
            ? candle.close < channelLow && prevCandle.close >= channelLow
            : candle.low < channelLow && prevCandle.low >= channelLow;

        if (isDownBreakout && this.lastBreakoutDirection !== 'down') {
            this.lastBreakoutDirection = 'down';

            // Close long position if exists
            if (position?.direction === 'long') {
                return { type: 'close', reason: 'Downside breakout - reversing position' };
            }

            if (!position) {
                const riskAmount = currentATR * this.params.atrMultiplier;

                return {
                    type: 'sell',
                    stopLoss: candle.close + riskAmount,
                    takeProfit: candle.close - (riskAmount * this.params.takeProfitRatio),
                    reason: `Price broke below ${this.params.lookbackPeriod}-period low (${channelLow.toFixed(2)})`,
                };
            }
        }

        return null;
    }

    clone(params: BreakoutParams): BreakoutStrategy {
        return new BreakoutStrategy(params);
    }
}
