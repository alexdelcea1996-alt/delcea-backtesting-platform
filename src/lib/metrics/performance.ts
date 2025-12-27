import { Trade, PerformanceMetrics } from '../types';

/**
 * Calculate comprehensive performance metrics from backtest results
 */
export function calculateMetrics(
    trades: Trade[],
    equityCurve: { timestamp: number; equity: number }[],
    initialCapital: number,
    startDate: number,
    endDate: number
): PerformanceMetrics {
    const completedTrades = trades.filter(t => t.pnl !== null);

    if (completedTrades.length === 0) {
        return getEmptyMetrics();
    }

    // Basic stats
    const finalEquity = equityCurve.length > 0
        ? equityCurve[equityCurve.length - 1].equity
        : initialCapital;

    const totalReturn = finalEquity - initialCapital;
    const totalReturnPercent = (totalReturn / initialCapital) * 100;

    // Time-based calculations
    const tradingDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
    const years = tradingDays / 365;
    const cagr = years > 0
        ? (Math.pow(finalEquity / initialCapital, 1 / years) - 1) * 100
        : 0;

    // Win/Loss analysis
    const winningTrades = completedTrades.filter(t => (t.pnl ?? 0) > 0);
    const losingTrades = completedTrades.filter(t => (t.pnl ?? 0) < 0);

    const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0));

    const winRate = (winningTrades.length / completedTrades.length) * 100;
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    const averageWin = winningTrades.length > 0
        ? totalWins / winningTrades.length
        : 0;
    const averageLoss = losingTrades.length > 0
        ? totalLosses / losingTrades.length
        : 0;

    // Largest win/loss
    const largestWin = winningTrades.length > 0
        ? Math.max(...winningTrades.map(t => t.pnl ?? 0))
        : 0;
    const largestLoss = losingTrades.length > 0
        ? Math.abs(Math.min(...losingTrades.map(t => t.pnl ?? 0)))
        : 0;

    // Consecutive wins/losses
    const { maxConsecutiveWins, maxConsecutiveLosses } = calculateConsecutive(completedTrades);

    // Drawdown
    const { maxDrawdown, maxDrawdownPercent } = calculateDrawdown(equityCurve, initialCapital);

    // Risk-adjusted returns
    const returns = calculateReturns(equityCurve);
    const sharpeRatio = calculateSharpeRatio(returns, cagr);
    const sortinoRatio = calculateSortinoRatio(returns, cagr);
    const calmarRatio = maxDrawdownPercent > 0 ? cagr / maxDrawdownPercent : 0;

    // Trade duration
    const tradeDurations = completedTrades
        .filter(t => t.exitTime !== null)
        .map(t => ((t.exitTime ?? 0) - t.entryTime) / (1000 * 60)); // In minutes

    const averageTradeDuration = tradeDurations.length > 0
        ? tradeDurations.reduce((a, b) => a + b, 0) / tradeDurations.length
        : 0;

    // Expectancy (average profit per trade)
    const expectancy = completedTrades.length > 0
        ? totalReturn / completedTrades.length
        : 0;

    return {
        totalReturn,
        totalReturnPercent,
        cagr,
        sharpeRatio,
        sortinoRatio,
        maxDrawdown,
        maxDrawdownPercent,
        calmarRatio,
        winRate,
        profitFactor,
        totalTrades: completedTrades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        averageWin,
        averageLoss,
        averageTradeDuration,
        largestWin,
        largestLoss,
        consecutiveWins: maxConsecutiveWins,
        consecutiveLosses: maxConsecutiveLosses,
        expectancy,
    };
}

/**
 * Returns empty metrics when no trades
 */
function getEmptyMetrics(): PerformanceMetrics {
    return {
        totalReturn: 0,
        totalReturnPercent: 0,
        cagr: 0,
        sharpeRatio: 0,
        sortinoRatio: 0,
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
        calmarRatio: 0,
        winRate: 0,
        profitFactor: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        averageWin: 0,
        averageLoss: 0,
        averageTradeDuration: 0,
        largestWin: 0,
        largestLoss: 0,
        consecutiveWins: 0,
        consecutiveLosses: 0,
        expectancy: 0,
    };
}

/**
 * Calculate consecutive wins and losses
 */
function calculateConsecutive(trades: Trade[]): { maxConsecutiveWins: number; maxConsecutiveLosses: number } {
    let maxConsecutiveWins = 0;
    let maxConsecutiveLosses = 0;
    let currentWins = 0;
    let currentLosses = 0;

    for (const trade of trades) {
        if ((trade.pnl ?? 0) > 0) {
            currentWins++;
            currentLosses = 0;
            maxConsecutiveWins = Math.max(maxConsecutiveWins, currentWins);
        } else if ((trade.pnl ?? 0) < 0) {
            currentLosses++;
            currentWins = 0;
            maxConsecutiveLosses = Math.max(maxConsecutiveLosses, currentLosses);
        }
    }

    return { maxConsecutiveWins, maxConsecutiveLosses };
}

/**
 * Calculate maximum drawdown
 */
function calculateDrawdown(
    equityCurve: { timestamp: number; equity: number }[],
    initialCapital: number
): { maxDrawdown: number; maxDrawdownPercent: number } {
    if (equityCurve.length === 0) {
        return { maxDrawdown: 0, maxDrawdownPercent: 0 };
    }

    let peak = initialCapital;
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;

    for (const point of equityCurve) {
        peak = Math.max(peak, point.equity);
        const drawdown = peak - point.equity;
        const drawdownPercent = (drawdown / peak) * 100;

        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
            maxDrawdownPercent = drawdownPercent;
        }
    }

    return { maxDrawdown, maxDrawdownPercent };
}

/**
 * Calculate period returns from equity curve
 */
function calculateReturns(equityCurve: { timestamp: number; equity: number }[]): number[] {
    const returns: number[] = [];

    for (let i = 1; i < equityCurve.length; i++) {
        const prevEquity = equityCurve[i - 1].equity;
        const currentEquity = equityCurve[i].equity;

        if (prevEquity > 0) {
            returns.push((currentEquity - prevEquity) / prevEquity);
        }
    }

    return returns;
}

/**
 * Calculate Sharpe Ratio (annualized)
 */
function calculateSharpeRatio(returns: number[], annualizedReturn: number): number {
    if (returns.length < 2) return 0;

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Annualize (assuming 1-minute candles, ~525600 per year)
    const annualizedStdDev = stdDev * Math.sqrt(525600);

    if (annualizedStdDev === 0) return 0;

    // Assuming risk-free rate of 2%
    const riskFreeRate = 2;
    return (annualizedReturn - riskFreeRate) / annualizedStdDev;
}

/**
 * Calculate Sortino Ratio (only downside deviation)
 */
function calculateSortinoRatio(returns: number[], annualizedReturn: number): number {
    if (returns.length < 2) return 0;

    // Calculate downside deviation
    const negativeReturns = returns.filter(r => r < 0);

    if (negativeReturns.length === 0) {
        return annualizedReturn > 0 ? Infinity : 0;
    }

    const downsideVariance = negativeReturns.reduce((sum, r) => sum + r * r, 0) / returns.length;
    const downsideDeviation = Math.sqrt(downsideVariance);

    // Annualize
    const annualizedDownside = downsideDeviation * Math.sqrt(525600);

    if (annualizedDownside === 0) return 0;

    const riskFreeRate = 2;
    return (annualizedReturn - riskFreeRate) / annualizedDownside;
}

/**
 * Format metrics for display
 */
export function formatMetrics(metrics: PerformanceMetrics): Record<string, string> {
    return {
        'Total Return': `$${metrics.totalReturn.toFixed(2)} (${metrics.totalReturnPercent.toFixed(2)}%)`,
        'CAGR': `${metrics.cagr.toFixed(2)}%`,
        'Sharpe Ratio': metrics.sharpeRatio.toFixed(2),
        'Sortino Ratio': metrics.sortinoRatio.toFixed(2),
        'Max Drawdown': `$${metrics.maxDrawdown.toFixed(2)} (${metrics.maxDrawdownPercent.toFixed(2)}%)`,
        'Calmar Ratio': metrics.calmarRatio.toFixed(2),
        'Win Rate': `${metrics.winRate.toFixed(1)}%`,
        'Profit Factor': metrics.profitFactor.toFixed(2),
        'Total Trades': metrics.totalTrades.toString(),
        'Winning Trades': metrics.winningTrades.toString(),
        'Losing Trades': metrics.losingTrades.toString(),
        'Average Win': `$${metrics.averageWin.toFixed(2)}`,
        'Average Loss': `$${metrics.averageLoss.toFixed(2)}`,
        'Largest Win': `$${metrics.largestWin.toFixed(2)}`,
        'Largest Loss': `$${metrics.largestLoss.toFixed(2)}`,
        'Avg Trade Duration': `${metrics.averageTradeDuration.toFixed(1)} min`,
        'Expectancy': `$${metrics.expectancy.toFixed(2)}`,
        'Max Consecutive Wins': metrics.consecutiveWins.toString(),
        'Max Consecutive Losses': metrics.consecutiveLosses.toString(),
    };
}
