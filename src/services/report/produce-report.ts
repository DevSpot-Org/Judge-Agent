import { mkdir } from "fs/promises";
import { TEMPORARY_FOLDER } from "../../config";
import type { HackathonChallenges, Project } from "../../types/entities";
import { getRepoName } from "../../utils/repos";
import { saveToMarkdown } from "../../utils/write-md-file";
import { judgeBusinessPotential } from "../analyze/judges/business/judge";
import { judgeInnovation } from "../analyze/judges/innovation/judge";
import { judgeTechnicalImplementation } from "../analyze/judges/technical/judge";
import { judgeUX } from "../analyze/judges/ux/judge";
import { judgeFinalReview } from "./final/judge";
import { aggregateResults } from "./result-agregator";

export const produceReport = async (
  project: Project,
  challenge: HackathonChallenges,
  provider: "groq" | "gemini" = "groq"
) => {
  const projectName = getRepoName(project.project_url!);
  console.log(`📁 Creating report directory for ${projectName}...`);

  const reportPath = `${TEMPORARY_FOLDER}/report/${projectName}`;
  await mkdir(reportPath, { recursive: true });

  console.log("🤖 Running AI analysis...");
  const analysisResults = await Promise.allSettled([
    judgeInnovation(project, challenge, provider),
    judgeTechnicalImplementation(project, challenge, provider),
    judgeUX(project, challenge, provider),
    judgeBusinessPotential(project, challenge, provider),
  ]);

  const [innovation, technical, ux, business] = analysisResults.map(
    (result) => {
      if (result.status === "rejected") {
        console.error("❌ Analysis failed:", result.reason);
        return {
          error: true,
          message: result.reason?.message || "Analysis failed",
        };
      }
      return result.value;
    }
  );

  console.log("📝 Generating final review...");
  try {
    const finalReview = await judgeFinalReview({
      submission: project,
      technical,
      innovation,
      ux,
      business,
      provider,
    });

    console.log("📊 Aggregating results...");
    const summary = await aggregateResults({
      technical,
      innovation,
      ux,
      business,
      final: finalReview,
    });

    console.log("💾 Saving reports to markdown files...");
    const saveResults = await Promise.allSettled([
      saveToMarkdown(innovation, `${reportPath}/innovation`),
      saveToMarkdown(technical, `${reportPath}/technical`),
      saveToMarkdown(ux, `${reportPath}/ux`),
      saveToMarkdown(business, `${reportPath}/business`),
      saveToMarkdown(finalReview, `${reportPath}/final`),
      saveToMarkdown(summary, `${reportPath}/summary`),
    ]);

    saveResults.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`❌ Failed to save report ${index}:`, result.reason);
      }
    });

    return {
      innovation,
      technical,
      ux,
      business,
      final: finalReview,
      summary,
      reportPath,
    };
  } catch (error) {
    console.error("❌ Error in final review or aggregation:", error);
    throw error;
  }
};
