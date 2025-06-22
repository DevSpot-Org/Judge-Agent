import fs from 'fs';
import path from 'path';
import { TEMPORARY_FOLDER } from '../../../constants';
import type { LLMProvider } from '../../../llmProviders';
import { requestLLM } from '../../../llmProviders/service';
import type { Project } from '../../../types/entities';
import { checkPromptSize } from '../../../utils/prompt-size';
import { getRepoName } from '../../../utils/repos';
import { preprocessorPrompt } from './prompt';

export const codePreProcessor = async (submission: Project, provider: LLMProvider = 'groq') => {
    const { description, project_url } = submission;

    const repoName = getRepoName(project_url!);
    const repoPath = `${TEMPORARY_FOLDER}/repositories/${repoName}-pack.xml`;

    const generatedFilePrompt = fs.readFileSync(path.join(repoPath), 'utf8');

    const estimatedFileTokens = Math.ceil(generatedFilePrompt.length / 4);

    if (estimatedFileTokens < 25000) return;

    const prompt = preprocessorPrompt(description ?? '', generatedFilePrompt);

    checkPromptSize(prompt);

    const analysis = await requestLLM(provider, prompt);

    const cleanedXML = cleanXMLResponse(analysis);

    console.log('cleanedXML', { cleanedXML, analysis });

    // if (!validateXML(cleanedXML)) return;

    const outputPath = path.join(repoPath);

    fs.writeFileSync(outputPath, cleanedXML, 'utf8');

    return analysis;
};

const cleanXMLResponse = (response: string): string => {
    let cleaned = response.trim();

    // Case 1: If it contains a fenced block with ```xml
    const xmlBlockMatch = cleaned.match(/```xml\s*([\s\S]*?)\s*```/);
    if (xmlBlockMatch) {
        cleaned = xmlBlockMatch[1];
    } else {
        // Case 2: Possibly wrapped in quotes
        if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
            cleaned = cleaned.slice(1, -1);
        }
    }

    // Replace escaped newlines, tabs, and escaped quotes
    cleaned = cleaned.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');

    return cleaned.trim();
};

// Helper function to validate XML structure
const validateXML = (xmlContent: string): boolean => {
    try {
        const trimmed = xmlContent.trim();
        return trimmed.startsWith('<codebase_analysis>') && trimmed.endsWith('</codebase_analysis>');
    } catch (error) {
        return false;
    }
};
