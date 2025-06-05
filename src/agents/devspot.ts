import { Novu } from "@novu/api";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HackathonChallenges, Project } from "../types/entities";
import supabase from "../utils/supabase";

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

interface ProjectAnalysisResult {
  challengeIds: number[];
  technologies: string[];
  description: string;
  title: string;
  tagline: string;
}

interface Hackathon {
  name: string;
  id: number;
}

class DevspotService {
  protected supabase: SupabaseClient;

  constructor() {
    this.supabase = supabase;
  }

  async getProjectInformation(projectId: number) {
    const { data, error } = await this.supabase
      .from("projects")
      .select(
        `
            *,
            project_challenges (
                challenge_id,
                hackathon_challenges (*)
            )
        `
      )
      .eq("id", projectId)
      .single();

    if (error) {
      throw new Error(`Could not fetch project: ${error.message}`);
    }

    return data as Project;
  }

  async getHackathonChallenges(hackathon_id: number) {
    const { data, error } = await this.supabase
      .from("hackathon_challenges")
      .select("*")
      .eq("hackathon_id", hackathon_id);

    if (error) {
      throw new Error(`Could not fetch project: ${error.message}`);
    }

    return data as HackathonChallenges[];
  }

  async updateProjectJudgeReport(
    projectId: number,
    challengeId: number,
    feedback: JudgingResults
  ) {
    const { business, final, innovation, technical, ux } = feedback;

    // const normalizedScore = this.extractAndNormalizeScore(final.summary.score);

    const { data, error } = await supabase
      .from("judging_entries")
      .insert([
        {
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
          score: final.summary.score,
          judging_status: "needs_review",
          general_comments_summary: final.summary.summary,
          general_comments: final.fullAnalysis,
          business_score: business.summary.score,
          innovation_score: innovation.summary.score,
          technical_score: technical.summary.score,
          ux_score: ux.summary.score,
        },
      ])
      .select();

    if (error) {
      console.error("Error inserting judging feedback:", error);
      throw error;
    }

    return data;
  }

  async fetchHackathon(hackathon_id: number) {
    const { data: hackathon } = await supabase
      .from("hackathons")
      .select("id, name")
      .eq("id", hackathon_id)
      .single();

    return hackathon;
  }

  private getHackathonProfileUrl(hackathonId: number): string {
    return `${process.env["NEXT_PUBLIC_PROTOCOL"]}${process.env["NEXT_PUBLIC_BASE_SITE_URL"]}/en/hackathons/${hackathonId}`;
  }

   async sendNotification(
    workflowId: string,
    creator_id: string,
    hackathon: Hackathon,
    message?: string,
    transactionId?: string
  ) {
    const novu = new Novu({ secretKey: process.env["NOVU_API_KEY"] });
    
    await novu.trigger({
      workflowId,
      transactionId,
      to: { subscriberId: creator_id },
      payload: {
        message,
        project_id: transactionId,
        hackathon_name: hackathon?.name,
        hackathon_profile: this.getHackathonProfileUrl(hackathon?.id),
      },
    });
  }

  async createAIProject(
    payload: ProjectAnalysisResult,
    projectUrl: string,
    creator_id: string,
    hackathon: Hackathon
  ) {
    const HACKATHON_ID = 1;
    const { technologies, description, title, tagline, challengeIds } = payload;

    try {
      if (challengeIds.length < 1) {
        await this.sendNotification(
          "project-creation-error",
          creator_id,
          hackathon,
          "Project - Doesn't Match any existing Challenges"
        );
        throw new Error("Project - Doesn't Match any existing Challenges");
      }

      const { data: project, error: projectError } = await this.supabase
        .from("projects")
        .insert({
          project_url: projectUrl,
          hackathon_id: HACKATHON_ID,
          submitted: false,
          name: title ?? "Untitled Project",
          description,
          tagline,
          technologies,
        })
        .select()
        .single();

      if (projectError) {
        throw new Error(`Failed to Create project: ${projectError.message}`);
      }

      await this.createProjectChallenges(project.id, challengeIds);
      await this.createProjectTeamMember(project.id, creator_id);
      
      await this.sendNotification(
        "project-creation-success",
        creator_id,
        hackathon,
        undefined,
        project.id.toString()
      );

      return project;
    } catch (error: any) {
      await this.sendNotification(
        "project-creation-error",
        creator_id,
        hackathon,
        error?.message
      );
      throw error;
    }
  }

  private async createProjectChallenges(projectId: number, challengeIds: number[]) {
    const challengeInserts = challengeIds.map(challengeId => ({
      project_id: projectId,
      challenge_id: challengeId,
    }));

    const { error: challengeError } = await this.supabase
      .from("project_challenges")
      .insert(challengeInserts);

    if (challengeError) {
      throw new Error(`Failed to link challenges: ${challengeError.message}`);
    }
  }

  private async createProjectTeamMember(projectId: number, userId: string) {
    const { error: teamMemberError } = await this.supabase
      .from("project_team_members")
      .insert({
        project_id: projectId,
        user_id: userId,
        is_project_manager: true,
        status: "confirmed",
        prize_allocation: 100,
      })
      .select()
      .single();

    if (teamMemberError) {
      throw new Error(`Failed to Add Team member: ${teamMemberError.message}`);
    }
  }
}

export default DevspotService;
