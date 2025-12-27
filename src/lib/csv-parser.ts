import Papa from 'papaparse';
import { Candle, CSVConfig, DEFAULT_CSV_CONFIG } from './types';

// Extended config type for internal use (includes _timeColumn)
type InternalCSVConfig = CSVConfig & { _timeColumn?: string };

export class CSVParser {
    private config: InternalCSVConfig;

    constructor(config: Partial<CSVConfig> = {}) {
        this.config = { ...DEFAULT_CSV_CONFIG, ...config };
    }

    /**
     * Check if the first row looks like data (headerless) rather than headers
     * HISTDATA format: [timestamp, open, high, low, close, volume?]
     */
    private isHeaderlessFormat(firstRow: unknown[]): boolean {
        if (firstRow.length < 5) return false;

        // Check for YYYYMMDD pattern in FIRST column (HISTDATA timestamp format)
        const firstColStr = String(firstRow[0]).trim();
        const hasDatePattern = /^\d{8}\s+\d{6}$/.test(firstColStr); // YYYYMMDD HHMMSS

        // Check if columns 1-4 look like OHLC prices (numbers with decimals)
        const pricePattern = /^\d+(\.\d+)?$/;
        const hasPriceColumns = firstRow.slice(1, 5).every(val => {
            const str = String(val).trim();
            return typeof val === 'number' || pricePattern.test(str);
        });

        const result = hasDatePattern && hasPriceColumns;
        console.log('CSV Parser - isHeaderlessFormat check:', { hasDatePattern, hasPriceColumns, result, firstRow });
        return result;
    }

    /**
     * Parse CSV string into candle data
     */
    parseString(csvString: string): Candle[] {
        // First, parse without headers to check if it's headerless
        const previewResult = Papa.parse(csvString, {
            header: false,
            skipEmptyLines: true,
            dynamicTyping: true,
            delimiter: this.config.delimiter || '',
            preview: 1, // Only parse first row
        });

        if (previewResult.data.length === 0) {
            return [];
        }

        const firstRow = previewResult.data[0] as unknown[];
        const isHeaderless = this.isHeaderlessFormat(firstRow);

        if (isHeaderless) {
            console.log('CSV Parser - Detected HEADERLESS format, parsing without headers');
            // Parse entire file without headers
            const result = Papa.parse(csvString, {
                header: false,
                skipEmptyLines: true,
                dynamicTyping: true,
                delimiter: this.config.delimiter || '',
            });

            if (result.errors.length > 0) {
                console.warn('CSV parsing warnings:', result.errors);
            }

            return this.transformHeaderlessData(result.data as unknown[][]);
        }

        // Standard parsing with headers
        console.log('CSV Parser - Parsing with headers');
        const result = Papa.parse(csvString, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            delimiter: this.config.delimiter || '',
        });

        if (result.errors.length > 0) {
            console.warn('CSV parsing warnings:', result.errors);
        }

        return this.transformData(result.data as Record<string, unknown>[]);
    }

    /**
     * Transform headerless data (array of arrays) into Candle objects
     * HISTDATA format: [timestamp, open, high, low, close, volume?]
     */
    private transformHeaderlessData(data: unknown[][]): Candle[] {
        const candles: Candle[] = [];

        console.log('CSV Parser - Processing', data.length, 'headerless rows');
        if (data.length > 0) {
            console.log('CSV Parser - First row sample:', data[0]);
        }

        for (let i = 0; i < data.length; i++) {
            const row = data[i];

            try {
                // HISTDATA format: [timestamp, open, high, low, close, volume?]
                // Minimum 5 columns required (timestamp + OHLC)
                if (row.length < 5) {
                    console.warn(`Row ${i + 1} has insufficient columns: ${row.length}`);
                    continue;
                }

                const timestampRaw = row[0]; // Column 0 = timestamp
                const open = this.toNumber(row[1]);
                const high = this.toNumber(row[2]);
                const low = this.toNumber(row[3]);
                const close = this.toNumber(row[4]);
                const volume = row.length > 5 ? this.toNumber(row[5]) : undefined;

                const timestamp = this.parseTimestamp(timestampRaw);

                if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) {
                    throw new Error(`Invalid OHLC values at row ${i + 1}: O=${open}, H=${high}, L=${low}, C=${close}`);
                }

                const candle: Candle = {
                    timestamp,
                    open,
                    high,
                    low,
                    close,
                    volume: volume !== undefined && !isNaN(volume) ? volume : undefined,
                };

                if (this.validateCandle(candle)) {
                    candles.push(candle);
                }
            } catch (error) {
                if (i < 3) {
                    console.warn(`Skipping headerless row ${i + 1}:`, error, 'Row data:', row);
                }
            }
        }

        // Sort by timestamp ascending
        candles.sort((a, b) => a.timestamp - b.timestamp);

        console.log('CSV Parser - Successfully parsed', candles.length, 'candles from headerless data');

        if (candles.length === 0 && data.length > 0) {
            throw new Error(`Failed to parse any candles from headerless data. First row: ${JSON.stringify(data[0])}`);
        }

        return candles;
    }

    /**
     * Parse CSV file (browser File object)
     */
    async parseFile(file: File): Promise<Candle[]> {
        // Read file as text first, then use parseString for consistent headerless detection
        const text = await file.text();
        return this.parseString(text);
    }

    /**
     * Transform raw CSV rows into Candle objects
     */
    private transformData(data: Record<string, unknown>[]): Candle[] {
        const candles: Candle[] = [];

        if (data.length === 0) {
            return candles;
        }

        // Get column names from first row
        const firstRow = data[0];
        const keys = Object.keys(firstRow);

        console.log('CSV Parser - All column keys:', keys);

        // Auto-detect columns
        this.detectColumns(keys);

        console.log('CSV Parser - Config after detection:', {
            timestamp: this.config.timestampColumn,
            time: this.config._timeColumn,
            open: this.config.openColumn,
            high: this.config.highColumn,
            low: this.config.lowColumn,
            close: this.config.closeColumn,
            volume: this.config.volumeColumn,
        });

        for (let i = 0; i < data.length; i++) {
            const row = data[i];

            try {
                const candle = this.rowToCandle(row, i);
                if (candle && this.validateCandle(candle)) {
                    candles.push(candle);
                }
            } catch (error) {
                if (i < 3) {
                    console.warn(`Skipping row ${i + 1}:`, error, 'Row data:', row);
                }
            }
        }

        // Sort by timestamp ascending
        candles.sort((a, b) => a.timestamp - b.timestamp);

        if (candles.length === 0 && data.length > 0) {
            throw new Error(`Failed to parse any candles. First row keys: ${keys.join(', ')}`);
        }

        return candles;
    }

    /**
     * Auto-detect columns from CSV headers
     */
    private detectColumns(keys: string[]): void {
        // Check if this is a headerless CSV (all keys are numeric like "0", "1", "2")
        const isHeaderless = keys.every(k => /^\d+$/.test(k));

        if (isHeaderless) {
            console.log('CSV Parser - Detected HEADERLESS CSV format');
            // Headerless format: index, timestamp, open, high, low, close, [volume]
            // Keys are "0", "1", "2", etc.
            if (keys.length >= 6) {
                // Column 0 = index (ignored)
                // Column 1 = timestamp (YYYYMMDD HHMMSS format)
                // Columns 2-5 = O, H, L, C
                // Column 6+ = volume (optional)
                this.config.timestampColumn = '1';
                this.config.openColumn = '2';
                this.config.highColumn = '3';
                this.config.lowColumn = '4';
                this.config.closeColumn = '5';
                if (keys.length > 6) {
                    this.config.volumeColumn = '6';
                }
                console.log('CSV Parser - Mapped columns by index:', {
                    timestamp: '1', open: '2', high: '3', low: '4', close: '5',
                    volume: keys.length > 6 ? '6' : undefined
                });
            }
            return;
        }

        // Helper to find column by normalized name
        const findColumn = (searchNames: string[]): string | undefined => {
            for (const key of keys) {
                // Normalize: remove angle brackets, lowercase, trim
                const normalized = key.toLowerCase().replace(/[<>]/g, '').trim();
                if (searchNames.includes(normalized)) {
                    return key;
                }
            }
            return undefined;
        };

        // Detect date/time columns for MetaTrader format
        const dateCol = findColumn(['date']);
        const timeCol = keys.find(k => {
            const norm = k.toLowerCase().replace(/[<>]/g, '').trim();
            return norm === 'time';
        });

        console.log('CSV Parser - Date/Time detection:', { dateCol, timeCol });

        if (dateCol && timeCol) {
            this.config.timestampColumn = dateCol;
            this.config._timeColumn = timeCol;
        } else {
            // Try standard timestamp column
            const tsCol = findColumn(['timestamp', 'datetime', 'date', 'time', 'ts']);
            if (tsCol) {
                this.config.timestampColumn = tsCol;
            }
        }

        // Detect OHLC columns
        const openCol = findColumn(['open', 'o']);
        const highCol = findColumn(['high', 'h']);
        const lowCol = findColumn(['low', 'l']);
        const closeCol = findColumn(['close', 'c']);
        const volCol = findColumn(['tickvol', 'vol', 'volume', 'v']);

        if (openCol) this.config.openColumn = openCol;
        if (highCol) this.config.highColumn = highCol;
        if (lowCol) this.config.lowColumn = lowCol;
        if (closeCol) this.config.closeColumn = closeCol;
        if (volCol) this.config.volumeColumn = volCol;
    }

    /**
     * Convert a single row to a Candle object
     */
    private rowToCandle(row: Record<string, unknown>, index: number): Candle | null {
        // Get timestamp value (combine date + time for MetaTrader format)
        let timestampRaw = row[this.config.timestampColumn];

        if (this.config._timeColumn) {
            const timeValue = row[this.config._timeColumn];
            if (timestampRaw !== undefined && timeValue !== undefined) {
                timestampRaw = `${timestampRaw} ${timeValue}`;
            }
        }

        if (timestampRaw === undefined || timestampRaw === null) {
            throw new Error(`Missing timestamp at row ${index + 1}. Looking for column: "${this.config.timestampColumn}"`);
        }

        const open = this.toNumber(row[this.config.openColumn]);
        const high = this.toNumber(row[this.config.highColumn]);
        const low = this.toNumber(row[this.config.lowColumn]);
        const close = this.toNumber(row[this.config.closeColumn]);
        const volume = this.config.volumeColumn
            ? this.toNumber(row[this.config.volumeColumn])
            : undefined;

        const timestamp = this.parseTimestamp(timestampRaw);

        if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) {
            throw new Error(`Invalid OHLC values at row ${index + 1}`);
        }

        return {
            timestamp,
            open,
            high,
            low,
            close,
            volume: volume !== undefined && !isNaN(volume) ? volume : undefined,
        };
    }

    /**
     * Parse timestamp based on configured format
     */
    private parseTimestamp(value: unknown): number {
        if (this.config.customTimestampParser) {
            return this.config.customTimestampParser(String(value));
        }

        const strValue = String(value).trim();

        // Unix timestamp (numeric)
        if (typeof value === 'number' || /^\d+$/.test(strValue)) {
            const num = Number(value);
            // Auto-detect seconds vs milliseconds
            if (num < 10000000000) {
                return num * 1000;
            }
            return num;
        }

        // Headerless format: "YYYYMMDD HHMMSS" (e.g., "20251201 000000")
        const headerlessMatch = strValue.match(/^(\d{4})(\d{2})(\d{2})\s+(\d{2})(\d{2})(\d{2})$/);
        if (headerlessMatch) {
            const [, year, month, day, hour, minute, second] = headerlessMatch;
            const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
            const date = new Date(isoString);
            if (!isNaN(date.getTime())) {
                console.log('CSV Parser - Parsed YYYYMMDD HHMMSS:', strValue, '->', date.toISOString());
                return date.getTime();
            }
        }

        // MetaTrader format: "2025.01.02 00:00" or "2025.01.02"
        if (strValue.match(/^\d{4}\.\d{2}\.\d{2}/)) {
            // Convert "2025.01.02 00:00" to parseable format
            const parts = strValue.split(' ');
            const datePart = parts[0].replace(/\./g, '-'); // "2025-01-02"
            const timePart = parts[1] || '00:00';
            const isoString = `${datePart}T${timePart}:00`;
            const date = new Date(isoString);
            if (!isNaN(date.getTime())) {
                return date.getTime();
            }
        }

        // ISO format or other parseable format
        const parsed = new Date(strValue);
        if (!isNaN(parsed.getTime())) {
            return parsed.getTime();
        }

        throw new Error(`Unknown timestamp format: "${strValue}"`);
    }

    /**
     * Convert value to number
     */
    private toNumber(value: unknown): number {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            const cleaned = value.replace(/[,\s]/g, '');
            return parseFloat(cleaned);
        }
        return NaN;
    }

    /**
     * Validate candle data
     */
    private validateCandle(candle: Candle): boolean {
        if (candle.high < candle.low) {
            console.warn(`Invalid candle: high (${candle.high}) < low (${candle.low})`);
            return false;
        }

        if (candle.open < candle.low || candle.open > candle.high) {
            console.warn(`Invalid candle: open (${candle.open}) outside high-low range`);
            return false;
        }

        if (candle.close < candle.low || candle.close > candle.high) {
            console.warn(`Invalid candle: close (${candle.close}) outside high-low range`);
            return false;
        }

        if (candle.timestamp <= 0 || isNaN(candle.timestamp)) {
            console.warn(`Invalid candle: invalid timestamp`);
            return false;
        }

        return true;
    }

    /**
     * Auto-detect CSV column configuration (static method)
     */
    static detectConfig(headers: string[]): Partial<CSVConfig> {
        const config: Partial<CSVConfig> = {};
        const headerLower = headers.map(h => h.toLowerCase().replace(/[<>]/g, '').trim());

        // Timestamp detection
        const timestampCandidates = ['timestamp', 'time', 'date', 'datetime', 'ts', 'utc'];
        for (const candidate of timestampCandidates) {
            const idx = headerLower.findIndex(h => h.includes(candidate));
            if (idx >= 0) {
                config.timestampColumn = headers[idx];
                break;
            }
        }

        // OHLC detection
        const ohlcMap = {
            openColumn: ['open', 'o', 'opening'],
            highColumn: ['high', 'h', 'max'],
            lowColumn: ['low', 'l', 'min'],
            closeColumn: ['close', 'c', 'closing', 'last'],
            volumeColumn: ['volume', 'vol', 'v', 'qty', 'tickvol'],
        };

        for (const [key, candidates] of Object.entries(ohlcMap)) {
            for (const candidate of candidates) {
                const idx = headerLower.findIndex(h => h === candidate || h.includes(candidate));
                if (idx >= 0) {
                    (config as Record<string, string>)[key] = headers[idx];
                    break;
                }
            }
        }

        return config;
    }
}

/**
 * Convenience function to parse CSV file
 */
export async function parseCSVFile(
    file: File,
    config?: Partial<CSVConfig>
): Promise<Candle[]> {
    const parser = new CSVParser(config);
    return parser.parseFile(file);
}

/**
 * Convenience function to parse CSV string
 */
export function parseCSVString(
    csvString: string,
    config?: Partial<CSVConfig>
): Candle[] {
    const parser = new CSVParser(config);
    return parser.parseString(csvString);
}
