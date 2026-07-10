// ── Message ──────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// ── Profile ───────────────────────────────────────────────────────────────────

export type InterestTag = string;

export type OpportunityFormat = "in-person" | "online" | "hybrid";
export type GroupSize = "solo" | "team" | "either";
export type SkillLevel = "beginner" | "intermediate" | "advanced" | "any";

/** The real filter dimensions Cordy's catalog is keyed on — see src/lib/opportunities.ts */
export interface OpportunityFilters {
  category?: string;
  subTags?: string[];
  format?: OpportunityFormat;
  groupSize?: GroupSize;
  skillLevel?: SkillLevel;
  ageMin?: number;
  ageMax?: number;
}

export interface Opportunity extends OpportunityFilters {
  id: string;
  title: string;
  description: string;
  tags: InterestTag[];
  url?: string;
}

export interface ProfileData {
  tags: InterestTag[];
  summary: string;
  opportunities: Opportunity[];
  filters?: OpportunityFilters;
  /** Populated by extractProfile; consumed and removed by the API route */
  _opportunityQueries?: string[];
}

// ── API ───────────────────────────────────────────────────────────────────────

export interface ChatRequest {
  messages: Omit<Message, "id">[];
  /** How many questions CORDY has already asked — drives server-side pacing */
  questionsAsked: number;
}

export interface ChatResponse {
  message: string;
  suggestions: string[];
  confidence: number;
  done: boolean;
  profile?: ProfileData;
}

export interface OpenerRequest {
  categories: string[];
}

export interface OpenerResponse {
  message: string;
  suggestions: string[];
}

// ── UI state ──────────────────────────────────────────────────────────────────

export type ChatStatus = "chatting" | "generating_profile" | "done";
