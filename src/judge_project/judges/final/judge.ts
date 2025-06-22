import type { LLMProvider } from '../../../llmProviders';
import { requestLLM } from '../../../llmProviders/service';
import { finalJudgeMetaPrompt } from './prompt';

interface ChallengeAnalysis {
    fullAnalysis: string;
    summary: string | null;
    score: number | null;
}

type FinalBulkAnalysisResult = Record<
    string,
    {
        technical: ChallengeAnalysis;
        ux: ChallengeAnalysis;
        business: ChallengeAnalysis;
        innovation: ChallengeAnalysis;
    }
>;
interface JudgeFinalReviewParams {
    entries: FinalBulkAnalysisResult;
    provider?: LLMProvider;
}

export const judgeFinalReview = async ({ entries, provider = 'groq' }: JudgeFinalReviewParams) => {
    console.log('judgeFinalReviewBulk', entries);
    const prompt = `
      <analysis>
      ${JSON.stringify(entries, null, 2)}
      </analysis>
  
      <meta_prompt>
      ${finalJudgeMetaPrompt}
      </meta_prompt>
  
      <scoring_weights>
      1. Technical Implementation: 30%
      2. Innovation & Utility: 30%
      3. User Experience: 20%
      4. Business Potential: 20%
      </scoring_weights>
  
      <user_instructions>
        You are tasked with analyzing judge assessments for multiple challenges. For each challenge in the provided analysis:

        1. Calculate the Final Weighted Score:
          - Extract numerical scores from technical (30%), innovation (30%), UX (20%), and business (20%) assessments
          - Apply the specified weights to calculate a final score out of 100
          - Example calculation: If technical=90, innovation=85, UX=95, business=80
            Final Score = (90*0.3) + (85*0.3) + (95*0.2) + (80*0.2) = 87.5

        2. Create a Comprehensive Analysis Including:
          a) Summary of Key Findings:
              - Technical implementation highlights
              - Innovation and utility achievements
              - UX design strengths/weaknesses
              - Business potential assessment
          
          b) Project Evaluation:
              - List 3-5 key strengths
              - List 2-3 areas needing improvement
              - Provide 2-3 specific, actionable recommendations
          
          c) Impact Assessment:
              - Concrete examples of ecosystem contribution
              - Specific potential long-term benefits
              - Unique differentiating features

        Return ONLY a JSON object where each key is the actual challenge ID from the provided data and each value is a comprehensive analysis following the above structure.

        Format structure:
        {
          "[ACTUAL_CHALLENGE_ID]": "Comprehensive analysis following the above structure, ending with exactly: The final score is - X.XX"
        }

        Example format (use actual challenge IDs, not this placeholder):
        {
          "[REPLACE_WITH_REAL_CHALLENGE_ID]": "Technical Analysis: [key points]... Innovation Review: [key points]... Final Recommendations: [points]... The final score is - 87.50"
        }

        Important:
        - Use the actual challenge IDs from the provided assessment data, not placeholder values
        - Use ONLY information present in the provided assessments
        - Maintain consistent scoring precision to 2 decimal places
        - Ensure all scores and weights are accurately calculated
        - Keep analysis concise but comprehensive
        - End each analysis with the exact phrase "The final score is - X.XX"
        - Do not use example IDs like "challenge123" - use the real challenge identifiers
      </user_instructions>
    `;

    const analysis = await requestLLM(provider, prompt);
    console.log({ analysis });

    return analysis;
};
