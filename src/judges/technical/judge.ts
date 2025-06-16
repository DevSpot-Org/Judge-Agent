import fs from 'fs';
import path from 'path';

import { TEMPORARY_FOLDER } from '../../constants';
import { type LLMProvider } from '../../llmProviders';
import { requestLLM } from '../../llmProviders/service';
import type { HackathonChallenges, Project } from '../../types/entities';
import { checkPromptSize } from '../../utils/prompt-size';
import { getRepoName } from '../../utils/repos';
import { dynamicChallengeJudgePrompt } from './prompt';

export const judgeTechnicalImplementation = async (submission: Project, challenge: HackathonChallenges, provider: LLMProvider = 'groq') => {
    const { description, project_url } = submission;

    const repoName = getRepoName(project_url!);
    const repoPath = `${TEMPORARY_FOLDER}/repositories/${repoName}-pack.xml`;

    const generatedFilePrompt = fs.readFileSync(path.join(repoPath), 'utf8');

    const metaPrompt = dynamicChallengeJudgePrompt(challenge);

    const prompt = `
        <project_description>
        ${description}
        </project_description>

        <project_code>
        ${generatedFilePrompt}
        </project_code>

        <user_instructions>
         Please analyze the usage of the technologies in this repo according to the requirements. Produce a final score on 100 combining your full analysis. Ensure you communicate the final score on 100 clearly at the end of your evaluation.
        </user_instructions>

        <meta_prompt>
        ${metaPrompt}
        </meta_prompt>
    `;

    checkPromptSize(prompt);

    //  const analysis = await aiQueue.makeRequest(provider, prompt);
    const analysis = await requestLLM(provider, prompt, 'deepseek-r1-distill-llama-70b');

    return analysis;
};
