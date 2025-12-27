import { useState, useCallback } from 'react';
import {
  FileUpload,
  CandlestickChart,
  StrategyControls,
  MetricsPanel,
  HeatmapCalendar,
  MonteCarloPanel,
  PositionSizingPanel,
  TradeJournal,
  StrategyComparison,
  LiveDataPanel,
  StrategyBuilder
} from './components';
import { Candle, BacktestResult, BacktestConfig, StrategyParams, DEFAULT_BACKTEST_CONFIG } from './lib/types';
import { runBacktest } from './lib/backtest-engine';
import { gridSearchOptimize } from './lib/optimizer/grid-search';
import { generateMQL4, generateMQL5, downloadMQLFile } from './lib/mql-exporter';
import { SMACrossoverStrategy, RSIReversalStrategy, BreakoutStrategy, PriceAction30MStrategy, SMACrossoverParams, RSIReversalParams, BreakoutParams, PriceAction30MParams, DEFAULT_PRICE_ACTION_30M_PARAMS } from './strategies';
import { Strategy } from './lib/strategy-base';
import './App.css';

type StrategyType = 'sma-crossover' | 'rsi-reversal' | 'breakout' | 'price-action-30m';
type AnalyticsTab = 'metrics' | 'calendar' | 'monte-carlo' | 'position' | 'journal' | 'comparison' | 'live-data' | 'builder';

function App() {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [filename, setFilename] = useState<string>('');
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [comparisonResults, setComparisonResults] = useState<BacktestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('metrics');
  const [currentConfig, setCurrentConfig] = useState<BacktestConfig>(DEFAULT_BACKTEST_CONFIG);

  const handleDataLoaded = useCallback((data: Candle[], name: string) => {
    setCandles(data);
    setFilename(name);
    setResult(null);
    setComparisonResults([]);
  }, []);

  const handleRunBacktest = useCallback((
    strategy: Strategy<StrategyParams>,
    config: BacktestConfig
  ) => {
    if (candles.length === 0) return;

    setIsRunning(true);
    setCurrentConfig(config);

    // Use setTimeout to allow UI to update
    setTimeout(() => {
      try {
        const backtestResult = runBacktest(candles, strategy, config);
        setResult(backtestResult);
        // Add to comparison if not already present
        setComparisonResults(prev => {
          const exists = prev.some(r => r.strategy === backtestResult.strategy);
          if (exists) {
            return prev.map(r => r.strategy === backtestResult.strategy ? backtestResult : r);
          }
          return [...prev, backtestResult].slice(-5); // Keep last 5
        });
      } catch (error) {
        console.error('Backtest failed:', error);
        alert(`Backtest failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsRunning(false);
      }
    }, 50);
  }, [candles]);

  const handleOptimize = useCallback((
    strategyType: StrategyType,
    _baseParams: StrategyParams,
    config: BacktestConfig
  ) => {
    if (candles.length === 0) return;

    setIsRunning(true);
    setOptimizationProgress(0);
    setCurrentConfig(config);

    setTimeout(() => {
      try {
        let optimResult;

        switch (strategyType) {
          case 'sma-crossover': {
            const smaBaseParams: SMACrossoverParams = { fastPeriod: 10, slowPeriod: 30, useAtrStopLoss: true, atrMultiplier: 2, atrPeriod: 14 };
            optimResult = gridSearchOptimize(
              candles,
              (params: SMACrossoverParams) => new SMACrossoverStrategy(params) as Strategy<SMACrossoverParams>,
              smaBaseParams,
              {
                paramRanges: {
                  fastPeriod: { min: 5, max: 20, step: 5 },
                  slowPeriod: { min: 20, max: 50, step: 10 },
                },
                metric: 'sharpeRatio',
                maximize: true,
              },
              config,
              (progress) => setOptimizationProgress(progress * 100)
            );
            const bestSmaStrategy = new SMACrossoverStrategy(optimResult.bestParams as SMACrossoverParams);
            const newResult = runBacktest(candles, bestSmaStrategy, config);
            setResult(newResult);
            setComparisonResults(prev => [...prev.filter(r => r.strategy !== newResult.strategy), newResult].slice(-5));
            break;
          }

          case 'rsi-reversal': {
            const rsiBaseParams: RSIReversalParams = { rsiPeriod: 14, oversoldLevel: 30, overboughtLevel: 70, useAtrStopLoss: true, atrMultiplier: 1.5, atrPeriod: 14, takeProfitRatio: 2 };
            optimResult = gridSearchOptimize(
              candles,
              (params: RSIReversalParams) => new RSIReversalStrategy(params) as Strategy<RSIReversalParams>,
              rsiBaseParams,
              {
                paramRanges: {
                  rsiPeriod: { min: 7, max: 21, step: 7 },
                  oversoldLevel: { min: 20, max: 35, step: 5 },
                  overboughtLevel: { min: 65, max: 80, step: 5 },
                },
                metric: 'sharpeRatio',
                maximize: true,
              },
              config,
              (progress) => setOptimizationProgress(progress * 100)
            );
            const bestRsiStrategy = new RSIReversalStrategy(optimResult.bestParams as RSIReversalParams);
            const newResult = runBacktest(candles, bestRsiStrategy, config);
            setResult(newResult);
            setComparisonResults(prev => [...prev.filter(r => r.strategy !== newResult.strategy), newResult].slice(-5));
            break;
          }

          case 'breakout': {
            const breakoutBaseParams: BreakoutParams = { lookbackPeriod: 20, atrPeriod: 14, atrMultiplier: 1.5, takeProfitRatio: 2, waitForClose: true };
            optimResult = gridSearchOptimize(
              candles,
              (params: BreakoutParams) => new BreakoutStrategy(params) as Strategy<BreakoutParams>,
              breakoutBaseParams,
              {
                paramRanges: {
                  lookbackPeriod: { min: 10, max: 30, step: 5 },
                  atrMultiplier: { min: 1, max: 2.5, step: 0.5 },
                },
                metric: 'sharpeRatio',
                maximize: true,
              },
              config,
              (progress) => setOptimizationProgress(progress * 100)
            );
            const bestBreakoutStrategy = new BreakoutStrategy(optimResult.bestParams as BreakoutParams);
            const newResult = runBacktest(candles, bestBreakoutStrategy, config);
            setResult(newResult);
            setComparisonResults(prev => [...prev.filter(r => r.strategy !== newResult.strategy), newResult].slice(-5));
            break;
          }

          case 'price-action-30m': {
            const pa30mBaseParams: PriceAction30MParams = DEFAULT_PRICE_ACTION_30M_PARAMS;
            optimResult = gridSearchOptimize(
              candles,
              (params: PriceAction30MParams) => new PriceAction30MStrategy(params) as Strategy<PriceAction30MParams>,
              pa30mBaseParams,
              {
                paramRanges: {
                  slTpRatio: { min: 1.5, max: 3, step: 0.5 },
                  minWickPips: { min: 0.05, max: 0.15, step: 0.05 },
                },
                metric: 'sharpeRatio',
                maximize: true,
              },
              config,
              (progress) => setOptimizationProgress(progress * 100)
            );
            const bestPa30mStrategy = new PriceAction30MStrategy(optimResult.bestParams as PriceAction30MParams);
            const newResult = runBacktest(candles, bestPa30mStrategy, config);
            setResult(newResult);
            setComparisonResults(prev => [...prev.filter(r => r.strategy !== newResult.strategy), newResult].slice(-5));
            break;
          }
        }

        if (optimResult) {
          console.log('Optimization complete:', optimResult);
          alert(`Optimization complete!\n\nBest parameters found with Sharpe Ratio: ${optimResult.bestMetricValue.toFixed(3)}\n\nTested ${optimResult.totalCombinations} combinations in ${(optimResult.processingTime / 1000).toFixed(1)}s`);
        }
      } catch (error) {
        console.error('Optimization failed:', error);
        alert(`Optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsRunning(false);
        setOptimizationProgress(null);
      }
    }, 50);
  }, [candles]);

  const handleExportMQL = useCallback((version: 'mq4' | 'mq5') => {
    if (!result) return;

    const config = {
      strategyName: result.strategy.replace(/\s+/g, '_'),
      params: result.params,
      symbol: 'XAUUSD',
      timeframe: 'PERIOD_M30',
      magicNumber: 123456,
      lotSize: 0.1,
      useAutolot: true,
      riskPercent: 2
    };

    const code = version === 'mq4' ? generateMQL4(config) : generateMQL5(config);
    downloadMQLFile(code, `${config.strategyName}.${version}`);
  }, [result]);

  const handleRemoveComparison = useCallback((index: number) => {
    setComparisonResults(prev => prev.filter((_, i) => i !== index));
  }, []);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const tabs: { key: AnalyticsTab; label: string; icon: string }[] = [
    { key: 'metrics', label: 'Metrics', icon: '📊' },
    { key: 'calendar', label: 'Heatmap', icon: '📅' },
    { key: 'monte-carlo', label: 'Monte Carlo', icon: '🎲' },
    { key: 'position', label: 'Position Size', icon: '💰' },
    { key: 'journal', label: 'Journal', icon: '📓' },
    { key: 'comparison', label: 'Compare', icon: '⚖️' },
    { key: 'live-data', label: 'Live Data', icon: '📡' },
    { key: 'builder', label: 'No-Code Builder', icon: '🧩' },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <span className="logo-icon">⚡</span>
          <h1>Delcea's Platform</h1>
        </div>
        <p className="tagline">XAU/USD Backtesting & Optimization Platform</p>
      </header>

      <main className="app-main">
        {candles.length === 0 ? (
          <div className="upload-section">
            <FileUpload onDataLoaded={handleDataLoaded} />
          </div>
        ) : (
          <div className="dashboard">
            <aside className="sidebar">
              <div className="data-info">
                <h3>📁 {filename}</h3>
                <div className="data-stats">
                  <span>{candles.length.toLocaleString()} candles</span>
                  <span>•</span>
                  <span>{formatDate(candles[0].timestamp)} - {formatDate(candles[candles.length - 1].timestamp)}</span>
                </div>
                <button
                  className="btn-small"
                  onClick={() => { setCandles([]); setResult(null); setComparisonResults([]); }}
                >
                  Load Different Data
                </button>
              </div>

              <StrategyControls
                onRunBacktest={handleRunBacktest}
                onOptimize={handleOptimize}
                isRunning={isRunning}
                hasData={candles.length > 0}
              />

              {result && (
                <div className="export-section">
                  <h4>Export to MetaTrader</h4>
                  <div className="export-buttons">
                    <button onClick={() => handleExportMQL('mq4')} className="btn-export">
                      📥 MT4 (.mq4)
                    </button>
                    <button onClick={() => handleExportMQL('mq5')} className="btn-export">
                      📥 MT5 (.mq5)
                    </button>
                  </div>
                </div>
              )}

              {optimizationProgress !== null && (
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${optimizationProgress}%` }}
                  />
                  <span>{optimizationProgress.toFixed(0)}%</span>
                </div>
              )}
            </aside>

            <div className="content">
              <CandlestickChart
                candles={candles}
                trades={result?.trades}
                equityCurve={result?.equityCurve}
              />

              {/* Analytics Tabs */}
              <div className="analytics-tabs">
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    <span className="tab-icon">{tab.icon}</span>
                    <span className="tab-label">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="tab-content">
                {activeTab === 'metrics' && (
                  <MetricsPanel
                    metrics={result?.metrics ?? null}
                    strategyName={result?.strategy}
                  />
                )}

                {activeTab === 'calendar' && result && (
                  <HeatmapCalendar trades={result.trades} />
                )}

                {activeTab === 'monte-carlo' && result && (
                  <MonteCarloPanel
                    trades={result.trades}
                    metrics={result.metrics}
                    initialCapital={currentConfig.initialCapital}
                  />
                )}

                {activeTab === 'position' && (
                  <PositionSizingPanel
                    metrics={result?.metrics ?? null}
                    initialCapital={currentConfig.initialCapital}
                  />
                )}

                {activeTab === 'journal' && result && (
                  <TradeJournal trades={result.trades} />
                )}

                {activeTab === 'comparison' && (
                  <StrategyComparison
                    results={comparisonResults}
                    onRemove={handleRemoveComparison}
                  />
                )}

                {activeTab === 'live-data' && (
                  <LiveDataPanel initialBalance={currentConfig.initialCapital} />
                )}

                {activeTab === 'builder' && (
                  <StrategyBuilder
                    candles={candles}
                    backtestConfig={currentConfig}
                    onBacktestComplete={(res) => {
                      setResult(res);
                      setComparisonResults(prev => [...prev.filter(r => r.strategy !== res.strategy), res].slice(-5));
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>Built for high-frequency XAU/USD analysis</p>
      </footer>
    </div>
  );
}

export default App;
