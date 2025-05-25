import { readdir, readFile } from "fs/promises";
import { TEMPORARY_FOLDER } from "../../config";
import { geminiFetch } from "../../transport/gemini";

export const findHighestScore = async (): Promise<void> => {
  const reportsPath = `${TEMPORARY_FOLDER}/report`;

  // Get all project directories
  const projectDirs = await readdir(reportsPath, { withFileTypes: true });
  const projects = projectDirs.filter((dir) => dir.isDirectory());

  // Read all final reports
  const projectReports = await Promise.all(
    projects.map(async (project) => {
      const finalReportPath = `${reportsPath}/${project.name}/final.md`;

      try {
        const finalReport = await readFile(finalReportPath, "utf-8");
        return {
          projectName: project.name,
          report: finalReport,
        };
      } catch (error) {
        console.warn(`Failed to read report for ${project.name}:`, error);
        return null;
      }
    })
  );

  // Filter out failed reads
  const validReports = projectReports.filter(Boolean);

  // Extract scores using LLM
  const scorePrompt = `
    Review these project reports and select winners for our prizes. You must choose winners for each category - use your judgment based on the projects' merits.

    Prizes to award:
    - Mother of All Agents ($2,500) - single winner
    - Most Viral Agent ($2,500) - single winner
    - Most Innovative Integration ($1,000) - up to two winners
    - Best Integrations ($750) - up to two winners
    - Best Implementation ($750) - up to two winners

    Also note the highest scoring project and their score.

    ${validReports
      .map(
        (report) => `
      Project: ${report?.projectName}
      Report:
      ${report?.report}
      ---
    `
      )
      .join("\n")}
  `;

  const scoresResponse = await geminiFetch(
    scorePrompt,
    "gemini-2.0-flash-thinking-exp-01-21"
  );

  console.log(scoresResponse);
};
