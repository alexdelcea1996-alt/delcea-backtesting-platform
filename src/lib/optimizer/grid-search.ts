import {
    Candle,
    StrategyParams,
    BacktestConfig,
    OptimizationConfig,
    OptimizationResult,
    PerformanceMetrics,
    DEFAULT_BACKTEST_CONFIG
} from '../types';
import { Strategy } from '../strategy-base';
import { BacktestEngine } from '../backtest-engine';

/**
 * Grid Search Optimizer
 * 
 * Exhaustively tests all parameter combinations within specified ranges
 */
export class GridSearchOptimizer<T extends StrategyParams> {
    private candles: Candle[];
    private backtestConfig: BacktestConfig;
    private optimizationConfig: OptimizationConfig;
    private onProgress?: (progress: number, current: T, result: PerformanceMetrics) => void;

    constructor(
        candles: Candle[],
        backtestConfig: BacktestConfig,
        optimizationConfig: OptimizationConfig,
        onProgress?: (progress: number, current: T, result: PerformanceMetrics) => void
    ) {
        this.candles = candles;
        this.backtestConfig = backtestConfig;
        this.optimizationConfig = optimizationConfig;
        this.onProgress = onProgress;
    }

    /**
     * Run grid search optimization
     */
    optimize(strategyFactory: (params: T) => Strategy<T>, baseParams: T): OptimizationResult {
        const startTime = performance.now();
        const combinations = this.generateCombinations(baseParams);
        const results: OptimizationResult['allResults'] = [];

        let bestParams: StrategyParams = baseParams;
        let bestMetricValue = this.optimizationConfig.maximize ? -Infinity : Infinity;

        const engine = new BacktestEngine(this.backtestConfig);

        for (let i = 0; i < combinations.length; i++) {
            const params = combinations[i];
            const strategy = strategyFactory(params);

            try {
                const result = engine.run(this.candles, strategy);
                const metricValue = result.metrics[this.optimizationConfig.metric] as number;

                results.push({
                    params,
                    metricValue,
                    metrics: result.metrics,
                });

                // Check if this is the best result
                const isBetter = this.optimizationConfig.maximize
                    ? metricValue > bestMetricValue
                    : metricValue < bestMetricValue;

                if (isBetter && isFinite(metricValue)) {
                    bestMetricValue = metricValue;
                    bestParams = params;
                }

                // Report progress
                if (this.onProgress) {
                    this.onProgress((i + 1) / combinations.length, params, result.metrics);
                }
            } catch (error) {
                console.warn(`Backtest failed for params:`, params, error);
            }
        }

        const processingTime = performance.now() - startTime;

        // Sort results by metric value
        results.sort((a, b) => this.optimizationConfig.maximize
            ? b.metricValue - a.metricValue
            : a.metricValue - b.metricValue
        );

        return {
            bestParams,
            bestMetricValue,
            allResults: results,
            totalCombinations: combinations.length,
            processingTime,
        };
    }

    /**
     * Generate all parameter combinations
     */
    private generateCombinations(baseParams: T): T[] {
        const paramKeys = Object.keys(this.optimizationConfig.paramRanges);
        const combinations: T[] = [];

        const generateRecursive = (index: number, current: Partial<T>): void => {
            if (index === paramKeys.length) {
                combinations.push({ ...baseParams, ...current } as T);
                return;
            }

            const key = paramKeys[index];
            const range = this.optimizationConfig.paramRanges[key];

            for (let value = range.min; value <= range.max; value += range.step) {
                // Round to avoid floating point issues
                const roundedValue = Math.round(value * 1000) / 1000;
                generateRecursive(index + 1, { ...current, [key]: roundedValue });
            }
        };

        generateRecursive(0, {});
        return combinations;
    }

    /**
     * Calculate total number of combinations
     */
    getTotalCombinations(): number {
        let total = 1;

        for (const range of Object.values(this.optimizationConfig.paramRanges)) {
            const steps = Math.floor((range.max - range.min) / range.step) + 1;
            total *= steps;
        }

        return total;
    }
}

/**
 * Convenience function for grid search optimization
 */
export function gridSearchOptimize<T extends StrategyParams>(
    candles: Candle[],
    strategyFactory: (params: T) => Strategy<T>,
    baseParams: T,
    optimizationConfig: OptimizationConfig,
    backtestConfig?: BacktestConfig,
    onProgress?: (progress: number, current: T, result: PerformanceMetrics) => void
): OptimizationResult {
    const optimizer = new GridSearchOptimizer<T>(
        candles,
        backtestConfig || DEFAULT_BACKTEST_CONFIG,
        optimizationConfig,
        onProgress
    );

    return optimizer.optimize(strategyFactory, baseParams);
}
