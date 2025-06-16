import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { TEMPORARY_FOLDER } from '../constants';
import { SubmissionSchema } from '../schema';
import type { Project } from '../types/entities';
import { repomixBundler } from '../utils/codeRetrieval';
import { getRepoName } from '../utils/repos';
import DevspotService from './devspot';
import Judge from './judge';

const failedSubmissions: string[] = [];

class JudgeBot {
    constructor() {}

    async judge_project(project_id: number) {
        const project = await this.getProjectInfo(project_id);
        await this.validateProject(project);
        await this.bundleProject(project);
        return await this.judgeProject(project);
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
            failedSubmissions?.push(project.name);

            throw error;
        }
    }

    private async bundleProject(project: Project) {
        try {
            await repomixBundler(project.project_url ?? '');

            return project;
        } catch (error) {
            console.error(`Error bundling project codebase: ${error}`);
            failedSubmissions.push(project.name);

            throw error;
        }
    }

    private async judgeProject(project: Project) {
        const ids = [];
        const allReviews = [];

        for (const challenge of project.project_challenges ?? []) {
            const hackathonChallenge = challenge.hackathon_challenges!;

            try {
                console.log(`\nProcessing report for: ${hackathonChallenge?.challenge_name}`);
                const judge = new Judge(project, hackathonChallenge);
                const response = await judge.projectJudgeAnalysis();

                const devSpotService = new DevspotService();

                const data = await devSpotService.updateProjectJudgeReport(project.id, hackathonChallenge.id, response);
                ids.push(data?.id);
                allReviews.push(data);

                console.log('Report generated successfully!');
            } catch (error) {
                failedSubmissions.push(project.name);
                console.error(`Failed to process report for ${project.name} ${hackathonChallenge.challenge_name}:`, error);
            }
        }

        const mainServerUrl = `${process.env['NEXT_PUBLIC_PROTOCOL']}${process.env['NEXT_PUBLIC_BASE_SITE_URL']}`;
        await axios.post(`${mainServerUrl}/api/judgings/assign`, {
            botScoreIds: ids,
        });

        this.cleanup(project);

        return {
            project,
            allReviews,
        };
    }

    private logFailedSubmissions() {
        if (failedSubmissions.length > 0) {
            console.log('\n\nFailed to analyze the following submissions:');
            failedSubmissions.forEach(name => console.log(`- ${name}`));
            console.log(`Total failed: ${failedSubmissions.length}`);
        } else {
            console.log('\n\nAll submissions were analyzed successfully!');
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
