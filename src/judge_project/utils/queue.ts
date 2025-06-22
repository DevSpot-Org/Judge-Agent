import { Job, Queue, QueueEvents, Worker } from 'bullmq';
import { cacheCreds } from '../../core/cache';
import type { Project } from '../../types/entities';

export interface QueueProgress {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    total: number;
}

const projectQueue = new Queue('project-judging', {
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

async function addProjectToQueue(project: Project): Promise<string> {
    try {
        const job = await projectQueue.add('judge-project', { project });

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
            data: { project },
        }));

        const addedJobs = await projectQueue.addBulk(jobs);
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
        const waiting = await projectQueue.getWaiting();
        const active = await projectQueue.getActive();
        return waiting.length + active.length;
    } catch (error) {
        console.error('Error getting queue length:', error);
        return 0;
    }
}

async function checkAndRefillQueue(): Promise<void> {
    if (!batchRefillCallback) return;

    try {
        const waiting = await projectQueue.getWaiting();
        const active = await projectQueue.getActive();
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

async function getQueueProgress(): Promise<QueueProgress> {
    try {
        const waiting = await projectQueue.getWaiting();
        const active = await projectQueue.getActive();
        const completed = await projectQueue.getCompleted();
        const failed = await projectQueue.getFailed();

        const progress: QueueProgress = {
            waiting: waiting.length,
            active: active.length,
            completed: completed.length,
            failed: failed.length,
            total: waiting.length + active.length + completed.length + failed.length,
        };

        return progress;
    } catch (error) {
        console.error('Error getting queue progress:', error);
        throw error;
    }
}

async function getQueueStats() {
    try {
        const counts = await projectQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused');

        return {
            ...counts,
            concurrency: currentConcurrency,
            isRunning: worker !== null,
        };
    } catch (error) {
        console.error('Error getting queue stats:', error);
        throw error;
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

async function startQueueProcessing(processorFn?: (project: Project) => Promise<any>): Promise<void> {
    if (worker) {
        console.log('Queue processing is already running');
        return;
    }

    await checkAndRefillQueue();

    const defaultProcessor = async (job: Job) => {
        const { project } = job.data;
        console.log(`Processing project: ${project.id}`);

        // Default processing logic - replace with actual implementation
        await new Promise(resolve => setTimeout(resolve, 1000));

        return { projectId: project.id, status: 'completed' };
    };

    const processor = processorFn ? async (job: Job) => await processorFn(job.data.project) : defaultProcessor;

    worker = new Worker('project-judging', processor, {
        connection: cacheCreds,
        concurrency: currentConcurrency,
        lockDuration: 180000,
    });

    // Set up event listeners
    worker.on('completed', async (job: Job) => {
        console.log(`Job ${job.id} completed for project ${job.data.project.id}`);
        await checkAndRefillQueue();
    });

    worker.on('failed', (job: Job | undefined, err: Error) => {
        console.error(`Job ${job?.id} failed:`, err.message);
    });

    worker.on('error', (err: Error) => {
        console.error('Worker error:', err);
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
    await projectQueue.pause();
    console.log('Queue paused');
}

async function resumeQueue(): Promise<void> {
    await projectQueue.resume();
    console.log('Queue resumed');
}

async function clearQueue(): Promise<void> {
    await projectQueue.obliterate({ force: true });
    console.log('Queue cleared');
}

async function getJob(jobId: string): Promise<Job | null> {
    return await projectQueue.getJob(jobId);
}

async function removeJob(jobId: string): Promise<void> {
    const job = await projectQueue.getJob(jobId);
    if (job) {
        await job.remove();
        console.log(`Job ${jobId} removed`);
    }
}

async function cleanup(): Promise<void> {
    await stopQueueProcessing();
    await projectQueue.close();
    await queueEvents.close();
    console.log('Queue service cleanup completed');
}

// Set up periodic queue monitoring
setInterval(checkAndRefillQueue, 30000);

export {
    addProjectsBatch,
    addProjectToQueue,
    cleanup,
    clearQueue,
    getJob,
    getQueueLength,
    getQueueProgress,
    getQueueStats,
    pauseQueue,
    removeJob,
    resumeQueue,
    setBatchRefillCallback,
    setConcurrency,
    startQueueProcessing,
};
