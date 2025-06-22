import fs from 'fs';
import { fetchHackathonFromDB } from '../../core/devspot';
import type { Project } from '../../types/entities';
import { repomixBundler } from '../../utils/codeRetrieval';
import { createProjectInDB } from '../utils/createProject';
import { generateProjectInfo } from './submit/agent';

interface CreateAiProjectOptions {
    project_url: string;
    creator_id: string;
    hackathon_id: number;
}
const create_ai_generated_project = async (options: CreateAiProjectOptions): Promise<Project> => {
    const { creator_id, hackathon_id, project_url } = options;

    const outputPath = await repomixBundler(project_url ?? '');

    const projectInfo = await generateProjectInfo(project_url);

    const hackathon = await fetchHackathonFromDB(hackathon_id);

    const createdProject = await createProjectInDB({
        creator_id,
        hackathon: { id: hackathon?.id!, name: hackathon?.name! },
        use_project_template: false,
        payload: {
            ...projectInfo,
            project_url: project_url,
        },
    });

    try {
        if (fs.existsSync(outputPath)) {
            fs.rmSync(outputPath, { recursive: true, force: true });
        }
    } catch (error) {
        console.error(`Error cleaning up repository files:`, error);
    }

    return createdProject;
};

export default create_ai_generated_project;
