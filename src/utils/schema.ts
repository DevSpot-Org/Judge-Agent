import { z } from 'zod';
import { isGithubRepo, repoContainsCode, repositoryExists } from './repos';

const ProjectChallengeSchema = z.object({
    challenge_id: z.number().int().describe('ID of the challenge'),
    hackathon_challenges: z.any().describe('Details of the hackathon challenge(s)'),
});

export const SubmissionSchema = z.object({
    id: z.number().int().describe('Unique identifier for this project'),
    hackathon_id: z.number().int().describe('ID of the hackathon this project belongs to'),
    name: z.string().min(1).describe('Name of the project'),
    description: z.string().default('').describe('Full description of the project'),
    tagline: z.string().default('').describe('Short tagline for the project'),
    submitted: z.boolean().describe('Whether the project has been submitted'),
    project_url: z
        .string()
        .url()
        .refine(isGithubRepo, {
            message: 'Source code URL must be a GitHub repository, not an organization',
        })
        .refine(repositoryExists, {
            message: 'GitHub repository must be accessible and public',
        })
        .refine(repoContainsCode, {
            message: 'Github repo is empty or contains no branch',
        }),
    project_challenges: z.array(ProjectChallengeSchema).min(1, { message: 'Must have at least one challenges' }).describe('List of associated project challenges; at least one required'),
});

export type Submission = z.infer<typeof SubmissionSchema>;

export type SubmissionCheckpoint = {
    validSubmissions: Submission[];
    invalidSubmissions: { data: any; formattedErrors: string[] }[];
};
