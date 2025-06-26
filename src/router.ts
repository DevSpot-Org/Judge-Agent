import express from 'express';
import {
    clearCompletedJobs,
    clearFailedJobs,
    clearAllJobs,
    getAllQueueProjects,
    getProjectDetails,
    getQueueStats,
    pauseQueue,
    removeJob,
    resumeQueue,
    retryFailedJob,
    setConcurrency,
} from './judge_project/utils/queue';

const router = express.Router();

/**
 * GET /api/queue/stats
 * Get overall queue statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await getQueueStats();
        res.json(stats);
    } catch (error) {
        console.error('Error getting queue stats:', error);
        res.status(500).json({ error: 'Failed to get queue statistics' });
    }
});

/**
 * GET /api/queue/projects
 * Get all projects in the queue with their status
 * Query params:
 * - status: filter by status (waiting, active, completed, failed)
 * - limit: limit number of results
 * - offset: pagination offset
 */
router.get('/projects', async (req, res) => {
    try {
        const { status, limit, offset } = req.query;

        let projects = await getAllQueueProjects();

        // Filter by status if provided
        if (status && typeof status === 'string') {
            projects = projects.filter(p => p.status === status);
        }

        // Apply pagination if provided
        const limitNum = limit ? parseInt(limit as string) : undefined;
        const offsetNum = offset ? parseInt(offset as string) : 0;

        if (limitNum) {
            projects = projects.slice(offsetNum, offsetNum + limitNum);
        }

        res.json({
            projects,
            total: projects.length,
            hasMore: limitNum ? projects.length === limitNum : false,
        });
    } catch (error) {
        console.error('Error getting queue projects:', error);
        res.status(500).json({ error: 'Failed to get queue projects' });
    }
});

/**
 * GET /api/queue/projects/:jobId
 * Get specific project details
 */
router.get('/projects/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const project = await getProjectDetails(jobId);

        if (!project) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }

        res.json(project);
        return;
    } catch (error) {
        console.error('Error getting project details:', error);
        res.status(500).json({ error: 'Failed to get project details' });
    }
});

/**
 * POST /api/queue/retry/:jobId
 * Retry a failed project
 */
router.post('/retry/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        await retryFailedJob(jobId);
        res.json({ message: 'Job queued for retry successfully' });
    } catch (error) {
        console.error('Error retrying job:', error);
        res.status(500).json({ error: 'Failed to retry job' });
    }
});

/**
 * DELETE /api/queue/projects/:jobId
 * Remove a project from the queue
 */
router.delete('/projects/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        await removeJob(jobId);
        res.json({ message: 'Job removed from queue successfully' });
    } catch (error) {
        console.error('Error removing job:', error);
        res.status(500).json({ error: 'Failed to remove job' });
    }
});

/**
 * PUT /api/queue/concurrency
 * Update queue concurrency level
 */
router.put('/concurrency', async (req, res) => {
    try {
        const { concurrency } = req.body;

        if (!concurrency || typeof concurrency !== 'number' || concurrency < 1) {
            res.status(400).json({
                error: 'Invalid concurrency value. Must be a number >= 1',
            });
            return;
        }

        await setConcurrency(concurrency);
        res.json({
            message: 'Concurrency updated successfully',
            concurrency,
        });
        return;
    } catch (error) {
        console.error('Error updating concurrency:', error);
        res.status(500).json({ error: 'Failed to update concurrency' });
    }
});

/**
 * POST /api/queue/pause
 * Pause the queue
 */
router.post('/pause', async (req, res) => {
    try {
        await pauseQueue();
        res.json({ message: 'Queue paused successfully' });
    } catch (error) {
        console.error('Error pausing queue:', error);
        res.status(500).json({ error: 'Failed to pause queue' });
    }
});

/**
 * POST /api/queue/resume
 * Resume the queue
 */
router.post('/resume', async (req, res) => {
    try {
        await resumeQueue();
        res.json({ message: 'Queue resumed successfully' });
    } catch (error) {
        console.error('Error resuming queue:', error);
        res.status(500).json({ error: 'Failed to resume queue' });
    }
});

/**
 * DELETE /api/queue/completed
 * Clear all completed jobs
 */
router.delete('/completed', async (req, res) => {
    try {
        await clearCompletedJobs();
        res.json({ message: 'Completed jobs cleared successfully' });
    } catch (error) {
        console.error('Error clearing completed jobs:', error);
        res.status(500).json({ error: 'Failed to clear completed jobs' });
    }
});

router.delete('/all', async (req, res) => {
    try {
        await clearAllJobs();
        res.json({ message: 'Jobs cleared successfully' });
    } catch (error) {
        console.error('Error clearing all jobs:', error);
        res.status(500).json({ error: 'Failed to clear all jobs' });
    }
});

/**
 * DELETE /api/queue/failed
 * Clear all failed jobs
 */
router.delete('/failed', async (req, res) => {
    try {
        await clearFailedJobs();
        res.json({ message: 'Failed jobs cleared successfully' });
    } catch (error) {
        console.error('Error clearing failed jobs:', error);
        res.status(500).json({ error: 'Failed to clear failed jobs' });
    }
});

/**
 * POST /api/queue/bulk-retry
 * Retry all failed jobs
 */
router.post('/bulk-retry', async (req, res) => {
    try {
        const projects = await getAllQueueProjects();
        const failedProjects = projects.filter(p => p.status === 'failed');

        const retryPromises = failedProjects.map(p => retryFailedJob(p.jobId));
        await Promise.all(retryPromises);

        res.json({
            message: `${failedProjects.length} failed jobs queued for retry`,
            retriedCount: failedProjects.length,
        });
    } catch (error) {
        console.error('Error bulk retrying jobs:', error);
        res.status(500).json({ error: 'Failed to retry failed jobs' });
    }
});

/**
 * WebSocket endpoint for real-time updates
 * This would typically be implemented with socket.io
 */
export function setupWebSocketUpdates(io: any) {
    // Emit queue stats every 5 seconds
    setInterval(async () => {
        try {
            const stats = await getQueueStats();
            io.emit('queue:stats', stats);
        } catch (error) {
            console.error('Error emitting queue stats:', error);
        }
    }, 5000);

    // Emit project updates every 3 seconds
    setInterval(async () => {
        try {
            const projects = await getAllQueueProjects();
            io.emit('queue:projects', projects);
        } catch (error) {
            console.error('Error emitting project updates:', error);
        }
    }, 3000);
}

/**
 * Middleware for error handling
 */
router.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Queue API Error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
});

export default router;
