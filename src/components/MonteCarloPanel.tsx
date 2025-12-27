import { useState } from 'react';
import { MonteCarloResult, runMonteCarloSimulation } from '../lib/monte-carlo';
import { Trade, PerformanceMetrics } from '../lib/types';
import './MonteCarloPanel.css';

interface MonteCarloPanelProps {
    trades: Trade[];
    metrics: PerformanceMetrics;
    initialCapital: number;
}

export function MonteCarloPanel({ trades, metrics, initialCapital }: MonteCarloPanelProps) {
    const [result, setResult] = useState<MonteCarloResult | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [simCount, setSimCount] = useState(1000);

    const runSimulation = () => {
        setIsRunning(true);
        setProgress(0);

        // Use setTimeout to allow UI updates
        setTimeout(() => {
            const mcResult = runMonteCarloSimulation(
                trades,
                metrics,
                { simulations: simCount, initialCapital, ruinThreshold: 0.5 },
                (p) => setProgress(p * 100)
            );
            setResult(mcResult);
            setIsRunning(false);
        }, 50);
    };

    const closedTrades = trades.filter(t => t.pnl !== null);

    if (closedTrades.length < 10) {
        return (
            <div className="monte-carlo-panel">
                <h3>🎲 Monte Carlo Simulation</h3>
                <p className="mc-notice">Requires at least 10 completed trades for simulation.</p>
            </div>
        );
    }

    return (
        <div className="monte-carlo-panel">
            <div className="mc-header">
                <h3>🎲 Monte Carlo Simulation</h3>
                <div className="mc-controls">
                    <label>
                        <span>Simulations:</span>
                        <select
                            value={simCount}
                            onChange={(e) => setSimCount(+e.target.value)}
                            disabled={isRunning}
                        >
                            <option value={500}>500</option>
                            <option value={1000}>1,000</option>
                            <option value={5000}>5,000</option>
                            <option value={10000}>10,000</option>
                        </select>
                    </label>
                    <button
                        onClick={runSimulation}
                        disabled={isRunning}
                        className="btn-simulate"
                    >
                        {isRunning ? `Running... ${progress.toFixed(0)}%` : 'Run Simulation'}
                    </button>
                </div>
            </div>

            {result && (
                <div className="mc-results">
                    <div className="mc-summary">
                        <div className="mc-stat risk-of-ruin">
                            <span className="label">Risk of Ruin (50% DD)</span>
                            <span className={`value ${result.riskOfRuin > 20 ? 'danger' : result.riskOfRuin > 5 ? 'warning' : 'success'}`}>
                                {result.riskOfRuin.toFixed(1)}%
                            </span>
                        </div>
                        <div className="mc-stat">
                            <span className="label">Simulations</span>
                            <span className="value">{result.simulations.toLocaleString()}</span>
                        </div>
                        <div className="mc-stat">
                            <span className="label">Processing Time</span>
                            <span className="value">{(result.processingTime / 1000).toFixed(2)}s</span>
                        </div>
                    </div>

                    <div className="mc-confidence">
                        <h4>95% Confidence Intervals</h4>
                        <div className="confidence-grid">
                            <div className="confidence-item">
                                <span className="ci-label">Return Range</span>
                                <span className="ci-value">
                                    <span className={result.confidenceInterval95.returnLow >= 0 ? 'positive' : 'negative'}>
                                        {result.confidenceInterval95.returnLow.toFixed(1)}%
                                    </span>
                                    {' → '}
                                    <span className={result.confidenceInterval95.returnHigh >= 0 ? 'positive' : 'negative'}>
                                        {result.confidenceInterval95.returnHigh.toFixed(1)}%
                                    </span>
                                </span>
                            </div>
                            <div className="confidence-item">
                                <span className="ci-label">Max Drawdown Range</span>
                                <span className="ci-value negative">
                                    {result.confidenceInterval95.drawdownLow.toFixed(1)}% → {result.confidenceInterval95.drawdownHigh.toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="mc-percentiles">
                        <h4>Percentile Distribution</h4>
                        <table className="percentile-table">
                            <thead>
                                <tr>
                                    <th>Percentile</th>
                                    <th>Return</th>
                                    <th>Max DD</th>
                                    <th>Final Equity</th>
                                    <th>Sharpe</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(['p5', 'p25', 'p50', 'p75', 'p95'] as const).map(p => {
                                    const data = result.percentiles[p];
                                    const label = p.replace('p', '');
                                    return (
                                        <tr key={p} className={p === 'p50' ? 'median' : ''}>
                                            <td>{label}th</td>
                                            <td className={data.totalReturn >= 0 ? 'positive' : 'negative'}>
                                                {data.totalReturn.toFixed(1)}%
                                            </td>
                                            <td className="negative">-{data.maxDrawdown.toFixed(1)}%</td>
                                            <td>${data.finalEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                            <td>{data.sharpeRatio.toFixed(2)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="mc-comparison">
                        <h4>Actual vs. Simulated Median</h4>
                        <div className="comparison-grid">
                            <div className="comparison-item">
                                <span className="comp-label">Your Return</span>
                                <span className={`comp-value ${metrics.totalReturnPercent >= 0 ? 'positive' : 'negative'}`}>
                                    {metrics.totalReturnPercent.toFixed(1)}%
                                </span>
                            </div>
                            <div className="comparison-item">
                                <span className="comp-label">Median Return</span>
                                <span className={`comp-value ${result.percentiles.p50.totalReturn >= 0 ? 'positive' : 'negative'}`}>
                                    {result.percentiles.p50.totalReturn.toFixed(1)}%
                                </span>
                            </div>
                            <div className="comparison-item">
                                <span className="comp-label">Your Max DD</span>
                                <span className="comp-value negative">-{metrics.maxDrawdownPercent.toFixed(1)}%</span>
                            </div>
                            <div className="comparison-item">
                                <span className="comp-label">Median Max DD</span>
                                <span className="comp-value negative">-{result.percentiles.p50.maxDrawdown.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MonteCarloPanel;
