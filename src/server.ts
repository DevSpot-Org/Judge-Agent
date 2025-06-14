import cors from 'cors';
import type { Request, Response } from 'express';
import express from 'express';
import { createServer } from 'http';
import JudgeBot from './agents';
import { SocketService } from './core/socketio';
import create_project from './create_project';
import { pullSingleFileWithGit } from './utils/codeRetrieval';

const PORT = process.env['PORT'] || 3002;
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));

const server = createServer(app);

export const socketService = new SocketService(server);

app.get('/self', (_, res) => {
    console.log('Self route called');
    res.send('Self call succeeded!');
    return;
});

app.post('/judge/:project_id', async (req: Request, res: Response) => {
    const projectIdString = req.params['project_id'];

    if (!projectIdString) {
        res.status(400).send({ error: 'Project ID is required' });
    }

    const projectId = parseInt(projectIdString, 10);
    if (isNaN(projectId)) {
        res.status(400).send({ error: 'Project ID must be a number' });
    }

    try {
        const judgeBot = new JudgeBot();

        await judgeBot.judge_project(projectId);

        res.status(200).send({
            message: `Judging process started for project ID: ${projectId}`,
        });

        return;
    } catch (error) {
        console.error(`Error judging project ID ${projectId}:`, error);

        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

        res.status(500).send({ error: `Failed to judge project: ${errorMessage}` });
    }

    return;
});

app.post('/test', async (req: Request, res: Response) => {
    const projectUrlString = req.query['project_url'] as string;
    console.log(projectUrlString);

    if (!projectUrlString) {
        res.status(400).send({ error: 'Project ID is required' });
        return;
    }

    try {
        pullSingleFileWithGit(projectUrlString);

        // const resss = await repomix.getAllRepoFiles(projectUrlString, {
        //     include: ['project.json'],
        // });

        // console.log(resss);

        res.status(200).send({
            message: `Judging process started for `,
        });

        return;
    } catch (error) {
        console.error(`Error judging project ID:`, error);

        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

        res.status(500).send({ error: `Failed to judge project: ${errorMessage}` });
    }

    return;
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

// new Worker('project-analysis', processProjectAnalysis, {
//     connection: cacheCreds,
//     concurrency: 2,
// });

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);

    setInterval(async () => {
        try {
            console.log('Calling /self endpoint...');
            fetch(`${process.env['ORIGIN_URL']}/self`);
        } catch (error: any) {
            console.error('Self call failed:', error.message);
        }
    }, 14 * 60 * 1000);
});

export default app;
