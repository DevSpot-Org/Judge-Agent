import fs from "fs";
import path from "path";
import { TEMPORARY_FOLDER } from "../constants";
import { generateProjectInfo } from "../judges/submit/agent";
import { SubmissionSchema } from "../schema";
import type { Project } from "../types/entities";
import repomixBundler from "../utils/repomix";
import { getRepoName } from "../utils/repos";
import DevspotService from "./devspot";
import Judge from "./judge";

class JudgeBot {
  protected failedSubmissions: string[] = [];

  constructor() {
    this.failedSubmissions = [];
  }

  async judge_project(project_id: number) {
    await this.getProjectInfo(project_id)
      .then(this.validateProject)
      .then(this.bundleProject)
      .then(this.judgeProject)
      .then(this.cleanup);

    // this.logFailedSubmissions();
  }

  async create_submit_generation_flow(project_url: string) {
    try {
      await repomixBundler(project_url ?? "");

      const response = await generateProjectInfo(project_url);

      const repoName = getRepoName(project_url);
      const repoPath = `${TEMPORARY_FOLDER}/repositories`;

      const outputFileName = `${repoName}-pack.xml`;
      const outputPath = path.join(repoPath, outputFileName);

      try {
        if (fs.existsSync(outputPath)) {
          fs.rmSync(outputPath, { recursive: true, force: true });
        }
      } catch (error) {
        console.error(`Error cleaning up repository files: ${error}`);
      }

      return response;
    } catch (error) {
      console.error(`Error generating project Information: ${error}`);

      throw error;
    }
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
      console.log(this.failedSubmissions);
      this.failedSubmissions?.push(project.name);

      throw error;
    }
  }

  private async bundleProject(project: Project) {
    try {
      await repomixBundler(project.project_url ?? "");

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
        const judge = new Judge(project, hackathonChallenge);
        const response = await judge.projectJudgeAnalysis();

        const devSpotService = new DevspotService();

        await devSpotService.updateProjectJudgeReport(
          project.id,
          hackathonChallenge.id,
          response
        );

        console.log("Report generated successfully!");
      } catch (error) {
        // this.failedSubmissions.push(project.name);

        console.error(
          `Failed to process report for ${project.name} ${hackathonChallenge.challenge_name}:`,
          error
        );
      }
    }

    return project;
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

  private cleanup(project: Project) {
    const repoName = getRepoName(project.project_url!);
    const repoPath = `${TEMPORARY_FOLDER}/repositories`;

    const outputFileName = `${repoName}-pack.xml`;
    const outputPath = path.join(repoPath, outputFileName);

    try {
      if (fs.existsSync(outputPath)) {
        fs.rmSync(outputPath, { recursive: true, force: true });
      }
    } catch (error) {
      console.error(`Error cleaning up repository files: ${error}`);
    }
  }
}

export default JudgeBot;
