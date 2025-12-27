// Core types for XAU/USD backtesting framework

export interface Candle {
    timestamp: number; // Unix timestamp in milliseconds
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

export type TradeDirection = 'long' | 'short';

export interface Trade {
    id: string;
    entryTime: number;
    exitTime: number | null;
    entryPrice: number;
    exitPrice: number | null;
    direction: TradeDirection;
    size: number;
    pnl: number | null;
    pnlPercent: number | null;
    stopLoss?: number;
    takeProfit?: number;
    commission: number;
}

export interface Position {
    id: string;
    direction: TradeDirection;
    entryTime: number;
    entryPrice: number;
    size: number;
    stopLoss?: number;
    takeProfit?: number;
}

export interface Signal {
    type: 'buy' | 'sell' | 'close';
    price?: number;
    size?: number;
    stopLoss?: number;
    takeProfit?: number;
    reason?: string;
}

export interface StrategyParams {
    [key: string]: number | string | boolean;
}

export interface StrategyConfig<T extends StrategyParams = StrategyParams> {
    name: string;
    params: T;
    description?: string;
}

export interface BacktestConfig {
    initialCapital: number;
    commission: number; // in percentage (0.001 = 0.1%)
    slippage: number; // in pips
    leverage: number;
    maxPositionSize: number; // as percentage of capital
}

export interface BacktestResult {
    strategy: string;
    params: StrategyParams;
    config: BacktestConfig;
    trades: Trade[];
    equityCurve: { timestamp: number; equity: number }[];
    metrics: PerformanceMetrics;
    startDate: number;
    endDate: number;
    candleCount: number;
}

export interface PerformanceMetrics {
    totalReturn: number;
    totalReturnPercent: number;
    cagr: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    calmarRatio: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    averageWin: number;
    averageLoss: number;
    averageTradeDuration: number; // in minutes
    largestWin: number;
    largestLoss: number;
    consecutiveWins: number;
    consecutiveLosses: number;
    expectancy: number;
}

export interface OptimizationRange {
    min: number;
    max: number;
    step: number;
}

export interface OptimizationConfig {
    paramRanges: { [key: string]: OptimizationRange };
    metric: keyof PerformanceMetrics;
    maximize: boolean;
}

export interface OptimizationResult {
    bestParams: StrategyParams;
    bestMetricValue: number;
    allResults: Array<{
        params: StrategyParams;
        metricValue: number;
        metrics: PerformanceMetrics;
    }>;
    totalCombinations: number;
    processingTime: number;
}

// CSV parsing configuration
export interface CSVConfig {
    timestampColumn: string;
    openColumn: string;
    highColumn: string;
    lowColumn: string;
    closeColumn: string;
    volumeColumn?: string;
    timestampFormat: 'unix' | 'iso' | 'custom';
    customTimestampParser?: (value: string) => number;
    delimiter?: string;
}

export const DEFAULT_CSV_CONFIG: CSVConfig = {
    timestampColumn: 'timestamp',
    openColumn: 'open',
    highColumn: 'high',
    lowColumn: 'low',
    closeColumn: 'close',
    volumeColumn: 'volume',
    timestampFormat: 'unix',
    // delimiter intentionally omitted to allow PapaParse auto-detection
};

export const DEFAULT_BACKTEST_CONFIG: BacktestConfig = {
    initialCapital: 10000,
    commission: 0.0001, // 0.01% (1 pip spread)
    slippage: 0.1, // 0.1 pip
    leverage: 100,
    maxPositionSize: 0.1, // 10% of capital per trade
};
