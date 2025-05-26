import fs from "fs";
import path from "path";
import { TEMPORARY_FOLDER } from "../../constants";

import DevspotService from "../../agents/devspot";
import type { LLMProvider } from "../../llmProviders";
import { geminiFetch } from "../../llmProviders/gemini";
import { groqFetch } from "../../llmProviders/groq";
import type { Project } from "../../types/entities";
import { checkPromptSize } from "../../utils/prompt-size";
import { getRepoName } from "../../utils/repos";
import { saveToMarkdown } from "../../utils/write-md-file";
import { challengeMatchingPrompt } from "./prompt";

export const generateProjectInfo = async (
  submission: Project,
  provider: LLMProvider = "groq"
) => {
  const { description, project_url, name } = submission;

  const repoName = getRepoName(project_url!);
  const repoPath = `${TEMPORARY_FOLDER}/repositories/${repoName}-pack.xml`;
  const reportPath = `${TEMPORARY_FOLDER}/report/${repoName}`;

  const generatedFilePrompt = fs.readFileSync(path.join(repoPath), "utf8");

  const devspotService = new DevspotService();

  const challenges = await devspotService.getHackathonChallenges(1);

  const prompt = `
        <project_name>
        ${name}
        </project_name>

        <project_description>
        ${description}
        </project_description>

        <project_code>
        ${generatedFilePrompt}
        </project_code>

        <available_challenges>
        ${JSON.stringify(challenges, null, 2)}
        </available_challenges>

        <user_instructions>
        Analyze the project information provided above against the ${
          challenges.length
        } available challenges. Generate comprehensive challenge recommendations using the framework outlined in the prompt.

        Focus on finding the best matches based on technical alignment, feature compatibility, and implementation feasibility.
        </user_instructions>

        <meta_prompt>
        ${challengeMatchingPrompt}
        </meta_prompt>
    `;

  checkPromptSize(prompt);

  const analysis =
    provider === "gemini" ? await geminiFetch(prompt) : await groqFetch(prompt);

  if (analysis) {
    saveToMarkdown(analysis, `${reportPath}/project-info`);
  }

  return analysis;
};
