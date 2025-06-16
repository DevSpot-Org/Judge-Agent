import { Queue, QueueEvents } from 'bullmq';
import { cacheCreds } from '../core/cache';
import { type LLMProvider } from './index';

const queueEventsMap: Record<LLMProvider, QueueEvents> = {
    groq: new QueueEvents('groq-queue', { connection: cacheCreds }),
    gemini: new QueueEvents('gemini-queue', { connection: cacheCreds }),
    openai: new QueueEvents('openai-queue', { connection: cacheCreds }),
};

const options = {
    connection: cacheCreds,
    defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
    },
};

export const llmQueues = {
    groq: new Queue('groq-queue', options),
    gemini: new Queue('gemini-queue', options),
    openai: new Queue('openai-queue', options),
};

export const requestLLM = async (provider: LLMProvider, prompt: string, model?: string): Promise<string> => {
    const queue = llmQueues[provider];
    const queueEvents = queueEventsMap[provider];

    const job = await queue.add(
        'llm-task',
        { provider, prompt, model },
        {
            attempts: 1,
            removeOnComplete: true,
            removeOnFail: true,
        }
    );

    const result = await job.waitUntilFinished(queueEvents);
    console.log({ result });
    return result;
};
