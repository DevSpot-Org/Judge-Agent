import path from 'path';
import { EmptyFileError, FileNotFoundError, InvalidJsonError, isProjectTemplateError, isTemplateValidationError, ProjectTemplateError, TemplateValidationError } from '../../core/errors';
import type { Project } from '../../types/entities';

export interface ProjectTeamTemplate {
    name: string;
    email: string;
}

interface ProjectTemplate {
    name?: string;
    tagline?: string;
    description?: string;
    team?: ProjectTeamTemplate[];
    video_url?: string;
    technologies?: string[];
    demo_url?: string;
}

type ParsedProject = Partial<Project>;

const retrieveProjectTemplate = async (repoUrl: string, repoPath: string): Promise<ProjectTemplate> => {
    try {
        const fileName = 'project.json';

        const filePath = path.join(repoPath, fileName);

        const fileExists = await Bun.file(filePath).exists();
        if (!fileExists) {
            throw new FileNotFoundError(fileName, repoUrl);
        }

        const fileContent = await Bun.file(filePath).text();
        if (!fileContent.trim()) {
            throw new EmptyFileError(fileName, repoUrl);
        }

        try {
            const template = JSON.parse(fileContent) as ProjectTemplate;
            return template;
        } catch (jsonError) {
            const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
            throw new InvalidJsonError(fileName, repoUrl, errorMessage);
        }
    } catch (error) {
        if (isProjectTemplateError(error)) {
            throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new ProjectTemplateError(`Unexpected error while reading file: ${errorMessage}`, 'FILE_SYSTEM_ERROR');
    }
};

const parseProjectTemplate = async (template: ProjectTemplate): Promise<ParsedProject> => {
    if (!template.name || template.name.trim() === '') {
        throw new TemplateValidationError('Project name is required but missing or empty', 'name');
    }

    if (!template.description || template.description.trim() === '') {
        throw new TemplateValidationError('Project description is required but missing or empty', 'description');
    }

    try {
        const parsedProject: ParsedProject = {
            name: template.name.trim(),
            description: template.description.trim(),
        };

        if (template.demo_url && template.demo_url.trim() !== '') {
            parsedProject.demo_url = template.demo_url.trim();
        }

        if (template.tagline && template.tagline.trim() !== '') {
            parsedProject.tagline = template.tagline.trim();
        }

        if (template.technologies && Array.isArray(template.technologies) && template.technologies.length > 0) {
            const cleanTechnologies = template.technologies.filter(tech => tech && tech.trim() !== '').map(tech => tech.trim());

            if (cleanTechnologies.length > 0) {
                parsedProject.technologies = cleanTechnologies;
            }
        }

        if (template.video_url && template.video_url.trim() !== '') {
            parsedProject.video_url = template.video_url.trim();
        }

        return parsedProject;
    } catch (error) {
        if (isTemplateValidationError(error)) {
            throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new ProjectTemplateError(`Unexpected error during template parsing: ${errorMessage}`, 'PARSING_ERROR');
    }
};

export { parseProjectTemplate, retrieveProjectTemplate };
