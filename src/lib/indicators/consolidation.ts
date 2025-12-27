/**
 * Consolidation Zone Detection
 * Identifies periods of price consolidation (tight range trading)
 */

import { Candle } from '../types';

export interface ConsolidationConfig {
    minRangePips: number;       // Minimum range in pips (e.g., 0.10)
    maxRangePips: number;       // Maximum range in pips (e.g., 0.20)
    minDurationMinutes: number; // Minimum duration (~120 minutes / 2 hours)
    minSwingPoints: number;     // Minimum HH/LL swing points (4)
}

export interface SwingPoint {
    type: 'HH' | 'HL' | 'LH' | 'LL';
    price: number;
    timestamp: number;
    index: number;
}

export interface ConsolidationZone {
    startTime: number;
    endTime: number;
    startIndex: number;
    endIndex: number;
    high: number;
    low: number;
    range: number;
    swingPoints: SwingPoint[];
    isConfirmed: boolean;       // Has HH-LL or LL-HH pattern
}

export const DEFAULT_CONSOLIDATION_CONFIG: ConsolidationConfig = {
    minRangePips: 0.10,         // 10 pips
    maxRangePips: 0.20,         // 20 pips
    minDurationMinutes: 120,    // 2 hours
    minSwingPoints: 4,          // 4 swing points
};

/**
 * Detect swing points (local highs and lows) in price data
 */
export function detectSwingPoints(candles: Candle[], lookback: number = 3): SwingPoint[] {
    const swings: SwingPoint[] = [];

    for (let i = lookback; i < candles.length - lookback; i++) {
        const current = candles[i];
        const leftCandles = candles.slice(i - lookback, i);
        const rightCandles = candles.slice(i + 1, i + 1 + lookback);

        const isSwingHigh = leftCandles.every(c => c.high < current.high) &&
            rightCandles.every(c => c.high < current.high);
        const isSwingLow = leftCandles.every(c => c.low > current.low) &&
            rightCandles.every(c => c.low > current.low);

        if (isSwingHigh || isSwingLow) {
            // Determine swing type based on previous swing
            const prevSwing = swings[swings.length - 1];
            let type: SwingPoint['type'];

            if (isSwingHigh) {
                if (prevSwing && prevSwing.type === 'HH' || prevSwing?.type === 'LH') {
                    type = current.high > prevSwing.price ? 'HH' : 'LH';
                } else {
                    type = 'HH'; // Default for first swing high
                }
                swings.push({
                    type,
                    price: current.high,
                    timestamp: current.timestamp,
                    index: i,
                });
            }

            if (isSwingLow) {
                if (prevSwing && (prevSwing.type === 'LL' || prevSwing.type === 'HL')) {
                    type = current.low < prevSwing.price ? 'LL' : 'HL';
                } else {
                    type = 'LL'; // Default for first swing low
                }
                swings.push({
                    type,
                    price: current.low,
                    timestamp: current.timestamp,
                    index: i,
                });
            }
        }
    }

    return swings;
}

/**
 * Detect consolidation zones in price data
 */
export function detectConsolidation(
    candles: Candle[],
    config: ConsolidationConfig = DEFAULT_CONSOLIDATION_CONFIG
): ConsolidationZone[] {
    const zones: ConsolidationZone[] = [];
    const minDurationMs = config.minDurationMinutes * 60 * 1000;

    let zoneStart = 0;

    for (let i = 1; i < candles.length; i++) {
        // Calculate range from zone start to current
        const zoneCandles = candles.slice(zoneStart, i + 1);
        const high = Math.max(...zoneCandles.map(c => c.high));
        const low = Math.min(...zoneCandles.map(c => c.low));
        const range = high - low;
        const duration = candles[i].timestamp - candles[zoneStart].timestamp;

        // Check if range exceeds max
        if (range > config.maxRangePips) {
            // Check if we had a valid zone before breakout
            if (duration >= minDurationMs && range >= config.minRangePips) {
                const swingPoints = detectSwingPoints(zoneCandles, 2);

                if (swingPoints.length >= config.minSwingPoints) {
                    // Check for HH-LL or LL-HH pattern
                    const hasHH = swingPoints.some(s => s.type === 'HH');
                    const hasLL = swingPoints.some(s => s.type === 'LL');
                    const isConfirmed = hasHH && hasLL;

                    zones.push({
                        startTime: candles[zoneStart].timestamp,
                        endTime: candles[i - 1].timestamp,
                        startIndex: zoneStart,
                        endIndex: i - 1,
                        high,
                        low,
                        range,
                        swingPoints,
                        isConfirmed,
                    });
                }
            }

            // Reset zone start
            zoneStart = i;
        }
    }

    // Check final zone
    if (zoneStart < candles.length - 1) {
        const zoneCandles = candles.slice(zoneStart);
        const high = Math.max(...zoneCandles.map(c => c.high));
        const low = Math.min(...zoneCandles.map(c => c.low));
        const range = high - low;
        const duration = candles[candles.length - 1].timestamp - candles[zoneStart].timestamp;

        if (duration >= minDurationMs && range >= config.minRangePips && range <= config.maxRangePips) {
            const swingPoints = detectSwingPoints(zoneCandles, 2);

            if (swingPoints.length >= config.minSwingPoints) {
                const hasHH = swingPoints.some(s => s.type === 'HH');
                const hasLL = swingPoints.some(s => s.type === 'LL');

                zones.push({
                    startTime: candles[zoneStart].timestamp,
                    endTime: candles[candles.length - 1].timestamp,
                    startIndex: zoneStart,
                    endIndex: candles.length - 1,
                    high,
                    low,
                    range,
                    swingPoints,
                    isConfirmed: hasHH && hasLL,
                });
            }
        }
    }

    return zones;
}

/**
 * Check if price is currently in a consolidation zone
 */
export function isInConsolidation(price: number, zones: ConsolidationZone[]): ConsolidationZone | null {
    for (const zone of zones) {
        if (price >= zone.low && price <= zone.high) {
            return zone;
        }
    }
    return null;
}
