import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { JsonRpcProvider } from "near-api-js";
import { verifyMessage } from "near-api-js/nep413";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  buildCreateEventMessage,
  EVENT_SIGNING_RECIPIENT,
} from "@/lib/event-auth";

const RPC = "https://rpc.mainnet.near.org";

function validDaoAccount(value: string) {
  return /^[a-z0-9._-]{2,64}$/.test(value);
}

async function isDaoAdmin(daoAccountId: string, accountId: string) {
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "circlehub-event-policy",
      method: "query",
      params: {
        request_type: "call_function",
        finality: "final",
        account_id: daoAccountId,
        method_name: "get_policy",
        args_base64: Buffer.from("{}").toString("base64"),
      },
    }),
    cache: "no-store",
  });

  const result = await response.json();

  if (!response.ok || result.error || !result.result?.result) {
    throw new Error("Unable to verify the DAO's admin permissions.");
  }

  const decoded = JSON.parse(
    Buffer.from(result.result.result).toString("utf8"),
  );

  const policy = decoded.Current || decoded;
  const roles = Array.isArray(policy.roles) ? policy.roles : [];

  return roles.some((role: {
    name?: string;
    kind?: { Group?: string[] };
    permissions?: string[];
  }) => {
    const members = role.kind?.Group || [];
    const permissions = role.permissions || [];

    return (
      role.name === "admin" &&
      members.includes(accountId) &&
      permissions.includes("*:AddProposal")
    );
  });
}

export async function POST(request: Request) {
  try {
    console.log("[EVENT] 1: Request received");
    const body = await request.json();

    const daoAccountId = String(body.daoAccountId || "").trim();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const fundingGoal = String(body.fundingGoal || "").trim();
    const deadline = body.deadline ? String(body.deadline) : null;

    const accountId = String(body.accountId || "").trim();
    const publicKey = String(body.publicKey || "").trim();
    const signature = String(body.signature || "").trim();
    const nonce = body.nonce;

    if (!validDaoAccount(daoAccountId)) {
      return NextResponse.json({ error: "Invalid DAO account." }, { status: 400 });
    }

    if (!title || title.length > 100) {
      return NextResponse.json(
        { error: "Event title is required and must be under 100 characters." },
        { status: 400 },
      );
    }

    if (description.length > 2000) {
      return NextResponse.json(
        { error: "Event description is too long." },
        { status: 400 },
      );
    }

    if (
      !/^\d{1,14}(\.\d{1,6})?$/.test(fundingGoal) ||
      Number(fundingGoal) <= 0
    ) {
      return NextResponse.json(
        { error: "Enter a valid funding goal with up to 6 decimal places." },
        { status: 400 },
      );
    }

    if (
      !/^[a-z0-9._-]{2,64}$/.test(accountId) ||
      !publicKey ||
      !signature ||
      !Array.isArray(nonce) ||
      nonce.length !== 32 ||
      !nonce.every((value: unknown) =>
        Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 255
      )
    ) {
      return NextResponse.json(
        { error: "Wallet signature details are invalid." },
        { status: 400 },
      );
    }

    if (deadline && Number.isNaN(Date.parse(deadline))) {
      return NextResponse.json(
        { error: "Invalid event deadline." },
        { status: 400 },
      );
    }

    const signatureBytes = Buffer.from(signature, "base64");

    if (
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(signature) ||
      signatureBytes.length !== 64 ||
      signatureBytes.toString("base64") !== signature
    ) {
      return NextResponse.json(
        { error: "The wallet returned an invalid NEP-413 signature encoding." },
        { status: 400 },
      );
    }

    const nonceBytes = Uint8Array.from(nonce);
    const nonceHash = createHash("sha256")
      .update(nonceBytes)
      .digest("hex");

    console.log("[EVENT] 2: Checking nonce in Supabase");
    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from("event_auth_nonces")
      .select("nonce_hash, account_id, expires_at")
      .eq("nonce_hash", nonceHash)
      .eq("account_id", accountId)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (challengeError || !challenge) {
      return NextResponse.json(
        { error: "Wallet verification expired or was already used. Please try again." },
        { status: 401 },
      );
    }

    const message = buildCreateEventMessage({
      daoAccountId,
      title,
      description,
      fundingGoal,
      deadline,
    });

    console.log("[EVENT] 3: Verifying NEAR signature");

    try {
      const provider = new JsonRpcProvider({ url: RPC });
      console.log("[EVENT] 3a: Provider created");

      await verifyMessage({
        signerAccountId: accountId,
        signerPublicKey: publicKey,
        payload: {
          message,
          recipient: EVENT_SIGNING_RECIPIENT,
          nonce: nonceBytes,
        },
        signature: Uint8Array.from(signatureBytes),
        provider,
      });

      console.log("[EVENT] 3b: Signature verified successfully");
    } catch (error) {
      console.error(
        "[EVENT] SIGNATURE ERROR:",
        error instanceof Error ? error.stack || error.message : String(error)
      );

      return NextResponse.json(
        {
          error: "NEAR signature verification failed.",
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 401 },
      );
    }

    console.log("[EVENT] 4: Checking DAO admin");
    const admin = await isDaoAdmin(daoAccountId, accountId);

    if (!admin) {
      return NextResponse.json(
        { error: "Only this community's DAO admin can create events." },
        { status: 403 },
      );
    }

    // Atomically consume the challenge to prevent replay.
    console.log("[EVENT] 5: Consuming nonce");
    const { data: consumed, error: consumeError } = await supabaseAdmin
      .from("event_auth_nonces")
      .delete()
      .eq("nonce_hash", nonceHash)
      .eq("account_id", accountId)
      .gt("expires_at", new Date().toISOString())
      .select("nonce_hash")
      .maybeSingle();

    if (consumeError || !consumed) {
      return NextResponse.json(
        { error: "This wallet verification has already been used. Please try again." },
        { status: 409 },
      );
    }

    console.log("[EVENT] 6: Finding community");
    const { data: community, error: communityError } = await supabaseAdmin
      .from("communities")
      .select("id")
      .eq("dao_account_id", daoAccountId)
      .single();

    if (communityError || !community) {
      return NextResponse.json(
        { error: "Community record could not be found." },
        { status: 404 },
      );
    }

    console.log("[EVENT] 7: Saving event");
    const { data: event, error: insertError } = await supabaseAdmin
      .from("community_events")
      .insert({
        community_id: community.id,
        title,
        description: description || null,
        funding_goal: fundingGoal,
        currency: "USDC",
        deadline: deadline ? new Date(deadline).toISOString() : null,
        status: "fundraising",
        created_by: accountId,
      })
      .select()
      .single();

    if (insertError || !event) {
      console.error("Event insert error:", insertError);
      return NextResponse.json(
        { error: "The event could not be saved." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error("Event creation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create event." },
      { status: 500 },
    );
  }
}
