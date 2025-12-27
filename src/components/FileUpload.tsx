import { useCallback, useState, useRef } from 'react';
import { parseCSVFile } from '../lib/csv-parser';
import { Candle } from '../lib/types';
import './FileUpload.css';

interface FileUploadProps {
    onDataLoaded: (candles: Candle[], filename: string) => void;
}

export function FileUpload({ onDataLoaded }: FileUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFiles = useCallback(async (files: FileList) => {
        const csvFiles = Array.from(files).filter(f => f.name.endsWith('.csv'));

        if (csvFiles.length === 0) {
            setError('Please upload CSV file(s)');
            return;
        }

        setIsLoading(true);
        setError(null);
        setProgress(`Processing 0/${csvFiles.length} files...`);

        try {
            const allCandles: Candle[] = [];
            const fileNames: string[] = [];

            for (let i = 0; i < csvFiles.length; i++) {
                const file = csvFiles[i];
                setProgress(`Processing ${i + 1}/${csvFiles.length}: ${file.name}`);

                try {
                    const candles = await parseCSVFile(file);
                    allCandles.push(...candles);
                    fileNames.push(file.name);
                    console.log(`Parsed ${candles.length} candles from ${file.name}`);
                } catch (err) {
                    console.warn(`Failed to parse ${file.name}:`, err);
                    // Continue with other files
                }
            }

            if (allCandles.length === 0) {
                setError('No valid candle data found in any file');
                return;
            }

            // Sort combined candles by timestamp
            allCandles.sort((a, b) => a.timestamp - b.timestamp);

            // Remove duplicates (same timestamp)
            const uniqueCandles = allCandles.filter((candle, index, arr) =>
                index === 0 || candle.timestamp !== arr[index - 1].timestamp
            );

            console.log(`Combined ${uniqueCandles.length} unique candles from ${fileNames.length} file(s)`);

            // Create combined filename
            const displayName = fileNames.length === 1
                ? fileNames[0]
                : `${fileNames.length} files (${uniqueCandles.length} candles)`;

            onDataLoaded(uniqueCandles, displayName);
        } catch (err) {
            setError(`Failed to parse CSV files: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setIsLoading(false);
            setProgress('');
        }
    }, [onDataLoaded]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
        }
    }, [handleFiles]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files);
        }
    };

    return (
        <div
            className={`file-upload ${isDragging ? 'dragging' : ''} ${isLoading ? 'loading' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleClick}
        >
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleInputChange}
                accept=".csv"
                multiple
                style={{ display: 'none' }}
            />

            <div className="upload-content">
                {isLoading ? (
                    <>
                        <div className="spinner" />
                        <p>{progress || 'Processing CSV data...'}</p>
                    </>
                ) : (
                    <>
                        <div className="upload-icon">📊</div>
                        <h3>Upload XAU/USD Data</h3>
                        <p>Drag & drop CSV file(s) here, or click to browse</p>
                        <span className="hint">Supports multiple files • Data will be merged by timestamp</span>
                    </>
                )}
            </div>

            {error && (
                <div className="upload-error">
                    {error}
                </div>
            )}
        </div>
    );
}
