import { cache } from '../core/cache';
import { judgeBusinessPotential } from '../judges/business/judge';
import { judgeFinalReview } from '../judges/final/judge';
import { judgeInnovation } from '../judges/innovation/judge';
import { judgeTechnicalImplementation } from '../judges/technical/judge';
import { judgeUX } from '../judges/ux/judge';
import type { LLMProvider } from '../llmProviders';
import { requestLLM } from '../llmProviders/service';
import type { HackathonChallenges, Project } from '../types/entities';
import jsonParser from '../utils/jsonParser';
import type { JudgingResults } from './devspot';

interface InitialJudgeResults {
    ux: string;
    technical: string;
    business: string;
    innovation: string;
}

interface Summary {
    summary: string;
    score: number;
}

class Judge {
    project: Project;
    challenge: HackathonChallenges;
    provider: LLMProvider = 'groq';

    constructor(project: Project, challenge: HackathonChallenges) {
        this.challenge = challenge;
        this.project = project;
    }

    async projectJudgeAnalysis() {
        const cacheKey = `${this.project.id}-${this.challenge.id}-review`;

        const entry = await cache.get(cacheKey);
        if (entry) {
            const result = JSON.parse(entry) as JudgingResults;

            return result;
        }

        const MAX_RETRIES = 3;
        const judgingFunctions = {
            innovation: this.innovationJudging.bind(this),
            technical: this.technicalJudging.bind(this),
            ux: this.uxJudging.bind(this),
            business: this.businessJudging.bind(this)
        };

        const results: Record<string, any> = {};

        // Try each judging function with retries
        for (const [key, func] of Object.entries(judgingFunctions)) {
            let attempts = 0;
            let success = false;

            console.log(`Judging Section - ${key} of project ${this.project.name}`)

            while (attempts < MAX_RETRIES && !success) {
                try {
                    results[key] = await func();
                    success = true;
                } catch (error:any) {
                    attempts++;
                    console.error(`❌ ${key} analysis failed (attempt ${attempts}/${MAX_RETRIES}):`, error);
                    
                    if (attempts === MAX_RETRIES) {
                        throw new Error(`${key} analysis failed after ${MAX_RETRIES} attempts: ${error.message}`);
                    }
                    // Wait briefly before retrying
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        const technicalReview = results['technical'];
        const uxReview = results['ux'];
        const businessReview = results['business'];
        const innovationReview = results['innovation'];

        const finalReview = await this.finalJudging({
            technical: technicalReview.fullAnalysis,
            ux: uxReview.fullAnalysis,
            business: businessReview.fullAnalysis,
            innovation: innovationReview.fullAnalysis,
        });

        cache.set(cacheKey, JSON.stringify({ ...results, final: finalReview }));

        return {
            technical: technicalReview,
            ux: uxReview,
            business: businessReview,
            innovation: innovationReview,
            final: finalReview,
        };
    }
    async technicalJudging() {
        const project = this.project;
        const challenge = this.challenge;
        const provider = this.provider;

        const fullAnalysis = await judgeTechnicalImplementation(project, challenge, provider);

        const summary = await this.summarizeResult(fullAnalysis);

        return {
            fullAnalysis,
            summary,
        };
    }

    async uxJudging() {
        const project = this.project;
        const challenge = this.challenge;
        const provider = this.provider;
        const fullAnalysis = await judgeUX(project, challenge, provider);
        const summary = await this.summarizeResult(fullAnalysis);
        return {
            fullAnalysis,
            summary,
        };
    }

    async businessJudging() {
        const project = this.project;
        const challenge = this.challenge;
        const provider = this.provider;
        const fullAnalysis = await judgeBusinessPotential(project, challenge, provider);
        const summary = await this.summarizeResult(fullAnalysis);
        return {
            fullAnalysis,
            summary,
        };
    }

    async innovationJudging() {
        const project = this.project;
        const challenge = this.challenge;
        const provider = this.provider;
        const fullAnalysis = await judgeInnovation(project, challenge, provider);
        const summary = await this.summarizeResult(fullAnalysis);
        return {
            fullAnalysis,
            summary,
        };
    }

    async finalJudging(initialReview: InitialJudgeResults) {
        const project = this.project;
        const provider = this.provider;

        const fullAnalysis = await judgeFinalReview({
            submission: project,
            provider,
            ...initialReview,
        });
        const summary = await this.summarizeResult(fullAnalysis);
        return {
            fullAnalysis,
            summary,
        };
    }

    async summarizeResult(review: string) {
        console.log('📊 Generating review summary...');

        const summarysPrompt = `
      Please analyze the following review and provide:
      1. A 1-2 sentence summary with 35-50 words (50 words max) focusing on key points and main takeaways
      2. A quality/performance score out of 10 based on the review content. If the Review Content has a final score, use that. Otherwise, calculate a score based on the review content.
      
      Consider factors like:
      - Project quality and functionality
      - Technical implementation
      - Innovation and uniqueness
      - User experience and design
      - Overall assessment tone in the review
      
      Return ONLY a JSON object with this format:
      {
        "summary": "your summary here",
        "score": 7.5
      }

      Review to analyze:
      ${review}
    `;
        const summary = await requestLLM(this.provider, summarysPrompt);

        const result = jsonParser(summary) as Summary;

        return result ?? { summary };
    }
}

export default Judge;
