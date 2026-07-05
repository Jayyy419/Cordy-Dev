import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { env } from "~/env";
import { extractProfile, stripProfileBlock, SYSTEM_PROMPT } from "~/lib/prompts";
import type { ChatRequest, ChatResponse, Opportunity } from "~/lib/types";

const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export async function POST(request: Request): Promise<NextResponse<ChatResponse>> {
  let body: ChatRequest;
  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return NextResponse.json(
      { message: "Invalid request body" },
      { status: 400 },
    );
  }

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { message: "messages must be a non-empty array" },
      { status: 400 },
    );
  }

  let rawMessage: string;
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    });

    const block = response.content[0];
    if (block?.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }
    rawMessage = block.text;
  } catch (err) {
    console.error("[chat/route] Claude API error:", err);
    return NextResponse.json(
      { message: "Something went wrong. Please try again." },
      { status: 502 },
    );
  }

  const profileData = extractProfile(rawMessage);

  if (!profileData) {
    return NextResponse.json({ message: rawMessage });
  }

  // Profile detected — fetch real opportunities or fall back to Claude-generated ones
  const queries = (profileData as typeof profileData & { _opportunityQueries?: string[] })
    ._opportunityQueries ?? [];
  delete (profileData as Record<string, unknown>)._opportunityQueries;

  profileData.opportunities = await fetchOpportunities(queries, profileData.tags);

  return NextResponse.json({
    message: stripProfileBlock(rawMessage),
    profile: profileData,
  });
}

async function fetchOpportunities(
  queries: string[],
  tags: string[],
): Promise<Opportunity[]> {
  if (env.CORDY_API_URL) {
    try {
      const results = await Promise.all(
        queries.map((q) =>
          fetch(`${env.CORDY_API_URL}/opportunities?q=${encodeURIComponent(q)}`)
            .then((r) => r.json() as Promise<Opportunity[]>),
        ),
      );
      const seen = new Set<string>();
      return results
        .flat()
        .filter((o) => {
          if (seen.has(o.id)) return false;
          seen.add(o.id);
          return true;
        })
        .slice(0, 6);
    } catch (err) {
      console.error("[chat/route] CORDY API error, falling back:", err);
    }
  }

  return generateFallbackOpportunities(tags);
}

function generateFallbackOpportunities(tags: string[]): Opportunity[] {
  const tagList = tags.slice(0, 3).join(", ");
  return [
    {
      id: "fallback-1",
      title: "Youth Interest Workshop",
      description: `A hands-on programme exploring ${tagList} with like-minded young people in Singapore.`,
      tags,
    },
    {
      id: "fallback-2",
      title: "Community Impact Project",
      description: `Collaborate with peers to create real change in areas you care about, including ${tagList}.`,
      tags,
    },
    {
      id: "fallback-3",
      title: "Skills Accelerator Programme",
      description: `Build practical skills in ${tagList} through mentorship and project-based learning.`,
      tags,
    },
  ];
}
