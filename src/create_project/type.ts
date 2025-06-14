import type { Project } from '../types/entities';

interface ProjectAnalysis {
    challengeIds: number[];
    technologies: string[];
    description: string;
    name: string;
    tagline: string;
}

interface CreateProjectPayload extends Partial<Project> {
    challengeIds?: number[];
}

export type { CreateProjectPayload, ProjectAnalysis };
