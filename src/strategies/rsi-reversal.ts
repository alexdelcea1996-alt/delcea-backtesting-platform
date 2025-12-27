import { Strategy, rsiSmoothed, atr } from '../lib/strategy-base';
import { Candle, Position, Signal, StrategyParams } from '../lib/types';

export interface RSIReversalParams extends StrategyParams {
    rsiPeriod: number;
    oversoldLevel: number;
    overboughtLevel: number;
    useAtrStopLoss: boolean;
    atrMultiplier: number;
    atrPeriod: number;
    takeProfitRatio: number; // Risk-reward ratio
}

export const DEFAULT_RSI_PARAMS: RSIReversalParams = {
    rsiPeriod: 14,
    oversoldLevel: 30,
    overboughtLevel: 70,
    useAtrStopLoss: true,
    atrMultiplier: 1.5,
    atrPeriod: 14,
    takeProfitRatio: 2, // 2:1 risk-reward
};

/**
 * RSI Reversal Strategy
 * 
 * Mean reversion strategy based on RSI:
 * - Buy when RSI crosses above oversold level (coming from oversold)
 * - Sell when RSI crosses below overbought level (coming from overbought)
 * - Uses ATR for stop-loss and take-profit levels
 */
export class RSIReversalStrategy extends Strategy<RSIReversalParams> {
    readonly name = 'RSI Reversal';

    private rsiValues: number[] = [];
    private atrValues: number[] = [];
    private wasOversold: boolean = false;
    private wasOverbought: boolean = false;

    constructor(params: Partial<RSIReversalParams> = {}) {
        super({ ...DEFAULT_RSI_PARAMS, ...params } as RSIReversalParams);
    }

    protected onInit(): void {
        const closes = this.candles.map(c => c.close);
        this.rsiValues = rsiSmoothed(closes, this.params.rsiPeriod);
        this.atrValues = atr(this.candles, this.params.atrPeriod);
        this.wasOversold = false;
        this.wasOverbought = false;
    }

    onCandle(index: number, _history: Candle[], position: Position | null): Signal | null {
        if (index < this.params.rsiPeriod + 1) {
            return null;
        }

        const currentRSI = this.rsiValues[index];
        const prevRSI = this.rsiValues[index - 1];
        const candle = this.candles[index];
        const currentATR = this.atrValues[index] || 0;

        if (isNaN(currentRSI) || isNaN(prevRSI)) {
            return null;
        }

        // Track oversold/overbought states
        if (prevRSI < this.params.oversoldLevel) {
            this.wasOversold = true;
        }
        if (prevRSI > this.params.overboughtLevel) {
            this.wasOverbought = true;
        }

        // Buy signal: RSI crosses above oversold level after being oversold
        if (this.wasOversold &&
            prevRSI <= this.params.oversoldLevel &&
            currentRSI > this.params.oversoldLevel) {

            this.wasOversold = false;

            const riskAmount = currentATR * this.params.atrMultiplier;
            const stopLoss = this.params.useAtrStopLoss ? candle.close - riskAmount : undefined;
            const takeProfit = stopLoss ? candle.close + (riskAmount * this.params.takeProfitRatio) : undefined;

            return {
                type: 'buy',
                stopLoss,
                takeProfit,
                reason: `RSI (${currentRSI.toFixed(1)}) crossed above ${this.params.oversoldLevel}`,
            };
        }

        // Sell signal: RSI crosses below overbought level after being overbought
        if (this.wasOverbought &&
            prevRSI >= this.params.overboughtLevel &&
            currentRSI < this.params.overboughtLevel) {

            this.wasOverbought = false;

            // Close long position if exists
            if (position?.direction === 'long') {
                return {
                    type: 'close',
                    reason: `RSI (${currentRSI.toFixed(1)}) crossed below ${this.params.overboughtLevel}`,
                };
            }

            const riskAmount = currentATR * this.params.atrMultiplier;
            const stopLoss = this.params.useAtrStopLoss ? candle.close + riskAmount : undefined;
            const takeProfit = stopLoss ? candle.close - (riskAmount * this.params.takeProfitRatio) : undefined;

            return {
                type: 'sell',
                stopLoss,
                takeProfit,
                reason: `RSI (${currentRSI.toFixed(1)}) crossed below ${this.params.overboughtLevel}`,
            };
        }

        return null;
    }

    clone(params: RSIReversalParams): RSIReversalStrategy {
        return new RSIReversalStrategy(params);
    }
}
