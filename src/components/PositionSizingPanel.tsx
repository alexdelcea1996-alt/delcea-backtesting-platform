import { useState, useMemo } from 'react';
import { PerformanceMetrics } from '../lib/types';
import {
    calculateAllPositionSizes,
    PositionSizeInputs,
    PositionSizeResult
} from '../lib/position-sizing';
import './PositionSizingPanel.css';

interface PositionSizingPanelProps {
    metrics: PerformanceMetrics | null;
    initialCapital: number;
}

export function PositionSizingPanel({ metrics, initialCapital }: PositionSizingPanelProps) {
    const [customInputs, setCustomInputs] = useState<PositionSizeInputs>({
        accountSize: initialCapital,
        winRate: metrics?.winRate ? metrics.winRate / 100 : 0.5,
        avgWin: metrics?.averageWin || 100,
        avgLoss: Math.abs(metrics?.averageLoss || 50),
        maxRiskPercent: 0.25
    });

    const results = useMemo(() => {
        return calculateAllPositionSizes(customInputs);
    }, [customInputs]);

    const updateInput = (key: keyof PositionSizeInputs, value: number) => {
        setCustomInputs(prev => ({ ...prev, [key]: value }));
    };

    // Apply metrics if available
    const applyMetrics = () => {
        if (metrics) {
            setCustomInputs({
                accountSize: initialCapital,
                winRate: metrics.winRate / 100,
                avgWin: metrics.averageWin,
                avgLoss: Math.abs(metrics.averageLoss),
                maxRiskPercent: 0.25
            });
        }
    };

    const payoffRatio = customInputs.avgLoss > 0
        ? (customInputs.avgWin / customInputs.avgLoss).toFixed(2)
        : '∞';

    const expectancy = (customInputs.winRate * customInputs.avgWin) -
        ((1 - customInputs.winRate) * customInputs.avgLoss);

    return (
        <div className="position-sizing-panel">
            <div className="ps-header">
                <h3>📊 Position Sizing Calculator</h3>
                {metrics && (
                    <button onClick={applyMetrics} className="btn-apply">
                        Apply Backtest Metrics
                    </button>
                )}
            </div>

            <div className="ps-inputs">
                <div className="input-group">
                    <label>
                        <span>Account Size ($)</span>
                        <input
                            type="number"
                            value={customInputs.accountSize}
                            onChange={(e) => updateInput('accountSize', +e.target.value)}
                            min={100}
                            step={1000}
                        />
                    </label>
                    <label>
                        <span>Win Rate (%)</span>
                        <input
                            type="number"
                            value={(customInputs.winRate * 100).toFixed(1)}
                            onChange={(e) => updateInput('winRate', +e.target.value / 100)}
                            min={0}
                            max={100}
                            step={1}
                        />
                    </label>
                </div>
                <div className="input-group">
                    <label>
                        <span>Avg Win ($)</span>
                        <input
                            type="number"
                            value={customInputs.avgWin.toFixed(2)}
                            onChange={(e) => updateInput('avgWin', +e.target.value)}
                            min={0}
                            step={10}
                        />
                    </label>
                    <label>
                        <span>Avg Loss ($)</span>
                        <input
                            type="number"
                            value={customInputs.avgLoss.toFixed(2)}
                            onChange={(e) => updateInput('avgLoss', +e.target.value)}
                            min={0}
                            step={10}
                        />
                    </label>
                </div>
            </div>

            <div className="ps-summary">
                <div className="summary-stat">
                    <span className="label">Payoff Ratio</span>
                    <span className="value">{payoffRatio}:1</span>
                </div>
                <div className="summary-stat">
                    <span className="label">Expectancy</span>
                    <span className={`value ${expectancy >= 0 ? 'positive' : 'negative'}`}>
                        ${expectancy.toFixed(2)}
                    </span>
                </div>
                <div className="summary-stat">
                    <span className="label">Edge</span>
                    <span className={`value ${expectancy >= 0 ? 'positive' : 'negative'}`}>
                        {expectancy >= 0 ? 'Positive' : 'Negative'}
                    </span>
                </div>
            </div>

            <div className="ps-results">
                <h4>Recommended Position Sizes</h4>
                <div className="results-grid">
                    {results.map((result, idx) => (
                        <PositionSizeCard key={idx} result={result} accountSize={customInputs.accountSize} />
                    ))}
                </div>
            </div>

            <div className="ps-disclaimer">
                <p>
                    ⚠️ These calculations are based on historical performance and assume
                    future results follow similar patterns. Always use proper risk management
                    and never risk more than you can afford to lose.
                </p>
            </div>
        </div>
    );
}

function PositionSizeCard({ result, accountSize }: { result: PositionSizeResult; accountSize: number }) {
    const dollarAmount = (result.positionSize / 100) * accountSize;

    return (
        <div className="ps-card">
            <div className="card-header">
                <span className="method">{result.method}</span>
                {result.positionSize > 0 && (
                    <span className={`size ${result.positionSize > 10 ? 'high' : ''}`}>
                        {result.positionSize.toFixed(1)}%
                    </span>
                )}
            </div>
            {result.positionSize > 0 ? (
                <>
                    <div className="card-value">
                        ${dollarAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div className="card-notes">{result.notes}</div>
                </>
            ) : (
                <div className="card-notes warning">{result.notes}</div>
            )}
        </div>
    );
}

export default PositionSizingPanel;
