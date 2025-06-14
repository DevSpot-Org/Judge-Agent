import { Job, Queue } from 'bullmq';
import JudgeBot from '../agents';
import { socketService } from '../server';
import { cache, cacheCreds } from './cache';

export interface ProjectAnalysisJobData {
    projectUrl: string;
    creatorId: string;
    requestId: string;
}

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

export const processProjectAnalysis = async (job: Job<ProjectAnalysisJobData>) => {
    const { projectUrl, creatorId, requestId } = job.data;

    try {
        job.updateProgress(10);
        const judgeBot = new JudgeBot();

        // const result = await judgeBot.create_submit_generation_flow(projectUrl, creatorId);
        const currentCount = await cache.get(creatorId);

        if (currentCount) {
            const count = parseInt(currentCount);

            if (count > 1) {
                await cache.set(creatorId, count - 1);
            } else {
                await cache.del(creatorId);
            }
        }

        const isFinal = currentCount ? parseInt(currentCount) <= 1 : false;

        console.log('Done');

        // socketService.emitCreatedProject(result, creatorId, isFinal);

        job.updateProgress(100);

        return {
            success: true,
            data: {},
            requestId,
        };
    } catch (error: any) {
        throw new Error(`Analysis failed: ${error.message}`);
    }
};
