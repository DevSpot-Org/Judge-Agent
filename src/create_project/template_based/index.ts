import fs from 'fs';
import { fetchHackathonFromDB } from '../../agents/devspot';
import type { Project } from '../../types/entities';
import { pullSingleFileWithGit } from '../../utils/codeRetrieval';
import { getRepoAgeAndCommitDate } from '../../utils/repos';
import { createProjectInDB } from '../utils/createProject';
import { parseProjectTemplate, retrieveProjectTemplate } from './parseProjectTemplate';

interface CreateTemplateProjectOptions {
    project_url: string;
    creator_id: string;
    hackathon_id: number;
}

const create_template_based_project = async (options: CreateTemplateProjectOptions): Promise<Project> => {
    const { creator_id, hackathon_id, project_url } = options;

    const repoPath = await pullSingleFileWithGit(project_url);

    const projectTemplate = await retrieveProjectTemplate(project_url, repoPath);

    const parsedProjectTemplate = await parseProjectTemplate(projectTemplate);

    parsedProjectTemplate.project_url = project_url;

    const hackathon = await fetchHackathonFromDB(hackathon_id);

    if (hackathon?.start_date) {
        const repoAge = await getRepoAgeAndCommitDate(project_url);

        const isExistingCode = new Date(repoAge.firstCommitDate) < new Date(hackathon?.start_date);

        parsedProjectTemplate.project_code_type = isExistingCode ? 'existing_code' : 'fresh_code';
    }

    const createdProject = await createProjectInDB({
        creator_id,
        hackathon: { id: hackathon?.id!, name: hackathon?.name! },
        payload: parsedProjectTemplate,
        use_project_template: true,
    });

    try {
        if (fs.existsSync(repoPath)) {
            fs.rmSync(repoPath, { recursive: true, force: true });
        }
    } catch (error) {
        console.warn(`Failed to cleanup directory ${repoPath}:`);
    }

    return createdProject;
};

export default create_template_based_project;
