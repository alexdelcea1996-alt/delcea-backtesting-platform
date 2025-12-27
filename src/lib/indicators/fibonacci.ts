/**
 * Fibonacci Retracement Utilities
 */

export interface FibonacciLevels {
    high: number;
    low: number;
    levels: {
        level: number;
        price: number;
    }[];
    // Quick access to common levels
    fib236: number;
    fib382: number;
    fib500: number;
    fib618: number;
    fib667: number;
    fib786: number;
}

// Standard Fibonacci retracement levels
export const STANDARD_FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.667, 0.786, 1];

/**
 * Calculate Fibonacci retracement levels between a swing high and low
 * @param swingHigh - The swing high price
 * @param swingLow - The swing low price
 * @returns Fibonacci levels object
 */
export function calculateFibLevels(swingHigh: number, swingLow: number): FibonacciLevels {
    const range = swingHigh - swingLow;

    const levels = STANDARD_FIB_LEVELS.map(level => ({
        level,
        price: swingLow + (range * level),
    }));

    return {
        high: swingHigh,
        low: swingLow,
        levels,
        fib236: swingLow + (range * 0.236),
        fib382: swingLow + (range * 0.382),
        fib500: swingLow + (range * 0.5),
        fib618: swingLow + (range * 0.618),
        fib667: swingLow + (range * 0.667),
        fib786: swingLow + (range * 0.786),
    };
}

/**
 * Check if a price is within a Fibonacci zone
 * @param price - Current price
 * @param fibLevels - Fibonacci levels object
 * @param zoneLowLevel - Lower bound of zone (e.g., 0.36)
 * @param zoneHighLevel - Upper bound of zone (e.g., 0.72)
 * @returns True if price is within the zone
 */
export function isInFibZone(
    price: number,
    fibLevels: FibonacciLevels,
    zoneLowLevel: number,
    zoneHighLevel: number
): boolean {
    const range = fibLevels.high - fibLevels.low;
    const zoneLowPrice = fibLevels.low + (range * zoneLowLevel);
    const zoneHighPrice = fibLevels.low + (range * zoneHighLevel);

    return price >= zoneLowPrice && price <= zoneHighPrice;
}

/**
 * Get the Fibonacci level for a given price
 * @param price - Current price
 * @param fibLevels - Fibonacci levels object
 * @returns Fibonacci level (0-1) or null if outside range
 */
export function getFibLevel(price: number, fibLevels: FibonacciLevels): number | null {
    if (price < fibLevels.low || price > fibLevels.high) {
        return null;
    }

    const range = fibLevels.high - fibLevels.low;
    if (range === 0) return null;

    return (price - fibLevels.low) / range;
}

/**
 * Get price at a specific Fibonacci level
 * @param fibLevels - Fibonacci levels object
 * @param level - Fibonacci level (0-1)
 * @returns Price at that level
 */
export function getPriceAtFibLevel(fibLevels: FibonacciLevels, level: number): number {
    const range = fibLevels.high - fibLevels.low;
    return fibLevels.low + (range * level);
}
