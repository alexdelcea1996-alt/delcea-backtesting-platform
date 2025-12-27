/**
 * 30-Minute Price Action Strategy
 * 
 * A comprehensive price action strategy with:
 * - S/R confluence zones
 * - Fibonacci retracement levels (0.36-0.72 buy zone, 0.667 short zone)
 * - Consolidation detection (10-20 pips range, 2hr, 4+ swing points)
 * - Wick confirmation (7-10+ pips)
 * - USA session timing filters
 */

import { Strategy, atr } from '../lib/strategy-base';
import { Candle, Position, Signal, StrategyParams } from '../lib/types';
import {
    aggregateCandles,
    calculateFibLevels,
    isInFibZone,
    FibonacciLevels,
    detectConsolidation,
    ConsolidationZone,
    detectSRZones,
    SRZone,
    findNearestZone,
    isZoneConfirmed,
} from '../lib/indicators';

export interface PriceAction30MParams extends StrategyParams {
    // Timeframe
    timeframeMinutes: number;

    // Consolidation detection
    consolidationMinRangePips: number;
    consolidationMaxRangePips: number;
    consolidationMinDuration: number;      // in minutes
    consolidationMinSwings: number;

    // Wick confirmation
    minWickPips: number;                   // 0.07-0.10 (7-10 pips)
    fullConfirmationWickPips: number;      // 0.10+ (10+ pips = 100% confirmation)

    // Entry timing
    entryWaitMinutes: number;              // Wait 2 min for green confirmation

    // Risk management
    slTpRatio: number;                     // Default 2:1
    useZoneTP: boolean;                    // Use next S/R zone as TP
    autoBreakevenPips: number;             // Move SL to entry after X pips profit (0.02 = 2 pips)

    // Counter-trend settings
    enableCounterTrend: boolean;
    maxCounterTrendPips: number;           // Max 0.10 (10 pips) profit in counter-trend

    // Fibonacci zones
    buyFibZoneLow: number;                 // 0.36
    buyFibZoneHigh: number;                // 0.72
    shortFibZone: number;                  // 0.667

    // S/R zones
    srZoneTolerance: number;
    srMinTouches: number;

    // Session filters (UTC hours)
    avoidUSAOpen1Hour: number;             // 15 (3PM UTC)
    avoidUSAOpen1Minute: number;           // 0
    avoidUSAOpen2Hour: number;             // 16 (4PM UTC)
    avoidUSAOpen2Minute: number;           // 30
    safeEntryAfterMinutes: number;         // 30 minutes after open
}

export const DEFAULT_PRICE_ACTION_30M_PARAMS: PriceAction30MParams = {
    // Timeframe
    timeframeMinutes: 30,

    // Consolidation (XAU/USD: 1 pip = $1, so 10-20 = $10-20 range)
    consolidationMinRangePips: 10,
    consolidationMaxRangePips: 20,
    consolidationMinDuration: 120,
    consolidationMinSwings: 4,

    // Wick confirmation (XAU/USD: 7-10 pips = $7-10) 
    minWickPips: 7,
    fullConfirmationWickPips: 10,

    // Entry timing
    entryWaitMinutes: 2,

    // Risk management
    slTpRatio: 2,
    useZoneTP: true,
    autoBreakevenPips: 2,  // $2 profit to move to breakeven

    // Counter-trend
    enableCounterTrend: true,
    maxCounterTrendPips: 10,  // Max $10 profit in counter-trend

    // Fibonacci
    buyFibZoneLow: 0.36,
    buyFibZoneHigh: 0.72,
    shortFibZone: 0.667,

    // S/R zones (tolerance = $5 range)
    srZoneTolerance: 5,
    srMinTouches: 2,

    // Session filters (UTC/EET times - adjust for your timezone)
    avoidUSAOpen1Hour: 13,     // 15:00 EET = 13:00 UTC
    avoidUSAOpen1Minute: 0,
    avoidUSAOpen2Hour: 14,     // 16:30 EET = 14:30 UTC
    avoidUSAOpen2Minute: 30,
    safeEntryAfterMinutes: 30,
};

/**
 * 30-Minute Price Action Strategy
 */
export class PriceAction30MStrategy extends Strategy<PriceAction30MParams> {
    readonly name = 'Price Action 30M';

    // Aggregated data
    private candles30M: Candle[] = [];
    private srZones: SRZone[] = [];
    private consolidationZones: ConsolidationZone[] = [];
    private fibLevels: FibonacciLevels | null = null;

    // Trend detection
    private currentTrend: 'up' | 'down' | 'neutral' = 'neutral';
    private lastSwingHigh = 0;
    private lastSwingLow = Infinity;

    // Entry state
    private pendingEntry: {
        direction: 'long' | 'short';
        confirmationTime: number;
        entryPrice: number;
        stopLoss: number;
        takeProfit: number;
        reason: string;
        isCounterTrend: boolean;
    } | null = null;

    constructor(params: Partial<PriceAction30MParams> = {}) {
        super({ ...DEFAULT_PRICE_ACTION_30M_PARAMS, ...params } as PriceAction30MParams);
    }

    protected onInit(): void {
        // Aggregate 1M candles to 30M
        this.candles30M = aggregateCandles(this.candles, this.params.timeframeMinutes);
        console.log(`PA30M: Aggregated ${this.candles.length} 1M candles to ${this.candles30M.length} 30M candles`);

        // Detect S/R zones
        this.srZones = detectSRZones(this.candles30M, {
            zoneTolerancePips: this.params.srZoneTolerance,
            minTouches: this.params.srMinTouches,
            lookbackCandles: 100,
        });
        console.log(`PA30M: Detected ${this.srZones.length} S/R zones`);

        // Detect consolidation zones
        this.consolidationZones = detectConsolidation(this.candles30M, {
            minRangePips: this.params.consolidationMinRangePips,
            maxRangePips: this.params.consolidationMaxRangePips,
            minDurationMinutes: this.params.consolidationMinDuration,
            minSwingPoints: this.params.consolidationMinSwings,
        });
        console.log(`PA30M: Detected ${this.consolidationZones.length} consolidation zones`);

        // Calculate ATR for volatility reference (used for dynamic SL sizing)
        const atrValues = atr(this.candles30M, 14);
        console.log(`PA30M: Calculated ATR. Latest: ${atrValues[atrValues.length - 1]?.toFixed(3) || 'N/A'}`);

        // Detect overall trend
        this.detectTrend();

        // Calculate Fibonacci from recent swing
        this.updateFibonacci();
    }

    private detectTrend(): void {
        if (this.candles30M.length < 20) {
            this.currentTrend = 'neutral';
            return;
        }

        const recent = this.candles30M.slice(-20);
        const highs = recent.map(c => c.high);
        const lows = recent.map(c => c.low);

        // Simple trend detection: compare first and last quarter
        const firstQuarter = recent.slice(0, 5);
        const lastQuarter = recent.slice(-5);

        const firstAvg = firstQuarter.reduce((s, c) => s + c.close, 0) / 5;
        const lastAvg = lastQuarter.reduce((s, c) => s + c.close, 0) / 5;

        this.lastSwingHigh = Math.max(...highs);
        this.lastSwingLow = Math.min(...lows);

        const diff = lastAvg - firstAvg;
        const threshold = this.params.consolidationMinRangePips * 2;

        if (diff > threshold) {
            this.currentTrend = 'up';
        } else if (diff < -threshold) {
            this.currentTrend = 'down';
        } else {
            this.currentTrend = 'neutral';
        }

        console.log(`PA30M: Detected trend: ${this.currentTrend}, SwingHigh: ${this.lastSwingHigh}, SwingLow: ${this.lastSwingLow}`);
    }

    private updateFibonacci(): void {
        if (this.lastSwingHigh > 0 && this.lastSwingLow < Infinity) {
            this.fibLevels = calculateFibLevels(this.lastSwingHigh, this.lastSwingLow);
        }
    }

    private get30MIndex(oneMinIndex: number): number {
        const targetTime = this.candles[oneMinIndex].timestamp;
        const periodMs = this.params.timeframeMinutes * 60 * 1000;
        const periodStart = Math.floor(targetTime / periodMs) * periodMs;

        return this.candles30M.findIndex(c => c.timestamp === periodStart);
    }

    private getWickSize(candle: Candle, direction: 'up' | 'down'): number {
        const bodyHigh = Math.max(candle.open, candle.close);
        const bodyLow = Math.min(candle.open, candle.close);

        if (direction === 'up') {
            return candle.high - bodyHigh; // Upper wick
        } else {
            return bodyLow - candle.low;   // Lower wick
        }
    }

    private isUSAOpenTime(timestamp: number): boolean {
        const date = new Date(timestamp);
        const hours = date.getUTCHours();
        const minutes = date.getUTCMinutes();

        // Check first USA open window (15:00 EET / 13:00 UTC)
        if (hours === this.params.avoidUSAOpen1Hour &&
            minutes >= this.params.avoidUSAOpen1Minute &&
            minutes < this.params.avoidUSAOpen1Minute + this.params.safeEntryAfterMinutes) {
            return true;
        }

        // Check second USA open window (16:30 EET / 14:30 UTC)
        if (hours === this.params.avoidUSAOpen2Hour &&
            minutes >= this.params.avoidUSAOpen2Minute &&
            minutes < this.params.avoidUSAOpen2Minute + this.params.safeEntryAfterMinutes) {
            return true;
        }

        return false;
    }

    private checkEntryConditions(index30M: number): {
        direction: 'long' | 'short';
        stopLoss: number;
        takeProfit: number;
        reason: string;
        isCounterTrend: boolean;
    } | null {
        if (index30M < 2 || index30M >= this.candles30M.length) return null;

        const candle = this.candles30M[index30M];
        const prevCandle = this.candles30M[index30M - 1];
        const price = candle.close;

        // Find nearest S/R zones for confluence checking
        const nearestSupport = findNearestZone(price, this.srZones.filter(z => z.type === 'support'), 'below');
        const nearestResistance = findNearestZone(price, this.srZones.filter(z => z.type === 'resistance'), 'above');

        // Check wick confirmation on previous candle
        const upperWick = this.getWickSize(prevCandle, 'up');
        const lowerWick = this.getWickSize(prevCandle, 'down');

        let direction: 'long' | 'short' | null = null;
        let stopLoss = 0;
        let takeProfit = 0;
        let reason = '';
        let isCounterTrend = false;

        // ===== BUY LOGIC =====
        // 1. In uptrend, look for entries in Fib 36-72 zone
        // 2. At confirmed support with wick rejection
        // 3. Strong wick rejection with any trend (bullish candle)

        const isBullishCandle = prevCandle.close > prevCandle.open;
        const isBearishCandle = prevCandle.close < prevCandle.open;

        // Strong wick rejection entry (any trend)
        if (lowerWick >= this.params.minWickPips && isBullishCandle) {
            // Additional check: wick should be larger than body
            const body = Math.abs(prevCandle.close - prevCandle.open);
            if (lowerWick >= body * 1.5) {
                direction = 'long';
                stopLoss = prevCandle.low;
                reason = `Strong lower wick rejection (${lowerWick.toFixed(1)} pts, ${(lowerWick / body).toFixed(1)}x body)`;

                // Add Fib zone context if applicable
                if (this.fibLevels && isInFibZone(price, this.fibLevels, this.params.buyFibZoneLow, this.params.buyFibZoneHigh)) {
                    reason += ` + Fib zone ${(this.params.buyFibZoneLow * 100).toFixed(0)}-${(this.params.buyFibZoneHigh * 100).toFixed(0)}%`;
                }
            }
        }

        // Check at support zone
        if (!direction && nearestSupport &&
            price >= nearestSupport.low && price <= nearestSupport.high * 1.001) {
            if (isZoneConfirmed(nearestSupport) && lowerWick >= this.params.minWickPips) {
                direction = 'long';
                stopLoss = prevCandle.low;
                reason = `Confirmed support zone (${nearestSupport.touches} touches) + wick rejection`;
            }
        }

        // ===== SELL LOGIC =====
        // Strong upper wick rejection (any trend, bearish candle)
        if (!direction && upperWick >= this.params.minWickPips && isBearishCandle) {
            const body = Math.abs(prevCandle.close - prevCandle.open);
            if (upperWick >= body * 1.5) {
                direction = 'short';
                stopLoss = prevCandle.high;
                reason = `Strong upper wick rejection (${upperWick.toFixed(1)} pts, ${(upperWick / body).toFixed(1)}x body)`;

                // Counter-trend if in uptrend
                if (this.currentTrend === 'up') {
                    isCounterTrend = true;
                    reason += ' [COUNTER-TREND]';
                }
            }
        }

        // Counter-trend short at 0.667 Fib level
        if (!direction && this.params.enableCounterTrend && this.fibLevels) {
            const fib667Zone = this.fibLevels.fib667;
            const tolerance = this.params.srZoneTolerance;

            if (price >= fib667Zone - tolerance && price <= fib667Zone + tolerance) {
                if (upperWick >= this.params.minWickPips) {
                    direction = 'short';
                    stopLoss = prevCandle.high;
                    reason = `Counter-trend short at Fib 66.7% + wick rejection`;
                    isCounterTrend = true;
                }
            }
        }

        // Check at resistance zone (if last low was broken = weakened)
        if (!direction && nearestResistance &&
            price <= nearestResistance.high && price >= nearestResistance.low * 0.999) {
            // Check if we're in a potential reversal area
            if (upperWick >= this.params.minWickPips) {
                direction = 'short';
                stopLoss = prevCandle.high;
                reason = `Resistance zone rejection (${nearestResistance.touches} touches)`;

                // This is counter-trend if overall trend is up
                if (this.currentTrend === 'up') {
                    isCounterTrend = true;
                    reason += ' [COUNTER-TREND]';
                }
            }
        }

        // Calculate take profit
        if (direction) {
            const slDistance = Math.abs(price - stopLoss);

            if (isCounterTrend) {
                // Counter-trend: max 10 pips profit
                takeProfit = direction === 'long'
                    ? price + Math.min(slDistance * this.params.slTpRatio, this.params.maxCounterTrendPips)
                    : price - Math.min(slDistance * this.params.slTpRatio, this.params.maxCounterTrendPips);
            } else if (this.params.useZoneTP) {
                // Use next S/R zone as TP
                const tpZone = direction === 'long' ? nearestResistance : nearestSupport;
                if (tpZone) {
                    takeProfit = tpZone.price;
                } else {
                    takeProfit = direction === 'long'
                        ? price + (slDistance * this.params.slTpRatio)
                        : price - (slDistance * this.params.slTpRatio);
                }
            } else {
                // Use fixed RR ratio
                takeProfit = direction === 'long'
                    ? price + (slDistance * this.params.slTpRatio)
                    : price - (slDistance * this.params.slTpRatio);
            }

            return { direction, stopLoss, takeProfit, reason, isCounterTrend };
        }

        return null;
    }

    onCandle(index: number, _history: Candle[], position: Position | null): Signal | null {
        const candle = this.candles[index];

        // Skip during USA open times
        if (this.isUSAOpenTime(candle.timestamp)) {
            return null;
        }

        // Get corresponding 30M candle index
        const index30M = this.get30MIndex(index);
        if (index30M < 0) return null;

        // Check for pending entry confirmation
        if (this.pendingEntry) {
            const elapsed = candle.timestamp - this.pendingEntry.confirmationTime;
            const waitMs = this.params.entryWaitMinutes * 60 * 1000;

            if (elapsed >= waitMs) {
                // Check if price is moving in the right direction (green)
                const isGreen = candle.close > candle.open;
                const isRed = candle.close < candle.open;

                const shouldEnter = (this.pendingEntry.direction === 'long' && isGreen) ||
                    (this.pendingEntry.direction === 'short' && isRed);

                if (shouldEnter) {
                    const entry = this.pendingEntry;
                    this.pendingEntry = null;

                    return {
                        type: entry.direction === 'long' ? 'buy' : 'sell',
                        stopLoss: entry.stopLoss,
                        takeProfit: entry.takeProfit,
                        reason: entry.reason,
                    };
                } else if (elapsed > waitMs * 2) {
                    // Cancel if not confirmed after 2x wait time
                    this.pendingEntry = null;
                }
            }

            return null;
        }

        // Only check for new entries at 30M candle boundaries
        const periodMs = this.params.timeframeMinutes * 60 * 1000;
        const isNewPeriod = candle.timestamp % periodMs < 60000; // Within first minute of period

        if (!isNewPeriod) return null;

        // Update S/R and consolidation zones periodically
        if (index % 100 === 0) {
            this.srZones = detectSRZones(this.candles30M.slice(0, index30M + 1), {
                zoneTolerancePips: this.params.srZoneTolerance,
                minTouches: this.params.srMinTouches,
                lookbackCandles: 100,
            });
            this.detectTrend();
            this.updateFibonacci();
        }

        // Check entry conditions
        const entry = this.checkEntryConditions(index30M);

        if (entry && !position) {
            // Set pending entry for confirmation
            this.pendingEntry = {
                ...entry,
                confirmationTime: candle.timestamp,
                entryPrice: candle.close,
            };

            console.log(`PA30M: Pending ${entry.direction} entry at ${candle.close}: ${entry.reason}`);
        }

        // Check for auto-breakeven on existing position
        if (position && this.params.autoBreakevenPips > 0) {
            const profit = position.direction === 'long'
                ? candle.close - position.entryPrice
                : position.entryPrice - candle.close;

            if (profit >= this.params.autoBreakevenPips && position.stopLoss !== position.entryPrice) {
                // Move SL to entry (breakeven)
                return {
                    type: position.direction === 'long' ? 'buy' : 'sell',
                    stopLoss: position.entryPrice,
                    reason: `Auto-breakeven triggered at ${(profit * 100).toFixed(1)} pips profit`,
                };
            }
        }

        return null;
    }

    clone(params: PriceAction30MParams): PriceAction30MStrategy {
        return new PriceAction30MStrategy(params);
    }
}
