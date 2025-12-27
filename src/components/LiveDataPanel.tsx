import { useState, useEffect, useRef, useCallback } from 'react';
import { SimulatedDataFeed, PaperTradingSimulator, Tick } from '../lib/data-feeds';
import './LiveDataPanel.css';

interface LiveDataPanelProps {
    initialBalance?: number;
}

export function LiveDataPanel({ initialBalance = 10000 }: LiveDataPanelProps) {
    const [isConnected, setIsConnected] = useState(false);
    const [currentTick, setCurrentTick] = useState<Tick | null>(null);
    const [tickHistory, setTickHistory] = useState<Tick[]>([]);
    const [tickCount, setTickCount] = useState(0);
    const [accountState, setAccountState] = useState(new PaperTradingSimulator(initialBalance).getAccountState());

    const feedRef = useRef<SimulatedDataFeed | null>(null);
    const traderRef = useRef<PaperTradingSimulator | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Initialize feed and trader
    useEffect(() => {
        feedRef.current = new SimulatedDataFeed({ basePrice: 2650.00 });
        traderRef.current = new PaperTradingSimulator(initialBalance);

        return () => {
            if (feedRef.current) {
                feedRef.current.stop();
            }
        };
    }, [initialBalance]);

    // Draw tick chart
    const drawChart = useCallback((ticks: Tick[]) => {
        const canvas = canvasRef.current;
        if (!canvas || ticks.length < 2) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const padding = 10;

        // Clear
        ctx.fillStyle = '#12121a';
        ctx.fillRect(0, 0, width, height);

        // Get price range
        const prices = ticks.map(t => t.last);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceRange = maxPrice - minPrice || 1;

        // Draw grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padding + (height - 2 * padding) * (i / 4);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Draw price line
        ctx.beginPath();
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 2;

        ticks.forEach((tick, i) => {
            const x = padding + (width - 2 * padding) * (i / (ticks.length - 1));
            const y = padding + (height - 2 * padding) * (1 - (tick.last - minPrice) / priceRange);

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        // Fill gradient
        const lastTick = ticks[ticks.length - 1];
        const lastX = width - padding;
        const lastY = padding + (height - 2 * padding) * (1 - (lastTick.last - minPrice) / priceRange);

        ctx.lineTo(lastX, height - padding);
        ctx.lineTo(padding, height - padding);
        ctx.closePath();

        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw current price dot
        ctx.beginPath();
        ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#8b5cf6';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }, []);

    // Handle tick updates
    useEffect(() => {
        if (!feedRef.current || !isConnected) return;

        const unsubscribe = feedRef.current.onTick((tick) => {
            setCurrentTick(tick);
            setTickCount(prev => prev + 1);

            setTickHistory(prev => {
                const newHistory = [...prev, tick].slice(-100); // Keep last 100 ticks
                drawChart(newHistory);
                return newHistory;
            });

            // Update paper trading positions
            if (traderRef.current) {
                traderRef.current.updatePositions(tick.last);
                setAccountState(traderRef.current.getAccountState());
            }
        });

        return () => unsubscribe();
    }, [isConnected, drawChart]);

    const toggleConnection = () => {
        if (isConnected) {
            feedRef.current?.stop();
            setIsConnected(false);
        } else {
            feedRef.current?.start(500); // Update every 500ms
            setIsConnected(true);
            setTickHistory([]);
            setTickCount(0);
        }
    };

    const openLong = () => {
        if (!traderRef.current || !currentTick) return;
        const sl = currentTick.last - 5; // $5 stop loss
        const tp = currentTick.last + 10; // $10 take profit
        traderRef.current.openPosition('long', currentTick.ask, 1, sl, tp);
        setAccountState(traderRef.current.getAccountState());
    };

    const openShort = () => {
        if (!traderRef.current || !currentTick) return;
        const sl = currentTick.last + 5;
        const tp = currentTick.last - 10;
        traderRef.current.openPosition('short', currentTick.bid, 1, sl, tp);
        setAccountState(traderRef.current.getAccountState());
    };

    const closePosition = (positionId: string) => {
        if (!traderRef.current || !currentTick) return;
        traderRef.current.closePosition(positionId, currentTick.last);
        setAccountState(traderRef.current.getAccountState());
    };

    const resetAccount = () => {
        if (!traderRef.current) return;
        traderRef.current.reset();
        setAccountState(traderRef.current.getAccountState());
    };

    const priceChange = tickHistory.length > 1
        ? tickHistory[tickHistory.length - 1].last - tickHistory[0].last
        : 0;

    return (
        <div className="live-data-panel">
            <div className="ldp-header">
                <h3>📡 Live Data Feed</h3>
                <div className="connection-controls">
                    <span className={`status-indicator ${isConnected ? 'connected' : ''}`}>
                        {isConnected ? '● Connected' : '○ Disconnected'}
                    </span>
                    <button
                        onClick={toggleConnection}
                        className={`btn-connect ${isConnected ? 'stop' : 'start'}`}
                    >
                        {isConnected ? '⏹ Stop' : '▶ Start'}
                    </button>
                </div>
            </div>

            <div className="ldp-content">
                {/* Price Display */}
                <div className="price-display">
                    <div className="current-price">
                        <span className="label">XAU/USD</span>
                        <span className={`price ${priceChange >= 0 ? 'up' : 'down'}`}>
                            {currentTick ? currentTick.last.toFixed(2) : '---'}
                        </span>
                        <span className={`change ${priceChange >= 0 ? 'up' : 'down'}`}>
                            {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}
                        </span>
                    </div>
                    <div className="bid-ask">
                        <span className="bid">Bid: {currentTick?.bid.toFixed(2) || '---'}</span>
                        <span className="spread">
                            Spread: {currentTick ? (currentTick.ask - currentTick.bid).toFixed(2) : '---'}
                        </span>
                        <span className="ask">Ask: {currentTick?.ask.toFixed(2) || '---'}</span>
                    </div>
                    <div className="tick-info">
                        <span>Ticks: {tickCount}</span>
                    </div>
                </div>

                {/* Tick Chart */}
                <div className="tick-chart">
                    <canvas
                        ref={canvasRef}
                        width={600}
                        height={150}
                    />
                </div>

                {/* Paper Trading */}
                <div className="paper-trading">
                    <div className="pt-header">
                        <h4>💵 Paper Trading</h4>
                        <button onClick={resetAccount} className="btn-reset">Reset</button>
                    </div>

                    <div className="account-info">
                        <div className="account-stat">
                            <span className="label">Balance</span>
                            <span className="value">${accountState.balance.toFixed(2)}</span>
                        </div>
                        <div className="account-stat">
                            <span className="label">Equity</span>
                            <span className="value">${accountState.equity.toFixed(2)}</span>
                        </div>
                        <div className="account-stat">
                            <span className="label">Unrealized P&L</span>
                            <span className={`value ${accountState.unrealizedPnl >= 0 ? 'positive' : 'negative'}`}>
                                ${accountState.unrealizedPnl.toFixed(2)}
                            </span>
                        </div>
                        <div className="account-stat">
                            <span className="label">Profit %</span>
                            <span className={`value ${accountState.profitPercent >= 0 ? 'positive' : 'negative'}`}>
                                {accountState.profitPercent >= 0 ? '+' : ''}{accountState.profitPercent.toFixed(2)}%
                            </span>
                        </div>
                    </div>

                    <div className="trade-buttons">
                        <button
                            onClick={openLong}
                            disabled={!isConnected}
                            className="btn-buy"
                        >
                            🟢 Buy Long
                        </button>
                        <button
                            onClick={openShort}
                            disabled={!isConnected}
                            className="btn-sell"
                        >
                            🔴 Sell Short
                        </button>
                    </div>

                    {/* Open Positions */}
                    {accountState.positions.length > 0 && (
                        <div className="positions-list">
                            <h5>Open Positions</h5>
                            {accountState.positions.map(pos => (
                                <div key={pos.id} className={`position-row ${pos.direction}`}>
                                    <span className="pos-dir">{pos.direction.toUpperCase()}</span>
                                    <span className="pos-entry">${pos.entryPrice.toFixed(2)}</span>
                                    <span className={`pos-pnl ${pos.unrealizedPnl >= 0 ? 'positive' : 'negative'}`}>
                                        ${pos.unrealizedPnl.toFixed(2)}
                                    </span>
                                    <button
                                        onClick={() => closePosition(pos.id)}
                                        className="btn-close"
                                    >
                                        Close
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Trade History */}
                    {accountState.trades.length > 0 && (
                        <div className="trades-list">
                            <h5>Recent Trades ({accountState.trades.length})</h5>
                            {accountState.trades.slice(-5).reverse().map(trade => (
                                <div key={trade.id} className="trade-row">
                                    <span className={`trade-dir ${trade.direction}`}>
                                        {trade.direction.toUpperCase()}
                                    </span>
                                    <span className="trade-prices">
                                        {trade.entryPrice.toFixed(2)} → {trade.exitPrice.toFixed(2)}
                                    </span>
                                    <span className={`trade-pnl ${trade.pnl >= 0 ? 'positive' : 'negative'}`}>
                                        {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default LiveDataPanel;
