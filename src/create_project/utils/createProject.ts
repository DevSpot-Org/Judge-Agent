import { sendNotification } from '../../agents/devspot';
import type { Hackathon } from '../../types/entities';
import supabase from '../../utils/supabase';
import type { CreateProjectPayload } from '.././type';
import type { ProjectTeamTemplate } from '../template_based/parseProjectTemplate';

interface CreateProjectInDBOptions {
    payload: CreateProjectPayload;
    creator_id: string;
    hackathon: Pick<Hackathon, 'id' | 'name'>;
    use_project_template: boolean;
    team?: ProjectTeamTemplate[];
}

export const createProjectInDB = async (options: CreateProjectInDBOptions) => {
    const { creator_id, hackathon, payload, use_project_template, team } = options;

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

    await createProjectTeamMembers(project.id, creator_id, team);

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

interface CreateProjectInDBOptions {
    payload: CreateProjectPayload;
    creator_id: string;
    hackathon: Pick<Hackathon, 'id' | 'name'>;
    use_project_template: boolean;
    team?: ProjectTeamTemplate[];
}

const createProjectTeamMembers = async (projectId: number, creatorId: string, team?: ProjectTeamTemplate[]) => {
    const teamMembers = [];
    
    if (team && team.length > 0) {
        const emails = team.map(member => member.email);
        const { data: existingUsers, error: userError } = await supabase.from('users').select('id, email').in('email', emails);

        if (userError) {
            console.log(`Failed to fetch team members: ${userError.message}`);
            return;
        }

        const creatorInTeam = existingUsers.some(user => user.id === creatorId);
        const totalMembers = creatorInTeam ? team.length : team.length + 1;
        const prizePerMember = Math.floor(100 / totalMembers);

        teamMembers.push({
            project_id: projectId,
            user_id: creatorId,
            is_project_manager: true,
            status: 'confirmed',
            prize_allocation: prizePerMember,
        });

        existingUsers.forEach(user => {
            if (user.id !== creatorId) {
                teamMembers.push({
                    project_id: projectId,
                    user_id: user.id,
                    is_project_manager: false,
                    status: 'confirmed',
                    prize_allocation: prizePerMember,
                });
            }
        });
    } else {
        teamMembers.push({
            project_id: projectId,
            user_id: creatorId,
            is_project_manager: true,
            status: 'confirmed',
            prize_allocation: 100,
        });
    }

    const { error: teamMemberError } = await supabase.from('project_team_members').insert(
        teamMembers.map(member => ({
            ...member,
            status: member.status as 'pending' | 'rejected' | 'confirmed',
        }))
    );

    if (teamMemberError) {
        throw new Error(`Failed to Add Team members: ${teamMemberError.message}`);
    }
};
