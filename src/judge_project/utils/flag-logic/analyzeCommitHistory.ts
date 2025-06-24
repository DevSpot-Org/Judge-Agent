import { $ } from 'bun';
import { TEMPORARY_FOLDER } from '../../../constants';
import { getRepoName } from '../../../utils/repos';
import { isCodeFile } from './isCodeFile';

export interface CommitAnalysis {
    hash: string;
    timestamp: string;
    author: string;
    message: string;
    date: Date;
    linesAdded: number;
    linesDeleted: number;
    filesChanged: number;
    isCodeCommit: boolean;
}

export const analyzeCommitHistory = async (repoUrl: string): Promise<CommitAnalysis[]> => {
    const repoUrlWithoutGit = repoUrl.endsWith('.git') ? repoUrl.slice(0, -4) : repoUrl;
    const repoName = getRepoName(repoUrlWithoutGit);
    const repoPath = `${TEMPORARY_FOLDER}/flagging/${repoName}-analysis`;

    try {
        console.log(`Analyzing commit history for ${repoUrl}...`);

        // Clone the repository
        await $`git clone ${repoUrlWithoutGit}.git ${repoPath}`;

        // Get all commits with detailed information
        const result = await $`git -C ${repoPath} log --all --format="%H|%ai|%an|%s" --numstat`;
        const output = result.stdout.toString().trim();

        const commits: CommitAnalysis[] = [];
        const lines = output.split('\n');
        let currentCommit: Partial<CommitAnalysis> | null = null;

        for (const line of lines) {
            if (line.includes('|') && line.split('|').length === 4) {
                // New commit line
                if (currentCommit) {
                    commits.push(currentCommit as CommitAnalysis);
                }

                const [hash, timestamp, author, message] = line.split('|');
                currentCommit = {
                    hash,
                    timestamp,
                    author,
                    message,
                    date: new Date(timestamp),
                    linesAdded: 0,
                    linesDeleted: 0,
                    filesChanged: 0,
                    isCodeCommit: false,
                };
            } else if (line.trim() && currentCommit) {
                // File change line (added    deleted    filename)
                const parts = line.trim().split('\t');
                if (parts.length >= 3) {
                    const added = parts[0] === '-' ? 0 : parseInt(parts[0]) || 0;
                    const deleted = parts[1] === '-' ? 0 : parseInt(parts[1]) || 0;
                    const filename = parts[2];

                    currentCommit.linesAdded! += added;
                    currentCommit.linesDeleted! += deleted;
                    currentCommit.filesChanged!++;

                    // Check if this is a code file (not just README, docs, etc.)
                    if (isCodeFile(filename)) {
                        currentCommit.isCodeCommit = true;
                    }
                }
            }
        }

        // Add the last commit
        if (currentCommit) {
            commits.push(currentCommit as CommitAnalysis);
        }

        return commits.reverse();
    } catch (error) {
        console.error(`Failed to analyze commit history for ${repoUrl}:`, error);
        throw error;
    } finally {
        try {
            await $`rm -rf ${repoPath}`;
        } catch (cleanupError) {
            console.warn(`Failed to cleanup directory ${repoPath}:`, cleanupError);
        }
    }
};
