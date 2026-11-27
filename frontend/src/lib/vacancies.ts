export type Rule = { name: string; requirement: string };
export type Anchor = { rating: number; description: string; points?: string };
export type Criterion = { name: string; description: string; weight: string; anchors: Anchor[] };
/** Human-editable role details only. Scorecards are not part of public write payloads. */
export type Brief = {
  title: string; jd: string; responsibilities: string; seniority: string; location: string;
  employment_type: string;
};
export type Configuration = Brief & {
  id: number; version: number; revision: number; status: "draft" | "approved";
  mandatory_rules: Rule[]; criteria: Criterion[]; missing_evidence_policy: string;
  weight_total: string; approval_errors: string[]; role_brief_errors: string[]; scorecard_errors: string[];
  scorecard_state: "awaiting_generation" | "needs_review" | "ready";
  scorecard_generation_available: boolean;
  approved_by: number | null; approved_at: string | null;
  created_at: string; updated_at: string; unknown_evidence: string; rating_to_points: string;
};
export type Vacancy = {
  id: number; title: string; status: "draft" | "approved" | "archived"; draft_id: number | null;
  approved_version_id: number | null; approved_version: number | null; versions?: Configuration[];
};
export function editableBrief(version: Configuration): Brief {
  return {
    title: version.title, jd: version.jd, responsibilities: version.responsibilities,
    seniority: version.seniority, location: version.location, employment_type: version.employment_type,
  };
}
