/**
 * Support/Resistance Zone Detection
 * Identifies key price levels based on swing highs/lows and price reactions
 */

import { Candle } from '../types';
import { detectSwingPoints } from './consolidation';

export interface SRConfig {
    zoneTolerancePips: number;  // Tolerance for grouping levels (e.g., 0.05 = 5 pips)
    minTouches: number;         // Minimum touches to confirm zone
    lookbackCandles: number;    // How far back to look for zones
}

export interface SRZone {
    type: 'support' | 'resistance';
    price: number;              // Center of zone
    high: number;               // Upper boundary
    low: number;                // Lower boundary
    touches: number;            // Number of times price touched this zone
    lastTouchTime: number;
    firstTouchTime: number;
    wasFlipped: boolean;        // Was resistance that became support or vice versa
    wickRejection: boolean;     // Had a wick rejection (strong zone)
    strength: number;           // 0-1 strength score
}

export const DEFAULT_SR_CONFIG: SRConfig = {
    zoneTolerancePips: 0.05,    // 5 pips
    minTouches: 2,
    lookbackCandles: 500,
};

/**
 * Detect Support/Resistance zones from price data
 */
export function detectSRZones(
    candles: Candle[],
    config: SRConfig = DEFAULT_SR_CONFIG
): SRZone[] {
    if (candles.length < 10) return [];

    const lookbackStart = Math.max(0, candles.length - config.lookbackCandles);
    const relevantCandles = candles.slice(lookbackStart);

    // Find all swing points
    const swingPoints = detectSwingPoints(relevantCandles, 3);

    // Group swing points into zones based on tolerance
    const zones: SRZone[] = [];

    for (const swing of swingPoints) {
        const isHigh = swing.type === 'HH' || swing.type === 'LH';
        const existingZone = zones.find(z =>
            Math.abs(z.price - swing.price) <= config.zoneTolerancePips
        );

        if (existingZone) {
            // Update existing zone
            existingZone.touches++;
            existingZone.lastTouchTime = swing.timestamp;
            existingZone.high = Math.max(existingZone.high, swing.price);
            existingZone.low = Math.min(existingZone.low, swing.price);
            existingZone.price = (existingZone.high + existingZone.low) / 2;

            // Check for flip
            const newType = isHigh ? 'resistance' : 'support';
            if (existingZone.type !== newType) {
                existingZone.wasFlipped = true;
                existingZone.type = newType;
            }
        } else {
            // Create new zone
            zones.push({
                type: isHigh ? 'resistance' : 'support',
                price: swing.price,
                high: swing.price + config.zoneTolerancePips / 2,
                low: swing.price - config.zoneTolerancePips / 2,
                touches: 1,
                lastTouchTime: swing.timestamp,
                firstTouchTime: swing.timestamp,
                wasFlipped: false,
                wickRejection: false,
                strength: 0,
            });
        }
    }

    // Analyze wick rejections and calculate strength
    for (const zone of zones) {
        zone.wickRejection = checkWickRejection(relevantCandles, zone);
        zone.strength = calculateZoneStrength(zone, config);
    }

    // Filter by minimum touches and sort by strength
    return zones
        .filter(z => z.touches >= config.minTouches)
        .sort((a, b) => b.strength - a.strength);
}

/**
 * Check if a zone has had wick rejection (candle body didn't close in zone but wick entered)
 */
function checkWickRejection(candles: Candle[], zone: SRZone): boolean {
    for (const candle of candles) {
        const bodyHigh = Math.max(candle.open, candle.close);
        const bodyLow = Math.min(candle.open, candle.close);

        if (zone.type === 'resistance') {
            // Wick entered zone but body closed below
            if (candle.high >= zone.low && bodyHigh < zone.low) {
                return true;
            }
        } else {
            // Wick entered zone but body closed above
            if (candle.low <= zone.high && bodyLow > zone.high) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Calculate zone strength (0-1)
 */
function calculateZoneStrength(zone: SRZone, config: SRConfig): number {
    let strength = 0;

    // More touches = stronger
    strength += Math.min(zone.touches / 5, 0.4); // Max 0.4 from touches

    // Wick rejection = stronger
    if (zone.wickRejection) strength += 0.2;

    // Flipped zone (S→R or R→S) = very strong
    if (zone.wasFlipped) strength += 0.3;

    // Recent zone = stronger
    const recencyWeight = 0.1; // Additional weight for recent zones
    strength += recencyWeight;

    return Math.min(strength, 1);
}

/**
 * Check if a zone is confirmed (single touch with rejection, no break)
 * This is your definition of confirmed resistance/support
 */
export function isZoneConfirmed(zone: SRZone): boolean {
    // Confirmed = touched once with wick rejection, not broken
    return zone.touches >= 1 && zone.wickRejection && !zone.wasFlipped;
}

/**
 * Find the nearest S/R zone above or below a price
 */
export function findNearestZone(
    price: number,
    zones: SRZone[],
    direction: 'above' | 'below'
): SRZone | null {
    if (direction === 'above') {
        const above = zones.filter(z => z.price > price);
        return above.length > 0
            ? above.reduce((min, z) => z.price < min.price ? z : min)
            : null;
    } else {
        const below = zones.filter(z => z.price < price);
        return below.length > 0
            ? below.reduce((max, z) => z.price > max.price ? z : max)
            : null;
    }
}

/**
 * Check if price is in a support or resistance zone
 */
export function isPriceInZone(price: number, zones: SRZone[]): SRZone | null {
    for (const zone of zones) {
        if (price >= zone.low && price <= zone.high) {
            return zone;
        }
    }
    return null;
}
