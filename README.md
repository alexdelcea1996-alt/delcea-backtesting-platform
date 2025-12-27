# Delcea's Backtesting & Optimization Platform

A comprehensive **XAU/USD (Gold) backtesting and optimization platform** built with React, TypeScript, and Vite. Features advanced analytics, real-time simulation, and a no-code strategy builder.

![Platform Screenshot](https://img.shields.io/badge/Platform-XAU%2FUSD-gold)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)
![React](https://img.shields.io/badge/React-19-blue)
![Vite](https://img.shields.io/badge/Vite-7.3-purple)

## ✨ Features

### 📊 Core Backtesting

- **Multiple Strategies**: SMA Crossover, RSI Reversal, Breakout, Price Action 30M
- **CSV Data Import**: Support for HISTDATA format and multiple file upload
- **Performance Metrics**: Sharpe Ratio, Sortino Ratio, Calmar Ratio, Max Drawdown, Win Rate
- **Equity Curve Visualization**: Interactive candlestick charts with trade markers

### 🔬 Advanced Analytics

| Feature | Description |
|---------|-------------|
| **Walk-Forward Analysis** | Out-of-sample validation with rolling/anchored windows |
| **Monte Carlo Simulation** | Risk-of-ruin calculation, confidence intervals (1000+ simulations) |
| **Strategy Comparison** | Side-by-side equity curves, metrics table with best-performer highlighting |
| **Heatmap Calendar** | Daily P&L visualization with color-coded intensity |

### 💰 Trading Tools

- **Position Sizing Calculators**: Kelly Criterion, Half-Kelly, Fixed Fractional, Optimal-f
- **Trade Journal**: Notes, tags, filtering, search for trade annotation
- **MT4/MT5 Export**: Generate downloadable MQL4/MQL5 Expert Advisor code

### 📡 Real-Time Features

- **Simulated Live Data**: XAU/USD price feed with realistic volatility
- **Paper Trading**: Open/close positions with automatic SL/TP execution
- **Account Tracking**: Balance, equity, unrealized P&L monitoring

### 🧩 No-Code Strategy Builder

- Visual block-based condition editor
- 10+ indicators: SMA, EMA, RSI, ATR, Bollinger Bands, MACD, Price levels
- Comparators: >, <, Crosses Above, Crosses Below
- AND/OR logic for complex conditions
- Live TypeScript code preview & download
- Direct backtest execution from builder

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
# Clone repository
git clone https://github.com/alexdelcea1996-altte/delcea-backtesting-platform.git
cd delcea-backtesting-platform

# Install dependencies
npm install

# Start development server
npm run dev
```

### Usage

1. **Load Data**: Upload XAU/USD CSV files (1-minute candles from HISTDATA or similar)
2. **Select Strategy**: Choose from pre-built strategies or create custom ones
3. **Run Backtest**: Click "Run Backtest" to analyze performance
4. **Analyze Results**: Use the 8 analytics tabs to explore metrics, Monte Carlo, comparison, etc.

## 📁 Project Structure

```
src/
├── components/           # React UI components
│   ├── CandlestickChart.tsx
│   ├── StrategyBuilder.tsx
│   ├── LiveDataPanel.tsx
│   ├── MonteCarloPanel.tsx
│   └── ...
├── lib/                  # Core libraries
│   ├── backtest-engine.ts
│   ├── strategy-base.ts
│   ├── strategy-compiler.ts
│   ├── monte-carlo.ts
│   ├── position-sizing.ts
│   └── optimizer/
│       ├── grid-search.ts
│       ├── genetic-optimizer.ts
│       └── walk-forward.ts
└── strategies/           # Pre-built strategies
    ├── sma-crossover.ts
    ├── rsi-reversal.ts
    ├── breakout.ts
    └── price-action-30m.ts
```

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript 5.6
- **Build Tool**: Vite 7.3
- **Charts**: Custom Canvas-based rendering
- **State**: React Hooks (useState, useCallback, useRef)

## 📊 Data Format

The platform accepts CSV files with the following format:

```csv
timestamp,open,high,low,close,volume
20241201 000000,2640.50,2641.20,2640.10,2640.80,100
```

Supported sources:

- HISTDATA.com (NT format)
- MetaTrader exports
- Custom CSV with OHLCV columns

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Built with ⚡ by Delcea
