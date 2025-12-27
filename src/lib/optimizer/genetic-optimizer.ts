import {
    Candle,
    StrategyParams,
    BacktestConfig,
    OptimizationConfig,
    OptimizationResult,
    PerformanceMetrics,
    DEFAULT_BACKTEST_CONFIG
} from '../types';
import { Strategy } from '../strategy-base';
import { BacktestEngine } from '../backtest-engine';

interface Individual<T extends StrategyParams> {
    params: T;
    fitness: number;
    metrics?: PerformanceMetrics;
}

export interface GeneticConfig {
    populationSize: number;
    generations: number;
    mutationRate: number;
    crossoverRate: number;
    eliteCount: number;
    earlyStopGenerations: number; // Stop if no improvement for X generations
}

export const DEFAULT_GENETIC_CONFIG: GeneticConfig = {
    populationSize: 50,
    generations: 100,
    mutationRate: 0.1,
    crossoverRate: 0.7,
    eliteCount: 2,
    earlyStopGenerations: 20,
};

/**
 * Genetic Algorithm Optimizer
 * 
 * Uses evolutionary approach to find optimal parameters:
 * - Selection: Tournament selection
 * - Crossover: Uniform crossover
 * - Mutation: Random resetting within bounds
 */
export class GeneticOptimizer<T extends StrategyParams> {
    private candles: Candle[];
    private backtestConfig: BacktestConfig;
    private optimizationConfig: OptimizationConfig;
    private geneticConfig: GeneticConfig;
    private onProgress?: (generation: number, best: T, bestFitness: number) => void;

    constructor(
        candles: Candle[],
        backtestConfig: BacktestConfig,
        optimizationConfig: OptimizationConfig,
        geneticConfig: Partial<GeneticConfig> = {},
        onProgress?: (generation: number, best: T, bestFitness: number) => void
    ) {
        this.candles = candles;
        this.backtestConfig = backtestConfig;
        this.optimizationConfig = optimizationConfig;
        this.geneticConfig = { ...DEFAULT_GENETIC_CONFIG, ...geneticConfig };
        this.onProgress = onProgress;
    }

    /**
     * Run genetic algorithm optimization
     */
    optimize(strategyFactory: (params: T) => Strategy<T>, baseParams: T): OptimizationResult {
        const startTime = performance.now();
        const allResults: OptimizationResult['allResults'] = [];

        // Initialize population
        let population = this.initializePopulation(baseParams);
        population = this.evaluatePopulation(population, strategyFactory, allResults);

        let bestOverall = this.getBest(population);
        let generationsWithoutImprovement = 0;

        // Evolution loop
        for (let gen = 0; gen < this.geneticConfig.generations; gen++) {
            // Selection and reproduction
            const newPopulation: Individual<T>[] = [];

            // Elitism: keep best individuals
            const sorted = [...population].sort((a, b) => b.fitness - a.fitness);
            for (let i = 0; i < this.geneticConfig.eliteCount; i++) {
                newPopulation.push(sorted[i]);
            }

            // Fill rest of population with offspring
            while (newPopulation.length < this.geneticConfig.populationSize) {
                const parent1 = this.tournamentSelection(population);
                const parent2 = this.tournamentSelection(population);

                let offspring: T;
                if (Math.random() < this.geneticConfig.crossoverRate) {
                    offspring = this.crossover(parent1.params, parent2.params, baseParams);
                } else {
                    offspring = { ...parent1.params };
                }

                if (Math.random() < this.geneticConfig.mutationRate) {
                    offspring = this.mutate(offspring, baseParams);
                }

                newPopulation.push({ params: offspring, fitness: 0 });
            }

            // Evaluate new population
            population = this.evaluatePopulation(newPopulation, strategyFactory, allResults);

            // Track best
            const currentBest = this.getBest(population);
            if (currentBest.fitness > bestOverall.fitness) {
                bestOverall = currentBest;
                generationsWithoutImprovement = 0;
            } else {
                generationsWithoutImprovement++;
            }

            // Progress callback
            if (this.onProgress) {
                this.onProgress(gen + 1, bestOverall.params, bestOverall.fitness);
            }

            // Early stopping
            if (generationsWithoutImprovement >= this.geneticConfig.earlyStopGenerations) {
                console.log(`Early stopping at generation ${gen + 1}`);
                break;
            }
        }

        const processingTime = performance.now() - startTime;

        // Sort all results
        allResults.sort((a, b) => this.optimizationConfig.maximize
            ? b.metricValue - a.metricValue
            : a.metricValue - b.metricValue
        );

        return {
            bestParams: bestOverall.params,
            bestMetricValue: bestOverall.fitness,
            allResults,
            totalCombinations: allResults.length,
            processingTime,
        };
    }

    /**
     * Initialize random population
     */
    private initializePopulation(baseParams: T): Individual<T>[] {
        const population: Individual<T>[] = [];

        // Add base params
        population.push({ params: { ...baseParams }, fitness: 0 });

        // Generate random individuals
        for (let i = 1; i < this.geneticConfig.populationSize; i++) {
            const params = this.randomizeParams(baseParams);
            population.push({ params, fitness: 0 });
        }

        return population;
    }

    /**
     * Randomize parameters within bounds
     */
    private randomizeParams(baseParams: T): T {
        const params = { ...baseParams };

        for (const [key, range] of Object.entries(this.optimizationConfig.paramRanges)) {
            const steps = Math.floor((range.max - range.min) / range.step);
            const randomStep = Math.floor(Math.random() * (steps + 1));
            (params as Record<string, unknown>)[key] = range.min + randomStep * range.step;
        }

        return params;
    }

    /**
     * Evaluate fitness for entire population
     */
    private evaluatePopulation(
        population: Individual<T>[],
        strategyFactory: (params: T) => Strategy<T>,
        allResults: OptimizationResult['allResults']
    ): Individual<T>[] {
        const engine = new BacktestEngine(this.backtestConfig);

        return population.map(individual => {
            if (individual.fitness !== 0 && individual.metrics) {
                return individual; // Already evaluated (elite)
            }

            try {
                const strategy = strategyFactory(individual.params);
                const result = engine.run(this.candles, strategy);
                const metricValue = result.metrics[this.optimizationConfig.metric] as number;

                // Store result
                const exists = allResults.some(r =>
                    JSON.stringify(r.params) === JSON.stringify(individual.params)
                );
                if (!exists) {
                    allResults.push({
                        params: individual.params,
                        metricValue,
                        metrics: result.metrics,
                    });
                }

                // Fitness is the metric value (higher is better for maximization)
                const fitness = this.optimizationConfig.maximize
                    ? metricValue
                    : -metricValue;

                return {
                    params: individual.params,
                    fitness: isFinite(fitness) ? fitness : -Infinity,
                    metrics: result.metrics,
                };
            } catch {
                return { params: individual.params, fitness: -Infinity };
            }
        });
    }

    /**
     * Tournament selection
     */
    private tournamentSelection(population: Individual<T>[], tournamentSize: number = 3): Individual<T> {
        let best: Individual<T> | null = null;

        for (let i = 0; i < tournamentSize; i++) {
            const idx = Math.floor(Math.random() * population.length);
            const candidate = population[idx];

            if (!best || candidate.fitness > best.fitness) {
                best = candidate;
            }
        }

        return best!;
    }

    /**
     * Uniform crossover
     */
    private crossover(parent1: T, parent2: T, _baseParams: T): T {
        const offspring = { ...parent1 };

        for (const key of Object.keys(this.optimizationConfig.paramRanges)) {
            if (Math.random() < 0.5) {
                (offspring as Record<string, unknown>)[key] = (parent2 as Record<string, unknown>)[key];
            }
        }

        return offspring;
    }

    /**
     * Mutation: randomly change one parameter
     */
    private mutate(params: T, baseParams: T): T {
        const mutated = { ...params };
        const keys = Object.keys(this.optimizationConfig.paramRanges);
        const keyToMutate = keys[Math.floor(Math.random() * keys.length)];
        const range = this.optimizationConfig.paramRanges[keyToMutate];

        // Random value within range
        const steps = Math.floor((range.max - range.min) / range.step);
        const randomStep = Math.floor(Math.random() * (steps + 1));
        (mutated as Record<string, unknown>)[keyToMutate] = range.min + randomStep * range.step;

        return mutated;
    }

    /**
     * Get best individual from population
     */
    private getBest(population: Individual<T>[]): Individual<T> {
        return population.reduce((best, current) =>
            current.fitness > best.fitness ? current : best
        );
    }
}

/**
 * Convenience function for genetic optimization
 */
export function geneticOptimize<T extends StrategyParams>(
    candles: Candle[],
    strategyFactory: (params: T) => Strategy<T>,
    baseParams: T,
    optimizationConfig: OptimizationConfig,
    backtestConfig?: BacktestConfig,
    geneticConfig?: Partial<GeneticConfig>,
    onProgress?: (generation: number, best: T, bestFitness: number) => void
): OptimizationResult {
    const optimizer = new GeneticOptimizer<T>(
        candles,
        backtestConfig || DEFAULT_BACKTEST_CONFIG,
        optimizationConfig,
        geneticConfig,
        onProgress
    );

    return optimizer.optimize(strategyFactory, baseParams);
}
