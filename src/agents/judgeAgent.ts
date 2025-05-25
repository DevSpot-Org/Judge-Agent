import DevspotService from "../devspot";
import repomixBundler from "../lib/repomix";
import { SubmissionSchema } from "../schema";
import { produceReport } from "../services/report/produce-report";
import { generateProjectInfo } from "../services/submit/agent";
import type { Project } from "../types/entities";

class JudgeBot {
  failedSubmissions: string[];

  constructor() {
    this.failedSubmissions = [];
  }

  async start(project_id: number) {
    await this.getProjectInfo(project_id)
      .then(this.validateProject)
      .then(this.bundleProject)
      // .then(this.generateProjectChallenges);
      .then(this.judgeProject)
      .then(this.writeReportToDb);

    this.logFailedSubmissions();
  }

  private async getProjectInfo(project_id: number) {
    try {
      const devSpotService = new DevspotService();

      const project = await devSpotService.getProjectInformation(project_id);

      return project;
    } catch (error) {
      console.error(`Error fetching project information: ${error}`);
      throw error;
    }
  }

  private async validateProject(project: Project) {
    try {
      const result = await SubmissionSchema.safeParseAsync(project);

      if (!result.success) {
        throw new Error(`Invalid Project - ${result.error}`);
      }

      return project;
    } catch (error) {
      console.error(`Error validating project information: ${error}`);
      this.failedSubmissions.push(project.name);

      throw error;
    }
  }

  private async bundleProject(project: Project) {
    try {
      await repomixBundler(project);

      return project;
    } catch (error) {
      console.error(`Error bundling project codebase: ${error}`);
      this.failedSubmissions.push(project.name);

      throw error;
    }
  }

  private async judgeProject(project: Project) {
    for (const challenge of project.project_challenges ?? []) {
      const hackathonChallenge = challenge.hackathon_challenges!;

      try {
        console.log(
          `\nProcessing report for: ${hackathonChallenge?.challenge_name}`
        );
        await produceReport(project, hackathonChallenge, "gemini");
        console.log("Report generated successfully!");
      } catch (error) {
        this.failedSubmissions.push(project.name);

        console.error(
          `Failed to process report for ${hackathonChallenge.challenge_name}:`,
          error
        );
      }
    }
  }

  private logFailedSubmissions() {
    if (this.failedSubmissions.length > 0) {
      console.log("\n\nFailed to analyze the following submissions:");
      this.failedSubmissions.forEach((name) => console.log(`- ${name}`));
      console.log(`Total failed: ${this.failedSubmissions.length}`);
    } else {
      console.log("\n\nAll submissions were analyzed successfully!");
    }
  }

  private async generateProjectChallenges(project: Project) {
    try {
      await generateProjectInfo(project);

      return project;
    } catch (error) {
      console.error(`Error generating project challenges: ${error}`);

      throw error;
    }
  }

  async writeReportToDb() {
    // Aggregate the reports
    //...
  }
}

export default JudgeBot;
