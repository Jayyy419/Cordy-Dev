import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { env } from "~/env";
import { buildRetrievalBlockFromCandidates } from "~/lib/opportunities";
import { OPENER_SYSTEM_PROMPT, OPENING_MESSAGE, parseOpener } from "~/lib/prompts";
import { checkRateLimit, clientIpFrom } from "~/lib/rateLimit";
import { semanticRetrieve } from "~/lib/semanticRetrieval";
import type { OpenerRequest, OpenerResponse } from "~/lib/types";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 30_000, maxRetries: 2 });

const FALLBACK_SUGGESTIONS = [
  "Something competitive",
  "Something creative",
  "Something hands-on",
  "Not sure yet",
];

const OPENER_RATE_LIMIT = 20;
const OPENER_RATE_WINDOW_MS = 5 * 60 * 1000;

export async function POST(request: Request): Promise<NextResponse<OpenerResponse>> {
  const { allowed, retryAfterSeconds } = checkRateLimit(
    clientIpFrom(request),
    OPENER_RATE_LIMIT,
    OPENER_RATE_WINDOW_MS,
  );
  if (!allowed) {
    return NextResponse.json(
      { message: OPENING_MESSAGE, suggestions: FALLBACK_SUGGESTIONS },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

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
