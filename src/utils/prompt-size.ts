import fs from 'fs';
import path from 'path';
import { TEMPORARY_FOLDER } from '../constants';
import { getRepoName } from './repos';

export const MAX_PROMPT_SIZE = 20971520; // 20MB in bytes

export const checkPromptSize = (prompt: string) => {
    const promptSize = new TextEncoder().encode(prompt).length;
    if (promptSize > MAX_PROMPT_SIZE) {
        throw new Error(`Prompt size (${promptSize} bytes) exceeds maximum allowed size (${MAX_PROMPT_SIZE} bytes)`);
    }
};

export const getEstimtedTokenSize = (project_url: string) => {
    const repoName = getRepoName(project_url!);
    const repoPath = `${TEMPORARY_FOLDER}/repositories/${repoName}-pack.xml`;

    const generatedFilePrompt = fs.readFileSync(path.join(repoPath), 'utf8');

    const estimatedFileTokens = Math.ceil(generatedFilePrompt.length / 4);

    return estimatedFileTokens;
};
