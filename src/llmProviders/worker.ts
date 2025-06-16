// workers/llmWorker.ts
import { Job } from 'bullmq';
import rateLimit from '../create_project/utils/rateLimit';
import { selectLLMFetcher } from './index';

export const processLLMJob = async (job: Job) => {
    const { provider, prompt } = job.data;
    const fetcher = selectLLMFetcher(provider);

    if (!fetcher) throw new Error(`Unknown provider: ${provider}`);

    return await rateLimit.retryWithBackoff(() => fetcher(prompt, job.data?.model), 5, `${provider.toUpperCase()} API`);
};
