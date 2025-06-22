import axios from 'axios';
import { Worker, type Job } from 'bullmq';
import fs from 'fs';
import path from 'path';
import { TEMPORARY_FOLDER } from './constants';
import { cacheCreds } from './core/cache';
import { getProjectChallengesScores, getProjectInformation, getUnJudgedProjects, updateProjectJudgeReportBulk } from './core/devspot';
import BulkJudge from './judge_project';
import { addProjectToQueue, getQueueLength, setBatchRefillCallback, setConcurrency, startQueueProcessing } from './judge_project/utils/queue';
import { processLLMJob } from './llmProviders/worker';
import type { HackathonChallenges, Project } from './types/entities';
import { repomixBundler } from './utils/codeRetrieval';
import { getEstimtedTokenSize } from './utils/prompt-size';
import { getRepoName } from './utils/repos';
import { SubmissionSchema } from './utils/schema';
import supabase from './utils/supabase';

const getUnjudgedProjectsForQueue = async () => {
    const projects = await getUnJudgedProjects();
    const invalidProjects: Project[] = [];
    const validProjects: Project[] = [];

    await Promise.all(
        projects.map(async project => {
            try {
                const result = await SubmissionSchema.safeParseAsync(project);

                if (!result.success) {
                    invalidProjects.push(project);
                    throw new Error(`Invalid Project - ${result.error}`);
                }

                validProjects.push(project);
            } catch (error) {
                console.error(`Error validating project information: ${error}`);
            }
        })
    );

    return validProjects;
};

const judgeProject = async (project: Project) => {
    try {
        console.log(`\nProcessing project: ${project.name}`);
        await repomixBundler(project.project_url ?? '');

        const allChallenges = project.project_challenges?.map(item => item.hackathon_challenges) as HackathonChallenges[];

        const challengeArray = allChallenges.map(item => item.id);

        const estimatedFileTokens = getEstimtedTokenSize(project?.project_url ?? '');

        if (estimatedFileTokens > 500000) {
            await Promise.all(
                challengeArray.map(async item => {
                    await supabase
                        .from('judging_bot_scores')
                        .upsert(
                            {
                                project_id: project?.id,
                                challenge_id: item,
                                ai_judged: true,
                            },
                            {
                                onConflict: 'project_id,challenge_id',
                            }
                        )
                        .select('*')
                        .maybeSingle();
                })
            );

            cleanup(project);

            return {
                project,
                allReviews: [],
            };
        }

        const alreadyJudgedChallenges = await getProjectChallengesScores(challengeArray, project.id);

        const notJudgedChallenges = allChallenges.filter(challenge => !alreadyJudgedChallenges.find(score => score.challenge_id === challenge.id));

        if (notJudgedChallenges.length <= 0) {
            cleanup(project);

            return {
                project,
                allReviews: alreadyJudgedChallenges,
            };
        }

        const judge = new BulkJudge(project, notJudgedChallenges!);

        const response = await judge.projectJudgeAnalysis();

        const data = await updateProjectJudgeReportBulk(project.id, response);

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

const main = async () => {
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

    if (length < 5) await addProjectToQueue(project);
};

main();
