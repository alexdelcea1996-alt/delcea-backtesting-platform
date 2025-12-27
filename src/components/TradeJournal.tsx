import { useState, useMemo } from 'react';
import { Trade } from '../lib/types';
import './TradeJournal.css';

interface TradeNote {
    tradeId: string;
    note: string;
    tags: string[];
    timestamp: number;
}

interface TradeJournalProps {
    trades: Trade[];
}

const PREDEFINED_TAGS = [
    'setup-valid', 'setup-invalid', 'emotional', 'revenge-trade',
    'news-event', 'trend-follow', 'counter-trend', 'breakout',
    'support', 'resistance', 'fib-level', 'pattern'
];

export function TradeJournal({ trades }: TradeJournalProps) {
    const [notes, setNotes] = useState<Map<string, TradeNote>>(new Map());
    const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
    const [filterTag, setFilterTag] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortField, setSortField] = useState<'time' | 'pnl'>('time');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const closedTrades = useMemo(() => {
        let filtered = trades.filter(t => t.exitTime !== null && t.pnl !== null);

        // Apply tag filter
        if (filterTag) {
            filtered = filtered.filter(t => {
                const note = notes.get(t.id);
                return note?.tags.includes(filterTag);
            });
        }

        // Apply search
        if (searchQuery) {
            filtered = filtered.filter(t => {
                const note = notes.get(t.id);
                return note?.note.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    note?.tags.some(tag => tag.includes(searchQuery.toLowerCase()));
            });
        }

        // Sort
        filtered.sort((a, b) => {
            let comparison = 0;
            if (sortField === 'time') {
                comparison = (a.exitTime || 0) - (b.exitTime || 0);
            } else {
                comparison = (a.pnl || 0) - (b.pnl || 0);
            }
            return sortDir === 'asc' ? comparison : -comparison;
        });

        return filtered;
    }, [trades, notes, filterTag, searchQuery, sortField, sortDir]);

    const allUsedTags = useMemo(() => {
        const tagSet = new Set<string>();
        notes.forEach(note => note.tags.forEach(tag => tagSet.add(tag)));
        return Array.from(tagSet);
    }, [notes]);

    const updateNote = (tradeId: string, note: string) => {
        setNotes(prev => {
            const newMap = new Map(prev);
            const existing = newMap.get(tradeId);
            newMap.set(tradeId, {
                tradeId,
                note,
                tags: existing?.tags || [],
                timestamp: Date.now()
            });
            return newMap;
        });
    };

    const toggleTag = (tradeId: string, tag: string) => {
        setNotes(prev => {
            const newMap = new Map(prev);
            const existing = newMap.get(tradeId) || { tradeId, note: '', tags: [], timestamp: Date.now() };
            const hasTag = existing.tags.includes(tag);
            newMap.set(tradeId, {
                ...existing,
                tags: hasTag ? existing.tags.filter(t => t !== tag) : [...existing.tags, tag],
                timestamp: Date.now()
            });
            return newMap;
        });
    };

    const formatDate = (ts: number) => new Date(ts).toLocaleString();
    const formatDuration = (entry: number, exit: number) => {
        const mins = Math.round((exit - entry) / 60000);
        if (mins < 60) return `${mins}m`;
        const hrs = Math.floor(mins / 60);
        return `${hrs}h ${mins % 60}m`;
    };

    // Stats
    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const notedCount = closedTrades.filter(t => notes.has(t.id)).length;

    return (
        <div className="trade-journal">
            <div className="tj-header">
                <h3>📓 Trade Journal</h3>
                <div className="tj-stats">
                    <span>{closedTrades.length} trades</span>
                    <span className="divider">|</span>
                    <span className={totalPnl >= 0 ? 'positive' : 'negative'}>
                        ${totalPnl.toFixed(2)}
                    </span>
                    <span className="divider">|</span>
                    <span>{notedCount} noted</span>
                </div>
            </div>

            <div className="tj-filters">
                <input
                    type="text"
                    placeholder="Search notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                />
                <select
                    value={filterTag}
                    onChange={(e) => setFilterTag(e.target.value)}
                    className="tag-filter"
                >
                    <option value="">All Tags</option>
                    {allUsedTags.map(tag => (
                        <option key={tag} value={tag}>{tag}</option>
                    ))}
                </select>
                <div className="sort-controls">
                    <select value={sortField} onChange={(e) => setSortField(e.target.value as 'time' | 'pnl')}>
                        <option value="time">Time</option>
                        <option value="pnl">P&L</option>
                    </select>
                    <button
                        onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                        className="sort-dir"
                    >
                        {sortDir === 'asc' ? '↑' : '↓'}
                    </button>
                </div>
            </div>

            <div className="tj-content">
                <div className="trade-list">
                    {closedTrades.map(trade => {
                        const tradeNote = notes.get(trade.id);
                        const isWin = (trade.pnl || 0) > 0;
                        const isSelected = selectedTrade?.id === trade.id;

                        return (
                            <div
                                key={trade.id}
                                className={`trade-item ${isWin ? 'win' : 'loss'} ${isSelected ? 'selected' : ''}`}
                                onClick={() => setSelectedTrade(trade)}
                            >
                                <div className="trade-main">
                                    <div className="trade-dir">
                                        {trade.direction === 'long' ? '🟢' : '🔴'}
                                    </div>
                                    <div className="trade-info">
                                        <span className="trade-time">
                                            {formatDate(trade.exitTime!)}
                                        </span>
                                        <span className="trade-duration">
                                            {formatDuration(trade.entryTime, trade.exitTime!)}
                                        </span>
                                    </div>
                                    <div className={`trade-pnl ${isWin ? 'positive' : 'negative'}`}>
                                        {isWin ? '+' : ''}{trade.pnl?.toFixed(2)}
                                    </div>
                                </div>
                                {tradeNote && (
                                    <div className="trade-meta">
                                        {tradeNote.tags.length > 0 && (
                                            <div className="trade-tags">
                                                {tradeNote.tags.map(tag => (
                                                    <span key={tag} className="tag">{tag}</span>
                                                ))}
                                            </div>
                                        )}
                                        {tradeNote.note && (
                                            <div className="trade-note-preview">
                                                {tradeNote.note.substring(0, 50)}...
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {selectedTrade && (
                    <div className="trade-detail">
                        <div className="detail-header">
                            <h4>Trade Details</h4>
                            <button onClick={() => setSelectedTrade(null)} className="close-btn">×</button>
                        </div>

                        <div className="detail-grid">
                            <div className="detail-item">
                                <span className="label">Direction</span>
                                <span className="value">{selectedTrade.direction.toUpperCase()}</span>
                            </div>
                            <div className="detail-item">
                                <span className="label">Entry</span>
                                <span className="value">${selectedTrade.entryPrice.toFixed(2)}</span>
                            </div>
                            <div className="detail-item">
                                <span className="label">Exit</span>
                                <span className="value">${selectedTrade.exitPrice?.toFixed(2)}</span>
                            </div>
                            <div className="detail-item">
                                <span className="label">P&L</span>
                                <span className={`value ${(selectedTrade.pnl || 0) >= 0 ? 'positive' : 'negative'}`}>
                                    ${selectedTrade.pnl?.toFixed(2)}
                                </span>
                            </div>
                        </div>

                        <div className="note-section">
                            <label>Tags</label>
                            <div className="tag-selector">
                                {PREDEFINED_TAGS.map(tag => {
                                    const isActive = notes.get(selectedTrade.id)?.tags.includes(tag);
                                    return (
                                        <button
                                            key={tag}
                                            className={`tag-btn ${isActive ? 'active' : ''}`}
                                            onClick={() => toggleTag(selectedTrade.id, tag)}
                                        >
                                            {tag}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="note-section">
                            <label>Notes</label>
                            <textarea
                                placeholder="Add notes about this trade..."
                                value={notes.get(selectedTrade.id)?.note || ''}
                                onChange={(e) => updateNote(selectedTrade.id, e.target.value)}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default TradeJournal;
