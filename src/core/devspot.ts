import { Novu } from '@novu/api';
import type { ProjectAnalysisResult } from '../judge_project/utils/flag-logic';
import type { Hackathon, HackathonChallenges, Project } from '../types/entities';
import supabase from '../utils/supabase';

interface SectionSummary {
    fullAnalysis: string;
    summary: {
        summary: string;
        score: number;
    };
}

export interface JudgingResults {
    technical: SectionSummary;
    innovation: SectionSummary;
    ux: SectionSummary;
    business: SectionSummary;
    final: SectionSummary;
}
interface ChallengeAnalysis {
    fullAnalysis: string;
    summary: string;
    score: number;
}

type FinalBulkAnalysisResult = Record<
    string,
    {
        technical: ChallengeAnalysis;
        ux: ChallengeAnalysis;
        business: ChallengeAnalysis;
        innovation: ChallengeAnalysis;
        final: ChallengeAnalysis;
    }
>;

const sendNotification = async (workflowId: string, creator_id: string, hackathon: Pick<Hackathon, 'id' | 'name'>, message?: string, transactionId?: string) => {
    const novu = new Novu({ secretKey: process.env['NOVU_API_KEY'] });

    const hackathonProfileUrl = `${process.env['NEXT_PUBLIC_PROTOCOL']}${process.env['NEXT_PUBLIC_BASE_SITE_URL']}/en/hackathons/${hackathon?.id}`;

    await novu.trigger({
        workflowId,
        transactionId,
        to: { subscriberId: creator_id },
        payload: {
            message,
            project_id: transactionId,
            hackathon_name: hackathon?.name,
            hackathon_profile: hackathonProfileUrl,
        },
    });
};

const fetchHackathonFromDB = async (hackathon_id: number) => {
    const { data: hackathon } = await supabase.from('hackathons').select('id, name, start_date, end_date').eq('id', hackathon_id).single();

    return hackathon;
};

const getHackathonChallengesFromDB = async (hackathon_id: number) => {
    const { data, error } = await supabase.from('hackathon_challenges').select('*').eq('hackathon_id', hackathon_id);

    if (error) {
        throw new Error(`Could not fetch project: ${error.message}`);
    }

    return data as HackathonChallenges[];
};

const updateProjectJudgeReport = async (projectId: number, challengeId: number, feedback: JudgingResults) => {
    const { business, final, innovation, technical, ux } = feedback;

    const { data, error } = await supabase
        .from('judging_bot_scores')
        .insert({
            project_id: projectId,
            challenge_id: challengeId,
            ux_summary: ux.summary.summary,
            ux_feedback: ux.fullAnalysis,
            business_summary: business.summary.summary,
            business_feedback: business.fullAnalysis,
            innovation_summary: innovation.summary.summary,
            innovation_feedback: innovation.fullAnalysis,
            technical_summary: technical.summary.summary,
            technical_feedback: technical.fullAnalysis,
            score: final.summary.score ?? 0,
            general_comments_summary: final.summary.summary,
            general_comments: final.fullAnalysis,
            business_score: business.summary.score ?? 0,
            innovation_score: innovation.summary.score ?? 0,
            technical_score: technical.summary.score ?? 0,
            ux_score: ux.summary.score ?? 0,
            ai_judged: true,
        })
        .select('*')
        .maybeSingle();

    if (error) {
        console.error('Error inserting judging feedback:', error);
        throw error;
    }

    return data;
};

const updateProjectJudgeReportBulk = async (projectId: number, feedback: FinalBulkAnalysisResult) => {
    // Convert feedback object into array of records to insert
    const recordsToInsert = Object.entries(feedback).map(([challengeId, analysis]) => ({
        project_id: projectId,
        challenge_id: parseInt(challengeId),
        ux_summary: analysis.ux.summary,
        ux_feedback: analysis.ux.fullAnalysis,
        business_summary: analysis.business.summary,
        business_feedback: analysis.business.fullAnalysis,
        innovation_summary: analysis.innovation.summary,
        innovation_feedback: analysis.innovation.fullAnalysis,
        technical_summary: analysis.technical.summary,
        technical_feedback: analysis.technical.fullAnalysis,
        score: analysis.final.score ?? 0,
        general_comments_summary: analysis.final.summary,
        general_comments: analysis.final.fullAnalysis,
        business_score: analysis.business.score ?? 0,
        innovation_score: analysis.innovation.score ?? 0,
        technical_score: analysis.technical.score ?? 0,
        ux_score: analysis.ux.score ?? 0,
        ai_judged: true,
    }));

    const { data, error } = await supabase
        .from('judging_bot_scores')
        .upsert(recordsToInsert, {
            onConflict: 'project_id,challenge_id',
            ignoreDuplicates: false,
        })
        .select('*');

    if (error) {
        console.error('Error updating judging feedback:', error);
        throw error;
    }

    await updateJudgingEntriesWithAiRecord(projectId, feedback);

    return data;
};

const updateProjectFlagReport = async (projectId: number, flaggedAnalysis: ProjectAnalysisResult) => {
    const { flagged } = flaggedAnalysis;

    // Convert feedback object into array of records to insert
    const { data, error } = await supabase
        .from('judging_bot_scores')
        .update({
            suspicious_flags: flagged?.value ? flagged?.reason : null,
        })
        .eq('project_id', projectId)
        .select('*');

    if (error) {
        console.error('Error updating judging feedback:', error);
        throw error;
    }

    const { data: entryData, error: entryError } = await supabase
        .from('judging_entries')
        .update({
            suspicious_flags: flagged?.value ? flagged?.reason : null,
        })
        .eq('project_id', projectId)
        .select('*');

    if (entryError) {
        console.error('Error updating judging feedback:', entryError);
        throw entryError;
    }

    return { ...data, entryData };
};

const updateJudgingEntriesWithAiRecord = async (projectId: number, feedback: FinalBulkAnalysisResult) => {
    const { data, error } = await supabase.from('judging_entries').select('*').eq('project_id', projectId).is('updated_at', null);

    if (error) {
        console.error('Error fetching judging entries:', error);
        throw error;
    }

    const recordsToInsert = data?.map(entry => {
        const feedbackForEntry = feedback[entry.challenge_id.toString()];

        return {
            ...entry,
            ux_summary: feedbackForEntry?.ux.summary,
            ux_feedback: feedbackForEntry?.ux.fullAnalysis,
            business_summary: feedbackForEntry?.business.summary,
            business_feedback: feedbackForEntry?.business.fullAnalysis,
            innovation_summary: feedbackForEntry?.innovation.summary,
            innovation_feedback: feedbackForEntry?.innovation.fullAnalysis,
            technical_summary: feedbackForEntry?.technical.summary,
            technical_feedback: feedbackForEntry?.technical.fullAnalysis,
            score: feedbackForEntry?.final.score ?? 0,
            general_comments_summary: feedbackForEntry?.final.summary,
            general_comments: feedbackForEntry?.final.fullAnalysis,
            business_score: feedbackForEntry?.business.score ?? 0,
            innovation_score: feedbackForEntry?.innovation.score ?? 0,
            ux_score: feedbackForEntry?.ux.score ?? 0,
            technical_score: feedbackForEntry?.technical.score ?? 0,
        };
    });

    const { data: updatedData, error: errorUpdating } = await supabase.from('judging_entries').upsert(recordsToInsert).select('*');

    if (errorUpdating) {
        console.error('Error updating judging entries:', errorUpdating);
        throw errorUpdating;
    }

    return updatedData;
};

const getProjectChallengesScores = async (challengeIds: number[], projectId: number) => {
    const { data, error } = await supabase.from('judging_bot_scores').select('*').in('challenge_id', challengeIds).eq('project_id', projectId);

    if (error) {
        console.error('Error fetching challenge scores:', error);
        throw error;
    }

    return data;
};

const getUnJudgedProjects = async () => {
    const { data, error } = await supabase
        .from('judging_bot_scores')
        .select(
            `
                *, 
                project:project_id (
                    *,  
                    hackathons (*),
                    project_challenges (
                        challenge_id,
                        hackathon_challenges (*)
                    )
                )
            `
        )
        .eq('ai_judged', false)
        .eq('project.submitted', true)
        .eq('general_comments_summary', '""');

    if (error) {
        console.error('Error fetching unjudged project scores:', error);
        throw error;
    }

    // Group projects by project ID to remove duplicates
    const uniqueProjects = data?.reduce((acc, score) => {
        if (!acc[score.project.id]) {
            acc[score.project.id] = score.project;
        }
        return acc;
    }, {} as Record<number, any>);

    return Object.values(uniqueProjects);
};

const getProjectInformation = async (projectId: number) => {
    const { data, error } = await supabase
        .from('projects')
        .select(
            `
            *,
            hackathons (*),
            project_challenges (
                challenge_id,
                hackathon_challenges (*)
            )
        `
        )
        .eq('id', projectId)
        .single();

    if (error) {
        throw new Error(`Could not fetch project: ${error.message}`);
    }

    return data as Project;
};

export {
    fetchHackathonFromDB,
    getHackathonChallengesFromDB,
    getProjectChallengesScores,
    getProjectInformation,
    getUnJudgedProjects,
    sendNotification,
    updateProjectFlagReport,
    updateProjectJudgeReport,
    updateProjectJudgeReportBulk,
};
