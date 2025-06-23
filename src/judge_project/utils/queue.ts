import { Job, Queue, QueueEvents, Worker } from 'bullmq';
import { cacheCreds } from '../../core/cache';
import type { HackathonChallenges, JudgingBotScores, Project } from '../../types/entities';

export interface QueueProject {
    jobId: string;
    projectId: string;
    projectName: string;
    challengeName: string;
    status: 'waiting' | 'active' | 'completed' | 'failed';
    progress: number; // 0-100
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
    error?: string;
    result?: JudgingResult;
    retryCount: number;
}

export interface JudgingResult {
    project: Project;
    allReviews: JudgingBotScores[];
}

export interface QueueProgress {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    total: number;
    concurrency: number;
    isRunning: boolean;
    isPaused: boolean;
}

type UpdateProgress = (progress: number, message?: string) => Promise<void>;

const judgingQueue = new Queue('project-judging', {
    connection: cacheCreds,
    defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
    },
});

const queueEvents = new QueueEvents('project-judging', {
    connection: cacheCreds,
});

let worker: Worker | null = null;
let currentConcurrency = 1;

// Callback function type for batch refill
type BatchRefillCallback = () => Promise<Project[]>;
let batchRefillCallback: BatchRefillCallback | null = null;

const LOW_QUEUE_THRESHOLD = 2;

const activeJobProgress = new Map<string, number>();

/**
 * Update progress for an active job
 */
async function updateJobProgress(jobId: string, progress: number, message?: string): Promise<void> {
    try {
        const job: Job = await judgingQueue.getJob(jobId);
        if (job) {
            activeJobProgress.set(jobId, Math.min(100, Math.max(0, progress)));

            // Update job data with progress
            await job.updateProgress(progress);

            // Optionally update job data with custom message
            if (message) {
                await job.updateData({
                    ...job.data,
                    progressMessage: message,
                    lastProgressUpdate: new Date().toISOString(),
                });
            }

            console.log(`Job ${jobId} progress updated to ${progress}%${message ? `: ${message}` : ''}`);
        }
    } catch (error) {
        console.error(`Error updating progress for job ${jobId}:`, error);
    }
}

/**
 * Get all projects in the queue with their current status
 */
async function getAllQueueProjects(): Promise<QueueProject[]> {
    try {
        const [waiting, active, completed, failed] = await Promise.all([judgingQueue.getWaiting(), judgingQueue.getActive(), judgingQueue.getCompleted(), judgingQueue.getFailed()]);

        const projects: QueueProject[] = [];

        // Process waiting jobs
        for (const job of waiting) {
            const project: Project = job.data.project;
            const allChallenges = project.project_challenges?.map(item => item.hackathon_challenges) as HackathonChallenges[];
            const challengeArray = allChallenges.map(item => item.challenge_name).join(', ');

            projects.push({
                jobId: job.id!,
                projectId: job.data.project.id,
                projectName: job.data.project.name,
                challengeName: challengeArray,
                status: 'waiting',
                progress: 0,
                createdAt: new Date(job.timestamp).toISOString(),
                retryCount: job.attemptsMade,
            });
        }

        // Process active jobs
        for (const job of active) {
            const project: Project = job.data.project;
            const allChallenges = project.project_challenges?.map(item => item.hackathon_challenges) as HackathonChallenges[];
            const challengeArray = allChallenges.map(item => item.challenge_name).join(', ');

            const progress = activeJobProgress.get(job.id!) || job.progress || 0;
            projects.push({
                jobId: job.id!,
                projectId: job.data.project.id,
                projectName: job.data.project.name,
                challengeName: challengeArray,
                status: 'active',
                progress,
                createdAt: new Date(job.timestamp).toISOString(),
                startedAt: job.processedOn ? new Date(job.processedOn).toISOString() : undefined,
                retryCount: job.attemptsMade,
            });
        }

        // Process completed jobs
        for (const job of completed) {
            const project: Project = job.data.project;
            const allChallenges = project.project_challenges?.map(item => item.hackathon_challenges) as HackathonChallenges[];
            const challengeArray = allChallenges.map(item => item.challenge_name).join(', ');

            projects.push({
                jobId: job.id!,
                projectId: job.data.project.id,
                projectName: job.data.project.name,
                challengeName: challengeArray,
                status: 'completed',
                progress: 100,
                createdAt: new Date(job.timestamp).toISOString(),
                startedAt: job.processedOn ? new Date(job.processedOn).toISOString() : undefined,
                completedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : undefined,
                result: job.returnvalue,
                retryCount: job.attemptsMade,
            });
        }

        // Process failed jobs
        for (const job of failed) {
            const project: Project = job.data.project;
            const allChallenges = project.project_challenges?.map(item => item.hackathon_challenges) as HackathonChallenges[];
            const challengeArray = allChallenges.map(item => item.challenge_name).join(', ');

            projects.push({
                jobId: job.id!,
                projectId: job.data.project.id,
                projectName: job.data.project.name,
                challengeName: challengeArray,
                status: 'failed',
                progress: 0,
                createdAt: new Date(job.timestamp).toISOString(),
                startedAt: job.processedOn ? new Date(job.processedOn).toISOString() : undefined,
                error: job.failedReason,
                retryCount: job.attemptsMade,
            });
        }

        // Sort by creation time (newest first)
        return projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
        console.error('Error getting queue projects:', error);
        throw error;
    }
}

/**
 * Get enhanced queue statistics
 */
async function getQueueStats(): Promise<QueueProgress> {
    try {
        const counts = await judgingQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused');

        const isPaused = await judgingQueue.isPaused();

        return {
            waiting: counts['waiting'],
            active: counts['active'],
            completed: counts['completed'],
            failed: counts['failed'],
            total: counts['waiting'] + counts['active'] + counts['completed'] + counts['failed'],
            concurrency: currentConcurrency,
            isRunning: worker !== null,
            isPaused,
        };
    } catch (error) {
        console.error('Error getting queue stats:', error);
        throw error;
    }
}

async function retryFailedJob(jobId: string): Promise<void> {
    try {
        const job = await judgingQueue.getJob(jobId);
        if (job && job.isFailed()) {
            await job.retry();
            console.log(`Job ${jobId} queued for retry`);
        } else {
            throw new Error(`Job ${jobId} not found or not in failed state`);
        }
    } catch (error) {
        console.error(`Error retrying job ${jobId}:`, error);
        throw error;
    }
}

async function removeJob(jobId: string): Promise<void> {
    const job = await judgingQueue.getJob(jobId);
    if (job) {
        await job.remove();
        activeJobProgress.delete(jobId);
        console.log(`Job ${jobId} removed from queue`);
    } else {
        throw new Error(`Job ${jobId} not found`);
    }
}

async function addProjectToQueue(project: Project): Promise<string> {
    try {
        const job = await judgingQueue.add('judge-project', { project, startTime: new Date().toISOString() });

        console.log(`Project ${project.id} added to queue with job ID: ${job.id}`);
        return job.id!;
    } catch (error) {
        console.error('Error adding project to queue:', error);
        throw error;
    }
}

async function addProjectsBatch(projects: Project[]): Promise<string[]> {
    try {
        const jobs = projects.map(project => ({
            name: 'judge-project',
            data: { project, startTime: new Date().toISOString() },
        }));

        const addedJobs = await judgingQueue.addBulk(jobs);
        const jobIds = addedJobs.map(job => job.id!);

        console.log(`Added ${projects.length} projects to queue`);
        return jobIds;
    } catch (error) {
        console.error('Error adding projects batch to queue:', error);
        throw error;
    }
}

function setBatchRefillCallback(callback: BatchRefillCallback): void {
    batchRefillCallback = callback;
}

async function getQueueLength(): Promise<number> {
    try {
        const waiting = await judgingQueue.getWaiting();
        const active = await judgingQueue.getActive();
        return waiting.length + active.length;
    } catch (error) {
        console.error('Error getting queue length:', error);
        return 0;
    }
}

async function checkAndRefillQueue(): Promise<void> {
    if (!batchRefillCallback) return;

    try {
        const waiting = await judgingQueue.getWaiting();
        const active = await judgingQueue.getActive();
        const totalInProgress = waiting.length + active.length;

        if (totalInProgress <= LOW_QUEUE_THRESHOLD) {
            console.log(`Queue running low (${totalInProgress} items), requesting new batch...`);

            const newProjects = await batchRefillCallback();

            const filteredProjects = newProjects.filter(project => {
                const isInQueue = waiting.some(job => job.data.project.id === project.id) || active.some(job => job.data.project.id === project.id);
                return !isInQueue;
            });

            if (filteredProjects.length > 0) {
                await addProjectsBatch(filteredProjects);
                console.log(`Refilled queue with ${filteredProjects.length} new projects`);
            } else {
                console.log('No new projects available for refill');
            }
        }
    } catch (error) {
        console.error('Error during queue refill check:', error);
    }
}

async function setConcurrency(newConcurrency: number): Promise<void> {
    if (newConcurrency < 1) {
        throw new Error('Concurrency must be at least 1');
    }

    currentConcurrency = newConcurrency;

    if (worker) {
        console.log(`Updating concurrency from ${worker.opts.concurrency} to ${newConcurrency}`);
        await stopQueueProcessing();
        await startQueueProcessing();
    }

    console.log(`Concurrency set to ${newConcurrency}`);
}

async function startQueueProcessing(processorFn?: (project: Project, updateProgress: UpdateProgress) => Promise<any>): Promise<void> {
    if (worker) {
        console.log('Queue processing is already running');
        return;
    }

    await checkAndRefillQueue();

    const defaultProcessor = async (job: Job) => {
        const { project } = job.data;

        return { projectId: project.id, status: 'completed' };
    };

    const processor = processorFn ? processorFn : defaultProcessor;

    worker = new Worker(
        'project-judging',
        async (job: Job) => {
            const { project } = job.data;
            const jobId = job.id!;

            console.log(`Starting to judge project: ${project.name}`);

            // Create progress update function for the job
            const updateProgress = async (progress: number, message?: string) => {
                await updateJobProgress(jobId, progress, message);
            };

            try {
                // Initialize progress
                await updateProgress(0, 'Starting judging process...');

                // Run the actual judging function
                const result = await processor(project, updateProgress);

                // Final progress update
                await updateProgress(100, 'Judging completed');

                // Clean up progress tracking
                activeJobProgress.delete(jobId);

                return result;
            } catch (error) {
                // Clean up progress tracking on error
                activeJobProgress.delete(jobId);
                throw error;
            }
        },
        {
            connection: cacheCreds,
            concurrency: currentConcurrency,
            lockDuration: 180000,
        }
    );

    // Set up event listeners
    worker.on('completed', async (job: Job) => {
        console.log(`Job ${job.id} completed for project ${job.data.project.id}`);

        await checkAndRefillQueue();
    });

    worker.on('failed', (job: Job | undefined, err: Error) => {
        console.error(`Job ${job?.id} failed:`, err.message);
    });

    worker.on('failed', (job: Job | undefined, err: Error) => {
        console.error(`Judging failed for project ${job?.data.project.id}:`, err.message);
        if (job?.id) {
            activeJobProgress.delete(job.id);
        }
    });

    console.log(`Queue processing started with concurrency: ${currentConcurrency}`);
}

async function stopQueueProcessing(): Promise<void> {
    if (worker) {
        await worker.close();
        worker = null;
        console.log('Queue processing stopped');
    }
}

async function pauseQueue(): Promise<void> {
    await judgingQueue.pause();
    console.log('Queue paused');
}

async function resumeQueue(): Promise<void> {
    await judgingQueue.resume();
    console.log('Queue resumed');
}

async function clearQueue(): Promise<void> {
    await judgingQueue.obliterate({ force: true });
    console.log('Queue cleared');
}

async function getJob(jobId: string): Promise<Job | null> {
    return await judgingQueue.getJob(jobId);
}

async function cleanup(): Promise<void> {
    await stopQueueProcessing();
    await judgingQueue.close();
    await queueEvents.close();
    console.log('Queue service cleanup completed');
}

/**
 * Clear completed jobs
 */
export async function clearCompletedJobs(): Promise<void> {
    await judgingQueue.clean(0, 1000, 'completed');
    console.log('Completed jobs cleared');
}

/**
 * Clear failed jobs
 */
export async function clearFailedJobs(): Promise<void> {
    await judgingQueue.clean(0, 1000, 'failed');
    console.log('Failed jobs cleared');
}

/**
 * Get specific project details
 */
export async function getProjectDetails(jobId: string): Promise<QueueProject | null> {
    try {
        const job = await judgingQueue.getJob(jobId);
        if (!job) return null;

        const progress = activeJobProgress.get(jobId) || job.progress || 0;
        let status: QueueProject['status'] = 'waiting';

        if (job.isCompleted()) status = 'completed';
        else if (job.isFailed()) status = 'failed';
        else if (job.isActive()) status = 'active';

        return {
            jobId: job.id!,
            projectId: job.data.project.id,
            projectName: job.data.project.name,
            challengeName: job.data.project.challengeName,
            status,
            progress,
            createdAt: new Date(job.timestamp).toISOString(),
            startedAt: job.processedOn ? new Date(job.processedOn).toISOString() : undefined,
            completedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : undefined,
            error: job.failedReason,
            result: job.returnvalue,
            retryCount: job.attemptsMade,
        };
    } catch (error) {
        console.error(`Error getting project details for job ${jobId}:`, error);
        return null;
    }
}

/**
 * Stop the judging processor
 */
export async function stopJudgingProcessor(): Promise<void> {
    if (worker) {
        await worker.close();
        worker = null;
        activeJobProgress.clear();
        console.log('Judging processor stopped');
    }
}

// Set up periodic queue monitoring
setInterval(checkAndRefillQueue, 30000);

export {
    addProjectsBatch,
    addProjectToQueue,
    cleanup,
    clearQueue,
    getAllQueueProjects,
    getJob,
    getQueueLength,
    getQueueStats,
    pauseQueue,
    removeJob,
    resumeQueue,
    retryFailedJob,
    setBatchRefillCallback,
    setConcurrency,
    startQueueProcessing,
    updateJobProgress,
};
