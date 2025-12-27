import { useState } from 'react';
import { Candle, StrategyParams, BacktestConfig } from '../lib/types';
import { WalkForwardResult, WalkForwardConfig, walkForwardAnalyze } from '../lib/optimizer/walk-forward';
import { Strategy } from '../lib/strategy-base';
import './WalkForwardPanel.css';

interface WalkForwardPanelProps<T extends StrategyParams> {
    candles: Candle[];
    strategyFactory: (params: T) => Strategy<T>;
    baseParams: T;
    backtestConfig: BacktestConfig;
    paramRanges: Record<string, { min: number; max: number; step: number }>;
}

export function WalkForwardPanel<T extends StrategyParams>({
    candles,
    strategyFactory,
    baseParams,
    backtestConfig,
    paramRanges
}: WalkForwardPanelProps<T>) {
    const [result, setResult] = useState<WalkForwardResult | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [numWindows, setNumWindows] = useState(5);
    const [windowType, setWindowType] = useState<'rolling' | 'anchored'>('rolling');
    const [trainRatio, setTrainRatio] = useState(0.7);

    const runAnalysis = () => {
        setIsRunning(true);
        setProgress(0);

        setTimeout(() => {
            const config: WalkForwardConfig = {
                windowType,
                trainRatio,
                numWindows,
                optimizationConfig: {
                    paramRanges,
                    metric: 'sharpeRatio',
                    maximize: true
                }
            };

            const wfResult = walkForwardAnalyze(
                candles,
                strategyFactory,
                baseParams,
                config,
                backtestConfig,
                (p) => setProgress(p * 100)
            );

            setResult(wfResult);
            setIsRunning(false);
        }, 50);
    };

    if (candles.length === 0) {
        return (
            <div className="walk-forward-panel">
                <h3>🔄 Walk-Forward Analysis</h3>
                <p className="wf-notice">Load data to run walk-forward analysis.</p>
            </div>
        );
    }

    return (
        <div className="walk-forward-panel">
            <div className="wf-header">
                <h3>🔄 Walk-Forward Analysis</h3>
            </div>

            <div className="wf-config">
                <div className="config-row">
                    <label>
                        <span>Window Type</span>
                        <select
                            value={windowType}
                            onChange={(e) => setWindowType(e.target.value as 'rolling' | 'anchored')}
                            disabled={isRunning}
                        >
                            <option value="rolling">Rolling</option>
                            <option value="anchored">Anchored</option>
                        </select>
                    </label>
                    <label>
                        <span>Windows</span>
                        <input
                            type="number"
                            value={numWindows}
                            onChange={(e) => setNumWindows(+e.target.value)}
                            min={2}
                            max={10}
                            disabled={isRunning}
                        />
                    </label>
                    <label>
                        <span>Train Ratio</span>
                        <input
                            type="number"
                            value={trainRatio}
                            onChange={(e) => setTrainRatio(+e.target.value)}
                            min={0.5}
                            max={0.9}
                            step={0.05}
                            disabled={isRunning}
                        />
                    </label>
                </div>
                <button
                    onClick={runAnalysis}
                    disabled={isRunning}
                    className="btn-analyze"
                >
                    {isRunning ? `Analyzing... ${progress.toFixed(0)}%` : 'Run Walk-Forward Analysis'}
                </button>
            </div>

            {result && (
                <div className="wf-results">
                    <div className="wf-summary">
                        <div className="summary-card robustness">
                            <span className="label">Robustness Score</span>
                            <span className={`value ${result.robustnessScore >= 70 ? 'good' : result.robustnessScore >= 40 ? 'moderate' : 'poor'}`}>
                                {result.robustnessScore.toFixed(0)}/100
                            </span>
                        </div>
                        <div className="summary-card">
                            <span className="label">Avg Degradation</span>
                            <span className={`value ${result.averageDegradation <= 20 ? 'good' : result.averageDegradation <= 50 ? 'moderate' : 'poor'}`}>
                                {result.averageDegradation.toFixed(1)}%
                            </span>
                        </div>
                        <div className="summary-card">
                            <span className="label">Processing Time</span>
                            <span className="value">{(result.processingTime / 1000).toFixed(1)}s</span>
                        </div>
                    </div>

                    <div className="wf-aggregated">
                        <h4>Aggregated Out-of-Sample Results</h4>
                        <div className="aggregated-grid">
                            <div className="agg-stat">
                                <span className="label">Total Return</span>
                                <span className={`value ${result.aggregatedOutOfSample.totalReturn >= 0 ? 'positive' : 'negative'}`}>
                                    {result.aggregatedOutOfSample.totalReturn.toFixed(2)}%
                                </span>
                            </div>
                            <div className="agg-stat">
                                <span className="label">Sharpe Ratio</span>
                                <span className="value">{result.aggregatedOutOfSample.sharpeRatio.toFixed(2)}</span>
                            </div>
                            <div className="agg-stat">
                                <span className="label">Max Drawdown</span>
                                <span className="value negative">-{result.aggregatedOutOfSample.maxDrawdown.toFixed(2)}%</span>
                            </div>
                            <div className="agg-stat">
                                <span className="label">Win Rate</span>
                                <span className="value">{result.aggregatedOutOfSample.winRate.toFixed(1)}%</span>
                            </div>
                            <div className="agg-stat">
                                <span className="label">Total Trades</span>
                                <span className="value">{result.aggregatedOutOfSample.totalTrades}</span>
                            </div>
                        </div>
                    </div>

                    <div className="wf-windows">
                        <h4>Window Results</h4>
                        <table className="windows-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Train Period</th>
                                    <th>Test Period</th>
                                    <th>In-Sample</th>
                                    <th>Out-Sample</th>
                                    <th>Degradation</th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.windows.map((w, idx) => {
                                    const formatDate = (ts: number) => new Date(ts).toLocaleDateString();
                                    const inSharpe = w.inSampleMetrics.sharpeRatio;
                                    const outSharpe = w.outOfSampleMetrics.sharpeRatio;

                                    return (
                                        <tr key={idx}>
                                            <td>{idx + 1}</td>
                                            <td className="date-col">
                                                {formatDate(w.window.trainStart)} - {formatDate(w.window.trainEnd)}
                                            </td>
                                            <td className="date-col">
                                                {formatDate(w.window.testStart)} - {formatDate(w.window.testEnd)}
                                            </td>
                                            <td className={inSharpe >= 0 ? 'positive' : 'negative'}>
                                                {inSharpe.toFixed(2)}
                                            </td>
                                            <td className={outSharpe >= 0 ? 'positive' : 'negative'}>
                                                {outSharpe.toFixed(2)}
                                            </td>
                                            <td className={w.degradation <= 20 ? 'good' : w.degradation <= 50 ? 'moderate' : 'poor'}>
                                                {w.degradation.toFixed(1)}%
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="wf-interpretation">
                        <h4>Interpretation</h4>
                        <div className="interpretation-text">
                            {result.robustnessScore >= 70 ? (
                                <p className="good">
                                    ✅ <strong>Good robustness.</strong> Your strategy shows consistent
                                    out-of-sample performance with minimal degradation. This suggests
                                    the strategy is not overfit and may perform well in live trading.
                                </p>
                            ) : result.robustnessScore >= 40 ? (
                                <p className="moderate">
                                    ⚠️ <strong>Moderate robustness.</strong> Performance degrades somewhat
                                    on unseen data. Consider simplifying the strategy or using more
                                    conservative parameters to reduce overfitting.
                                </p>
                            ) : (
                                <p className="poor">
                                    ❌ <strong>Poor robustness.</strong> Significant performance degradation
                                    on out-of-sample data suggests overfitting. The strategy may not
                                    perform well in live trading. Consider revising the strategy logic.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WalkForwardPanel;
