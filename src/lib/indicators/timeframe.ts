/**
 * Timeframe Aggregation Utilities
 * Aggregate 1-minute candles into higher timeframes
 */

import { Candle } from '../types';

/**
 * Aggregate 1-minute candles into higher timeframe candles
 * @param candles - Array of 1-minute candles (sorted by timestamp ascending)
 * @param periodMinutes - Target timeframe in minutes (e.g., 30 for 30M, 60 for 1H)
 * @returns Array of aggregated candles
 */
export function aggregateCandles(candles: Candle[], periodMinutes: number): Candle[] {
    if (candles.length === 0) return [];
    if (periodMinutes <= 1) return candles;

    const aggregated: Candle[] = [];
    const periodMs = periodMinutes * 60 * 1000;

    let currentPeriodStart = Math.floor(candles[0].timestamp / periodMs) * periodMs;
    let periodCandles: Candle[] = [];

    for (const candle of candles) {
        const candlePeriodStart = Math.floor(candle.timestamp / periodMs) * periodMs;

        if (candlePeriodStart !== currentPeriodStart && periodCandles.length > 0) {
            // Complete the current period
            aggregated.push(createAggregatedCandle(periodCandles, currentPeriodStart));
            periodCandles = [];
            currentPeriodStart = candlePeriodStart;
        }

        periodCandles.push(candle);
    }

    // Don't forget the last period
    if (periodCandles.length > 0) {
        aggregated.push(createAggregatedCandle(periodCandles, currentPeriodStart));
    }

    return aggregated;
}

/**
 * Create a single aggregated candle from multiple 1M candles
 */
function createAggregatedCandle(candles: Candle[], periodStart: number): Candle {
    const open = candles[0].open;
    const close = candles[candles.length - 1].close;
    const high = Math.max(...candles.map(c => c.high));
    const low = Math.min(...candles.map(c => c.low));
    const volume = candles.reduce((sum, c) => sum + (c.volume || 0), 0);

    return {
        timestamp: periodStart,
        open,
        high,
        low,
        close,
        volume: volume > 0 ? volume : undefined,
    };
}

/**
 * Get the candle index in the higher timeframe that corresponds to a 1M candle index
 * @param oneMinIndex - Index in the 1-minute candle array
 * @param oneMinCandles - Array of 1-minute candles
 * @param periodMinutes - Target timeframe in minutes
 * @returns Index in the aggregated candle array
 */
export function getAggregatedIndex(
    oneMinIndex: number,
    oneMinCandles: Candle[],
    periodMinutes: number
): number {
    if (periodMinutes <= 1) return oneMinIndex;

    const periodMs = periodMinutes * 60 * 1000;
    const targetTimestamp = oneMinCandles[oneMinIndex].timestamp;
    const targetPeriodStart = Math.floor(targetTimestamp / periodMs) * periodMs;
    const firstPeriodStart = Math.floor(oneMinCandles[0].timestamp / periodMs) * periodMs;

    return Math.floor((targetPeriodStart - firstPeriodStart) / periodMs);
}

/**
 * Find the 1-minute candle index where a higher timeframe candle starts
 */
export function findPeriodStartIndex(
    aggregatedIndex: number,
    oneMinCandles: Candle[],
    aggregatedCandles: Candle[]
): number {
    if (aggregatedIndex < 0 || aggregatedIndex >= aggregatedCandles.length) return -1;

    const targetTimestamp = aggregatedCandles[aggregatedIndex].timestamp;
    return oneMinCandles.findIndex(c => c.timestamp >= targetTimestamp);
}
