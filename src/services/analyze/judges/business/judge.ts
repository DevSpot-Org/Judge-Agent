import fs from "fs";
import path from "path";
import { TEMPORARY_FOLDER } from "../../../../config";
import { geminiFetch } from "../../../../transport/gemini";
import { groqFetch } from "../../../../transport/groq";
import type { HackathonChallenges, Project } from "../../../../types/entities";
import { checkPromptSize } from "../../../../utils/prompt-size";
import { getRepoName } from "../../../../utils/repos";
import { collablandKnowledge } from "../collabland-knowledge";
import { gaiaKnowledge } from "../gaia-knowledge";
import type { LLMProvider } from "../types";
import { dynamicBusinessJudgePrompt } from "./prompt";

export const judgeBusinessPotential = async (
  submission: Project,
  challenge: HackathonChallenges,
  provider: LLMProvider = "groq"
) => {
  const { description, project_url } = submission;

  const repoName = getRepoName(project_url!);
  const repoPath = `${TEMPORARY_FOLDER}/repositories/${repoName}-pack.xml`;

  const generatedFilePrompt = fs.readFileSync(path.join(repoPath), "utf8");

  const metaPrompt = dynamicBusinessJudgePrompt(challenge);

  const prompt = `
        <project_description>
        ${description}
        </project_description>

        <hackathon_sponsor_docs_1>
        ${gaiaKnowledge}
        </hackathon_sponsor_docs_1>

        <hackathon_sponsor_docs_2>
        ${collablandKnowledge}
        </hackathon_sponsor_docs_2>

        <project_code>
        ${generatedFilePrompt}
        </project_code>

        <user_instructions>
          Please analyze the business potential of this project according to the criteria above. Consider the market opportunity, business model viability, and go-to-market strategy. Produce a final business potential score out of 100 combining your full analysis.
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
