import type { LLMProvider } from '../llmProviders';
import { requestLLM } from '../llmProviders/service';
import type { HackathonChallenges, Project } from '../types/entities';
import jsonParser from '../utils/jsonParser';
import { judgeBusinessPotential } from './judges/business/judge';
import { judgeFinalReview } from './judges/final/judge';
import { judgeInnovation } from './judges/innovation/judge';
import { judgeTechnicalImplementation } from './judges/technical/judge';
import { judgeUX } from './judges/ux/judge';
import { codePreProcessor } from './utils/codePreProcessor/judge';

interface Summary {
    summary: string;
    score: number;
}

interface ChallengeAnalysis {
    fullAnalysis: string;
    summary: string;
    score: number;
}

interface BulkAnalysisResult {
    technical: Record<string, ChallengeAnalysis>;
    ux: Record<string, ChallengeAnalysis>;
    business: Record<string, ChallengeAnalysis>;
    innovation: Record<string, ChallengeAnalysis>;
}

type FinalBulkAnalysisResult = Record<
    string,
    {
        technical: ChallengeAnalysis;
        ux: ChallengeAnalysis;
        business: ChallengeAnalysis;
        innovation: ChallengeAnalysis;
        final: ChallengeAnalysis;
    }
>;

class BulkJudge {
    project: Project;
    challenges: HackathonChallenges[];
    provider: LLMProvider = 'groq';
    private concurrencyLimit: number = 3; // Adjust based on API rate limits

    constructor(project: Project, challenges: HackathonChallenges[], concurrencyLimit?: number) {
        this.challenges = challenges;
        this.project = project;
        if (concurrencyLimit) this.concurrencyLimit = concurrencyLimit;
    }

    async projectJudgeAnalysis() {
        const startTime = Date.now();
        console.log(`🚀 Starting analysis for project ${this.project.name}`);

        await codePreProcessor(this.project);

        // 1. MAIN OPTIMIZATION: Run all judging functions in parallel
        const judgingPromises = Promise.allSettled([
            this.retryWrapper('innovation', () => this.innovationJudging()),
            this.retryWrapper('technical', () => this.technicalJudging()),
            this.retryWrapper('ux', () => this.uxJudging()),
            this.retryWrapper('business', () => this.businessJudging()),
        ]);

        const results = await judgingPromises;

        // Handle any failures
        const processedResults: Record<string, any> = {};
        const categories = ['innovation', 'technical', 'ux', 'business'];

        results.forEach((result, index) => {
            const category = categories[index];
            if (result.status === 'fulfilled') {
                processedResults[category] = result.value;
            } else {
                console.error(`❌ ${category} analysis failed:`, result.reason);
                // Provide fallback empty results
                processedResults[category] = this.generateEmptyResults();
            }
        });

        const data = {
            technical: processedResults['technical'],
            ux: processedResults['ux'],
            business: processedResults['business'],
            innovation: processedResults['innovation'],
        };

        const finalData = this.restructureResults(data);
        const finalReview = await this.finalJudging(finalData);

        this.challenges.forEach(challenge => {
            if (finalReview[challenge.id]) {
                finalData[challenge.id].final = {
                    fullAnalysis: finalReview[challenge.id].fullAnalysis,
                    summary: finalReview[challenge.id].summary,
                    score: finalReview[challenge.id].score,
                };
            }
        });

        const totalTime = Date.now() - startTime;
        console.log(`✅ Analysis completed in ${totalTime}ms`);

        return finalData;
    }

    // 2. OPTIMIZATION: Centralized retry logic with exponential backoff
    private async retryWrapper<T>(operation: string, fn: () => Promise<T>): Promise<T> {
        const MAX_RETRIES = 3;
        let attempts = 0;

        console.log(`Judging Section - ${operation} of project ${this.project.name}`);

        while (attempts < MAX_RETRIES) {
            try {
                return await fn();
            } catch (error: any) {
                attempts++;
                console.error(`❌ ${operation} analysis failed (attempt ${attempts}/${MAX_RETRIES}):`, error);

                if (attempts === MAX_RETRIES) {
                    throw new Error(`${operation} analysis failed after ${MAX_RETRIES} attempts: ${error.message}`);
                }

                // Exponential backoff: 1s, 2s, 4s
                const delay = Math.pow(2, attempts - 1) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw new Error(`${operation} failed after all retries`);
    }

    // 3. OPTIMIZATION: Batch processing with concurrency control
    private async processChallengesInBatches<T>(challenges: HackathonChallenges[], processor: (challenge: HackathonChallenges) => Promise<T>): Promise<T[]> {
        const results: T[] = [];

        for (let i = 0; i < challenges.length; i += this.concurrencyLimit) {
            const batch = challenges.slice(i, i + this.concurrencyLimit);
            const batchPromises = batch.map(processor);
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }

        return results;
    }

    // 4. OPTIMIZATION: Combined judging function to reduce duplication
    private async performJudging(judgeFunction: (project: Project, challenges: HackathonChallenges[], provider: LLMProvider) => Promise<string>): Promise<Record<string, ChallengeAnalysis>> {
        const fullAnalysis = await judgeFunction(this.project, this.challenges, this.provider);
        const result = jsonParser(fullAnalysis) as Record<string, string>;

        // Process summary in parallel with result parsing
        const [summary] = await Promise.all([this.summarizeResult(result)]);

        const analysisResults: Record<string, ChallengeAnalysis> = {};

        this.challenges.forEach(challenge => {
            const challengeSummary = summary[challenge.id];
            analysisResults[challenge.id] = {
                fullAnalysis: result[challenge.id] || '',
                summary: challengeSummary?.summary || 'No summary available',
                score: challengeSummary?.score || 0,
            };
        });

        return analysisResults;
    }

    async innovationJudging() {
        return this.performJudging(judgeInnovation);
    }

    async businessJudging() {
        return this.performJudging(judgeBusinessPotential);
    }

    async technicalJudging() {
        return this.performJudging(judgeTechnicalImplementation);
    }

    async uxJudging() {
        return this.performJudging(judgeUX);
    }

    async finalJudging(initialReview: FinalBulkAnalysisResult) {
        const fullAnalysis = await judgeFinalReview({
            entries: initialReview,
            provider: this.provider,
        });

        const result = jsonParser(fullAnalysis) as Record<string, string>;
        const summary = await this.summarizeResult(result);

        const analysisResults: Record<string, ChallengeAnalysis> = {};

        this.challenges.forEach(challenge => {
            const challengeSummary = summary[challenge.id];
            analysisResults[challenge.id] = {
                fullAnalysis: result?.[challenge.id] || '',
                summary: challengeSummary?.summary || 'No summary available',
                score: challengeSummary?.score || 0,
            };
        });

        return analysisResults;
    }

    // 5. OPTIMIZATION: Optimized summarization with better error handling
    async summarizeResult(reviewEntries: Record<string, string>): Promise<Record<string, Summary>> {
        console.log('📊 Generating review summaries...');

        // Skip if no entries
        if (!reviewEntries || Object.keys(reviewEntries).length === 0) {
            return this.generateDefaultSummaries();
        }

        const summariesPrompt = `
            Please analyze the following reviews for multiple challenges and provide summaries.
            For each challenge, provide:
            1. A 1-2 sentence summary with 35-50 words (50 words max) focusing on key points and main takeaways
            2. A quality/performance score out of 10 based on the review content. If the Review Content has a final score, use that. Otherwise, calculate a score based on the review content.
            
            Consider factors like:
            - Project quality and functionality
            - Technical implementation
            - Innovation and uniqueness
            - User experience and design
            - Overall assessment tone in the review
            
            Return a JSON object where each key is a challenge ID and its value is the summary objects, in this format:
            {
                "123": {
                    "summary": "summary for challenge 123",
                    "score": 7.5
                },
                "456": {
                    "summary": "summary for challenge 456",
                    "score": 8.5
                }
            }

            Reviews to analyze:
            ${JSON.stringify(reviewEntries)}
        `;

        try {
            const summary = await requestLLM(this.provider, summariesPrompt);
            const result = jsonParser(summary) as Record<string, Summary>;

            if (result && Object.keys(result).length > 0) {
                return result;
            }

            return this.generateDefaultSummaries();
        } catch (error) {
            console.error('Error generating summaries:', error);
            return this.generateDefaultSummaries();
        }
    }

    private restructureResults(results: BulkAnalysisResult): FinalBulkAnalysisResult {
        const restructured: FinalBulkAnalysisResult = {};

        // Get all unique challenge IDs from all categories
        const challengeIds = new Set([...Object.keys(results.technical || {}), ...Object.keys(results.ux || {}), ...Object.keys(results.business || {}), ...Object.keys(results.innovation || {})]);

        // For each challenge ID, group all category results together
        challengeIds.forEach(challengeId => {
            const defaultAnalysis = {
                fullAnalysis: '',
                summary: 'No analysis available',
                score: 0,
            };

            restructured[challengeId] = {
                technical: results.technical?.[challengeId] || defaultAnalysis,
                ux: results.ux?.[challengeId] || defaultAnalysis,
                business: results.business?.[challengeId] || defaultAnalysis,
                innovation: results.innovation?.[challengeId] || defaultAnalysis,
                final: defaultAnalysis, 
            };
        });

        return restructured;
    }

    private generateDefaultSummaries(): Record<string, Summary> {
        const defaultSummaries: Record<string, Summary> = {};

        this.challenges.forEach(challenge => {
            defaultSummaries[challenge.id] = {
                summary: 'No summary available',
                score: 0,
            };
        });

        return defaultSummaries;
    }

    private generateEmptyResults(): Record<string, ChallengeAnalysis> {
        const emptyResults: Record<string, ChallengeAnalysis> = {};

        this.challenges.forEach(challenge => {
            emptyResults[challenge.id] = {
                fullAnalysis: '',
                summary: 'Analysis failed',
                score: 0,
            };
        });

        return emptyResults;
    }
}

export default BulkJudge;
