// ── Message ──────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// ── Profile ───────────────────────────────────────────────────────────────────

export type InterestTag = string;

export interface Opportunity {
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
  /** Populated by extractProfile; consumed and removed by the API route */
  _opportunityQueries?: string[];
}

// ── API ───────────────────────────────────────────────────────────────────────

export interface ChatRequest {
  messages: Omit<Message, "id">[];
}

export interface ChatResponse {
  message: string;
  profile?: ProfileData;
}

// ── UI state ──────────────────────────────────────────────────────────────────

export type ChatStatus = "chatting" | "generating_profile" | "done";
