import { Job, Queue } from 'bullmq';
import JudgeBot from '../agents';
import { cacheCreds } from './cache';

export const projectAnalysisQueue = new Queue('project-analysis', {
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
});

export const judgeProjectAsync = async (job: Job<{ projectId: number }>) => {
    const { projectId } = job.data;

    try {
        job.updateProgress(10);
        const judgeBot = new JudgeBot();

        const response = await judgeBot.judge_project(projectId);

        job.updateProgress(100);

        return {
            success: true,
            data: response,
        };
    } catch (error: any) {
        const fallbackSheetUrl = process.env['FALLBACK_CSV_ENDPOINT'] as string;
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

        const fallbackRow = {
            timestamp: new Date().toISOString(),
            projectId: projectId,
            error: errorMessage,
        };

        await fetch(fallbackSheetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([Object.values(fallbackRow)]),
        });

        throw new Error(`Judging failed: ${error.message}`);
    }
};
