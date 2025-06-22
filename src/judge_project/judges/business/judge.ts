import fs from 'fs';
import path from 'path';
import { TEMPORARY_FOLDER } from '../../../constants';
import type { LLMProvider } from '../../../llmProviders';
import { requestLLM } from '../../../llmProviders/service';
import type { HackathonChallenges, Project } from '../../../types/entities';
import { checkPromptSize } from '../../../utils/prompt-size';
import { getRepoName } from '../../../utils/repos';
import { dynamicBusinessJudgePrompt } from './prompt';

export const judgeBusinessPotential = async (submission: Project, challenges: HackathonChallenges[], provider: LLMProvider = 'groq') => {
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
        ${dynamicBusinessJudgePrompt}
        </meta_prompt>

         <user_instructions>
          Please analyze the business potential of this project according to the criteria above. Focus on:
          - Market opportunity and target audience
          - Business model viability and revenue streams
          - Go-to-market strategy and competitive advantage
          - Scalability and growth potential
          - Financial sustainability and resource requirements

          For each challenge, provide a detailed business analysis that evaluates how well the project meets the specific business requirements and criteria of that challenge.

          Return strictly a JSON object where each key is the actual challenge ID from the provided challenges and its value contains a comprehensive business evaluation.

          Format the response as a JSON object where:
          - Keys are the actual challenge IDs (e.g., if the challenge ID is "378", use "378" as the key)
          - Values are detailed business analyses for each specific challenge

          Example structure (use actual challenge IDs, not these examples):
          {
            "[ACTUAL_CHALLENGE_ID_1]": "Detailed business analysis covering market fit, business model, go-to-market strategy, and commercial viability for this challenge's requirements",
            "[ACTUAL_CHALLENGE_ID_2]": "Comprehensive business evaluation including market opportunity, revenue potential, and strategic alignment with challenge objectives"
          }

          Do not use placeholder IDs like "123" or "456" - use the actual challenge IDs provided in the input data.
        </user_instructions>
    `;

    checkPromptSize(prompt);

    const analysis = await requestLLM(provider, prompt);

    return analysis;
};
