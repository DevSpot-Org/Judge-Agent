import DevspotService from "./src/devspot";
import repomixBundler from "./src/lib/repomix";
import { SubmissionSchema } from "./src/schema";
import { produceReport } from "./src/services/report/produce-report";
import type { Project } from "./src/types/entities";
// import { logParsedDataResults } from "./src/utils/logging";

const main = async () => {
  // const submissionData = await getSubmissionsData();
  // logParsedDataResults(submissionData);
  const failedSubmissions: string[] = [];

  // console.log("Starting to pull repositories...");
  // for (const submission of submissionData.validSubmissions) {
  //   await pullRepo(submission);
  // }

  // console.log("\nGenerating individual reports...");
  // for (const submission of submissionData.validSubmissions) {
  //   try {
  //     console.log(`\nProcessing report for: ${submission.name}`);
  //     await produceReport(submission, "gemini");
  //     console.log("Report generated successfully!");
  //   } catch (error) {
  //     console.error(`Failed to process report for ${submission.name}:`, error);
  //     failedSubmissions.push(submission.name);
  //   }
  // }

  // if (failedSubmissions.length > 0) {
  //   console.log("\n\nFailed to analyze the following submissions:");
  //   failedSubmissions.forEach((name) => console.log(`- ${name}`));
  //   console.log(`Total failed: ${failedSubmissions.length}`);
  // } else {
  //   console.log("\n\nAll submissions were analyzed successfully!");
  // }

  // // Comment out or remove the comparison report generation since we only have one report
  // console.log("\nGenerating final comparison report...");
  // try {
  //   await aggregateAllReports();
  //   console.log("\nFinal comparison report generated successfully!");
  // } catch (error) {
  //   console.error("Failed to generate comparison report:", error);
  // }
  // await findHighestScore();
};

// main();

// The jdge bot takes in a project information
//

class JudgeBot {
  failedSubmissions: string[];

  constructor() {
    this.failedSubmissions = ["ds"];
  }

  async start(project_id: number) {
    await this.getProjectInfo(project_id)
      .then(this.validateProject)
      .then(this.bundleProject)
      .then(this.judgeProject)
      .then(this.writeReportToDb)
      .then(this.logFailedSubmissions);

      this.logFailedSubmissions()
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

  async writeReportToDb() {
    // Aggregate the reports
    //...
  }
}

const bot = new JudgeBot();
bot.start(41);
