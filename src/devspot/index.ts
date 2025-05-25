import type { SupabaseClient } from "@supabase/supabase-js";
import supabase from "../lib/supabase";
import type { HackathonChallenges, Project } from "../types/entities";

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
}

export default DevspotService;
