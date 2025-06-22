import cors from 'cors';
import type { Request, Response } from 'express';
import express from 'express';
import create_project from './create_project';
import { addProject, startApp } from './main';

const PORT = process.env['PORT'] || 3002;
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));

startApp();

app.get('/judge/:project_id', async (req: Request, res: Response) => {
    try {
        const projectIdString = req.params['project_id'];

        if (!projectIdString) {
            res.status(400).json({ error: 'Project ID is required' });
            return;
        }

        const projectId = parseInt(projectIdString, 10);

        if (isNaN(projectId)) {
            res.status(400).json({ error: 'Project ID must be a number' });
            return;
        }

        await addProject(projectId);

        res.status(200).json({
            message: `Judging process started for project ID: ${projectId}`,
        });
        return;
    } catch (error) {
        console.error('Error processing judge request:', error);
        res.status(500).json({
            error: 'Internal server error occurred while processing the judge request',
        });
        return;
    }
});

app.post('/project/generate', async (req: Request, res: Response) => {
    const project_url = req.query['project_url'] as string;
    const creator_id = req.query['user_id'] as string;

    if (!project_url) {
        res.status(400).send({ error: 'Project URL is required' });
        return;
    }

    if (!creator_id) {
        res.status(400).send({ error: 'User ID is required' });
        return;
    }

    try {
        const project = await create_project({
            creator_id,
            project_url,
            use_project_template: true,
        });

        res.status(200).send({ data: project });

        return;
    } catch (error) {
        console.error(`Error Generating Project Information for ${project_url}:`, error);

        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

        res.status(500).send({ error: `Failed to generate project: ${errorMessage}` });
    }
    return;
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
