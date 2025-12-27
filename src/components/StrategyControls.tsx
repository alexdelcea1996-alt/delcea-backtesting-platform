import { useState, useCallback } from 'react';
import { StrategyParams, BacktestConfig, DEFAULT_BACKTEST_CONFIG } from '../lib/types';
import { SMACrossoverStrategy, RSIReversalStrategy, BreakoutStrategy, PriceAction30MStrategy, DEFAULT_SMA_PARAMS, DEFAULT_RSI_PARAMS, DEFAULT_BREAKOUT_PARAMS, DEFAULT_PRICE_ACTION_30M_PARAMS } from '../strategies';
import './StrategyControls.css';

type StrategyType = 'sma-crossover' | 'rsi-reversal' | 'breakout' | 'price-action-30m';

interface StrategyControlsProps {
    onRunBacktest: (strategy: SMACrossoverStrategy | RSIReversalStrategy | BreakoutStrategy | PriceAction30MStrategy, config: BacktestConfig) => void;
    onOptimize: (strategyType: StrategyType, baseParams: StrategyParams, config: BacktestConfig) => void;
    isRunning: boolean;
    hasData: boolean;
}

export function StrategyControls({ onRunBacktest, onOptimize, isRunning, hasData }: StrategyControlsProps) {
    const [strategyType, setStrategyType] = useState<StrategyType>('sma-crossover');
    const [config, setConfig] = useState<BacktestConfig>(DEFAULT_BACKTEST_CONFIG);

    // SMA params
    const [smaParams, setSmaParams] = useState(DEFAULT_SMA_PARAMS);

    // RSI params
    const [rsiParams, setRsiParams] = useState(DEFAULT_RSI_PARAMS);

    // Breakout params
    const [breakoutParams, setBreakoutParams] = useState(DEFAULT_BREAKOUT_PARAMS);

    // Price Action 30M params
    const [pa30mParams, setPa30mParams] = useState(DEFAULT_PRICE_ACTION_30M_PARAMS);

    const handleRunBacktest = useCallback(() => {
        let strategy;

        switch (strategyType) {
            case 'sma-crossover':
                strategy = new SMACrossoverStrategy(smaParams);
                break;
            case 'rsi-reversal':
                strategy = new RSIReversalStrategy(rsiParams);
                break;
            case 'breakout':
                strategy = new BreakoutStrategy(breakoutParams);
                break;
            case 'price-action-30m':
                strategy = new PriceAction30MStrategy(pa30mParams);
                break;
        }

        onRunBacktest(strategy, config);
    }, [strategyType, smaParams, rsiParams, breakoutParams, pa30mParams, config, onRunBacktest]);

    const handleOptimize = useCallback(() => {
        let baseParams: StrategyParams;

        switch (strategyType) {
            case 'sma-crossover':
                baseParams = smaParams;
                break;
            case 'rsi-reversal':
                baseParams = rsiParams;
                break;
            case 'breakout':
                baseParams = breakoutParams;
                break;
            case 'price-action-30m':
                baseParams = pa30mParams;
                break;
        }

        onOptimize(strategyType, baseParams, config);
    }, [strategyType, smaParams, rsiParams, breakoutParams, pa30mParams, config, onOptimize]);

    const updateConfig = (key: keyof BacktestConfig, value: number) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="strategy-controls">
            <section className="control-section">
                <h3>Strategy Selection</h3>
                <div className="strategy-tabs">
                    <button
                        className={strategyType === 'sma-crossover' ? 'active' : ''}
                        onClick={() => setStrategyType('sma-crossover')}
                    >
                        SMA Crossover
                    </button>
                    <button
                        className={strategyType === 'rsi-reversal' ? 'active' : ''}
                        onClick={() => setStrategyType('rsi-reversal')}
                    >
                        RSI Reversal
                    </button>
                    <button
                        className={strategyType === 'breakout' ? 'active' : ''}
                        onClick={() => setStrategyType('breakout')}
                    >
                        Breakout
                    </button>
                    <button
                        className={strategyType === 'price-action-30m' ? 'active' : ''}
                        onClick={() => setStrategyType('price-action-30m')}
                    >
                        Price Action 30M
                    </button>
                </div>
            </section>

            <section className="control-section">
                <h3>Strategy Parameters</h3>

                {strategyType === 'sma-crossover' && (
                    <div className="params-grid">
                        <label>
                            <span>Fast Period</span>
                            <input
                                type="number"
                                value={smaParams.fastPeriod}
                                onChange={(e) => setSmaParams(p => ({ ...p, fastPeriod: +e.target.value }))}
                                min={2}
                                max={100}
                            />
                        </label>
                        <label>
                            <span>Slow Period</span>
                            <input
                                type="number"
                                value={smaParams.slowPeriod}
                                onChange={(e) => setSmaParams(p => ({ ...p, slowPeriod: +e.target.value }))}
                                min={5}
                                max={200}
                            />
                        </label>
                        <label>
                            <span>ATR Period</span>
                            <input
                                type="number"
                                value={smaParams.atrPeriod}
                                onChange={(e) => setSmaParams(p => ({ ...p, atrPeriod: +e.target.value }))}
                                min={5}
                                max={50}
                            />
                        </label>
                        <label>
                            <span>ATR Multiplier</span>
                            <input
                                type="number"
                                value={smaParams.atrMultiplier}
                                onChange={(e) => setSmaParams(p => ({ ...p, atrMultiplier: +e.target.value }))}
                                min={0.5}
                                max={5}
                                step={0.1}
                            />
                        </label>
                    </div>
                )}

                {strategyType === 'rsi-reversal' && (
                    <div className="params-grid">
                        <label>
                            <span>RSI Period</span>
                            <input
                                type="number"
                                value={rsiParams.rsiPeriod}
                                onChange={(e) => setRsiParams(p => ({ ...p, rsiPeriod: +e.target.value }))}
                                min={2}
                                max={50}
                            />
                        </label>
                        <label>
                            <span>Oversold Level</span>
                            <input
                                type="number"
                                value={rsiParams.oversoldLevel}
                                onChange={(e) => setRsiParams(p => ({ ...p, oversoldLevel: +e.target.value }))}
                                min={10}
                                max={40}
                            />
                        </label>
                        <label>
                            <span>Overbought Level</span>
                            <input
                                type="number"
                                value={rsiParams.overboughtLevel}
                                onChange={(e) => setRsiParams(p => ({ ...p, overboughtLevel: +e.target.value }))}
                                min={60}
                                max={90}
                            />
                        </label>
                        <label>
                            <span>Take Profit Ratio</span>
                            <input
                                type="number"
                                value={rsiParams.takeProfitRatio}
                                onChange={(e) => setRsiParams(p => ({ ...p, takeProfitRatio: +e.target.value }))}
                                min={1}
                                max={5}
                                step={0.5}
                            />
                        </label>
                    </div>
                )}

                {strategyType === 'breakout' && (
                    <div className="params-grid">
                        <label>
                            <span>Lookback Period</span>
                            <input
                                type="number"
                                value={breakoutParams.lookbackPeriod}
                                onChange={(e) => setBreakoutParams(p => ({ ...p, lookbackPeriod: +e.target.value }))}
                                min={5}
                                max={100}
                            />
                        </label>
                        <label>
                            <span>ATR Period</span>
                            <input
                                type="number"
                                value={breakoutParams.atrPeriod}
                                onChange={(e) => setBreakoutParams(p => ({ ...p, atrPeriod: +e.target.value }))}
                                min={5}
                                max={50}
                            />
                        </label>
                        <label>
                            <span>ATR Multiplier</span>
                            <input
                                type="number"
                                value={breakoutParams.atrMultiplier}
                                onChange={(e) => setBreakoutParams(p => ({ ...p, atrMultiplier: +e.target.value }))}
                                min={0.5}
                                max={5}
                                step={0.1}
                            />
                        </label>
                        <label>
                            <span>Take Profit Ratio</span>
                            <input
                                type="number"
                                value={breakoutParams.takeProfitRatio}
                                onChange={(e) => setBreakoutParams(p => ({ ...p, takeProfitRatio: +e.target.value }))}
                                min={1}
                                max={5}
                                step={0.5}
                            />
                        </label>
                    </div>
                )}

                {strategyType === 'price-action-30m' && (
                    <div className="params-grid">
                        <label>
                            <span>SL/TP Ratio</span>
                            <input
                                type="number"
                                value={pa30mParams.slTpRatio}
                                onChange={(e) => setPa30mParams(p => ({ ...p, slTpRatio: +e.target.value }))}
                                min={1}
                                max={5}
                                step={0.5}
                            />
                        </label>
                        <label>
                            <span>Min Wick (pips)</span>
                            <input
                                type="number"
                                value={pa30mParams.minWickPips}
                                onChange={(e) => setPa30mParams(p => ({ ...p, minWickPips: +e.target.value }))}
                                min={0.01}
                                max={0.5}
                                step={0.01}
                            />
                        </label>
                        <label>
                            <span>Fib Zone Low</span>
                            <input
                                type="number"
                                value={pa30mParams.buyFibZoneLow}
                                onChange={(e) => setPa30mParams(p => ({ ...p, buyFibZoneLow: +e.target.value }))}
                                min={0.2}
                                max={0.6}
                                step={0.01}
                            />
                        </label>
                        <label>
                            <span>Fib Zone High</span>
                            <input
                                type="number"
                                value={pa30mParams.buyFibZoneHigh}
                                onChange={(e) => setPa30mParams(p => ({ ...p, buyFibZoneHigh: +e.target.value }))}
                                min={0.5}
                                max={0.9}
                                step={0.01}
                            />
                        </label>
                        <label>
                            <span>Breakeven (pips)</span>
                            <input
                                type="number"
                                value={pa30mParams.autoBreakevenPips}
                                onChange={(e) => setPa30mParams(p => ({ ...p, autoBreakevenPips: +e.target.value }))}
                                min={0}
                                max={0.1}
                                step={0.01}
                            />
                        </label>
                        <label>
                            <span>Counter-Trend</span>
                            <select
                                value={pa30mParams.enableCounterTrend ? 'yes' : 'no'}
                                onChange={(e) => setPa30mParams(p => ({ ...p, enableCounterTrend: e.target.value === 'yes' }))}
                            >
                                <option value="yes">Enabled</option>
                                <option value="no">Disabled</option>
                            </select>
                        </label>
                    </div>
                )}
            </section>

            <section className="control-section">
                <h3>Backtest Configuration</h3>
                <div className="params-grid">
                    <label>
                        <span>Initial Capital</span>
                        <input
                            type="number"
                            value={config.initialCapital}
                            onChange={(e) => updateConfig('initialCapital', +e.target.value)}
                            min={100}
                            step={1000}
                        />
                    </label>
                    <label>
                        <span>Leverage</span>
                        <input
                            type="number"
                            value={config.leverage}
                            onChange={(e) => updateConfig('leverage', +e.target.value)}
                            min={1}
                            max={500}
                        />
                    </label>
                    <label>
                        <span>Commission (%)</span>
                        <input
                            type="number"
                            value={config.commission * 100}
                            onChange={(e) => updateConfig('commission', +e.target.value / 100)}
                            min={0}
                            max={1}
                            step={0.01}
                        />
                    </label>
                    <label>
                        <span>Max Position (%)</span>
                        <input
                            type="number"
                            value={config.maxPositionSize * 100}
                            onChange={(e) => updateConfig('maxPositionSize', +e.target.value / 100)}
                            min={1}
                            max={100}
                        />
                    </label>
                </div>
            </section>

            <div className="control-actions">
                <button
                    className="btn-primary"
                    onClick={handleRunBacktest}
                    disabled={!hasData || isRunning}
                >
                    {isRunning ? 'Running...' : '▶ Run Backtest'}
                </button>
                <button
                    className="btn-secondary"
                    onClick={handleOptimize}
                    disabled={!hasData || isRunning}
                >
                    🔧 Optimize Parameters
                </button>
            </div>
        </div>
    );
}
