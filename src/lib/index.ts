// Core library exports
export * from './types';
export { CSVParser, parseCSVFile, parseCSVString } from './csv-parser';
export { BacktestEngine, runBacktest } from './backtest-engine';
export {
    Strategy,
    sma,
    ema,
    rsi,
    rsiSmoothed,
    macd,
    bollingerBands,
    atr,
    highest,
    lowest,
    stdDev,
    crossover,
    crossunder
} from './strategy-base';
export { calculateMetrics, formatMetrics } from './metrics/performance';
export { GridSearchOptimizer, gridSearchOptimize } from './optimizer/grid-search';
export { GeneticOptimizer, geneticOptimize, DEFAULT_GENETIC_CONFIG } from './optimizer/genetic-optimizer';
export type { GeneticConfig } from './optimizer/genetic-optimizer';

// New Phase 1-3 exports
export { WalkForwardAnalyzer, walkForwardAnalyze, DEFAULT_WALK_FORWARD_CONFIG } from './optimizer/walk-forward';
export type { WalkForwardResult, WalkForwardConfig, WalkForwardWindow, WalkForwardWindowResult } from './optimizer/walk-forward';

export { MonteCarloSimulator, runMonteCarloSimulation, DEFAULT_MONTE_CARLO_CONFIG } from './monte-carlo';
export type { MonteCarloResult, MonteCarloConfig, MonteCarloPercentile } from './monte-carlo';

export {
    kellyPositionSize,
    halfKellyPositionSize,
    fixedFractionalPositionSize,
    optimalFPositionSize,
    fixedRatioPositionSize,
    calculateAllPositionSizes,
    antiMartingaleSize
} from './position-sizing';
export type { PositionSizeResult, PositionSizeInputs } from './position-sizing';

export { generateMQL4, generateMQL5, downloadMQLFile, DEFAULT_MQL_CONFIG } from './mql-exporter';
export type { MQLExportConfig } from './mql-exporter';
