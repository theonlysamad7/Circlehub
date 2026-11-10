import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";


const NEAR_AI_URL = "https://cloud-api.near.ai/v1/chat/completions";
const MODEL = "z-ai/glm-5.3-flash";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const requestCounts = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string) {
  const now = Date.now();
  const current = requestCounts.get(key);

  if (!current || current.resetAt <= now) {
    requestCounts.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (current.count >= 12) return false;

  current.count += 1;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.NEARAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "The AI assistant is not configured yet." },
        { status: 503 },
      );
    }

    const body = await request.json();
    const daoAccountId = String(body.daoAccountId || "").toLowerCase();
    const message = String(body.message || "").trim();
    const history = Array.isArray(body.history)
      ? (body.history as ChatMessage[]).slice(-12)
      : [];

    if (!/^[a-z0-9._-]{2,64}$/.test(daoAccountId)) {
      return NextResponse.json(
        { error: "Invalid community account." },
        { status: 400 },
      );
    }

    if (!message || message.length > 4000) {
      return NextResponse.json(
        { error: "Enter a message of up to 4,000 characters." },
        { status: 400 },
      );
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    if (!rateLimit(`${ip}:${daoAccountId}`)) {
      return NextResponse.json(
        { error: "You're sending messages too quickly. Please wait a minute and try again." },
        { status: 429 },
      );
    }

    const { data: community, error: communityError } = await supabaseAdmin
      .from("communities")
      .select("name, description, category, purpose, dao_account_id")
      .eq("dao_account_id", daoAccountId)
      .maybeSingle();

    if (communityError || !community) {
      return NextResponse.json(
        { error: "Community information could not be found." },
        { status: 404 },
      );
    }

    const systemPrompt = `You are CircleHub's AI Budget Planner, a helpful conversational assistant for a community using CircleHub.

COMMUNITY CONTEXT
Name: ${community.name}
Description: ${community.description || "Not provided"}
Category: ${community.category || "Not provided"}
Purpose: ${community.purpose || "Not provided"}
NEAR DAO account: ${community.dao_account_id}

HOW TO HELP
- Be a capable, natural conversational assistant. Do not restrict yourself to budget questions.
- Help with budget planning, fundraising targets, event cost estimates, spending allocations, expense reduction, activity planning, financial explanations, and general questions from community members.
- When discussing a budget, make assumptions explicit, show calculations when useful, and distinguish estimates from verified figures.
- Use the community context when relevant. Ask for missing details when they materially affect a recommendation.
- Keep answers practical, clear, and appropriately concise.
- Do not claim to know live treasury balances, member contributions, proposal status, or current on-chain activity unless that information is explicitly supplied in the conversation.
- You cannot access wallets, move funds, create or approve proposals, release payouts, or execute transactions. Never claim to have done so.
- All treasury transfers, payouts, and governance decisions must follow the community's DAO approval process.
- Do not request private keys, seed phrases, passwords, or API credentials.`;

    const validHistory = history
      .filter(
        (item) =>
          item &&
          (item.role === "user" || item.role === "assistant") &&
          typeof item.content === "string",
      )
      .map((item) => ({
        role: item.role,
        content: item.content.slice(0, 4000),
      }));

    const aiResponse = await fetch(NEAR_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          ...validHistory,
          { role: "user", content: message },
        ],
        temperature: 0.6,
        max_tokens: 1000,
        stream: false,
      }),
      cache: "no-store",
    });

    const result = await aiResponse.json().catch(() => null);

    if (!aiResponse.ok) {
      console.error("NEAR AI request failed:", aiResponse.status, result);
      return NextResponse.json(
        { error: "The AI assistant couldn't complete that response. Please try again." },
        { status: 502 },
      );
    }

    const content = result?.choices?.[0]?.message?.content;
    const reply = typeof content === "string"
      ? content.trim()
      : Array.isArray(content)
        ? content.map((part: { text?: string }) => part?.text || "").join("").trim()
        : "";

    if (!reply) {
      return NextResponse.json(
        { error: "The AI assistant returned an empty response. Please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ reply, model: MODEL });
  } catch (error) {
    console.error("CircleHub AI chat error:", error);
    return NextResponse.json(
      { error: "Something went wrong while contacting the AI assistant." },
      { status: 500 },
    );
  }
}
