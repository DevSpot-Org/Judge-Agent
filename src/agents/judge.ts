import { judgeBusinessPotential } from "../judges/business/judge";
import { judgeFinalReview } from "../judges/final/judge";
import { judgeInnovation } from "../judges/innovation/judge";
import { judgeTechnicalImplementation } from "../judges/technical/judge";
import { judgeUX } from "../judges/ux/judge";
import { geminiFetch } from "../llmProviders/gemini";
import { groqFetch } from "../llmProviders/groq";
import type { HackathonChallenges, Project } from "../types/entities";

interface InitialJudgeResults {
  ux: string;
  technical: string;
  business: string;
  innovation: string;
}

class Judge {
  project: Project;
  challenge: HackathonChallenges;
  provider: "groq" | "gemini" = "gemini";

  constructor(project: Project, challenge: HackathonChallenges) {
    this.challenge = challenge;
    this.project = project;
  }

  async projectJudgeAnalysis() {
    console.log("🤖 Running AI analysis...");
    const analysisResults = await Promise.allSettled([
      this.innovationJudging(),
      this.technicalJudging(),
      this.uxJudging(),
      this.businessJudging(),
    ]);

    const [innovation, technical, ux, business] = analysisResults.map(
      (result) => {
        if (result.status === "rejected") {
          console.error("❌ Analysis failed:", result.reason);
          throw Error(result.reason?.message || "Analysis failed");
        }
        return result.value;
      }
    );

    const finalReview = await this.finalJudging({
      technical: technical.fullAnalysis,
      ux: ux.fullAnalysis,
      business: business.fullAnalysis,
      innovation: innovation.fullAnalysis,
    });

    return {
      technical,
      ux,
      business,
      innovation,
      final: finalReview,
    };
  }

  async technicalJudging() {
    const project = this.project;
    const challenge = this.challenge;
    const provider = this.provider;

    const fullAnalysis = await judgeTechnicalImplementation(
      project,
      challenge,
      provider
    );

    const summary = await this.summarizeResult(fullAnalysis);

    return {
      fullAnalysis,
      summary,
    };
  }

  async uxJudging() {
    const project = this.project;
    const challenge = this.challenge;
    const provider = this.provider;
    const fullAnalysis = await judgeUX(project, challenge, provider);
    const summary = await this.summarizeResult(fullAnalysis);
    return {
      fullAnalysis,
      summary,
    };
  }

  async businessJudging() {
    const project = this.project;
    const challenge = this.challenge;
    const provider = this.provider;
    const fullAnalysis = await judgeBusinessPotential(
      project,
      challenge,
      provider
    );
    const summary = await this.summarizeResult(fullAnalysis);
    return {
      fullAnalysis,
      summary,
    };
  }

  async innovationJudging() {
    const project = this.project;
    const challenge = this.challenge;
    const provider = this.provider;
    const fullAnalysis = await judgeInnovation(project, challenge, provider);
    const summary = await this.summarizeResult(fullAnalysis);
    return {
      fullAnalysis,
      summary,
    };
  }

  async finalJudging(initialReview: InitialJudgeResults) {
    const project = this.project;
    const provider = this.provider;

    const fullAnalysis = await judgeFinalReview({
      submission: project,
      provider,
      ...initialReview,
    });
    const summary = await this.summarizeResult(fullAnalysis);
    return {
      fullAnalysis,
      summary,
    };
  }

  async summarizeResult(review: string) {
    console.log("📊 Generating review summary...");

    const summaryPrompt = `
      Please provide a 3-4 sentence summary of the following review. 
      Focus on the key points and main takeaways:

      ${review}
    `;

    const summary =
      this.provider === "gemini"
        ? await geminiFetch(summaryPrompt)
        : await groqFetch(summaryPrompt, "llama-3.3-70b-versatile");

    return summary;
  }
}

export default Judge;
