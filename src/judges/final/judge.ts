import { type LLMProvider } from '../../llmProviders';
import { requestLLM } from '../../llmProviders/service';
import type { Project } from '../../types/entities';
import { finalJudgeMetaPrompt } from './prompt';

interface JudgeFinalReviewParams {
    submission: Project;
    technical: string;
    innovation: string;
    ux: string;
    business: string;
    provider?: LLMProvider;
}

export const judgeFinalReview = async ({ technical, innovation, ux, business, provider = 'groq' }: JudgeFinalReviewParams) => {
    const prompt = `
      <technical_analysis>
      ${technical}
      </technical_analysis>
  
      <innovation_analysis>
      ${innovation}
      </innovation_analysis>
  
      <ux_analysis>
      ${ux}
      </ux_analysis>
  
      <business_analysis>
      ${business}
      </business_analysis>
  
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
      Please analyze all judge assessments and provide:
      1. A synthesis of the key findings from each area
      2. The weighted final score based on the scoring weights provided
      3. Key strengths and areas for improvement
      4. Strategic recommendations for the project's future development
      5. Final Merit Assessment:
         - Evaluate the project's overall contribution to the ecosystem
         - Assess potential long-term impact beyond the immediate scores
         - Consider unique aspects that may not be captured in the standard criteria
         - Provide a holistic view of the project's significance
      
      Ensure you extract the numerical scores from each assessment and apply the weights correctly in your final calculation.
      at the end of your response, please provide a final score for the project in the form "The final score is - X"
      </user_instructions>
    `;

    const analysis = await requestLLM(provider, prompt);

    return analysis;
};
