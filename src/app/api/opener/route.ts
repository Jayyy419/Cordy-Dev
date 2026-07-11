import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { env } from "~/env";
import { buildRetrievalBlockFromCandidates } from "~/lib/opportunities";
import { OPENER_SYSTEM_PROMPT, OPENING_MESSAGE, parseOpener } from "~/lib/prompts";
import { semanticRetrieve } from "~/lib/semanticRetrieval";
import type { OpenerRequest, OpenerResponse } from "~/lib/types";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

const FALLBACK_SUGGESTIONS = [
  "Something competitive",
  "Something creative",
  "Something hands-on",
  "Not sure yet",
];

export async function POST(request: Request): Promise<NextResponse<OpenerResponse>> {
  let body: OpenerRequest;
  try {
    body = (await request.json()) as OpenerRequest;
  } catch {
    body = { categories: [] };
  }

  const categories = Array.isArray(body.categories) ? body.categories : [];
  const filters = categories.length === 1 ? { category: categories[0] } : {};
  const candidates = await semanticRetrieve(anthropic, categories.join(", "), filters);
  const retrievalBlock = buildRetrievalBlockFromCandidates(candidates);
  const situation = categories.length
    ? `Their picked categories from a quick tap-only warm-up: ${categories.join(", ")}.`
    : `They haven't picked any category yet — keep the opening question broad and easy.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 160,
      system: OPENER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `${situation}\n\n${retrievalBlock}` }],
    });

    const block = response.content[0];
    if (block?.type !== "text") throw new Error("Unexpected response type from Claude");

    return NextResponse.json(parseOpener(block.text));
  } catch (err) {
    console.error("[opener/route] Claude API error:", err);
    return NextResponse.json({ message: OPENING_MESSAGE, suggestions: FALLBACK_SUGGESTIONS });
  }
}
