import { Trade, PerformanceMetrics } from './types';

/**
 * Monte Carlo Simulation Result
 */
export interface MonteCarloResult {
    simulations: number;
    percentiles: {
        p5: MonteCarloPercentile;
        p25: MonteCarloPercentile;
        p50: MonteCarloPercentile;
        p75: MonteCarloPercentile;
        p95: MonteCarloPercentile;
    };
    riskOfRuin: number; // Probability of reaching specified drawdown threshold
    confidenceInterval95: {
        returnLow: number;
        returnHigh: number;
        drawdownLow: number;
        drawdownHigh: number;
    };
    originalMetrics: PerformanceMetrics;
    processingTime: number;
}

export interface MonteCarloPercentile {
    totalReturn: number;
    maxDrawdown: number;
    finalEquity: number;
    sharpeRatio: number;
}

export interface MonteCarloConfig {
    simulations: number; // Number of simulations (1000-10000 recommended)
    initialCapital: number;
    ruinThreshold: number; // Drawdown threshold for risk of ruin (e.g., 0.5 = 50%)
}

export const DEFAULT_MONTE_CARLO_CONFIG: MonteCarloConfig = {
    simulations: 1000,
    initialCapital: 10000,
    ruinThreshold: 0.5
};

/**
 * Monte Carlo Simulator
 * 
 * Randomizes trade sequences to calculate confidence intervals
 * for performance metrics using bootstrap resampling.
 */
export class MonteCarloSimulator {
    private trades: Trade[];
    private config: MonteCarloConfig;
    private originalMetrics: PerformanceMetrics;

    constructor(
        trades: Trade[],
        originalMetrics: PerformanceMetrics,
        config: MonteCarloConfig = DEFAULT_MONTE_CARLO_CONFIG
    ) {
        this.trades = trades;
        this.config = config;
        this.originalMetrics = originalMetrics;
    }

    /**
     * Run Monte Carlo simulation
     */
    simulate(onProgress?: (progress: number) => void): MonteCarloResult {
        const startTime = performance.now();
        const results: {
            totalReturn: number;
            maxDrawdown: number;
            finalEquity: number;
            sharpeRatio: number;
            hitRuin: boolean;
        }[] = [];

        const closedTrades = this.trades.filter(t => t.pnl !== null);
        if (closedTrades.length === 0) {
            return this.emptyResult();
        }

        let ruinCount = 0;

        for (let sim = 0; sim < this.config.simulations; sim++) {
            // Shuffle trades (bootstrap resampling with replacement)
            const shuffledTrades = this.shuffleTrades(closedTrades);

            // Simulate equity curve
            const result = this.simulateEquityCurve(shuffledTrades);
            results.push(result);

            if (result.hitRuin) {
                ruinCount++;
            }

            if (onProgress && sim % 100 === 0) {
                onProgress((sim + 1) / this.config.simulations);
            }
        }

        // Sort arrays for percentile calculation
        const sortedReturns = results.map(r => r.totalReturn).sort((a, b) => a - b);
        const sortedDrawdowns = results.map(r => r.maxDrawdown).sort((a, b) => a - b);
        const sortedEquities = results.map(r => r.finalEquity).sort((a, b) => a - b);
        const sortedSharpe = results.map(r => r.sharpeRatio).sort((a, b) => a - b);

        const getPercentile = (arr: number[], p: number) => {
            const index = Math.floor(arr.length * p);
            return arr[Math.min(index, arr.length - 1)];
        };

        return {
            simulations: this.config.simulations,
            percentiles: {
                p5: {
                    totalReturn: getPercentile(sortedReturns, 0.05),
                    maxDrawdown: getPercentile(sortedDrawdowns, 0.95), // Worst case
                    finalEquity: getPercentile(sortedEquities, 0.05),
                    sharpeRatio: getPercentile(sortedSharpe, 0.05)
                },
                p25: {
                    totalReturn: getPercentile(sortedReturns, 0.25),
                    maxDrawdown: getPercentile(sortedDrawdowns, 0.75),
                    finalEquity: getPercentile(sortedEquities, 0.25),
                    sharpeRatio: getPercentile(sortedSharpe, 0.25)
                },
                p50: {
                    totalReturn: getPercentile(sortedReturns, 0.50),
                    maxDrawdown: getPercentile(sortedDrawdowns, 0.50),
                    finalEquity: getPercentile(sortedEquities, 0.50),
                    sharpeRatio: getPercentile(sortedSharpe, 0.50)
                },
                p75: {
                    totalReturn: getPercentile(sortedReturns, 0.75),
                    maxDrawdown: getPercentile(sortedDrawdowns, 0.25),
                    finalEquity: getPercentile(sortedEquities, 0.75),
                    sharpeRatio: getPercentile(sortedSharpe, 0.75)
                },
                p95: {
                    totalReturn: getPercentile(sortedReturns, 0.95),
                    maxDrawdown: getPercentile(sortedDrawdowns, 0.05), // Best case
                    finalEquity: getPercentile(sortedEquities, 0.95),
                    sharpeRatio: getPercentile(sortedSharpe, 0.95)
                }
            },
            riskOfRuin: (ruinCount / this.config.simulations) * 100,
            confidenceInterval95: {
                returnLow: getPercentile(sortedReturns, 0.025),
                returnHigh: getPercentile(sortedReturns, 0.975),
                drawdownLow: getPercentile(sortedDrawdowns, 0.025),
                drawdownHigh: getPercentile(sortedDrawdowns, 0.975)
            },
            originalMetrics: this.originalMetrics,
            processingTime: performance.now() - startTime
        };
    }

    /**
     * Shuffle trades using Fisher-Yates algorithm
     */
    private shuffleTrades(trades: Trade[]): Trade[] {
        const shuffled = [...trades];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Simulate equity curve from shuffled trades
     */
    private simulateEquityCurve(trades: Trade[]): {
        totalReturn: number;
        maxDrawdown: number;
        finalEquity: number;
        sharpeRatio: number;
        hitRuin: boolean;
    } {
        let equity = this.config.initialCapital;
        let peak = equity;
        let maxDrawdown = 0;
        let hitRuin = false;
        const returns: number[] = [];

        for (const trade of trades) {
            if (trade.pnl === null) continue;

            const prevEquity = equity;
            equity += trade.pnl;
            returns.push((equity - prevEquity) / prevEquity);

            // Track drawdown
            if (equity > peak) {
                peak = equity;
            }
            const drawdown = (peak - equity) / peak;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }

            // Check for ruin
            if (drawdown >= this.config.ruinThreshold) {
                hitRuin = true;
            }
        }

        const totalReturn = ((equity - this.config.initialCapital) / this.config.initialCapital) * 100;

        // Calculate Sharpe (simplified)
        const avgReturn = returns.length > 0
            ? returns.reduce((a, b) => a + b, 0) / returns.length
            : 0;
        const stdDev = returns.length > 1
            ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1))
            : 1;
        const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

        return {
            totalReturn,
            maxDrawdown: maxDrawdown * 100,
            finalEquity: equity,
            sharpeRatio,
            hitRuin
        };
    }

    /**
     * Return empty result when no trades available
     */
    private emptyResult(): MonteCarloResult {
        const emptyPercentile: MonteCarloPercentile = {
            totalReturn: 0,
            maxDrawdown: 0,
            finalEquity: this.config.initialCapital,
            sharpeRatio: 0
        };

        return {
            simulations: 0,
            percentiles: {
                p5: emptyPercentile,
                p25: emptyPercentile,
                p50: emptyPercentile,
                p75: emptyPercentile,
                p95: emptyPercentile
            },
            riskOfRuin: 0,
            confidenceInterval95: {
                returnLow: 0,
                returnHigh: 0,
                drawdownLow: 0,
                drawdownHigh: 0
            },
            originalMetrics: this.originalMetrics,
            processingTime: 0
        };
    }
}

/**
 * Convenience function for Monte Carlo simulation
 */
export function runMonteCarloSimulation(
    trades: Trade[],
    originalMetrics: PerformanceMetrics,
    config?: Partial<MonteCarloConfig>,
    onProgress?: (progress: number) => void
): MonteCarloResult {
    const fullConfig: MonteCarloConfig = {
        ...DEFAULT_MONTE_CARLO_CONFIG,
        ...config
    };

    const simulator = new MonteCarloSimulator(trades, originalMetrics, fullConfig);
    return simulator.simulate(onProgress);
}
