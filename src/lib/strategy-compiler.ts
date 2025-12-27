/**
 * Strategy Compiler
 * 
 * Converts visual block-based strategy definitions into executable code
 */

import { Candle, StrategyParams, Signal, Position, Trade } from './types';
import { Strategy, sma, ema, rsi, atr, bollingerBands, macd, highest, lowest } from './strategy-base';

// Block Types
export type IndicatorType = 'SMA' | 'EMA' | 'RSI' | 'ATR' | 'BB_UPPER' | 'BB_LOWER' | 'MACD' | 'MACD_SIGNAL' | 'HIGH' | 'LOW' | 'PRICE';
export type ComparatorType = 'greater' | 'less' | 'equal' | 'crosses_above' | 'crosses_below';
export type LogicType = 'AND' | 'OR';
export type PriceType = 'open' | 'high' | 'low' | 'close';

export interface IndicatorBlock {
    id: string;
    type: IndicatorType;
    period?: number;
    priceType?: PriceType;
    offset?: number; // Bars back (0 = current, 1 = previous)
}

export interface ConditionBlock {
    id: string;
    left: IndicatorBlock;
    comparator: ComparatorType;
    right: IndicatorBlock | number;
}

export interface RuleBlock {
    id: string;
    conditions: ConditionBlock[];
    logic: LogicType;
}

export interface VisualStrategy {
    name: string;
    entryLong: RuleBlock;
    entryShort: RuleBlock;
    exitLong: RuleBlock;
    exitShort: RuleBlock;
    stopLossAtr: number; // ATR multiplier for SL
    takeProfitAtr: number; // ATR multiplier for TP
}

export const DEFAULT_VISUAL_STRATEGY: VisualStrategy = {
    name: 'Custom Strategy',
    entryLong: {
        id: 'entry_long',
        conditions: [],
        logic: 'AND'
    },
    entryShort: {
        id: 'entry_short',
        conditions: [],
        logic: 'AND'
    },
    exitLong: {
        id: 'exit_long',
        conditions: [],
        logic: 'OR'
    },
    exitShort: {
        id: 'exit_short',
        conditions: [],
        logic: 'OR'
    },
    stopLossAtr: 2,
    takeProfitAtr: 4
};

// Indicator calculation cache
interface IndicatorCache {
    [key: string]: number[];
}

/**
 * Compile visual strategy to executable Strategy class
 */
export function compileStrategy(visualStrategy: VisualStrategy): CompiledStrategy {
    return new CompiledStrategy(visualStrategy);
}

/**
 * Generate TypeScript code from visual strategy
 */
export function generateCode(visualStrategy: VisualStrategy): string {
    const lines: string[] = [];
    const className = visualStrategy.name.replace(/\s+/g, '');

    lines.push(`// Generated Strategy: ${visualStrategy.name}`);
    lines.push(`// Generated at: ${new Date().toISOString()}`);
    lines.push('');
    lines.push(`import { Strategy, sma, ema, rsi, atr } from './lib/strategy-base';`);
    lines.push(`import { Candle, Signal, StrategyParams, Position } from './lib/types';`);
    lines.push('');
    lines.push(`export interface ${className}Params extends StrategyParams {`);
    lines.push(`    stopLossAtr: number;`);
    lines.push(`    takeProfitAtr: number;`);
    lines.push(`}`);
    lines.push('');
    lines.push(`export class ${className}Strategy extends Strategy<${className}Params> {`);
    lines.push(`    name = '${visualStrategy.name}';`);
    lines.push('');
    lines.push(`    onCandle(index: number, history: Candle[], position: Position | null): Signal | null {`);
    lines.push(`        if (index < 50) return null; // Wait for indicators`);
    lines.push('');
    lines.push(`        const candle = history[index];`);
    lines.push(`        const closes = history.map(c => c.close);`);
    lines.push(`        const atrValues = this.calculateATR(history, 14);`);
    lines.push(`        const atrValue = atrValues[index] || candle.close * 0.01;`);
    lines.push('');

    // Generate entry conditions
    lines.push(`        // Entry Long conditions`);
    lines.push(`        const entryLong = ${generateConditionCode(visualStrategy.entryLong)};`);
    lines.push('');
    lines.push(`        // Entry Short conditions`);
    lines.push(`        const entryShort = ${generateConditionCode(visualStrategy.entryShort)};`);
    lines.push('');

    lines.push(`        if (entryLong && !position) {`);
    lines.push(`            return {`);
    lines.push(`                type: 'buy',`);
    lines.push(`                price: candle.close,`);
    lines.push(`                stopLoss: candle.close - atrValue * ${visualStrategy.stopLossAtr},`);
    lines.push(`                takeProfit: candle.close + atrValue * ${visualStrategy.takeProfitAtr}`);
    lines.push(`            };`);
    lines.push(`        }`);
    lines.push('');
    lines.push(`        if (entryShort && !position) {`);
    lines.push(`            return {`);
    lines.push(`                type: 'sell',`);
    lines.push(`                price: candle.close,`);
    lines.push(`                stopLoss: candle.close + atrValue * ${visualStrategy.stopLossAtr},`);
    lines.push(`                takeProfit: candle.close - atrValue * ${visualStrategy.takeProfitAtr}`);
    lines.push(`            };`);
    lines.push(`        }`);
    lines.push('');
    lines.push(`        return null;`);
    lines.push(`    }`);
    lines.push('');
    lines.push(`    private calculateATR(history: Candle[], period: number): number[] {`);
    lines.push(`        // ATR calculation...`);
    lines.push(`        return history.map(() => 0);`);
    lines.push(`    }`);
    lines.push(`}`);

    return lines.join('\n');
}

function generateConditionCode(rule: RuleBlock): string {
    if (rule.conditions.length === 0) return 'false';

    const conditions = rule.conditions.map(cond => {
        const left = generateIndicatorCode(cond.left);
        const right = typeof cond.right === 'number'
            ? cond.right.toString()
            : generateIndicatorCode(cond.right as IndicatorBlock);

        switch (cond.comparator) {
            case 'greater': return `(${left} > ${right})`;
            case 'less': return `(${left} < ${right})`;
            case 'equal': return `(${left} === ${right})`;
            case 'crosses_above': return `(${left.replace('[index]', '[index-1]')} <= ${right.replace('[index]', '[index-1]')} && ${left} > ${right})`;
            case 'crosses_below': return `(${left.replace('[index]', '[index-1]')} >= ${right.replace('[index]', '[index-1]')} && ${left} < ${right})`;
            default: return 'false';
        }
    });

    return conditions.join(rule.logic === 'AND' ? ' && ' : ' || ');
}

function generateIndicatorCode(block: IndicatorBlock): string {
    const offset = block.offset || 0;
    const index = offset === 0 ? 'index' : `index - ${offset}`;

    switch (block.type) {
        case 'SMA': return `sma(closes, ${block.period || 14})[${index}]`;
        case 'EMA': return `ema(closes, ${block.period || 14})[${index}]`;
        case 'RSI': return `rsi(closes, ${block.period || 14})[${index}]`;
        case 'ATR': return `atrValues[${index}]`;
        case 'PRICE': return `candle.${block.priceType || 'close'}`;
        case 'HIGH': return `highest(history.map(c => c.high), ${block.period || 20})[${index}]`;
        case 'LOW': return `lowest(history.map(c => c.low), ${block.period || 20})[${index}]`;
        default: return '0';
    }
}

/**
 * Compiled Strategy Class - properly extends Strategy base
 */
export class CompiledStrategy extends Strategy<StrategyParams> {
    readonly name: string;
    private visualStrategy: VisualStrategy;
    private cache: IndicatorCache = {};

    constructor(visualStrategy: VisualStrategy) {
        super({ stopLossAtr: visualStrategy.stopLossAtr, takeProfitAtr: visualStrategy.takeProfitAtr });
        this.visualStrategy = visualStrategy;
        this.name = visualStrategy.name;
    }

    clone(params: StrategyParams): CompiledStrategy {
        const newStrategy = new CompiledStrategy(this.visualStrategy);
        newStrategy.params = { ...this.params, ...params };
        return newStrategy;
    }

    private getIndicatorValue(block: IndicatorBlock, index: number, history: Candle[]): number {
        const cacheKey = `${block.type}_${block.period || 0}_${block.priceType || 'close'}`;

        if (!this.cache[cacheKey]) {
            this.cache[cacheKey] = this.calculateIndicator(block, history);
        }

        const offset = block.offset || 0;
        const actualIndex = index - offset;
        return this.cache[cacheKey][actualIndex] ?? 0;
    }

    private calculateIndicator(block: IndicatorBlock, history: Candle[]): number[] {
        const closes = history.map(c => c.close);
        const period = block.period || 14;

        switch (block.type) {
            case 'SMA': return sma(closes, period);
            case 'EMA': return ema(closes, period);
            case 'RSI': return rsi(closes, period);
            case 'ATR': return atr(history, period);
            case 'HIGH': return highest(history.map(c => c.high), period);
            case 'LOW': return lowest(history.map(c => c.low), period);
            case 'BB_UPPER': return bollingerBands(closes, period, 2).upper;
            case 'BB_LOWER': return bollingerBands(closes, period, 2).lower;
            case 'MACD': return macd(closes, 12, 26, 9).macd;
            case 'MACD_SIGNAL': return macd(closes, 12, 26, 9).signal;
            case 'PRICE':
                return history.map(c => c[block.priceType || 'close']);
            default:
                return closes;
        }
    }

    private evaluateCondition(cond: ConditionBlock, index: number, history: Candle[]): boolean {
        const leftValue = this.getIndicatorValue(cond.left, index, history);
        const rightValue = typeof cond.right === 'number'
            ? cond.right
            : this.getIndicatorValue(cond.right as IndicatorBlock, index, history);

        // For crossover/crossunder, we need previous values too
        if (cond.comparator === 'crosses_above' || cond.comparator === 'crosses_below') {
            const leftPrev = this.getIndicatorValue({ ...cond.left, offset: (cond.left.offset || 0) + 1 }, index, history);
            const rightPrev = typeof cond.right === 'number'
                ? cond.right
                : this.getIndicatorValue({ ...(cond.right as IndicatorBlock), offset: ((cond.right as IndicatorBlock).offset || 0) + 1 }, index, history);

            if (cond.comparator === 'crosses_above') {
                return leftPrev <= rightPrev && leftValue > rightValue;
            } else {
                return leftPrev >= rightPrev && leftValue < rightValue;
            }
        }

        switch (cond.comparator) {
            case 'greater': return leftValue > rightValue;
            case 'less': return leftValue < rightValue;
            case 'equal': return Math.abs(leftValue - rightValue) < 0.0001;
            default: return false;
        }
    }

    private evaluateRule(rule: RuleBlock, index: number, history: Candle[]): boolean {
        if (rule.conditions.length === 0) return false;

        if (rule.logic === 'AND') {
            return rule.conditions.every(cond => this.evaluateCondition(cond, index, history));
        } else {
            return rule.conditions.some(cond => this.evaluateCondition(cond, index, history));
        }
    }

    onInit(): void {
        this.cache = {}; // Reset cache
    }

    onCandle(index: number, history: Candle[], position: Position | null): Signal | null {
        if (index < 50) return null; // Wait for indicators to warm up

        const candle = history[index];
        const atrValues = atr(history, 14);
        const atrValue = atrValues[index] || candle.close * 0.01;

        const entryLong = this.evaluateRule(this.visualStrategy.entryLong, index, history);
        const entryShort = this.evaluateRule(this.visualStrategy.entryShort, index, history);
        const exitLong = this.evaluateRule(this.visualStrategy.exitLong, index, history);
        const exitShort = this.evaluateRule(this.visualStrategy.exitShort, index, history);

        if (entryLong && !position) {
            return {
                type: 'buy',
                price: candle.close,
                stopLoss: candle.close - atrValue * this.visualStrategy.stopLossAtr,
                takeProfit: candle.close + atrValue * this.visualStrategy.takeProfitAtr
            };
        }

        if (entryShort && !position) {
            return {
                type: 'sell',
                price: candle.close,
                stopLoss: candle.close + atrValue * this.visualStrategy.stopLossAtr,
                takeProfit: candle.close - atrValue * this.visualStrategy.takeProfitAtr
            };
        }

        if ((exitLong && position?.direction === 'long') ||
            (exitShort && position?.direction === 'short')) {
            return { type: 'close', price: candle.close };
        }

        return null;
    }

    onComplete(_trades: Trade[]): void {
        // Cleanup
        this.cache = {};
    }
}

// Helper to create common blocks
export const createIndicatorBlock = (
    type: IndicatorType,
    period?: number,
    priceType?: PriceType,
    offset?: number
): IndicatorBlock => ({
    id: `ind_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    period,
    priceType,
    offset
});

export const createConditionBlock = (
    left: IndicatorBlock,
    comparator: ComparatorType,
    right: IndicatorBlock | number
): ConditionBlock => ({
    id: `cond_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    left,
    comparator,
    right
});
