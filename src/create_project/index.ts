import create_ai_generated_project from './ai_generated';
import create_template_based_project from './template_based';

interface CreateProjectOptions {
    project_url: string;
    creator_id: string;
    use_project_template?: boolean;
}

const create_project = async (options: CreateProjectOptions) => {
    const { creator_id, project_url, use_project_template } = options;

    const HACKATHON_ID = 1;

    const creationOptions = {
        project_url,
        creator_id,
        hackathon_id: HACKATHON_ID,
    };

    if (use_project_template) {
        return await create_template_based_project(creationOptions);
    }

    return await create_ai_generated_project(creationOptions);
};

export default create_project;
