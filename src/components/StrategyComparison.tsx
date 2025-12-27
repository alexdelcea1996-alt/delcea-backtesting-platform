import { useState } from 'react';
import { BacktestResult, PerformanceMetrics } from '../lib/types';
import './StrategyComparison.css';

interface StrategyComparisonProps {
    results: BacktestResult[];
    onRemove: (index: number) => void;
}

const METRIC_LABELS: Record<keyof PerformanceMetrics, string> = {
    totalReturn: 'Total Return ($)',
    totalReturnPercent: 'Total Return (%)',
    cagr: 'CAGR (%)',
    sharpeRatio: 'Sharpe Ratio',
    sortinoRatio: 'Sortino Ratio',
    maxDrawdown: 'Max Drawdown ($)',
    maxDrawdownPercent: 'Max Drawdown (%)',
    calmarRatio: 'Calmar Ratio',
    winRate: 'Win Rate (%)',
    profitFactor: 'Profit Factor',
    totalTrades: 'Total Trades',
    winningTrades: 'Winning Trades',
    losingTrades: 'Losing Trades',
    averageWin: 'Avg Win ($)',
    averageLoss: 'Avg Loss ($)',
    averageTradeDuration: 'Avg Duration (min)',
    largestWin: 'Largest Win ($)',
    largestLoss: 'Largest Loss ($)',
    consecutiveWins: 'Max Consec. Wins',
    consecutiveLosses: 'Max Consec. Losses',
    expectancy: 'Expectancy ($)'
};

const KEY_METRICS: (keyof PerformanceMetrics)[] = [
    'totalReturnPercent',
    'sharpeRatio',
    'maxDrawdownPercent',
    'winRate',
    'profitFactor',
    'totalTrades',
    'calmarRatio',
    'expectancy'
];

const COLORS = [
    '#6366f1', // Indigo
    '#10b981', // Green
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Purple
    '#06b6d4', // Cyan
];

export function StrategyComparison({ results, onRemove }: StrategyComparisonProps) {
    const selectedMetrics: (keyof PerformanceMetrics)[] = KEY_METRICS;
    const [showAllMetrics, setShowAllMetrics] = useState(false);

    if (results.length === 0) {
        return (
            <div className="strategy-comparison empty">
                <h3>📊 Strategy Comparison</h3>
                <p>Run multiple backtests to compare strategies side by side.</p>
                <p className="hint">Each backtest you run will be added here for comparison.</p>
            </div>
        );
    }

    // Note: toggleMetric function reserved for future custom metric selection feature

    const formatValue = (metric: keyof PerformanceMetrics, value: number): string => {
        if (metric.includes('Percent') || metric === 'winRate' || metric === 'cagr') {
            return `${value.toFixed(2)}%`;
        }
        if (metric === 'totalTrades' || metric === 'winningTrades' || metric === 'losingTrades' ||
            metric === 'consecutiveWins' || metric === 'consecutiveLosses') {
            return value.toString();
        }
        if (metric.includes('Ratio')) {
            return value.toFixed(2);
        }
        if (metric === 'averageTradeDuration') {
            return `${value.toFixed(0)}m`;
        }
        return `$${value.toFixed(2)}`;
    };

    const getBestIndex = (metric: keyof PerformanceMetrics): number => {
        const isHigherBetter = !metric.toLowerCase().includes('loss') &&
            !metric.toLowerCase().includes('drawdown');

        let bestIdx = 0;
        let bestVal = results[0].metrics[metric] as number;

        results.forEach((result, idx) => {
            const val = result.metrics[metric] as number;
            if (isHigherBetter ? val > bestVal : val < bestVal) {
                bestVal = val;
                bestIdx = idx;
            }
        });

        return bestIdx;
    };

    // Calculate max equity for chart scaling
    const allEquities = results.flatMap(r => r.equityCurve.map(p => p.equity));
    const maxEquity = Math.max(...allEquities);
    const minEquity = Math.min(...allEquities);
    const equityRange = maxEquity - minEquity;

    return (
        <div className="strategy-comparison">
            <div className="sc-header">
                <h3>📊 Strategy Comparison</h3>
                <button
                    className="toggle-metrics"
                    onClick={() => setShowAllMetrics(!showAllMetrics)}
                >
                    {showAllMetrics ? 'Show Key Metrics' : 'Show All Metrics'}
                </button>
            </div>

            {/* Strategy Legend */}
            <div className="strategy-legend">
                {results.map((result, idx) => (
                    <div key={idx} className="legend-item">
                        <span
                            className="legend-color"
                            style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                        />
                        <span className="legend-name">{result.strategy}</span>
                        <button
                            className="remove-btn"
                            onClick={() => onRemove(idx)}
                            title="Remove from comparison"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>

            {/* Equity Curve Comparison */}
            <div className="equity-comparison">
                <h4>Equity Curves</h4>
                <div className="equity-chart">
                    <svg viewBox="0 0 100 40" preserveAspectRatio="none">
                        {results.map((result, idx) => {
                            const points = result.equityCurve.map((point, i) => {
                                const x = (i / (result.equityCurve.length - 1)) * 100;
                                const y = 40 - ((point.equity - minEquity) / equityRange) * 38;
                                return `${x},${y}`;
                            }).join(' ');

                            return (
                                <polyline
                                    key={idx}
                                    fill="none"
                                    stroke={COLORS[idx % COLORS.length]}
                                    strokeWidth="0.5"
                                    points={points}
                                    opacity={0.8}
                                />
                            );
                        })}
                    </svg>
                </div>
            </div>

            {/* Metrics Table */}
            <div className="metrics-table-wrapper">
                <table className="metrics-table">
                    <thead>
                        <tr>
                            <th>Metric</th>
                            {results.map((result, idx) => (
                                <th key={idx} style={{ borderTopColor: COLORS[idx % COLORS.length] }}>
                                    {result.strategy}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {(showAllMetrics ? Object.keys(METRIC_LABELS) : selectedMetrics).map(metric => {
                            const bestIdx = getBestIndex(metric as keyof PerformanceMetrics);
                            return (
                                <tr key={metric}>
                                    <td className="metric-name">
                                        {METRIC_LABELS[metric as keyof PerformanceMetrics]}
                                    </td>
                                    {results.map((result, idx) => {
                                        const value = result.metrics[metric as keyof PerformanceMetrics] as number;
                                        const isBest = idx === bestIdx && results.length > 1;
                                        return (
                                            <td
                                                key={idx}
                                                className={`metric-value ${isBest ? 'best' : ''}`}
                                            >
                                                {formatValue(metric as keyof PerformanceMetrics, value)}
                                                {isBest && <span className="best-badge">★</span>}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default StrategyComparison;
