import { useState, useCallback } from 'react';
import {
    VisualStrategy,
    IndicatorBlock,
    ConditionBlock,
    RuleBlock,
    IndicatorType,
    ComparatorType,
    PriceType,
    DEFAULT_VISUAL_STRATEGY,
    createIndicatorBlock,
    createConditionBlock,
    compileStrategy,
    generateCode
} from '../lib/strategy-compiler';
import { Candle, BacktestConfig } from '../lib/types';
import { runBacktest } from '../lib/backtest-engine';
import './StrategyBuilder.css';

interface StrategyBuilderProps {
    candles: Candle[];
    backtestConfig: BacktestConfig;
    onBacktestComplete?: (result: ReturnType<typeof runBacktest>) => void;
}

const INDICATOR_OPTIONS: { value: IndicatorType; label: string; hasPeriod: boolean }[] = [
    { value: 'PRICE', label: 'Price', hasPeriod: false },
    { value: 'SMA', label: 'SMA (Simple Moving Average)', hasPeriod: true },
    { value: 'EMA', label: 'EMA (Exponential Moving Average)', hasPeriod: true },
    { value: 'RSI', label: 'RSI (Relative Strength Index)', hasPeriod: true },
    { value: 'ATR', label: 'ATR (Average True Range)', hasPeriod: true },
    { value: 'HIGH', label: 'Highest High', hasPeriod: true },
    { value: 'LOW', label: 'Lowest Low', hasPeriod: true },
    { value: 'BB_UPPER', label: 'Bollinger Upper', hasPeriod: true },
    { value: 'BB_LOWER', label: 'Bollinger Lower', hasPeriod: true },
    { value: 'MACD', label: 'MACD Line', hasPeriod: false },
    { value: 'MACD_SIGNAL', label: 'MACD Signal', hasPeriod: false },
];

const COMPARATOR_OPTIONS: { value: ComparatorType; label: string }[] = [
    { value: 'greater', label: '>' },
    { value: 'less', label: '<' },
    { value: 'crosses_above', label: 'Crosses Above' },
    { value: 'crosses_below', label: 'Crosses Below' },
];

const PRICE_OPTIONS: { value: PriceType; label: string }[] = [
    { value: 'close', label: 'Close' },
    { value: 'open', label: 'Open' },
    { value: 'high', label: 'High' },
    { value: 'low', label: 'Low' },
];

export function StrategyBuilder({ candles, backtestConfig, onBacktestComplete }: StrategyBuilderProps) {
    const [strategy, setStrategy] = useState<VisualStrategy>(DEFAULT_VISUAL_STRATEGY);
    const [activeRule, setActiveRule] = useState<'entryLong' | 'entryShort' | 'exitLong' | 'exitShort'>('entryLong');
    const [showCodePreview, setShowCodePreview] = useState(false);
    const [isRunning, setIsRunning] = useState(false);

    const updateStrategyName = (name: string) => {
        setStrategy(prev => ({ ...prev, name }));
    };

    const updateRule = (ruleKey: typeof activeRule, updater: (rule: RuleBlock) => RuleBlock) => {
        setStrategy(prev => ({
            ...prev,
            [ruleKey]: updater(prev[ruleKey])
        }));
    };

    const addCondition = () => {
        const newCondition = createConditionBlock(
            createIndicatorBlock('PRICE', undefined, 'close'),
            'greater',
            createIndicatorBlock('SMA', 20)
        );

        updateRule(activeRule, rule => ({
            ...rule,
            conditions: [...rule.conditions, newCondition]
        }));
    };

    const removeCondition = (conditionId: string) => {
        updateRule(activeRule, rule => ({
            ...rule,
            conditions: rule.conditions.filter(c => c.id !== conditionId)
        }));
    };

    const updateCondition = (conditionId: string, updates: Partial<ConditionBlock>) => {
        updateRule(activeRule, rule => ({
            ...rule,
            conditions: rule.conditions.map(c =>
                c.id === conditionId ? { ...c, ...updates } : c
            )
        }));
    };

    const updateIndicator = (
        conditionId: string,
        side: 'left' | 'right',
        updates: Partial<IndicatorBlock>
    ) => {
        updateRule(activeRule, rule => ({
            ...rule,
            conditions: rule.conditions.map(c => {
                if (c.id !== conditionId) return c;
                if (side === 'left') {
                    return { ...c, left: { ...c.left, ...updates } };
                } else if (typeof c.right === 'object') {
                    return { ...c, right: { ...c.right, ...updates } };
                }
                return c;
            })
        }));
    };

    const setRightToNumber = (conditionId: string, value: number) => {
        updateRule(activeRule, rule => ({
            ...rule,
            conditions: rule.conditions.map(c =>
                c.id === conditionId ? { ...c, right: value } : c
            )
        }));
    };

    const setRightToIndicator = (conditionId: string) => {
        updateRule(activeRule, rule => ({
            ...rule,
            conditions: rule.conditions.map(c =>
                c.id === conditionId
                    ? { ...c, right: createIndicatorBlock('SMA', 20) }
                    : c
            )
        }));
    };

    const toggleLogic = () => {
        updateRule(activeRule, rule => ({
            ...rule,
            logic: rule.logic === 'AND' ? 'OR' : 'AND'
        }));
    };

    const runVisuaBacktest = useCallback(() => {
        if (candles.length === 0) return;

        setIsRunning(true);

        setTimeout(() => {
            try {
                const compiledStrategy = compileStrategy(strategy);
                const result = runBacktest(candles, compiledStrategy, backtestConfig);
                onBacktestComplete?.(result);
                alert(`Backtest Complete!\n\nTotal Return: ${result.metrics.totalReturnPercent.toFixed(2)}%\nSharpe Ratio: ${result.metrics.sharpeRatio.toFixed(2)}\nTotal Trades: ${result.metrics.totalTrades}`);
            } catch (error) {
                console.error('Backtest failed:', error);
                alert(`Backtest failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } finally {
                setIsRunning(false);
            }
        }, 50);
    }, [candles, strategy, backtestConfig, onBacktestComplete]);

    const downloadCode = () => {
        const code = generateCode(strategy);
        const blob = new Blob([code], { type: 'text/typescript' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${strategy.name.replace(/\s+/g, '-').toLowerCase()}.ts`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const currentRule = strategy[activeRule];

    return (
        <div className="strategy-builder">
            <div className="sb-header">
                <h3>🧩 No-Code Strategy Builder</h3>
                <div className="sb-actions">
                    <button onClick={() => setShowCodePreview(!showCodePreview)} className="btn-preview">
                        {showCodePreview ? '📝 Hide Code' : '👁 View Code'}
                    </button>
                    <button onClick={downloadCode} className="btn-download">
                        📥 Download
                    </button>
                </div>
            </div>

            <div className="sb-content">
                {/* Strategy Name */}
                <div className="strategy-name-input">
                    <label>Strategy Name</label>
                    <input
                        type="text"
                        value={strategy.name}
                        onChange={(e) => updateStrategyName(e.target.value)}
                        placeholder="My Custom Strategy"
                    />
                </div>

                {/* Risk Management */}
                <div className="risk-settings">
                    <div className="risk-input">
                        <label>Stop Loss (ATR x)</label>
                        <input
                            type="number"
                            value={strategy.stopLossAtr}
                            onChange={(e) => setStrategy(prev => ({ ...prev, stopLossAtr: +e.target.value }))}
                            min={0.5}
                            max={10}
                            step={0.5}
                        />
                    </div>
                    <div className="risk-input">
                        <label>Take Profit (ATR x)</label>
                        <input
                            type="number"
                            value={strategy.takeProfitAtr}
                            onChange={(e) => setStrategy(prev => ({ ...prev, takeProfitAtr: +e.target.value }))}
                            min={0.5}
                            max={20}
                            step={0.5}
                        />
                    </div>
                </div>

                {/* Rule Tabs */}
                <div className="rule-tabs">
                    {(['entryLong', 'entryShort', 'exitLong', 'exitShort'] as const).map(rule => (
                        <button
                            key={rule}
                            className={`rule-tab ${activeRule === rule ? 'active' : ''}`}
                            onClick={() => setActiveRule(rule)}
                        >
                            {rule === 'entryLong' && '🟢 Entry Long'}
                            {rule === 'entryShort' && '🔴 Entry Short'}
                            {rule === 'exitLong' && '⬆ Exit Long'}
                            {rule === 'exitShort' && '⬇ Exit Short'}
                            {strategy[rule].conditions.length > 0 && (
                                <span className="condition-count">{strategy[rule].conditions.length}</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Rule Editor */}
                <div className="rule-editor">
                    <div className="rule-header">
                        <span className="rule-title">
                            {activeRule.replace(/([A-Z])/g, ' $1').trim()} when:
                        </span>
                        {currentRule.conditions.length > 1 && (
                            <button onClick={toggleLogic} className="logic-toggle">
                                Logic: <strong>{currentRule.logic}</strong>
                            </button>
                        )}
                    </div>

                    <div className="conditions-list">
                        {currentRule.conditions.length === 0 ? (
                            <p className="no-conditions">No conditions added. Click "Add Condition" to start.</p>
                        ) : (
                            currentRule.conditions.map((condition, idx) => (
                                <div key={condition.id} className="condition-block">
                                    {idx > 0 && <span className="logic-connector">{currentRule.logic}</span>}

                                    {/* Left Indicator */}
                                    <div className="indicator-select">
                                        <select
                                            value={condition.left.type}
                                            onChange={(e) => updateIndicator(condition.id, 'left', {
                                                type: e.target.value as IndicatorType
                                            })}
                                        >
                                            {INDICATOR_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>

                                        {condition.left.type === 'PRICE' && (
                                            <select
                                                value={condition.left.priceType || 'close'}
                                                onChange={(e) => updateIndicator(condition.id, 'left', {
                                                    priceType: e.target.value as PriceType
                                                })}
                                            >
                                                {PRICE_OPTIONS.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        )}

                                        {INDICATOR_OPTIONS.find(o => o.value === condition.left.type)?.hasPeriod && (
                                            <input
                                                type="number"
                                                value={condition.left.period || 14}
                                                onChange={(e) => updateIndicator(condition.id, 'left', {
                                                    period: +e.target.value
                                                })}
                                                min={1}
                                                max={200}
                                                className="period-input"
                                            />
                                        )}
                                    </div>

                                    {/* Comparator */}
                                    <select
                                        value={condition.comparator}
                                        onChange={(e) => updateCondition(condition.id, {
                                            comparator: e.target.value as ComparatorType
                                        })}
                                        className="comparator-select"
                                    >
                                        {COMPARATOR_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>

                                    {/* Right Side */}
                                    <div className="indicator-select">
                                        {typeof condition.right === 'number' ? (
                                            <>
                                                <input
                                                    type="number"
                                                    value={condition.right}
                                                    onChange={(e) => setRightToNumber(condition.id, +e.target.value)}
                                                    className="value-input"
                                                />
                                                <button
                                                    onClick={() => setRightToIndicator(condition.id)}
                                                    className="btn-toggle-type"
                                                    title="Switch to indicator"
                                                >
                                                    📊
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <select
                                                    value={condition.right.type}
                                                    onChange={(e) => updateIndicator(condition.id, 'right', {
                                                        type: e.target.value as IndicatorType
                                                    })}
                                                >
                                                    {INDICATOR_OPTIONS.map(opt => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>

                                                {condition.right.type === 'PRICE' && (
                                                    <select
                                                        value={condition.right.priceType || 'close'}
                                                        onChange={(e) => updateIndicator(condition.id, 'right', {
                                                            priceType: e.target.value as PriceType
                                                        })}
                                                    >
                                                        {PRICE_OPTIONS.map(opt => (
                                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                        ))}
                                                    </select>
                                                )}

                                                {INDICATOR_OPTIONS.find(o => o.value === (condition.right as IndicatorBlock).type)?.hasPeriod && (
                                                    <input
                                                        type="number"
                                                        value={(condition.right as IndicatorBlock).period || 14}
                                                        onChange={(e) => updateIndicator(condition.id, 'right', {
                                                            period: +e.target.value
                                                        })}
                                                        min={1}
                                                        max={200}
                                                        className="period-input"
                                                    />
                                                )}

                                                <button
                                                    onClick={() => setRightToNumber(condition.id, 50)}
                                                    className="btn-toggle-type"
                                                    title="Switch to number"
                                                >
                                                    #
                                                </button>
                                            </>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => removeCondition(condition.id)}
                                        className="btn-remove"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    <button onClick={addCondition} className="btn-add-condition">
                        + Add Condition
                    </button>
                </div>

                {/* Run Backtest */}
                <button
                    onClick={runVisuaBacktest}
                    disabled={isRunning || candles.length === 0}
                    className="btn-run-backtest"
                >
                    {isRunning ? '⏳ Running...' : '▶ Run Backtest'}
                </button>

                {/* Code Preview */}
                {showCodePreview && (
                    <div className="code-preview">
                        <h4>Generated TypeScript Code</h4>
                        <pre>{generateCode(strategy)}</pre>
                    </div>
                )}
            </div>
        </div>
    );
}

export default StrategyBuilder;
