import type Anthropic from "@anthropic-ai/sdk";
import { CATALOG, matchOpportunities, retrieveCandidates } from "./opportunities";
import type { Opportunity, OpportunityFilters } from "./types";

// ── Semantic reranking ───────────────────────────────────────────────────
// A real production version of this would embed the transcript and the
// catalog and do a vector-search nearest-neighbours lookup. There's no
// vector DB or embeddings endpoint wired into this environment, so this
// takes the honest two-stage shape of that architecture instead: a cheap,
// fast model reads the actual conversation and re-ranks a candidate pool by
// relevance (semantic understanding), rather than the keyword/tag-overlap
// heuristic in opportunities.ts scoring the pool alone. Swap this call for
// a real vector search once one exists — the rest of the pipeline (the
// RETRIEVED OPPORTUNITIES block, the discriminating-question prompt) is
// already shaped to consume whatever ranked list comes back.

const RERANK_MODEL = "claude-haiku-4-5-20251001";

function buildCandidatePool(filters: OpportunityFilters, poolSize: number): Opportunity[] {
  const heuristic = matchOpportunities(filters, poolSize);
  if (heuristic.length >= poolSize) return heuristic;
  const seen = new Set(heuristic.map((o) => o.id));
  const rest = CATALOG.filter((o) => !seen.has(o.id));
  return [...heuristic, ...rest].slice(0, poolSize);
}

export async function semanticRetrieve(
  anthropic: Anthropic,
  transcriptText: string,
  filters: OpportunityFilters,
  limit = 5,
): Promise<Opportunity[]> {
  const pool = buildCandidatePool(filters, Math.max(limit * 2, 8));
  if (!transcriptText.trim() || pool.length === 0) return retrieveCandidates(filters, limit);

  const catalogBlock = pool
    .map(
      (o) =>
        `${o.id}: ${o.title} — category: ${o.category ?? "?"}, sub-tags: ${o.subTags?.join(", ") ?? "?"}, format: ${o.format ?? "?"}, group: ${o.groupSize ?? "?"}, skill: ${o.skillLevel ?? "?"}`,
    )
    .join("\n");

  try {
    const response = await anthropic.messages.create({
      model: RERANK_MODEL,
      max_tokens: 150,
      system:
        "You rank youth-programme catalog entries by relevance to a conversation transcript. Respond with ONLY a JSON array of entry ids, most relevant first, no other text.",
      messages: [
        {
          role: "user",
          content: `TRANSCRIPT:\n${transcriptText}\n\nCATALOG ENTRIES:\n${catalogBlock}\n\nReturn the ${limit} most relevant entry ids as a JSON array, most relevant first.`,
        },
      ],
    });

    const block = response.content[0];
    if (block?.type !== "text") throw new Error("Unexpected response type");

    const match = /\[[\s\S]*\]/.exec(block.text);
    if (!match) throw new Error("No JSON array in rerank response");

    const ids = JSON.parse(match[0]) as unknown;
    if (!Array.isArray(ids)) throw new Error("Rerank response was not an array");

    const byId = new Map(pool.map((o) => [o.id, o]));
    const ranked = ids
      .filter((id): id is string => typeof id === "string" && byId.has(id))
      .map((id) => byId.get(id)!);

    return ranked.length ? ranked.slice(0, limit) : retrieveCandidates(filters, limit);
  } catch (err) {
    console.error("[semanticRetrieval] rerank failed, falling back to heuristic:", err);
    return retrieveCandidates(filters, limit);
  }
}
