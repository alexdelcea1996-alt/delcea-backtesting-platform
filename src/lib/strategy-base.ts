import { Candle, Position, Signal, StrategyParams, BacktestConfig, Trade } from './types';

/**
 * Abstract base class for trading strategies
 */
export abstract class Strategy<T extends StrategyParams = StrategyParams> {
    public abstract readonly name: string;
    public params: T;
    protected candles: Candle[] = [];
    protected config!: BacktestConfig;

    constructor(params: T) {
        this.params = params;
    }

    /**
     * Called once before backtest starts
     */
    init(candles: Candle[], config: BacktestConfig): void {
        this.candles = candles;
        this.config = config;
        this.onInit();
    }

    /**
     * Override to perform initialization logic
     */
    protected onInit(): void {
        // Override in subclass
    }

    /**
     * Called for each candle during backtest
     * @param index Current candle index
     * @param history All candles up to and including current
     * @param position Current open position (if any)
     * @returns Signal to execute, or null for no action
     */
    abstract onCandle(
        index: number,
        history: Candle[],
        position: Position | null
    ): Signal | null;

    /**
     * Called after backtest completes
     */
    onComplete(_trades: Trade[]): void {
        // Override in subclass for post-analysis
    }

    /**
     * Get parameter value with type safety
     */
    protected getParam<K extends keyof T>(key: K): T[K] {
        return this.params[key];
    }

    /**
     * Clone strategy with new parameters
     */
    abstract clone(params: T): Strategy<T>;
}

// ============================================================================
// TECHNICAL INDICATORS
// ============================================================================

/**
 * Simple Moving Average
 */
export function sma(data: number[], period: number): number[] {
    const result: number[] = [];

    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push(NaN);
        } else {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += data[i - j];
            }
            result.push(sum / period);
        }
    }

    return result;
}

/**
 * Exponential Moving Average
 */
export function ema(data: number[], period: number): number[] {
    const result: number[] = [];
    const multiplier = 2 / (period + 1);

    for (let i = 0; i < data.length; i++) {
        if (i === 0) {
            result.push(data[0]);
        } else if (i < period - 1) {
            // Use SMA until we have enough data
            let sum = 0;
            for (let j = 0; j <= i; j++) {
                sum += data[j];
            }
            result.push(sum / (i + 1));
        } else if (i === period - 1) {
            // First EMA is SMA
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += data[i - j];
            }
            result.push(sum / period);
        } else {
            result.push((data[i] - result[i - 1]) * multiplier + result[i - 1]);
        }
    }

    return result;
}

/**
 * Relative Strength Index
 */
export function rsi(closes: number[], period: number = 14): number[] {
    const result: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 0; i < closes.length; i++) {
        if (i === 0) {
            gains.push(0);
            losses.push(0);
            result.push(NaN);
            continue;
        }

        const change = closes[i] - closes[i - 1];
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? Math.abs(change) : 0);

        if (i < period) {
            result.push(NaN);
            continue;
        }

        let avgGain: number;
        let avgLoss: number;

        if (i === period) {
            // First RSI uses simple average
            avgGain = gains.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
            avgLoss = losses.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
        } else {
            // Subsequent RSIs use smoothed average
            const prevAvgGain = calculateAvgFromRSI(result[i - 1], period, gains[i - 1]);
            const prevAvgLoss = calculateAvgFromRSI(100 - result[i - 1], period, losses[i - 1]);
            avgGain = (prevAvgGain * (period - 1) + gains[i]) / period;
            avgLoss = (prevAvgLoss * (period - 1) + losses[i]) / period;
        }

        if (avgLoss === 0) {
            result.push(100);
        } else {
            const rs = avgGain / avgLoss;
            result.push(100 - (100 / (1 + rs)));
        }
    }

    return result;
}

function calculateAvgFromRSI(rsiValue: number, period: number, lastValue: number): number {
    // This is a simplified approximation
    if (isNaN(rsiValue)) return lastValue;
    const rs = rsiValue / (100 - rsiValue);
    return rs * 0.5; // Approximation
}

/**
 * RSI with proper smoothing (alternative implementation)
 */
export function rsiSmoothed(closes: number[], period: number = 14): number[] {
    const result: number[] = new Array(closes.length).fill(NaN);

    if (closes.length <= period) return result;

    let avgGain = 0;
    let avgLoss = 0;

    // Calculate initial averages using SMA
    for (let i = 1; i <= period; i++) {
        const change = closes[i] - closes[i - 1];
        if (change > 0) avgGain += change;
        else avgLoss += Math.abs(change);
    }
    avgGain /= period;
    avgLoss /= period;

    // First RSI value
    result[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

    // Subsequent values using smoothed averages
    for (let i = period + 1; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;

        result[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
    }

    return result;
}

/**
 * MACD (Moving Average Convergence Divergence)
 */
export function macd(
    closes: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
): { macd: number[]; signal: number[]; histogram: number[] } {
    const fastEMA = ema(closes, fastPeriod);
    const slowEMA = ema(closes, slowPeriod);

    const macdLine: number[] = [];
    for (let i = 0; i < closes.length; i++) {
        if (isNaN(fastEMA[i]) || isNaN(slowEMA[i])) {
            macdLine.push(NaN);
        } else {
            macdLine.push(fastEMA[i] - slowEMA[i]);
        }
    }

    const signalLine = ema(macdLine.map(v => isNaN(v) ? 0 : v), signalPeriod);

    const histogram: number[] = [];
    for (let i = 0; i < closes.length; i++) {
        if (isNaN(macdLine[i]) || isNaN(signalLine[i])) {
            histogram.push(NaN);
        } else {
            histogram.push(macdLine[i] - signalLine[i]);
        }
    }

    return { macd: macdLine, signal: signalLine, histogram };
}

/**
 * Bollinger Bands
 */
export function bollingerBands(
    closes: number[],
    period: number = 20,
    stdDev: number = 2
): { upper: number[]; middle: number[]; lower: number[] } {
    const middle = sma(closes, period);
    const upper: number[] = [];
    const lower: number[] = [];

    for (let i = 0; i < closes.length; i++) {
        if (i < period - 1) {
            upper.push(NaN);
            lower.push(NaN);
        } else {
            // Calculate standard deviation
            let sumSquares = 0;
            for (let j = 0; j < period; j++) {
                const diff = closes[i - j] - middle[i];
                sumSquares += diff * diff;
            }
            const std = Math.sqrt(sumSquares / period);

            upper.push(middle[i] + stdDev * std);
            lower.push(middle[i] - stdDev * std);
        }
    }

    return { upper, middle, lower };
}

/**
 * Average True Range
 */
export function atr(candles: Candle[], period: number = 14): number[] {
    const tr: number[] = [];

    for (let i = 0; i < candles.length; i++) {
        if (i === 0) {
            tr.push(candles[i].high - candles[i].low);
        } else {
            const high = candles[i].high;
            const low = candles[i].low;
            const prevClose = candles[i - 1].close;

            tr.push(Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            ));
        }
    }

    // Use smoothed average (Wilder's smoothing)
    const result: number[] = [];
    for (let i = 0; i < tr.length; i++) {
        if (i < period - 1) {
            result.push(NaN);
        } else if (i === period - 1) {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += tr[i - j];
            }
            result.push(sum / period);
        } else {
            result.push((result[i - 1] * (period - 1) + tr[i]) / period);
        }
    }

    return result;
}

/**
 * Highest high over period
 */
export function highest(data: number[], period: number): number[] {
    const result: number[] = [];

    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push(NaN);
        } else {
            let max = data[i];
            for (let j = 1; j < period; j++) {
                max = Math.max(max, data[i - j]);
            }
            result.push(max);
        }
    }

    return result;
}

/**
 * Lowest low over period
 */
export function lowest(data: number[], period: number): number[] {
    const result: number[] = [];

    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push(NaN);
        } else {
            let min = data[i];
            for (let j = 1; j < period; j++) {
                min = Math.min(min, data[i - j]);
            }
            result.push(min);
        }
    }

    return result;
}

/**
 * Standard Deviation
 */
export function stdDev(data: number[], period: number): number[] {
    const ma = sma(data, period);
    const result: number[] = [];

    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push(NaN);
        } else {
            let sumSquares = 0;
            for (let j = 0; j < period; j++) {
                const diff = data[i - j] - ma[i];
                sumSquares += diff * diff;
            }
            result.push(Math.sqrt(sumSquares / period));
        }
    }

    return result;
}

/**
 * Crossover detection - returns true when fast crosses above slow
 */
export function crossover(fast: number[], slow: number[], index: number): boolean {
    if (index < 1) return false;
    if (isNaN(fast[index]) || isNaN(slow[index]) || isNaN(fast[index - 1]) || isNaN(slow[index - 1])) {
        return false;
    }
    return fast[index - 1] <= slow[index - 1] && fast[index] > slow[index];
}

/**
 * Crossunder detection - returns true when fast crosses below slow
 */
export function crossunder(fast: number[], slow: number[], index: number): boolean {
    if (index < 1) return false;
    if (isNaN(fast[index]) || isNaN(slow[index]) || isNaN(fast[index - 1]) || isNaN(slow[index - 1])) {
        return false;
    }
    return fast[index - 1] >= slow[index - 1] && fast[index] < slow[index];
}
