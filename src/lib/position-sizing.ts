/**
 * Position Sizing Calculators
 * 
 * Provides various methods for calculating optimal position sizes
 * based on risk management principles.
 */

export interface PositionSizeResult {
    method: string;
    positionSize: number; // As percentage of capital
    riskPerTrade: number;
    expectedValue: number;
    notes: string;
}

export interface PositionSizeInputs {
    accountSize: number;
    winRate: number; // 0-1
    avgWin: number;
    avgLoss: number;
    maxRiskPercent?: number; // Maximum risk per trade (e.g., 0.02 = 2%)
}

/**
 * Kelly Criterion
 * 
 * Calculates the optimal bet size to maximize long-term growth.
 * Formula: f* = (bp - q) / b
 * Where:
 *   b = odds (avg win / avg loss)
 *   p = probability of winning
 *   q = probability of losing (1 - p)
 */
export function kellyPositionSize(inputs: PositionSizeInputs): PositionSizeResult {
    const { winRate, avgWin, avgLoss, maxRiskPercent = 0.25 } = inputs;

    if (avgLoss === 0) {
        return {
            method: 'Kelly Criterion',
            positionSize: 0,
            riskPerTrade: 0,
            expectedValue: 0,
            notes: 'Cannot calculate: average loss is zero'
        };
    }

    const b = avgWin / avgLoss; // Win/loss ratio
    const p = winRate;
    const q = 1 - p;

    // Kelly formula
    let kelly = (b * p - q) / b;

    // Clamp to reasonable bounds
    kelly = Math.max(0, Math.min(kelly, maxRiskPercent));

    const expectedValue = (p * avgWin) - (q * avgLoss);

    let notes = '';
    if (kelly === 0) {
        notes = 'Negative edge - no position recommended';
    } else if (kelly > 0.2) {
        notes = 'High Kelly value - consider using half-Kelly for safety';
    } else {
        notes = 'Optimal growth position size';
    }

    return {
        method: 'Kelly Criterion',
        positionSize: kelly * 100,
        riskPerTrade: kelly * 100,
        expectedValue,
        notes
    };
}

/**
 * Half-Kelly
 * 
 * More conservative version of Kelly, reducing volatility.
 */
export function halfKellyPositionSize(inputs: PositionSizeInputs): PositionSizeResult {
    const fullKelly = kellyPositionSize(inputs);

    return {
        method: 'Half-Kelly',
        positionSize: fullKelly.positionSize / 2,
        riskPerTrade: fullKelly.riskPerTrade / 2,
        expectedValue: fullKelly.expectedValue,
        notes: 'Conservative approach - half of Kelly for reduced volatility'
    };
}

/**
 * Fixed Fractional
 * 
 * Risks a fixed percentage of account per trade.
 */
export function fixedFractionalPositionSize(
    inputs: PositionSizeInputs,
    riskPercent: number = 0.02 // Default 2% risk
): PositionSizeResult {
    const { avgLoss, accountSize } = inputs;

    if (avgLoss === 0) {
        return {
            method: 'Fixed Fractional',
            positionSize: 0,
            riskPerTrade: riskPercent * 100,
            expectedValue: 0,
            notes: 'Cannot calculate: average loss is zero'
        };
    }

    // Position size = (Account * Risk%) / Average Loss
    const riskAmount = accountSize * riskPercent;
    const positionSize = riskAmount / avgLoss;
    const positionPercent = (positionSize / accountSize) * 100;

    return {
        method: 'Fixed Fractional',
        positionSize: Math.min(positionPercent, 100),
        riskPerTrade: riskPercent * 100,
        expectedValue: (inputs.winRate * inputs.avgWin) - ((1 - inputs.winRate) * inputs.avgLoss),
        notes: `Risking ${(riskPercent * 100).toFixed(1)}% per trade`
    };
}

/**
 * Optimal-f
 * 
 * Ralph Vince's optimal fixed fraction based on historical trades.
 */
export function optimalFPositionSize(inputs: PositionSizeInputs): PositionSizeResult {
    const { winRate, avgWin, avgLoss, maxRiskPercent = 0.25 } = inputs;

    // Optimal-f is similar to Kelly but uses a different derivation
    // f_optimal = W - [(1 - W) / R]
    // Where W = win rate, R = payoff ratio

    const R = avgLoss > 0 ? avgWin / avgLoss : 0;
    let optimalF = winRate - ((1 - winRate) / R);

    optimalF = Math.max(0, Math.min(optimalF, maxRiskPercent));

    const expectedValue = (winRate * avgWin) - ((1 - winRate) * avgLoss);

    return {
        method: 'Optimal-f',
        positionSize: optimalF * 100,
        riskPerTrade: optimalF * 100,
        expectedValue,
        notes: optimalF > 0
            ? 'Based on historical trade distribution'
            : 'Edge too small for optimal-f recommendation'
    };
}

/**
 * Fixed Ratio (Ryan Jones)
 * 
 * Position size increases based on account growth milestones.
 */
export function fixedRatioPositionSize(
    accountSize: number,
    delta: number = 5000, // Amount of profit needed to increase by 1 contract
    startingContracts: number = 1
): PositionSizeResult {
    // Calculate current contract level
    // Contracts = sqrt(2 * profit / delta + 0.25) + 0.5
    // Simplified: contracts grow as account grows

    const profitFactor = accountSize / delta;
    const contracts = Math.floor(
        Math.sqrt(2 * profitFactor + 0.25) + 0.5
    );

    const actualContracts = Math.max(startingContracts, contracts);
    const positionPercent = (actualContracts * delta / accountSize) * 100;

    return {
        method: 'Fixed Ratio',
        positionSize: Math.min(positionPercent, 100),
        riskPerTrade: positionPercent,
        expectedValue: 0, // N/A for this method
        notes: `${actualContracts} contracts at delta $${delta.toLocaleString()}`
    };
}

/**
 * Calculate all position sizing methods
 */
export function calculateAllPositionSizes(inputs: PositionSizeInputs): PositionSizeResult[] {
    return [
        kellyPositionSize(inputs),
        halfKellyPositionSize(inputs),
        fixedFractionalPositionSize(inputs, 0.01), // 1% risk
        fixedFractionalPositionSize(inputs, 0.02), // 2% risk
        optimalFPositionSize(inputs),
        fixedRatioPositionSize(inputs.accountSize, 5000)
    ];
}

/**
 * Anti-Martingale (increase after wins)
 */
export function antiMartingaleSize(
    baseSize: number,
    consecutiveWins: number,
    multiplier: number = 1.5,
    maxMultiplier: number = 3
): number {
    const growth = Math.pow(multiplier, consecutiveWins);
    return Math.min(baseSize * growth, baseSize * maxMultiplier);
}
