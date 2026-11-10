import { NextResponse } from "next/server";

const RPC = "https://rpc.mainnet.near.org";

function validAccountId(value: string) {
  return value.length <= 64 && /^[a-z0-9._-]+$/.test(value);
}

async function rpc(method: string, params: Record<string, unknown>) {
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "circlehub-dashboard",
      method,
      params,
    }),
    cache: "no-store",
  });

  if (!response.ok) throw new Error("NEAR RPC is temporarily unavailable.");

  const payload = await response.json();
  if (payload.error) {
    throw new Error("NEAR mainnet could not return the requested DAO data.");
  }

  return payload.result;
}

async function viewMethod(
  accountId: string,
  methodName: string,
  args: Record<string, unknown> = {},
) {
  const bytes = new TextEncoder().encode(JSON.stringify(args));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  const result = await rpc("query", {
    request_type: "call_function",
    finality: "final",
    account_id: accountId,
    method_name: methodName,
    args_base64: btoa(binary),
  });

  if (!Array.isArray(result?.result)) {
    throw new Error(`Could not read ${methodName} from the DAO.`);
  }

  return JSON.parse(
    new TextDecoder().decode(new Uint8Array(result.result)),
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ daoAccountId: string }> },
) {
  try {
    const { daoAccountId } = await context.params;

    if (
      !validAccountId(daoAccountId) ||
      !daoAccountId.endsWith(".sputnik-dao.near")
    ) {
      return NextResponse.json(
        { error: "Invalid SputnikDAO account ID." },
        { status: 400 },
      );
    }

    const [account, config, policy, proposalsResult] = await Promise.all([
      rpc("query", {
        request_type: "view_account",
        finality: "final",
        account_id: daoAccountId,
      }),
      viewMethod(daoAccountId, "get_config"),
      viewMethod(daoAccountId, "get_policy"),
      viewMethod(daoAccountId, "get_proposals", {
        from_index: "0",
        limit: 50,
      }).then((value) => ({ ok: true as const, value }))
        .catch(() => ({ ok: false as const, value: [] })),
    ]);

    const roles = Array.isArray(policy?.roles) ? policy.roles : [];
    const voters = new Set<string>();

    for (const role of roles) {
      if (
        !Array.isArray(role.permissions) ||
        !role.permissions.includes("*:VoteApprove")
      ) continue;

      const group = role.kind?.Group ?? role.kind?.group;
      if (Array.isArray(group)) {
        for (const member of group) {
          if (typeof member === "string") voters.add(member);
        }
      }
    }

    const proposals = Array.isArray(proposalsResult.value)
      ? proposalsResult.value
      : [];

    const openStatuses = new Set(["InProgress", "in_progress"]);
    const pendingStatuses = new Set(["Approved", "ApprovedWithVote", "approved"]);

    const openProposals = proposals.filter((proposal: any) =>
      openStatuses.has(String(proposal.status)),
    );

    const pendingDecisions = proposals.filter((proposal: any) =>
      pendingStatuses.has(String(proposal.status)),
    );

    return NextResponse.json({
      accountId: daoAccountId,
      name: typeof config?.name === "string" ? config.name : daoAccountId,
      purpose: typeof config?.purpose === "string" ? config.purpose : "",
      balanceYocto: String(account.amount ?? "0"),
      votingMembers: voters.size,
      openProposals: openProposals.length,
      pendingDecisions: pendingDecisions.length,
      proposals: proposals.slice(0, 8).map((proposal: any) => ({
        id: String(proposal.id ?? ""),
        description: String(proposal.description ?? "Untitled proposal"),
        kind: Array.isArray(proposal.kind)
          ? String(proposal.kind[0] ?? "Proposal")
          : String(proposal.kind?.Transfer ? "Transfer" : "Community proposal"),
        status: String(proposal.status ?? "Unknown"),
        proposer: String(proposal.proposer ?? ""),
        submissionTime: String(proposal.submission_time ?? ""),
      })),
      proposalsAvailable: proposalsResult.ok,
      network: "mainnet",
      source: "NEAR mainnet",
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Unable to load community data from NEAR mainnet.",
      },
      { status: 502 },
    );
  }
}
