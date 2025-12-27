import {
    Candle,
    StrategyParams,
    BacktestConfig,
    OptimizationConfig,
    PerformanceMetrics,
    DEFAULT_BACKTEST_CONFIG
} from '../types';
import { Strategy } from '../strategy-base';
import { BacktestEngine } from '../backtest-engine';
import { GridSearchOptimizer } from './grid-search';

/**
 * Walk-Forward Analysis Window
 */
export interface WalkForwardWindow {
    trainStart: number;
    trainEnd: number;
    testStart: number;
    testEnd: number;
    trainIndex: { start: number; end: number };
    testIndex: { start: number; end: number };
}

/**
 * Walk-Forward Analysis Result for a single window
 */
export interface WalkForwardWindowResult {
    window: WalkForwardWindow;
    optimizedParams: StrategyParams;
    inSampleMetrics: PerformanceMetrics;
    outOfSampleMetrics: PerformanceMetrics;
    degradation: number; // Percentage degradation in metric
}

/**
 * Walk-Forward Analysis Complete Result
 */
export interface WalkForwardResult {
    windows: WalkForwardWindowResult[];
    aggregatedOutOfSample: {
        totalReturn: number;
        sharpeRatio: number;
        maxDrawdown: number;
        winRate: number;
        totalTrades: number;
    };
    averageDegradation: number;
    robustnessScore: number; // 0-100, higher is better
    processingTime: number;
}

/**
 * Walk-Forward Configuration
 */
export interface WalkForwardConfig {
    windowType: 'rolling' | 'anchored';
    trainRatio: number; // 0.7 = 70% training, 30% testing
    numWindows: number; // Number of walk-forward periods
    optimizationConfig: OptimizationConfig;
}

export const DEFAULT_WALK_FORWARD_CONFIG: WalkForwardConfig = {
    windowType: 'rolling',
    trainRatio: 0.7,
    numWindows: 5,
    optimizationConfig: {
        paramRanges: {},
        metric: 'sharpeRatio',
        maximize: true
    }
};

/**
 * Walk-Forward Analyzer
 * 
 * Performs walk-forward optimization to validate strategy robustness
 * by testing optimized parameters on unseen data.
 */
export class WalkForwardAnalyzer<T extends StrategyParams> {
    private candles: Candle[];
    private backtestConfig: BacktestConfig;
    private walkForwardConfig: WalkForwardConfig;
    private onProgress?: (progress: number, windowIndex: number) => void;

    constructor(
        candles: Candle[],
        backtestConfig: BacktestConfig,
        walkForwardConfig: WalkForwardConfig,
        onProgress?: (progress: number, windowIndex: number) => void
    ) {
        this.candles = candles;
        this.backtestConfig = backtestConfig;
        this.walkForwardConfig = walkForwardConfig;
        this.onProgress = onProgress;
    }

    /**
     * Generate walk-forward windows
     */
    private generateWindows(): WalkForwardWindow[] {
        const windows: WalkForwardWindow[] = [];
        const totalCandles = this.candles.length;
        const { numWindows, trainRatio, windowType } = this.walkForwardConfig;

        if (windowType === 'rolling') {
            // Rolling window: each window slides forward
            const windowSize = Math.floor(totalCandles / numWindows);
            const trainSize = Math.floor(windowSize * trainRatio);
            const testSize = windowSize - trainSize;

            for (let i = 0; i < numWindows; i++) {
                const trainStart = i * windowSize;
                const trainEnd = trainStart + trainSize - 1;
                const testStart = trainEnd + 1;
                const testEnd = Math.min(testStart + testSize - 1, totalCandles - 1);

                if (testEnd <= trainEnd) continue;

                windows.push({
                    trainStart: this.candles[trainStart].timestamp,
                    trainEnd: this.candles[trainEnd].timestamp,
                    testStart: this.candles[testStart].timestamp,
                    testEnd: this.candles[testEnd].timestamp,
                    trainIndex: { start: trainStart, end: trainEnd },
                    testIndex: { start: testStart, end: testEnd }
                });
            }
        } else {
            // Anchored window: training always starts from beginning
            const testSize = Math.floor(totalCandles / numWindows);

            for (let i = 0; i < numWindows; i++) {
                const trainEnd = Math.floor((i + 1) * totalCandles * trainRatio / numWindows);
                const testStart = trainEnd + 1;
                const testEnd = Math.min(testStart + testSize - 1, totalCandles - 1);

                if (testEnd <= testStart) continue;

                windows.push({
                    trainStart: this.candles[0].timestamp,
                    trainEnd: this.candles[trainEnd].timestamp,
                    testStart: this.candles[testStart].timestamp,
                    testEnd: this.candles[testEnd].timestamp,
                    trainIndex: { start: 0, end: trainEnd },
                    testIndex: { start: testStart, end: testEnd }
                });
            }
        }

        return windows;
    }

    /**
     * Run walk-forward analysis
     */
    analyze(
        strategyFactory: (params: T) => Strategy<T>,
        baseParams: T
    ): WalkForwardResult {
        const startTime = performance.now();
        const windows = this.generateWindows();
        const results: WalkForwardWindowResult[] = [];

        for (let i = 0; i < windows.length; i++) {
            const window = windows[i];

            // Extract training and testing data
            const trainCandles = this.candles.slice(
                window.trainIndex.start,
                window.trainIndex.end + 1
            );
            const testCandles = this.candles.slice(
                window.testIndex.start,
                window.testIndex.end + 1
            );

            // Optimize on training data
            const optimizer = new GridSearchOptimizer<T>(
                trainCandles,
                this.backtestConfig,
                this.walkForwardConfig.optimizationConfig
            );

            const optimResult = optimizer.optimize(strategyFactory, baseParams);
            const optimizedParams = optimResult.bestParams as T;

            // Get in-sample metrics (best result from optimization)
            const inSampleMetrics = optimResult.allResults[0]?.metrics;

            // Test on out-of-sample data
            const engine = new BacktestEngine(this.backtestConfig);
            const optimizedStrategy = strategyFactory(optimizedParams);
            const outOfSampleResult = engine.run(testCandles, optimizedStrategy);

            // Calculate degradation
            const metric = this.walkForwardConfig.optimizationConfig.metric;
            const inSampleValue = inSampleMetrics?.[metric] as number || 0;
            const outOfSampleValue = outOfSampleResult.metrics[metric] as number;

            const degradation = inSampleValue !== 0
                ? ((inSampleValue - outOfSampleValue) / Math.abs(inSampleValue)) * 100
                : 0;

            results.push({
                window,
                optimizedParams,
                inSampleMetrics: inSampleMetrics || outOfSampleResult.metrics,
                outOfSampleMetrics: outOfSampleResult.metrics,
                degradation
            });

            if (this.onProgress) {
                this.onProgress((i + 1) / windows.length, i);
            }
        }

        // Aggregate out-of-sample results
        const aggregated = this.aggregateResults(results);
        const averageDegradation = results.reduce((sum, r) => sum + r.degradation, 0) / results.length;

        // Calculate robustness score (0-100)
        // Higher score = less degradation and more consistent performance
        const robustnessScore = Math.max(0, Math.min(100, 100 - averageDegradation));

        return {
            windows: results,
            aggregatedOutOfSample: aggregated,
            averageDegradation,
            robustnessScore,
            processingTime: performance.now() - startTime
        };
    }

    /**
     * Aggregate out-of-sample results across all windows
     */
    private aggregateResults(results: WalkForwardWindowResult[]): WalkForwardResult['aggregatedOutOfSample'] {
        if (results.length === 0) {
            return {
                totalReturn: 0,
                sharpeRatio: 0,
                maxDrawdown: 0,
                winRate: 0,
                totalTrades: 0
            };
        }

        const totalReturn = results.reduce((sum, r) => sum + r.outOfSampleMetrics.totalReturnPercent, 0);
        const avgSharpe = results.reduce((sum, r) => sum + r.outOfSampleMetrics.sharpeRatio, 0) / results.length;
        const maxDD = Math.max(...results.map(r => r.outOfSampleMetrics.maxDrawdownPercent));
        const totalTrades = results.reduce((sum, r) => sum + r.outOfSampleMetrics.totalTrades, 0);
        const totalWins = results.reduce((sum, r) => sum + r.outOfSampleMetrics.winningTrades, 0);
        const winRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;

        return {
            totalReturn,
            sharpeRatio: avgSharpe,
            maxDrawdown: maxDD,
            winRate,
            totalTrades
        };
    }
}

/**
 * Convenience function for walk-forward analysis
 */
export function walkForwardAnalyze<T extends StrategyParams>(
    candles: Candle[],
    strategyFactory: (params: T) => Strategy<T>,
    baseParams: T,
    walkForwardConfig: WalkForwardConfig,
    backtestConfig?: BacktestConfig,
    onProgress?: (progress: number, windowIndex: number) => void
): WalkForwardResult {
    const analyzer = new WalkForwardAnalyzer<T>(
        candles,
        backtestConfig || DEFAULT_BACKTEST_CONFIG,
        walkForwardConfig,
        onProgress
    );

    return analyzer.analyze(strategyFactory, baseParams);
}
