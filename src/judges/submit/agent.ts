import fs from "fs";
import path from "path";
import { TEMPORARY_FOLDER } from "../../constants";

import DevspotService from "../../agents/devspot";
import type { LLMProvider } from "../../llmProviders";
import { geminiFetch } from "../../llmProviders/gemini";
import { groqFetch } from "../../llmProviders/groq";
import jsonParser from "../../utils/jsonParser";
import { checkPromptSize } from "../../utils/prompt-size";
import { getRepoName } from "../../utils/repos";
import { challengeMatchingPrompt } from "./prompt";

const structuredAnalysisPrompt = `
  Analyze the project information provided above against the available challenges. Generate comprehensive challenge recommendations using the framework outlined in the prompt.
  
  ANALYSIS REQUIREMENTS:

  1. **Challenge Matching**: Analyze the project against provided challenges and identify the best matches based on:
    - Technical stack alignment (minimum 60% overlap required)
    - Feature compatibility and functional alignment
    - Implementation feasibility within reasonable effort
    - Required vs. available technologies
    - Project's core purpose alignment with challenge objectives
    
    **IMPORTANT**: If NO challenges meet the 60% compatibility threshold, return an empty array for challengeIds. Do not force matches for unrelated projects.

  2. **Technology Extraction**: Comprehensively identify all technologies, frameworks, libraries, and tools used in the project by scanning:
    - Package.json, requirements.txt, Cargo.toml, go.mod, pom.xml and other dependency files
    - Import statements and library usage in code
    - Configuration files (docker, CI/CD, environment configs)
    - Infrastructure and deployment related technologies
    - Development tools, testing frameworks, and build systems

  3. **Project Understanding & Name Detection**: 
    - Generate a comprehensive description and compelling title/tagline
    - **Project Name Detection**: Scan the entire codebase for project name hints including:
      - package.json "name" field
      - README.md title or project name
      - HTML title tags
      - Application/class names in main files
      - Repository or folder names mentioned in configs
      - Brand/product names in documentation
      - Variable names or constants that indicate project identity
      - If no explicit name found, create a descriptive title based on functionality

  **STRICT MATCHING CRITERIA:**
  
  Before recommending any challenge, verify:
  - **Technology Overlap**: Project uses at least 60% of the required technologies
  - **Functional Alignment**: Project's core features align with challenge objectives
  - **Feasibility Check**: Missing requirements can be reasonably implemented
  - **Purpose Match**: Project's domain/industry aligns with challenge focus area
  
  **Reject matches if:**
  - Technology stacks are fundamentally incompatible (e.g., web2 project vs blockchain-only challenge)
  - Project domain is completely unrelated (e.g., gaming project vs fintech challenge)
  - Required technologies would require complete rewrite
  - Challenge scope is entirely outside project's intended use case

  OUTPUT FORMAT:
  You must return ONLY a valid JSON object with these exact keys:

  {
    "challengeIds": [array of challenge IDs that meet >60% compatibility - EMPTY ARRAY if no good matches exist],
    "technologies": [comprehensive array of all technologies/frameworks/libraries/tools used],
    "description": "A detailed 10-sentence description explaining what the project does, its key features, technical implementation, architecture, user benefits, and unique value proposition",
    "title": "A clear, professional project title (scan codebase for existing names first, otherwise create descriptive title)",
    "tagline": "A single compelling sentence under 20 words that defines the project's core value and purpose"
  }

  ANALYSIS GUIDELINES:

  **Challenge Matching Criteria:**
  - **Compatibility Threshold**: Only include challenges with genuine >60% technical alignment
  - **Quality over Quantity**: Better to return fewer high-quality matches than force poor fits
  - **Functional Relevance**: Challenge objectives must align with project's actual capabilities
  - **Implementation Reality**: Consider if challenge completion is actually feasible
  - **Domain Alignment**: Ensure project type matches challenge category (web3, AI, mobile, etc.)

  **Technology Identification Priority:**
  1. Core frameworks and languages (React, Python, Rust, etc.)
  2. Blockchain/Web3 technologies (if applicable)
  3. Databases and storage solutions
  4. Cloud services and deployment platforms
  5. APIs and external integrations
  6. Development and testing tools
  7. Build systems and package managers

  **Project Name Detection Strategy:**
  1. Check package.json, setup.py, Cargo.toml for project name
  2. Scan README.md for title headers
  3. Look for HTML title tags or app names
  4. Check for brand/product references in documentation
  5. Examine main application class/component names
  6. Look for constants or variables indicating project identity
  7. If none found, create descriptive title based on main functionality

  **Description Structure:**
  - Sentence 1-2: What the project is and its primary purpose
  - Sentence 3-4: Key features and main functionality
  - Sentence 5-6: Technical implementation details and architecture
  - Sentence 7-8: Target users and practical benefits
  - Sentence 9-10: Unique value proposition and potential impact/scalability

  **Title Guidelines:**
  - Prioritize discovered names from codebase
  - If creating new title: be specific and descriptive
  - Avoid generic terms like "App" or "Platform" alone
  - Should clearly indicate what the project does
  - Professional and marketable

  **Tagline Guidelines:**
  - Maximum 20 words, preferably 10-15
  - Clearly communicates primary value
  - Action-oriented or benefit-focused
  - Memorable and compelling
  - Avoid technical jargon

  **CRITICAL VALIDATION RULES:**
  - If project is purely web2 and all challenges are web3-focused: return empty challengeIds
  - If project is mobile-only and challenges require web deployment: return empty challengeIds  
  - If project lacks fundamental requirements for any challenge: return empty challengeIds
  - If project domain (gaming/fintech/social/etc.) doesn't match any challenge themes: return empty challengeIds
  - Better to return no matches than poor matches that would waste participant time

  IMPORTANT: Return ONLY the JSON object, no additional text, explanations, or markdown formatting.
  Prioritize accuracy over participation - only recommend challenges where there's genuine compatibility and realistic completion potential.
`;

export const generateProjectInfo = async (
  project_url: string,
  provider: LLMProvider = "groq"
) => {
  const repoName = getRepoName(project_url!);
  const repoPath = `${TEMPORARY_FOLDER}/repositories/${repoName}-pack.xml`;

  const generatedFilePrompt = fs.readFileSync(path.join(repoPath), "utf8");

  const devspotService = new DevspotService();

  const challenges = await devspotService.getHackathonChallenges(1);

  const prompt = `
        <project_code>
        ${generatedFilePrompt}
        </project_code>

        <available_challenges>
        ${JSON.stringify(challenges, null, 2)}
        </available_challenges>

        <user_instructions>
        ${structuredAnalysisPrompt}
        </user_instructions>

        <meta_prompt>
        ${challengeMatchingPrompt}
        </meta_prompt>
    `;

  checkPromptSize(prompt);

  const analysis =
    provider === "gemini" ? await geminiFetch(prompt) : await groqFetch(prompt);

  const result = jsonParser(analysis);

  return result;
};
