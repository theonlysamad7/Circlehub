import { connection } from "next/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const RPC = "https://rpc.mainnet.near.org";

async function isDaoMember(daoAccountId: string, walletId: string) {
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "circlehub",
      method: "query",
      params: {
        request_type: "call_function",
        finality: "final",
        account_id: daoAccountId,
        method_name: "get_policy",
        args_base64: Buffer.from("{}").toString("base64"),
      },
    }),
  });

  const payload = await response.json();

  if (!response.ok || payload.error || !Array.isArray(payload.result?.result)) {
    throw new Error(`Unable to check membership for ${daoAccountId}.`);
  }

  const decoded = JSON.parse(
    new TextDecoder().decode(new Uint8Array(payload.result.result)),
  );

  const policy = decoded.Current || decoded;
  const roles = Array.isArray(policy.roles) ? policy.roles : [];

  return roles.some((role: any) => {
    const group = role.kind?.Group;
    return Array.isArray(group) &&
      group.some(
        (member: string) => member.toLowerCase() === walletId.toLowerCase(),
      );
  });
}

export async function GET(request: Request) {
  await connection();
  try {
    const walletId = new URL(request.url).searchParams.get("member");

    if (
      walletId &&
      !/^[a-z0-9._-]{2,64}$/.test(walletId)
    ) {
      return NextResponse.json(
        { error: "Invalid NEAR wallet account ID." },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("communities")
      .select(
        "id, name, description, category, purpose, membership, dao_account_id, created_by, created_at",
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Community list lookup failed:", error.message);
      return NextResponse.json(
        { error: "Unable to load communities." },
        { status: 500 },
      );
    }

    let communities = data || [];

    if (walletId) {
      const membershipChecks = await Promise.all(
        communities.map(async (community) => ({
          community,
          isMember: await isDaoMember(
            community.dao_account_id,
            walletId,
          ),
        })),
      );

      communities = membershipChecks
        .filter((item) => item.isMember)
        .map((item) => item.community);
    }

    return NextResponse.json({ communities });
  } catch (error) {
    console.error("Communities API error:", error);

    return NextResponse.json(
      { error: "Unable to retrieve communities. Please try again." },
      { status: 500 },
    );
  }
}
