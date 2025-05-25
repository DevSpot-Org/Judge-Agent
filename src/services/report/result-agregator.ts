import { groqFetch } from "../../transport/groq";

interface JudgeResults {
  technical: string;
  innovation: string;
  ux: string;
  business: string;
  final: string;
}

export const aggregateResults = async (
  results: JudgeResults
): Promise<string> => {
  const { technical, innovation, ux, business, final } = results;

  const summaryPrompt = `
    Please create a markdown table summarizing the following judge assessments. 
    Extract the numerical scores and provide a brief (1-2 sentences) summary of each judge's key points.
    Format the table with columns: Judge | Score | Key Points
    Include a final row showing the weighted final score from the final judge.

    Technical Assessment:
    ${technical}

    Innovation Assessment:
    ${innovation}

    UX Assessment:
    ${ux}

    Business Assessment:
    ${business}

    Final Assessment:
    ${final}
  `;

  const summaryTable = await groqFetch(
    summaryPrompt,
    "llama-3.3-70b-versatile"
  );

  return summaryTable;
};
