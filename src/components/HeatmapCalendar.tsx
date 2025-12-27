import { Trade } from '../lib/types';
import './HeatmapCalendar.css';

interface HeatmapCalendarProps {
    trades: Trade[];
    onDayClick?: (date: string, trades: Trade[]) => void;
}

interface DailyData {
    date: string;
    pnl: number;
    trades: Trade[];
    tradesCount: number;
}

/**
 * Get cell color based on P&L value
 */
function getCellColor(pnl: number, maxAbsPnl: number): string {
    if (pnl === 0) return 'var(--bg-tertiary)';

    const intensity = Math.min(Math.abs(pnl) / maxAbsPnl, 1);

    if (pnl > 0) {
        // Green gradient
        const lightness = 45 - (intensity * 20);
        return `hsl(142, 76%, ${lightness}%)`;
    } else {
        // Red gradient
        const lightness = 45 - (intensity * 20);
        return `hsl(0, 76%, ${lightness}%)`;
    }
}

/**
 * Group trades by date
 */
function groupTradesByDate(trades: Trade[]): Map<string, DailyData> {
    const grouped = new Map<string, DailyData>();

    for (const trade of trades) {
        if (trade.exitTime === null || trade.pnl === null) continue;

        const date = new Date(trade.exitTime).toISOString().split('T')[0];

        if (grouped.has(date)) {
            const data = grouped.get(date)!;
            data.pnl += trade.pnl;
            data.trades.push(trade);
            data.tradesCount++;
        } else {
            grouped.set(date, {
                date,
                pnl: trade.pnl,
                trades: [trade],
                tradesCount: 1
            });
        }
    }

    return grouped;
}

/**
 * Get all months between start and end dates
 */
function getMonthsInRange(startDate: Date, endDate: Date): { year: number; month: number }[] {
    const months: { year: number; month: number }[] = [];
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (current <= end) {
        months.push({ year: current.getFullYear(), month: current.getMonth() });
        current.setMonth(current.getMonth() + 1);
    }

    return months;
}

/**
 * Get days in a month as a grid (7 columns, 6 rows max)
 */
function getMonthGrid(year: number, month: number): (Date | null)[][] {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay(); // 0 = Sunday

    const grid: (Date | null)[][] = [];
    let currentDay = 1;

    for (let week = 0; week < 6; week++) {
        const row: (Date | null)[] = [];
        for (let day = 0; day < 7; day++) {
            if (week === 0 && day < startOffset) {
                row.push(null);
            } else if (currentDay > lastDay.getDate()) {
                row.push(null);
            } else {
                row.push(new Date(year, month, currentDay));
                currentDay++;
            }
        }
        grid.push(row);
        if (currentDay > lastDay.getDate()) break;
    }

    return grid;
}

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function HeatmapCalendar({ trades, onDayClick }: HeatmapCalendarProps) {
    const closedTrades = trades.filter(t => t.exitTime !== null && t.pnl !== null);

    if (closedTrades.length === 0) {
        return (
            <div className="heatmap-calendar">
                <h3>📅 P&L Heatmap Calendar</h3>
                <div className="heatmap-empty">No completed trades to display</div>
            </div>
        );
    }

    const dailyData = groupTradesByDate(closedTrades);
    const dates = Array.from(dailyData.keys()).sort();
    const startDate = new Date(dates[0]);
    const endDate = new Date(dates[dates.length - 1]);
    const months = getMonthsInRange(startDate, endDate);

    // Calculate max absolute P&L for color scaling
    const allPnls = Array.from(dailyData.values()).map(d => Math.abs(d.pnl));
    const maxAbsPnl = Math.max(...allPnls, 1);

    // Summary stats
    const totalPnl = Array.from(dailyData.values()).reduce((sum, d) => sum + d.pnl, 0);
    const profitDays = Array.from(dailyData.values()).filter(d => d.pnl > 0).length;
    const lossDays = Array.from(dailyData.values()).filter(d => d.pnl < 0).length;
    const tradingDays = dailyData.size;

    const handleCellClick = (date: Date | null) => {
        if (!date || !onDayClick) return;
        const dateStr = date.toISOString().split('T')[0];
        const data = dailyData.get(dateStr);
        if (data) {
            onDayClick(dateStr, data.trades);
        }
    };

    return (
        <div className="heatmap-calendar">
            <div className="heatmap-header">
                <h3>📅 P&L Heatmap Calendar</h3>
                <div className="heatmap-summary">
                    <span className={totalPnl >= 0 ? 'positive' : 'negative'}>
                        ${totalPnl.toFixed(2)}
                    </span>
                    <span className="divider">|</span>
                    <span className="positive">{profitDays} profit days</span>
                    <span className="divider">|</span>
                    <span className="negative">{lossDays} loss days</span>
                    <span className="divider">|</span>
                    <span>{tradingDays} trading days</span>
                </div>
            </div>

            <div className="heatmap-legend">
                <span>Loss</span>
                <div className="legend-gradient">
                    <div className="gradient-bar" />
                </div>
                <span>Profit</span>
            </div>

            <div className="heatmap-months">
                {months.map(({ year, month }) => {
                    const grid = getMonthGrid(year, month);

                    return (
                        <div key={`${year}-${month}`} className="month-block">
                            <div className="month-title">
                                {MONTH_NAMES[month]} {year}
                            </div>
                            <div className="month-grid">
                                <div className="day-headers">
                                    {DAY_NAMES.map(d => (
                                        <div key={d} className="day-header">{d}</div>
                                    ))}
                                </div>
                                {grid.map((week, weekIdx) => (
                                    <div key={weekIdx} className="week-row">
                                        {week.map((date, dayIdx) => {
                                            if (!date) {
                                                return <div key={dayIdx} className="day-cell empty" />;
                                            }

                                            const dateStr = date.toISOString().split('T')[0];
                                            const data = dailyData.get(dateStr);
                                            const hasTrades = !!data;
                                            const pnl = data?.pnl || 0;

                                            return (
                                                <div
                                                    key={dayIdx}
                                                    className={`day-cell ${hasTrades ? 'has-trades' : ''}`}
                                                    style={{
                                                        backgroundColor: hasTrades ? getCellColor(pnl, maxAbsPnl) : undefined
                                                    }}
                                                    onClick={() => handleCellClick(date)}
                                                    title={hasTrades
                                                        ? `${dateStr}\nP&L: $${pnl.toFixed(2)}\nTrades: ${data?.tradesCount}`
                                                        : dateStr
                                                    }
                                                >
                                                    <span className="day-number">{date.getDate()}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default HeatmapCalendar;
