import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const NEAR_RPC = "https://free.rpc.fastnear.com";

const EXPECTED = {
  weightKind: "RoleWeight",
  quorum: "0",
  threshold: [1, 2],
  proposalBond: "0",
  proposalPeriod: "604800000000000",
  bountyBond: "1000000000000000000000000",
  bountyForgivenessPeriod: "86400000000000",
};

function validAccountId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 64 &&
    /^[a-z0-9._-]+$/.test(value)
  );
}

function hasPermissions(role: any, expected: string[]): boolean {
  if (!Array.isArray(role?.permissions)) return false;

  return (
    role.permissions.length === expected.length &&
    expected.every((permission) =>
      role.permissions.includes(permission)
    )
  );
}

function groupMembers(role: any): unknown[] | null {
  const group = role?.kind?.Group ?? role?.kind?.group;
  return Array.isArray(group) ? group : null;
}

async function rpc(
  method: string,
  params: Record<string, unknown>,
): Promise<any> {
  const response = await fetch(NEAR_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "circlehub-dao-verification",
      method,
      params,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("NEAR RPC is temporarily unavailable.");
  }

  const payload = await response.json();

  if (payload.error) {
    throw new Error("NEAR RPC could not verify the DAO.");
  }

  return payload.result;
}

async function viewMethod(
  accountId: string,
  methodName: string,
): Promise<any> {
  const result = await rpc("query", {
    request_type: "call_function",
    finality: "final",
    account_id: accountId,
    method_name: methodName,
    args_base64: "e30=",
  });

  if (!Array.isArray(result?.result)) {
    throw new Error(`Could not read ${methodName} from the DAO.`);
  }

  return JSON.parse(
    new TextDecoder().decode(new Uint8Array(result.result)),
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const accountId = body.accountId;
    const creatorAccountId = body.creatorAccountId;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const category = typeof body.category === "string" ? body.category : "other";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const purpose = typeof body.purpose === "string" ? body.purpose.trim() : "";
    const membership = body.membership === "invite" ? "invite" : "open";
    const creationTxHash =
      typeof body.creationTxHash === "string" ? body.creationTxHash : null;

    if (
      !name ||
      name.length > 60 ||
      !description ||
      description.length > 400 ||
      !purpose ||
      purpose.length > 300 ||
      !["education", "creative", "events", "technology", "social", "other"].includes(category) ||
      (body.membership !== "open" && body.membership !== "invite")
    ) {
      return NextResponse.json(
        { verified: false, error: "Invalid community details." },
        { status: 400 },
      );
    }

    if (
      !validAccountId(accountId) ||
      !accountId.endsWith(".sputnik-dao.near") ||
      !validAccountId(creatorAccountId)
    ) {
      return NextResponse.json(
        { verified: false, error: "Invalid DAO or creator account ID." },
        { status: 400 },
      );
    }

    const code = await rpc("query", {
      request_type: "view_code",
      finality: "final",
      account_id: accountId,
    });

    if (!code?.code_base64) {
      return NextResponse.json({
        verified: false,
        error: "DAO contract code is not confirmed on-chain.",
      });
    }

    const [policy, config] = await Promise.all([
      viewMethod(accountId, "get_policy"),
      viewMethod(accountId, "get_config"),
    ]);

    const roles = Array.isArray(policy?.roles) ? policy.roles : [];
    const admin = roles.find((role: any) => role.name === "admin");
    const members = roles.find((role: any) => role.name === "members");

    const adminGroup = groupMembers(admin);
    const memberGroup = groupMembers(members);

    const everyoneCanPropose = roles.some((role: any) =>
      role.kind === "Everyone" &&
      Array.isArray(role.permissions) &&
      role.permissions.includes("*:AddProposal")
    );

    const defaultPolicy = policy?.default_vote_policy;
    const threshold = defaultPolicy?.threshold;

    const policyMatches =
      roles.length === 2 &&
      admin &&
      members &&
      Array.isArray(adminGroup) &&
      adminGroup.length === 1 &&
      adminGroup[0] === creatorAccountId &&
      Array.isArray(memberGroup) &&
      memberGroup.length === 1 &&
      memberGroup[0] === creatorAccountId &&
      hasPermissions(admin, [
        "*:AddProposal",
        "*:Finalize",
        "*:VoteApprove",
        "*:VoteReject",
      ]) &&
      hasPermissions(members, [
        "*:VoteApprove",
        "*:VoteReject",
      ]) &&
      !everyoneCanPropose &&
      defaultPolicy?.weight_kind === EXPECTED.weightKind &&
      String(defaultPolicy?.quorum) === EXPECTED.quorum &&
      Array.isArray(threshold) &&
      threshold.length === 2 &&
      Number(threshold[0]) === EXPECTED.threshold[0] &&
      Number(threshold[1]) === EXPECTED.threshold[1] &&
      String(policy.proposal_bond) === EXPECTED.proposalBond &&
      String(policy.proposal_period) === EXPECTED.proposalPeriod &&
      String(policy.bounty_bond) === EXPECTED.bountyBond &&
      String(policy.bounty_forgiveness_period) ===
        EXPECTED.bountyForgivenessPeriod;

    if (!policyMatches) {
      return NextResponse.json({
        verified: false,
        error:
          "The DAO exists, but its governance policy does not match CircleHub's expected configuration.",
      });
    }

    if (
      !config ||
      typeof config.name !== "string" ||
      typeof config.purpose !== "string"
    ) {
      return NextResponse.json({
        verified: false,
        error: "The DAO configuration could not be verified.",
      });
    }

    const communityData = {
      name,
      description,
      created_by: creatorAccountId,
      category,
      purpose,
      membership,
      dao_account_id: accountId,
      creation_tx_hash: creationTxHash,
      dao_code_hash: code.hash ?? null,
    };

    const { error: insertError } = await supabaseAdmin
      .from("communities")
      .insert(communityData);

    if (insertError) {
      if (insertError.code !== "23505") {
        console.error("Community database save failed:", insertError.message);
        return NextResponse.json(
          { verified: false, error: "DAO verified, but saving the community to the database failed." },
          { status: 500 },
        );
      }

      const { data: existing, error: lookupError } = await supabaseAdmin
        .from("communities")
        .select("created_by")
        .eq("dao_account_id", accountId)
        .maybeSingle();

      if (lookupError || !existing || existing.created_by !== creatorAccountId) {
        return NextResponse.json(
          { verified: false, error: "This DAO account is already registered or could not be safely confirmed." },
          { status: 409 },
        );
      }
    }

    return NextResponse.json({
      verified: true,
      saved: true,
      policyVerified: true,
      accountId,
      codeHash: code.hash ?? null,
      daoName: config.name,
    });
  } catch {
    return NextResponse.json(
      {
        verified: false,
        error:
          "Unable to verify the DAO contract and policy on NEAR mainnet.",
      },
      { status: 502 },
    );
  }
}
