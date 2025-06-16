import { $ } from 'bun';
import { TEMPORARY_FOLDER } from '../constants';

export const isGithubRepo = (url: string) => {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.includes('github.com')) return false;

    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);

    // need url to be owner/repo => ['owner', 'repo']
    return pathSegments.length === 2;
};

export const repositoryExists = async (repoUrl: string) => {
    const request = await fetch(repoUrl);
    return request.status === 200;
};

export const repoContainsCode = async (repoUrl: string) => {
    const { stdout } = await $`git ls-remote --heads ${repoUrl}`.nothrow().quiet();
    
    // checks the latest refs of a repo. Empty repos will have no stdout
    return stdout.length > 0;
};

export const getRepoName = (url: string) => {
    const parsedUrl = new URL(url);
    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
    return pathSegments[pathSegments.length - 1];
};

export const folderExists = async (path: string) => {
    return !!Array.from(new Bun.Glob(path).scanSync({ onlyFiles: false }))[0];
};

export interface FirstCommitResult {
    timestamp: string;
    hash: string;
    message: string;
    author: string;
    date: Date;
}

export interface FirstCommitOptions {
    format?: 'iso' | 'unix' | 'human' | 'relative';
    includeDetails?: boolean;
    cleanup?: boolean;
}

export const getFirstCommitTime = async (repoUrl: string, options: FirstCommitOptions = {}): Promise<string | FirstCommitResult> => {
    const { format = 'iso', includeDetails = false, cleanup = true } = options;

    const repoUrlWithoutGit = repoUrl.endsWith('.git') ? repoUrl.slice(0, -4) : repoUrl;
    const repoName = getRepoName(repoUrlWithoutGit);
    const repoPath = `${TEMPORARY_FOLDER}/${repoName}-first-commit`;

    try {
        console.log(`Cloning ${repoUrl} to get first commit time...`);

        // Clone the repository with minimal data
        await $`git clone --depth=1 ${repoUrlWithoutGit}.git ${repoPath}`;

        // Get the full history for the current branch
        await $`git -C ${repoPath} fetch --unshallow`;

        if (includeDetails) {
            // Get detailed first commit information
            const result = await $`git -C ${repoPath} log --reverse --format="%H|%ai|%an|%s" | head -1`;
            const [hash, timestamp, author, message] = result.stdout.toString().trim().split('|');

            return {
                timestamp,
                hash,
                message,
                author,
                date: new Date(timestamp),
            };
        } else {
            // Get just the timestamp in requested format
            let formatString: string;
            switch (format) {
                case 'unix':
                    formatString = '%at';
                    break;
                case 'human':
                    formatString = '%ad';
                    break;
                case 'relative':
                    formatString = '%ar';
                    break;
                case 'iso':
                default:
                    formatString = '%ai';
                    break;
            }

            const dateFlag = format === 'human' ? '--date=human' : '';
            const result = await $`git -C ${repoPath} log --reverse --format="${formatString}" ${dateFlag} | head -1`;
            return result.stdout.toString().trim();
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (errorMessage.includes('repository not found') || errorMessage.includes('404')) {
            throw new Error(`Repository not found: ${repoUrl}`);
        }

        if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
            throw new Error(`Network error accessing repository: ${repoUrl}`);
        }

        if (errorMessage.includes('shallow')) {
            throw new Error(`Unable to get full history from repository: ${repoUrl}`);
        }

        throw new Error(`Failed to get first commit time from ${repoUrl}: ${errorMessage}`);
    } finally {
        if (cleanup) {
            try {
                await $`rm -rf ${repoPath}`;
                console.log(`Cleaned up temporary directory: ${repoPath}`);
            } catch (cleanupError) {
                console.warn(`Failed to cleanup directory ${repoPath}:`, cleanupError);
            }
        }
    }
};

export const getRepoAgeAndCommitDate = async (repoUrl: string) => {
    const firstCommitTime = (await getFirstCommitTime(repoUrl, { format: 'unix' })) as string;
    const firstCommitTimestamp = parseInt(firstCommitTime) * 1000; // Convert to milliseconds
    const firstCommitDate = new Date(firstCommitTimestamp);
    const now = Date.now();
    const ageInDays = Math.floor((now - firstCommitTimestamp) / (1000 * 60 * 60 * 24));

    return {
        firstCommitDate,
        codebaseAge: ageInDays,
    };
};
