import { geminiFetch } from './gemini';
import { groqFetch } from './groq';
import { openaiFetch } from './openai';

export type LLMProvider = 'groq' | 'gemini';

export const selectLLMFetcher = (provider: LLMProvider) => {
    const fetchers = {
        gemini: geminiFetch,
        groq: groqFetch,
        openai: openaiFetch,
    };

    const fetcher = fetchers[provider];
    if (!fetcher) {
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }

    return fetcher;
};
