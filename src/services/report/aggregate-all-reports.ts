import { readdir, readFile } from "fs/promises";
import { TEMPORARY_FOLDER } from "../../config";
import { groqFetch } from "../../transport/groq";

export const aggregateAllReports = async (): Promise<string> => {
  const reportsPath = `${TEMPORARY_FOLDER}/report`;

  // Get all project directories
  const projectDirs = await readdir(reportsPath, { withFileTypes: true });
  const projects = projectDirs.filter((dir) => dir.isDirectory());

  // Read all final reports
  const projectReports = await Promise.all(
    projects.map(async (project) => {
      const projectPath = `${reportsPath}/${project.name}`;
      const finalReportPath = `${projectPath}/final.md`;
      const summaryPath = `${projectPath}/summary.md`;

      try {
        const [finalReport, summary] = await Promise.all([
          readFile(finalReportPath, "utf-8"),
          readFile(summaryPath, "utf-8"),
        ]);

        return {
          projectName: project.name,
          finalReport,
          summary,
        };
      } catch (error) {
        console.warn(`Failed to read reports for ${project.name}:`, error);
        return null;
      }
    })
  );

  // Filter out failed reads
  const validReports = projectReports.filter(Boolean);

  // Create prompt for the LLM
  const comparePrompt = `
    Please analyze the following project reports and create a markdown table comparing all projects.
    The table should have the following columns:
    | Project | Technical Score | Innovation Score | UX Score | Business Score | Final Score | Key Strengths | Areas for Improvement |

    Extract the numerical scores from each report's summary and provide a concise overview of strengths and areas for improvement.
    Sort the table by Final Score in descending order.

    Projects to analyze:
    ${validReports
      .map(
        (report) => `
      Project: ${report?.projectName}
      
      Final Report:
      ${report?.finalReport}
      
      Summary:
      ${report?.summary}
      ---
    `
      )
      .join("\n")}
  `;

  // Get comparison table from LLM
  const comparisonTable = await groqFetch(
    comparePrompt,
    "llama-3.3-70b-versatile"
  );

  // Save the comparison table
  const outputPath = `${TEMPORARY_FOLDER}/report/final_comparison.md`;
  await Bun.write(outputPath, comparisonTable);

  return comparisonTable;
};
