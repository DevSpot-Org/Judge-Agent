import fs from 'fs';
import path from 'path';
import { TEMPORARY_FOLDER } from '../../../constants';
import type { LLMProvider } from '../../../llmProviders';
import { requestLLM } from '../../../llmProviders/service';
import type { HackathonChallenges, Project } from '../../../types/entities';
import { checkPromptSize } from '../../../utils/prompt-size';
import { getRepoName } from '../../../utils/repos';
import { dynamicInnovationJudgePrompt } from './prompt';

export const judgeInnovation = async (submission: Project, challenges: HackathonChallenges[], provider: LLMProvider = 'groq') => {
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
        ${dynamicInnovationJudgePrompt}
        </meta_prompt>

        <user_instructions>
          Evaluate this project's innovative elements based on the provided criteria. For each challenge:
          1. Assess technical innovative sophistication and implementation quality
          2. Verify alignment with challenge-specific requirements
          3. Analyze innovative approaches and creative problem-solving
          4. Assign an innovation score (0-100) based on overall merit

          Return strictly a JSON object where each key is the actual challenge ID from the provided challenges and its value contains a comprehensive business evaluation.

          Format the response as a JSON object where:
          - Keys are the actual challenge IDs (e.g., if the challenge ID is "378", use "378" as the key)
          - Values are detailed Innovative analyses for each specific challenge

          Example structure (use actual challenge IDs, not these examples):
          {
            "[ACTUAL_CHALLENGE_ID_1]": "Comprehensive evaluation including technical assessment, requirement fulfillment, and innovation analysis",
            "[ACTUAL_CHALLENGE_ID_2]": "Detailed breakdown of innovative aspects and implementation quality"
          }

          Do not use placeholder IDs like "123" or "456" - use the actual challenge IDs provided in the input data.
        </user_instructions>
    `;

    checkPromptSize(prompt);

    const analysis = await requestLLM(provider, prompt);

    return analysis;
};
