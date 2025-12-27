import { PerformanceMetrics } from '../lib/types';
import { formatMetrics } from '../lib/metrics/performance';
import './MetricsPanel.css';

interface MetricsPanelProps {
    metrics: PerformanceMetrics | null;
    strategyName?: string;
}

export function MetricsPanel({ metrics, strategyName }: MetricsPanelProps) {
    if (!metrics) {
        return (
            <div className="metrics-panel empty">
                <div className="empty-state">
                    <span className="icon">📈</span>
                    <p>Run a backtest to see performance metrics</p>
                </div>
            </div>
        );
    }

    const formatted = formatMetrics(metrics);
    const isProfit = metrics.totalReturn >= 0;

    return (
        <div className="metrics-panel">
            {strategyName && (
                <div className="metrics-header">
                    <h3>{strategyName}</h3>
                    <span className={`total-return ${isProfit ? 'profit' : 'loss'}`}>
                        {isProfit ? '+' : ''}{metrics.totalReturnPercent.toFixed(2)}%
                    </span>
                </div>
            )}

            <div className="metrics-grid">
                {/* Key Metrics */}
                <div className="metric-card highlight">
                    <span className="metric-label">Total Return</span>
                    <span className={`metric-value ${isProfit ? 'profit' : 'loss'}`}>
                        {formatted['Total Return']}
                    </span>
                </div>

                <div className="metric-card">
                    <span className="metric-label">Sharpe Ratio</span>
                    <span className="metric-value">{formatted['Sharpe Ratio']}</span>
                </div>

                <div className="metric-card">
                    <span className="metric-label">Max Drawdown</span>
                    <span className="metric-value loss">{formatted['Max Drawdown']}</span>
                </div>

                <div className="metric-card">
                    <span className="metric-label">Win Rate</span>
                    <span className="metric-value">{formatted['Win Rate']}</span>
                </div>

                <div className="metric-card">
                    <span className="metric-label">Profit Factor</span>
                    <span className="metric-value">{formatted['Profit Factor']}</span>
                </div>

                <div className="metric-card">
                    <span className="metric-label">Total Trades</span>
                    <span className="metric-value">{formatted['Total Trades']}</span>
                </div>

                <div className="metric-card">
                    <span className="metric-label">Avg Win</span>
                    <span className="metric-value profit">{formatted['Average Win']}</span>
                </div>

                <div className="metric-card">
                    <span className="metric-label">Avg Loss</span>
                    <span className="metric-value loss">{formatted['Average Loss']}</span>
                </div>

                <div className="metric-card">
                    <span className="metric-label">Sortino Ratio</span>
                    <span className="metric-value">{formatted['Sortino Ratio']}</span>
                </div>

                <div className="metric-card">
                    <span className="metric-label">Calmar Ratio</span>
                    <span className="metric-value">{formatted['Calmar Ratio']}</span>
                </div>

                <div className="metric-card">
                    <span className="metric-label">CAGR</span>
                    <span className="metric-value">{formatted['CAGR']}</span>
                </div>

                <div className="metric-card">
                    <span className="metric-label">Expectancy</span>
                    <span className="metric-value">{formatted['Expectancy']}</span>
                </div>
            </div>

            <div className="metrics-details">
                <h4>Trade Statistics</h4>
                <div className="details-row">
                    <span>Winning Trades</span>
                    <span className="profit">{metrics.winningTrades}</span>
                </div>
                <div className="details-row">
                    <span>Losing Trades</span>
                    <span className="loss">{metrics.losingTrades}</span>
                </div>
                <div className="details-row">
                    <span>Largest Win</span>
                    <span className="profit">{formatted['Largest Win']}</span>
                </div>
                <div className="details-row">
                    <span>Largest Loss</span>
                    <span className="loss">{formatted['Largest Loss']}</span>
                </div>
                <div className="details-row">
                    <span>Max Consecutive Wins</span>
                    <span>{metrics.consecutiveWins}</span>
                </div>
                <div className="details-row">
                    <span>Max Consecutive Losses</span>
                    <span>{metrics.consecutiveLosses}</span>
                </div>
                <div className="details-row">
                    <span>Avg Trade Duration</span>
                    <span>{formatted['Avg Trade Duration']}</span>
                </div>
            </div>
        </div>
    );
}
