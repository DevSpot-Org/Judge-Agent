import fs from 'fs';
import path from 'path';

import { getHackathonChallengesFromDB } from '../../../agents/devspot';
import { TEMPORARY_FOLDER } from '../../../constants';
import { selectLLMFetcher, type LLMProvider } from '../../../llmProviders';
import type { HackathonChallenges } from '../../../types/entities';
import jsonParser from '../../../utils/jsonParser';
import { getRepoName } from '../../../utils/repos';
import type { ProjectAnalysis } from '../../type';
import chunkService from '../../utils/chunkService';
import rateLimit from '../../utils/rateLimit';
import { challengeMatchingPrompt, structuredAnalysisPrompt } from './prompt';
import type { CacheEntry, ChunkResult } from './types';

// ===== CONSTANTS =====
const CACHE_DURATION = 10 * 60 * 1000;
const MAX_TOKENS_PER_REQUEST = 25000;
const MAX_RETRY_ATTEMPTS = 5;
const CHALLENGE_MATCH_THRESHOLD = 0.3;

// ===== MAIN ORCHESTRATION =====
export const generateProjectInfo = async (project_url: string, provider: LLMProvider = 'groq'): Promise<ProjectAnalysis> => {
    const repoName = getRepoName(project_url);
    const cacheKey = repoName;

    const cachedResult = getCachedData(repoAnalysisCache, cacheKey);
    if (cachedResult) return cachedResult;

    const llmExecutor = executeLLMRequest(provider);
    const challengeGetter = getChallengesWithCache(fetchChallengesFromService);
    const strategySelector = selectAnalysisStrategy(llmExecutor);

    const [fileContent, challenges] = await Promise.all([readRepositoryFile(repoName), challengeGetter(1)]);

    const result = await strategySelector(fileContent, challenges);

    // Cache and return result
    repoAnalysisCache.set(cacheKey, createCacheEntry(result));
    return result;
};

// ===== CACHE MANAGEMENT =====
const challengeCache = new Map<number, CacheEntry<any>>();
const repoAnalysisCache = new Map<string, CacheEntry<any>>();

const isCacheValid = <T>(entry: CacheEntry<T> | undefined): boolean => {
    return entry !== undefined && Date.now() - entry.timestamp < CACHE_DURATION;
};

const createCacheEntry = <T>(data: T): CacheEntry<T> => ({
    data,
    timestamp: Date.now(),
});

const getCachedData = <T>(cache: Map<string | number, CacheEntry<T>>, key: string | number): T | undefined => {
    const entry = cache.get(key);
    return isCacheValid(entry) ? entry?.data : undefined;
};

// ===== LLM PROVIDER FUNCTIONS =====
const executeLLMRequest =
    (provider: LLMProvider) =>
    (prompt: string): Promise<any> => {
        const fetcher = selectLLMFetcher(provider);

        return rateLimit.retryWithBackoff(
            async () => {
                const response = await fetcher(prompt);
                return jsonParser(response);
            },
            MAX_RETRY_ATTEMPTS,
            `${provider} analysis`
        );
    };

// ===== CHALLENGE MANAGEMENT =====
const fetchChallengesFromService = async (hackathonId: number): Promise<HackathonChallenges[]> => {
    return await getHackathonChallengesFromDB(hackathonId);
};

const getChallengesWithCache =
    (fetchFn: (id: number) => Promise<HackathonChallenges[]>) =>
    async (hackathonId: number): Promise<HackathonChallenges[]> => {
        const cached = getCachedData(challengeCache, hackathonId);
        if (cached) return cached;

        const challenges = await fetchFn(hackathonId);
        challengeCache.set(hackathonId, createCacheEntry(challenges));

        return challenges;
    };

// ===== PROMPT GENERATION =====
const createSingleAnalysisPrompt = (fileContent: string, challenges: HackathonChallenges[]): string => `
  <project_code>
  ${fileContent}
  </project_code>

  <available_challenges>
  ${JSON.stringify(challenges, null, 2)}
  </available_challenges>

  <user_instructions>
  ${structuredAnalysisPrompt}
  </user_instructions>

  <meta_prompt>
  ${challengeMatchingPrompt}
  </meta_prompt>
`;

const createChunkAnalysisPrompt = (chunk: string, challenges: HackathonChallenges[], chunkIndex: number, totalChunks: number): string => `
  <project_code_chunk ${chunkIndex + 1}/${totalChunks}>
  ${chunk}
  </project_code_chunk>

  <available_challenges>
  ${JSON.stringify(challenges, null, 2)}
  </available_challenges>

  <analysis_instructions>
  This is chunk ${chunkIndex + 1} of ${totalChunks} from a larger codebase.
  
  Analyze this chunk and extract:
  1. Technologies, frameworks, and libraries used
  2. Project name hints (from package.json, README, etc.)
  3. Key functionality and features visible in this chunk
  4. Potential challenge matches based on what you can see
  
  Return JSON format:
  {
    "technologies": ["array of technologies found in this chunk"],
    "projectNameHints": ["any project name hints found"],
    "features": ["key features/functionality identified"],
    "potentialChallenges": ["challenge IDs that might match based on this chunk"],
    "description": "What this chunk reveals about the project, don't include the chunk name as this is shown to the end user. if this is the final chunk , then just resturcture the description to be the general desscription of the project not a chunk based description"
  }
  </analysis_instructions>
`;

// ===== CHUNK PROCESSING =====
const calculateMinChunksForMatch = (totalChunks: number): number => Math.ceil(totalChunks * CHALLENGE_MATCH_THRESHOLD);

// Pure function: Merge unique items from arrays
const mergeUniqueItems = (arrays: string[][]): string[] => [...new Set(arrays.flat())];

const countChallengeOccurrences = (chunkResults: ChunkResult[]): Map<string, number> => {
    const challengeMatches = new Map<string, number>();

    chunkResults.forEach(result => {
        result.potentialChallenges?.forEach(challengeId => {
            challengeMatches.set(challengeId, (challengeMatches.get(challengeId) || 0) + 1);
        });
    });

    return challengeMatches;
};

const selectConfidentChallenges = (challengeMatches: Map<string, number>, minChunksRequired: number): number[] =>
    Array.from(challengeMatches.entries())
        .filter(([_, count]) => count >= minChunksRequired)
        .sort((a, b) => b[1] - a[1])
        .map(([challengeId, _]) => {
            const numId = Number(challengeId);
            return !isNaN(numId) ? numId : null;
        })
        .filter((id): id is number => id !== null);

const generateTagline = (technologies: string[]): string => `A comprehensive solution built with ${technologies.slice(0, 3).join(', ')}`;

const mergeChunkResults = (chunkResults: ChunkResult[]): ProjectAnalysis => {
    const technologies = mergeUniqueItems(chunkResults.map(r => r.technologies || []));
    const projectNameHints = mergeUniqueItems(chunkResults.map(r => r.projectNameHints || []));
    const challengeMatches = countChallengeOccurrences(chunkResults);
    const minChunksRequired = calculateMinChunksForMatch(chunkResults.length);

    const challengeIds = selectConfidentChallenges(challengeMatches, minChunksRequired);
    const descriptions = chunkResults.map(r => r.description).filter(Boolean);

    return {
        challengeIds,
        technologies,
        description: descriptions.length > 0 ? descriptions.join(' ') : 'A software project with multiple components and features.',
        name: projectNameHints[0] || 'Analyzed Project',
        tagline: generateTagline(technologies),
    };
};

// ===== ANALYSIS STRATEGIES =====
const analyzeChunk =
    (llmExecutor: (prompt: string) => Promise<any>) =>
    async (chunk: string, challenges: any[], chunkIndex: number, totalChunks: number): Promise<ChunkResult> => {
        const prompt = createChunkAnalysisPrompt(chunk, challenges, chunkIndex, totalChunks);
        console.log(`Analyzing chunk ${chunkIndex + 1}/${totalChunks}...`);

        return await llmExecutor(prompt);
    };

const processChunks =
    (chunkAnalyzer: (chunk: string, challenges: any[], index: number, total: number) => Promise<ChunkResult>) =>
    async (chunks: string[], challenges: any[]): Promise<ChunkResult[]> => {
        const results: ChunkResult[] = [];

        const totalChunks = chunks.length;

        for (let i = 0; i < chunks.length; i++) {
            try {
                const result = await chunkAnalyzer(chunks[i], challenges, i, totalChunks);
                results.push(result);

                console.log(`✅ Completed chunk ${i + 1}/${totalChunks}`);
            } catch (error) {
                console.error(`❌ Failed to analyze chunk ${i + 1}:`, error);
            }
        }

        if (results.length === 0) {
            throw new Error('All chunk analyses failed');
        }

        // Update final progress
        return results;
    };

const createChunkedAnalysisStrategy =
    (llmExecutor: (prompt: string) => Promise<any>) =>
    async (fileContent: string, challenges: any[]): Promise<ProjectAnalysis> => {
        console.log('Large codebase detected, using chunking strategy...');

        const chunks = chunkService.chunkString(fileContent, MAX_TOKENS_PER_REQUEST);
        const chunkAnalyzer = analyzeChunk(llmExecutor);
        const chunkProcessor = processChunks(chunkAnalyzer);

        const chunkResults = await chunkProcessor(chunks, challenges);
        return mergeChunkResults(chunkResults);
    };

const createSingleAnalysisStrategy =
    (llmExecutor: (prompt: string) => Promise<any>) =>
    async (fileContent: string, challenges: any[]): Promise<ProjectAnalysis> => {
        const prompt = createSingleAnalysisPrompt(fileContent, challenges);
        return await llmExecutor(prompt);
    };

// ===== STRATEGY SELECTION =====
const shouldUseChunking = (fileContent: string): boolean => chunkService.estimateTokens(fileContent) > MAX_TOKENS_PER_REQUEST;

const selectAnalysisStrategy =
    (llmExecutor: (prompt: string) => Promise<any>) =>
    async (fileContent: string, challenges: any[]): Promise<ProjectAnalysis> => {
        const estimatedTokens = chunkService.estimateTokens(fileContent);
        console.log(`📊 Estimated tokens: ${estimatedTokens.toLocaleString()}`);

        if (shouldUseChunking(fileContent)) {
            console.log('📄 Large codebase detected - using chunked analysis');
            return createChunkedAnalysisStrategy(llmExecutor)(fileContent, challenges);
        } else {
            console.log('📄 Small codebase - using single request analysis');
            return createSingleAnalysisStrategy(llmExecutor)(fileContent, challenges);
        }
    };

// ===== FILE OPERATIONS =====
const generateRepoFilePath = (repoName: string): string => `${TEMPORARY_FOLDER}/repositories/${repoName}-pack.xml`;

const readRepositoryFile = async (repoName: string): Promise<string> => {
    const filePath = generateRepoFilePath(repoName);
    return fs.readFileSync(path.join(filePath), 'utf8');
};
