import type { Database } from "./database";

type DatabaseTables = Database["public"]["Tables"];

export type HackathonChallenges = DatabaseTables["hackathon_challenges"]["Row"];

export type ProjectChallenges = DatabaseTables["project_challenges"]["Row"] & {
  hackathon_challenges: HackathonChallenges;
};
export type Project = DatabaseTables["projects"]["Row"] & {
  project_challenges?: Partial<ProjectChallenges>[];
};
