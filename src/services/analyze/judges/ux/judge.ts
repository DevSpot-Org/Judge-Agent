import fs from "fs";
import path from "path";
import { TEMPORARY_FOLDER } from "../../../../config";
import { geminiFetch } from "../../../../transport/gemini";
import { groqFetch } from "../../../../transport/groq";
import type { HackathonChallenges, Project } from "../../../../types/entities";
import { checkPromptSize } from "../../../../utils/prompt-size";
import { getRepoName } from "../../../../utils/repos";
import type { LLMProvider } from "../types";
import { dynamicUXJudgePrompt } from "./prompt";

export const judgeUX = async (
  submission: Project,
  challenge: HackathonChallenges,
  provider: LLMProvider = "groq"
) => {
  const { description, project_url } = submission;

  const repoName = getRepoName(project_url!);
  const repoPath = `${TEMPORARY_FOLDER}/repositories/${repoName}-pack.xml`;

  const generatedFilePrompt = fs.readFileSync(path.join(repoPath), "utf8");

  const metaPrompt = dynamicUXJudgePrompt(challenge);

  const prompt = `
        <project_description>
        ${description}
        </project_description>

        <project_code>
        ${generatedFilePrompt}
        </project_code>

        <user_instructions>
          Please analyze the UX aspects of this project according to the criteria above. Consider both traditional UX metrics and blockchain/AI-specific interaction patterns. Produce a final UX score out of 100 combining your full analysis.
        </user_instructions>

        <meta_prompt>
        ${metaPrompt}
        </meta_prompt>
    `;

  checkPromptSize(prompt);

  const analysis =
    provider === "gemini" ? await geminiFetch(prompt) : await groqFetch(prompt);
  return analysis;
};
