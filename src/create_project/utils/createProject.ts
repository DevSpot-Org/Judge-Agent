import { sendNotification } from '../../agents/devspot';
import type { Hackathon } from '../../types/entities';
import supabase from '../../utils/supabase';
import type { CreateProjectPayload } from '.././type';

interface CreateProjectInDBOptions {
    payload: CreateProjectPayload;
    creator_id: string;
    hackathon: Pick<Hackathon, 'id' | 'name'>;
    use_project_template: boolean;
}

export const createProjectInDB = async (options: CreateProjectInDBOptions) => {
    const { creator_id, hackathon, payload, use_project_template } = options;

    const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
            submitted: false,
            tagline: payload.tagline,
            demo_url: payload?.demo_url,
            hackathon_id: hackathon.id,
            video_url: payload?.video_url,
            description: payload.description,
            project_url: payload.project_url,
            technologies: payload?.technologies,
            name: payload.name || 'Untitled Project',
            project_code_type: payload?.project_code_type,
        })

        .select()
        .single();

    if (projectError) {
        throw new Error(`Failed to Create project: ${projectError.message}`);
    }

    await createProjectTeamMember(project.id, creator_id);

    if (payload.challengeIds && use_project_template) {
        if (payload.challengeIds.length < 1) {
            await sendNotification('project-creation-error', creator_id, hackathon, "Project - Doesn't Match any existing Challenges");

            throw new Error("Project - Doesn't Match any existing Challenges");
        }

        await createProjectChallenges(project.id, payload.challengeIds);
    }

    await sendNotification('project-creation-success', creator_id, hackathon, undefined, project.id.toString());

    return project;
};

const createProjectChallenges = async (projectId: number, challengeIds: number[]) => {
    const challengeInserts = challengeIds.map(challengeId => ({
        project_id: projectId,
        challenge_id: challengeId,
    }));

    const { error: challengeError } = await supabase.from('project_challenges').insert(challengeInserts);

    if (challengeError) {
        throw new Error(`Failed to link challenges: ${challengeError.message}`);
    }
};

const createProjectTeamMember = async (projectId: number, userId: string) => {
    const { error: teamMemberError } = await supabase
        .from('project_team_members')
        .insert({
            project_id: projectId,
            user_id: userId,
            is_project_manager: true,
            status: 'confirmed',
            prize_allocation: 100,
        })
        .select()
        .single();

    if (teamMemberError) {
        throw new Error(`Failed to Add Team member: ${teamMemberError.message}`);
    }
};
