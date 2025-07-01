import axios from 'axios';
import { Worker, type Job } from 'bullmq';
import fs from 'fs';
import path from 'path';
import { TEMPORARY_FOLDER } from './constants';
import { cacheCreds } from './core/cache';
import { getProjectChallengesScores, getProjectInformation, getUnJudgedProjects, updateProjectFlagReport, updateProjectJudgeReportBulk } from './core/devspot';
import BulkJudge from './judge_project';
import { analyzeProjectForIrregularities } from './judge_project/utils/flag-logic';
import { addProjectToQueue, getQueueLength, resumeQueue, setBatchRefillCallback, setConcurrency, startQueueProcessing } from './judge_project/utils/queue';
import { processLLMJob } from './llmProviders/worker';
import type { HackathonChallenges, Project } from './types/entities';
import { repomixBundler } from './utils/codeRetrieval';
import { getEstimtedTokenSize } from './utils/prompt-size';
import { getRepoName } from './utils/repos';
import { SubmissionSchema } from './utils/schema';
import supabase from './utils/supabase';

const getUnjudgedProjectsForQueue = async () => {
    const projects: Project[] = await getUnJudgedProjects();

    const filteredProjects = projects.filter(item => {
        const hackathon = item.hackathons;
        return hackathon && hackathon.use_judge_bot === true;
    });
    const validProjects: Project[] = [];

    await Promise.all(
        filteredProjects.map(async project => {
            try {
                const result = await validateAndProcessProject(project);
                if (result.isValid) {
                    validProjects.push(project);
                }
            } catch (error) {
                console.error(`Error validating project information: ${error}`);
            }
        })
    );

    return validProjects;
};

const validateAndProcessProject = async (project: Project) => {
    const result = await SubmissionSchema.safeParseAsync(project);

    if (!result.success) {
        await handleInvalidProject(project, result.error.issues);
        return { isValid: false };
    }

    return { isValid: true };
};

const handleInvalidProject = async (project: Project, issues: any[]) => {
    const errorMessage = issues.map(issue => `${issue.path[0]}: ${issue.message}`).join(', ');
    const challengeIds = extractChallengeIds(project);

    await updateJudgingBotScores(project.id, challengeIds, errorMessage);
};

const extractChallengeIds = (project: Project): number[] => {
    const allChallenges = project.project_challenges?.map(item => item.hackathon_challenges) as HackathonChallenges[];
    return allChallenges.map(item => item.id);
};

const updateJudgingBotScores = async (projectId: number, challengeIds: number[], errorMessage: string) => {
    await Promise.all(
        challengeIds.map(challengeId =>
            supabase
                .from('judging_bot_scores')
                .upsert(
                    {
                        project_id: projectId,
                        challenge_id: challengeId,
                        general_comments_summary: errorMessage,
                        ai_judged: false,
                    },
                    {
                        onConflict: 'project_id,challenge_id',
                    }
                )
                .select('*')
                .maybeSingle()
        )
    );
};

const judgeProject = async (project: Project, updateProgress: (progress: number, message?: string) => Promise<void>) => {
    try {
        if (!project?.hackathons?.use_judge_bot) return;

        console.log(`\nProcessing project: ${project.name}`);
        await repomixBundler(project.project_url ?? '');
        await updateProgress(20, 'Retrieved Code...Getting Flag Report');

        const allChallenges = project.project_challenges?.map(item => item.hackathon_challenges) as HackathonChallenges[];

        const challengeArray = allChallenges.map(item => item.id);

        const estimatedFileTokens = getEstimtedTokenSize(project?.project_url ?? '');

        const flaggedAnalysis = await analyzeProjectForIrregularities(project, project?.hackathons!);

        await updateProjectFlagReport(project.id, flaggedAnalysis);

        await updateProgress(30, 'Gotten Flag Report, about to Judge');

        if (estimatedFileTokens > 500000) {
            await updateJudgingBotScores(project.id, challengeArray, 'Project Codebase is too large to be processed by the AI. Please review the project manually.');

            cleanup(project);

            return {
                project,
                allReviews: [],
            };
        }

        const alreadyJudgedChallenges = await getProjectChallengesScores(challengeArray, project.id);

        const notJudgedChallenges = allChallenges.filter(
            challenge => !alreadyJudgedChallenges.find(score => score.challenge_id === challenge.id && !score.ai_judged && score.general_comments_summary == '')
        );

        if (notJudgedChallenges.length <= 0) {
            cleanup(project);

            return {
                project,
                allReviews: alreadyJudgedChallenges,
            };
        }

        const judge = new BulkJudge(project, notJudgedChallenges!);

        const response = await judge.projectJudgeAnalysis(updateProgress);

        await updateProgress(80, 'Completed Judging Code..., Saving to Database');

        const data = await updateProjectJudgeReportBulk(project.id, response);

        await updateProgress(90, 'Saved to Database Successfully');

        const botScoreIds = data?.map(item => item.id);

        const mainServerUrl = `${process.env['NEXT_PUBLIC_PROTOCOL']}${process.env['NEXT_PUBLIC_BASE_SITE_URL']}`;

        if (botScoreIds.length) {
            await axios.post(`${mainServerUrl}/api/judgings/assign`, {
                botScoreIds,
            });
        }

        cleanup(project);

        return {
            project,
            allReviews: data,
        };
    } catch (error) {
        console.log(`Error: ${error}`);

        const fallbackSheetUrl = process.env['FALLBACK_CSV_ENDPOINT'] as string;

        let errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

        const fallbackRow = {
            timestamp: new Date().toISOString(),
            projectId: project?.id,
            error: errorMessage,
        };

        await fetch(fallbackSheetUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([Object.values(fallbackRow)]),
        });
    }
};

const cleanup = (project: Project) => {
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
};

export const startApp = async () => {
    setBatchRefillCallback(getUnjudgedProjectsForQueue);

    ['groq', 'gemini', 'openai'].forEach(provider => {
        new Worker(
            `${provider}-queue`,
            async (job: Job) => {
                return await processLLMJob(job);
            },
            {
                connection: cacheCreds,
                concurrency: 2,
            }
        );
    });

    await setConcurrency(5);

    await startQueueProcessing(judgeProject);
};

export const addProject = async (projectId: number) => {
    const project = await getProjectInformation(projectId);

    const length = await getQueueLength();

    if (length < 5 && project?.hackathons?.use_judge_bot) await addProjectToQueue(project);

    resumeQueue();
};
