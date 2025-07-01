import type { Hackathon, Project } from '../../../types/entities';
import { getRepoAgeAndCommits } from '../../../utils/repos';
import { detectIrregularities, generateIrregularitySummary } from './detectCodeIrregularities';

export interface ProjectAnalysisResult {
    project_code_type: 'fresh_code' | 'existing_code';
    flagged: {
        value: boolean;
        reason: string | null;
    };
}

export const analyzeProjectForIrregularities = async (project: Project, hackathon: Hackathon): Promise<ProjectAnalysisResult> => {
    const { repoAge, commits } = await getRepoAgeAndCommits(project?.project_url ?? '');

    const isExistingCode = new Date(repoAge.firstCommitDate) < new Date(hackathon?.start_date);
    const project_code_type = isExistingCode ? 'existing_code' : 'fresh_code';

    const irregularity_flags = detectIrregularities(commits, hackathon?.end_date);

    if (project?.project_code_type === 'fresh_code' && isExistingCode) {
        irregularity_flags.push({
            type: 'suspicious_timing',
            severity: 'high',
            description: 'Project claimed as fresh code but repository contains commits before hackathon start date',
            metadata: {
                firstCommitDate: repoAge.firstCommitDate,
                hackathonStartDate: hackathon?.start_date,
            },
        });
    }

    const irregularity_summary = generateIrregularitySummary(irregularity_flags);

    return {
        project_code_type,
        flagged: {
            value: Boolean(irregularity_summary),
            reason: irregularity_summary,
        },
    };
};
