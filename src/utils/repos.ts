import { $ } from 'bun';
import { TEMPORARY_FOLDER } from '../constants';
import { isCodeFile } from '../judge_project/utils/flag-logic/isCodeFile';

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

// export interface FirstCommitResult {
//     timestamp: string;
//     hash: string;
//     message: string;
//     author: string;
//     date: Date;
// }

// export interface FirstCommitOptions {
//     format?: 'iso' | 'unix' | 'human' | 'relative';
//     includeDetails?: boolean;
//     cleanup?: boolean;
// }

// export const getFirstCommitTime = async (repoUrl: string, options: FirstCommitOptions = {}): Promise<string | FirstCommitResult> => {
//     const { format = 'iso', includeDetails = false, cleanup = true } = options;

//     const repoUrlWithoutGit = repoUrl.endsWith('.git') ? repoUrl.slice(0, -4) : repoUrl;
//     const repoName = getRepoName(repoUrlWithoutGit);
//     const repoPath = `${TEMPORARY_FOLDER}/${repoName}-first-commit`;

//     try {
//         console.log(`Cloning ${repoUrl} to get first commit time...`);

//         // Clone the repository with minimal data
//         await $`git clone --depth=1 ${repoUrlWithoutGit}.git ${repoPath}`;

//         // Get the full history for the current branch
//         await $`git -C ${repoPath} fetch --unshallow`;

//         if (includeDetails) {
//             // Get detailed first commit information
//             const result = await $`git -C ${repoPath} log --reverse --format="%H|%ai|%an|%s" | head -1`;
//             const [hash, timestamp, author, message] = result.stdout.toString().trim().split('|');

//             return {
//                 timestamp,
//                 hash,
//                 message,
//                 author,
//                 date: new Date(timestamp),
//             };
//         } else {
//             // Get just the timestamp in requested format
//             let formatString: string;
//             switch (format) {
//                 case 'unix':
//                     formatString = '%at';
//                     break;
//                 case 'human':
//                     formatString = '%ad';
//                     break;
//                 case 'relative':
//                     formatString = '%ar';
//                     break;
//                 case 'iso':
//                 default:
//                     formatString = '%ai';
//                     break;
//             }

//             const dateFlag = format === 'human' ? '--date=human' : '';
//             const result = await $`git -C ${repoPath} log --reverse --format="${formatString}" ${dateFlag} | head -1`;
//             return result.stdout.toString().trim();
//         }
//     } catch (error) {
//         const errorMessage = error instanceof Error ? error.message : String(error);

//         if (errorMessage.includes('repository not found') || errorMessage.includes('404')) {
//             throw new Error(`Repository not found: ${repoUrl}`);
//         }

//         if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
//             throw new Error(`Network error accessing repository: ${repoUrl}`);
//         }

//         if (errorMessage.includes('shallow')) {
//             throw new Error(`Unable to get full history from repository: ${repoUrl}`);
//         }

//         throw new Error(`Failed to get first commit time from ${repoUrl}: ${errorMessage}`);
//     } finally {
//         if (cleanup) {
//             try {
//                 await $`rm -rf ${repoPath}`;
//                 console.log(`Cleaned up temporary directory: ${repoPath}`);
//             } catch (cleanupError) {
//                 console.warn(`Failed to cleanup directory ${repoPath}:`, cleanupError);
//             }
//         }
//     }
// };

// export const getRepoAgeAndCommitDate = async (repoUrl: string) => {
//     const firstCommitTime = (await getFirstCommitTime(repoUrl, { format: 'unix' })) as string;
//     const firstCommitTimestamp = parseInt(firstCommitTime) * 1000; // Convert to milliseconds
//     const firstCommitDate = new Date(firstCommitTimestamp);
//     const now = Date.now();
//     const ageInDays = Math.floor((now - firstCommitTimestamp) / (1000 * 60 * 60 * 24));

//     return {
//         firstCommitDate,
//         codebaseAge: ageInDays,
//     };
// };








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

export interface FirstCommitResult {
    timestamp: string;
    hash: string;
    message: string;
    author: string;
    date: Date;
}

export interface RepoAnalysisOptions {
    includeCommitHistory?: boolean;
    includeFirstCommit?: boolean;
    includeRepoAge?: boolean;

    // First commit format options
    firstCommitFormat?: 'iso' | 'unix' | 'human' | 'relative';
    firstCommitDetails?: boolean;

    cleanup?: boolean;
}

export interface RepoAnalysisResult {
    firstCommit?: FirstCommitResult | string;
    commitHistory?: CommitAnalysis[];
    repoAge?: {
        firstCommitDate: Date;
        codebaseAge: number;
    };
}

export const analyzeRepository = async (repoUrl: string, options: RepoAnalysisOptions = {}): Promise<RepoAnalysisResult> => {
    const { includeCommitHistory = false, includeFirstCommit = false, includeRepoAge = false, firstCommitFormat = 'iso', firstCommitDetails = false, cleanup = true } = options;

    const repoUrlWithoutGit = repoUrl.endsWith('.git') ? repoUrl.slice(0, -4) : repoUrl;
    const repoName = getRepoName(repoUrlWithoutGit);
    const repoPath = `${TEMPORARY_FOLDER}/unified-analysis/${repoName}`;

    console.log({ repoUrlWithoutGit, repoPath });
    await $`rm -rf ${repoPath}`;
    await $`mkdir -p ${repoPath}`;

    try {
        console.log(`Analyzing repository ${repoUrl}...`);
        // await $`git config --global core.compression 0`;

        // Clone the repository
        await $`git clone --depth=1 ${repoUrlWithoutGit}.git ${repoPath}`;

        // If we need full history for commit analysis, fetch it
        if (includeCommitHistory) {
            try {
                await $`git -C ${repoPath} fetch --unshallow`;
            } catch (error) {
                // Already a full clone, continue
            }
        } else if (includeFirstCommit || includeRepoAge) {
            // Only fetch full history if we need first commit info
            try {
                await $`git -C ${repoPath} fetch --unshallow`;
            } catch (error) {
                // Already a full clone, continue
            }
        }

        const result: RepoAnalysisResult = {};

        // Get first commit information if requested
        if (includeFirstCommit || includeRepoAge) {
            if (firstCommitDetails && includeFirstCommit) {
                const commitResult = await $`git -C ${repoPath} log --reverse --format="%H|%ai|%an|%s" | head -1`;
                const [hash, timestamp, author, message] = commitResult.stdout.toString().trim().split('|');

                result.firstCommit = {
                    timestamp,
                    hash,
                    message,
                    author,
                    date: new Date(timestamp),
                };
            } else if (includeFirstCommit) {
                let formatString: string;
                switch (firstCommitFormat) {
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

                const dateFlag = firstCommitFormat === 'human' ? '--date=human' : '';
                const timestampResult = await $`git -C ${repoPath} log --reverse --format="${formatString}" ${dateFlag} | head -1`;
                result.firstCommit = timestampResult.stdout.toString().trim();
            }

            if (includeRepoAge) {
                const unixTimeResult = await $`git -C ${repoPath} log --reverse --format="%at" | sed -n '1p'`;
                const firstCommitTime = unixTimeResult.stdout.toString().trim();
                const firstCommitTimestamp = parseInt(firstCommitTime) * 1000;
                const firstCommitDate = new Date(firstCommitTimestamp);
                const now = Date.now();
                const ageInDays = Math.floor((now - firstCommitTimestamp) / (1000 * 60 * 60 * 24));

                result.repoAge = {
                    firstCommitDate,
                    codebaseAge: ageInDays,
                };
            }
        }

        // Get commit history if requested
        if (includeCommitHistory) {
            const commitResult = await $`git -C ${repoPath} log --all --format="%H|%ai|%an|%s" --numstat`;
            const output = commitResult.stdout.toString().trim();

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
                    // File change line
                    const parts = line.trim().split('\t');
                    if (parts.length >= 3) {
                        const added = parts[0] === '-' ? 0 : parseInt(parts[0]) || 0;
                        const deleted = parts[1] === '-' ? 0 : parseInt(parts[1]) || 0;
                        const filename = parts[2];

                        currentCommit.linesAdded! += added;
                        currentCommit.linesDeleted! += deleted;
                        currentCommit.filesChanged!++;

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

            result.commitHistory = commits.reverse();
        }

        return result;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (errorMessage.includes('repository not found') || errorMessage.includes('404')) {
            throw new Error(`Repository not found: ${repoUrl}`);
        }

        if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
            throw new Error(`Network error accessing repository: ${repoUrl}`);
        }
        console.log({ errorMessage });

        if (errorMessage.includes('shallow')) {
            throw new Error(`Unable to get full history from repository: ${repoUrl}`);
        }

        throw new Error(`Failed to analyze repository ${repoUrl}: ${errorMessage}`);
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

export const analyzeCommitHistory = async (repoUrl: string): Promise<CommitAnalysis[]> => {
    const result = await analyzeRepository(repoUrl, { includeCommitHistory: true });
    return result.commitHistory!;
};

export const getFirstCommitTime = async (
    repoUrl: string,
    options: { format?: 'iso' | 'unix' | 'human' | 'relative'; includeDetails?: boolean; cleanup?: boolean } = {}
): Promise<string | FirstCommitResult> => {
    const { format = 'iso', includeDetails = false, cleanup = true } = options;

    const result = await analyzeRepository(repoUrl, {
        includeFirstCommit: true,
        firstCommitFormat: format,
        firstCommitDetails: includeDetails,
        cleanup,
    });

    return result.firstCommit!;
};

export const getRepoAgeAndCommitDate = async (repoUrl: string) => {
    const result = await analyzeRepository(repoUrl, { includeRepoAge: true });
    return result.repoAge!;
};

export const getRepoAgeAndCommits = async (repoUrl: string) => {
    const result = await analyzeRepository(repoUrl, {
        includeRepoAge: true,
        includeCommitHistory: true,
    });

    return {
        repoAge: result.repoAge!,
        commits: result.commitHistory!,
    };
};