import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, LineData, Time, CandlestickSeries, LineSeries } from 'lightweight-charts';
import { Candle, Trade } from '../lib/types';
import './CandlestickChart.css';

interface CandlestickChartProps {
    candles: Candle[];
    trades?: Trade[];
    equityCurve?: { timestamp: number; equity: number }[];
    height?: number;
}

export function CandlestickChart({
    candles,
    trades = [],
    equityCurve = [],
    height = 400
}: CandlestickChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const equityChartContainerRef = useRef<HTMLDivElement>(null);
    const equityChartRef = useRef<IChartApi | null>(null);

    // Main chart with candlesticks
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: height,
            layout: {
                background: { color: 'transparent' },
                textColor: 'rgba(255, 255, 255, 0.7)',
            },
            grid: {
                vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
                horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
            },
            crosshair: {
                mode: 1,
                vertLine: {
                    color: 'rgba(139, 92, 246, 0.5)',
                    width: 1,
                    style: 2,
                },
                horzLine: {
                    color: 'rgba(139, 92, 246, 0.5)',
                    width: 1,
                    style: 2,
                },
            },
            rightPriceScale: {
                borderColor: 'rgba(255, 255, 255, 0.1)',
            },
            timeScale: {
                borderColor: 'rgba(255, 255, 255, 0.1)',
                timeVisible: true,
                secondsVisible: false,
            },
        });

        const candlestickSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderUpColor: '#22c55e',
            borderDownColor: '#ef4444',
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
        });

        chartRef.current = chart;
        candlestickSeriesRef.current = candlestickSeries;

        // Handle resize
        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [height]);

    // Update candlestick data
    useEffect(() => {
        if (!candlestickSeriesRef.current || candles.length === 0) return;

        const data: CandlestickData<Time>[] = candles.map(c => ({
            time: (c.timestamp / 1000) as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
        }));

        candlestickSeriesRef.current.setData(data);

        // Add trade markers
        if (trades.length > 0 && chartRef.current) {
            const markers = trades
                .filter(t => t.exitTime !== null)
                .flatMap(trade => {
                    const result = [];

                    // Entry marker
                    result.push({
                        time: (trade.entryTime / 1000) as Time,
                        position: trade.direction === 'long' ? 'belowBar' as const : 'aboveBar' as const,
                        color: trade.direction === 'long' ? '#22c55e' : '#ef4444',
                        shape: trade.direction === 'long' ? 'arrowUp' as const : 'arrowDown' as const,
                        text: trade.direction.toUpperCase(),
                    });

                    // Exit marker
                    if (trade.exitTime) {
                        result.push({
                            time: (trade.exitTime / 1000) as Time,
                            position: trade.direction === 'long' ? 'aboveBar' as const : 'belowBar' as const,
                            color: (trade.pnl ?? 0) > 0 ? '#22c55e' : '#ef4444',
                            shape: 'circle' as const,
                            text: `${(trade.pnl ?? 0) > 0 ? '+' : ''}${(trade.pnl ?? 0).toFixed(2)}`,
                        });
                    }

                    return result;
                });

            // Note: setMarkers has been removed in lightweight-charts v5.x
            // Trade markers would need to be rendered as separate series or overlays
            console.log('Trade markers:', markers.length);
        }
    }, [candles, trades]);

    // Equity curve chart
    useEffect(() => {
        if (!equityChartContainerRef.current || equityCurve.length === 0) return;

        const chart = createChart(equityChartContainerRef.current, {
            width: equityChartContainerRef.current.clientWidth,
            height: 150,
            layout: {
                background: { color: 'transparent' },
                textColor: 'rgba(255, 255, 255, 0.7)',
            },
            grid: {
                vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
                horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
            },
            rightPriceScale: {
                borderColor: 'rgba(255, 255, 255, 0.1)',
            },
            timeScale: {
                borderColor: 'rgba(255, 255, 255, 0.1)',
                timeVisible: true,
            },
        });

        const lineSeries = chart.addSeries(LineSeries, {
            color: '#8b5cf6',
            lineWidth: 2,
        });

        // Downsample if too many points
        const maxPoints = 1000;
        const step = Math.max(1, Math.floor(equityCurve.length / maxPoints));

        const data: LineData<Time>[] = equityCurve
            .filter((_, i) => i % step === 0)
            .map(point => ({
                time: (point.timestamp / 1000) as Time,
                value: point.equity,
            }));

        lineSeries.setData(data);

        equityChartRef.current = chart;

        const handleResize = () => {
            if (equityChartContainerRef.current) {
                chart.applyOptions({ width: equityChartContainerRef.current.clientWidth });
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [equityCurve]);

    return (
        <div className="chart-container">
            <div className="chart-section">
                <h3>Price Chart</h3>
                <div ref={chartContainerRef} className="chart" />
            </div>

            {equityCurve.length > 0 && (
                <div className="chart-section equity">
                    <h3>Equity Curve</h3>
                    <div ref={equityChartContainerRef} className="chart" />
                </div>
            )}
        </div>
    );
}
