import fs from 'fs';
import path from 'path';
import { TEMPORARY_FOLDER } from '../../../constants';
import type { LLMProvider } from '../../../llmProviders';
import { requestLLM } from '../../../llmProviders/service';
import type { HackathonChallenges, Project } from '../../../types/entities';
import { checkPromptSize } from '../../../utils/prompt-size';
import { getRepoName } from '../../../utils/repos';
import { dynamicUXJudgePrompt } from './prompt';

export const judgeUX = async (submission: Project, challenges: HackathonChallenges[], provider: LLMProvider = 'groq') => {
    const { description, project_url } = submission;

    const repoName = getRepoName(project_url!);
    const repoPath = `${TEMPORARY_FOLDER}/repositories/${repoName}-pack.xml`;

    const generatedFilePrompt = fs.readFileSync(path.join(repoPath), 'utf8');

    const prompt = `
        <project_description>
        ${description}
        </project_description>

        <project_code>
        ${generatedFilePrompt}
        </project_code>
        
        <challenges>
        ${JSON.stringify(challenges)}
        </challenges>

        <meta_prompt>
        ${dynamicUXJudgePrompt}
        </meta_prompt>

        <user_instructions>
          Please analyze the UX aspects of this project for each challenge provided. For each challenge, consider both traditional UX metrics and blockchain/AI-specific interaction patterns relevant to that challenge's requirements. 

          Return strictly a JSON object where each key is the actual challenge ID from the provided challenges and its value is a detailed UX analysis specific to that challenge's requirements.

          Format the response as a JSON object where:
          - Keys are the actual challenge IDs from the input data
          - Values are detailed UX analyses for each specific challenge

          Example structure (use actual challenge IDs, not these placeholders):
          {
            "[ACTUAL_CHALLENGE_ID_1]": "detailed UX analysis text addressing traditional UX metrics and blockchain/AI-specific patterns for this challenge",
            "[ACTUAL_CHALLENGE_ID_2]": "detailed UX analysis text addressing traditional UX metrics and blockchain/AI-specific patterns for this challenge"
          }

          Important:
          - Use the real challenge IDs from the provided data, not placeholder values like "123" or "456"
          - Each analysis should be specific to that challenge's UX requirements
          - Consider both traditional UX metrics and blockchain/AI-specific interaction patterns
          - Focus on how well the project's UX meets the specific challenge criteria
        </user_instructions>
    `;

    checkPromptSize(prompt);

    const analysis = await requestLLM(provider, prompt);

    return analysis;
};
