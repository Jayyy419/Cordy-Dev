// ── Request-body limits (abuse / cost-amplification guards) ──────────────
// These bound what an attacker can push through the paid LLM calls and into
// Airtable. The rate limiter caps request *frequency*; these cap the *size*
// and *shape* of each request so a single allowed request can't be a
// multi-megabyte transcript (billed twice — Haiku rerank + Sonnet) or set
// an unbounded question cap.

export const LIMITS = {
  /** Max chat messages accepted in one request (a real conversation is <~15) */
  MAX_MESSAGES: 40,
  /** Max characters per message content */
  MAX_MESSAGE_CHARS: 4000,
  /** Hard ceiling on questionsAsked/maxQuestions no matter what the client sends */
  MAX_QUESTIONS_HARD_CAP: 12,
  /** Max keys accepted in survey meta/answers combined */
  MAX_SURVEY_FIELDS: 30,
  /** Max characters for any single survey field value */
  MAX_SURVEY_VALUE_CHARS: 2000,
  /** Max categories accepted by the opener route */
  MAX_CATEGORIES: 12,
  /** Max chars of a base64 payload the /shared page will attempt to decode */
  MAX_SHARED_PAYLOAD_CHARS: 20000,
} as const;

export interface ChatMessageLike {
  role: "user" | "assistant";
  content: string;
}

/** Returns a cleaned message array, or null if the shape is invalid/abusive. */
export function validateChatMessages(input: unknown): ChatMessageLike[] | null {
  if (!Array.isArray(input) || input.length === 0) return null;
  if (input.length > LIMITS.MAX_MESSAGES) return null;

  const out: ChatMessageLike[] = [];
  for (const m of input) {
    if (typeof m !== "object" || m === null) return null;
    const role = (m as { role?: unknown }).role;
    const content = (m as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string") return null;
    if (content.length > LIMITS.MAX_MESSAGE_CHARS) return null;
    out.push({ role, content });
  }
  return out;
}

/** Clamps a client-supplied question cap into a safe range. */
export function clampMaxQuestions(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.floor(value), LIMITS.MAX_QUESTIONS_HARD_CAP);
}

export function toSafeInt(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return fallback;
  return Math.min(Math.floor(value), LIMITS.MAX_QUESTIONS_HARD_CAP);
}
