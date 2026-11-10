export const SPUTNIK_FACTORY = "sputnik-dao.near";

export const SPUTNIK_CREATE_GAS = "150000000000000";

// Tentative only. Verify mainnet storage/deployment cost before signing.
export const SPUTNIK_CREATE_DEPOSIT = "10000000000000000000000";

export type CommunityDaoInput = {
  name: string;
  description: string;
  purpose: string;
  creatorAccountId: string;
};

export type CommunityDaoArgs = {
  name: string;
  args: string;
  daoAccountId: string;
};

function toBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

function makeDaoName(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 19)
    .replace(/-+$/g, "");

  const suffix = Math.random().toString(36).slice(2, 7);

  return `${slug || "circle"}-${suffix}`;
}

export function buildCommunityDaoArgs(
  input: CommunityDaoInput,
): CommunityDaoArgs {
  const creator = input.creatorAccountId.trim().toLowerCase();

  if (!/^[a-z0-9._-]+$/.test(creator) || creator.length > 64) {
    throw new Error("The connected NEAR account ID is invalid.");
  }

  if (
    !input.name.trim() ||
    !input.description.trim() ||
    !input.purpose.trim()
  ) {
    throw new Error("Complete the community name, description, and purpose.");
  }

  const name = makeDaoName(input.name);
  const daoAccountId = `${name}.${SPUTNIK_FACTORY}`;

  const config = {
    name: input.name.trim(),
    purpose: input.purpose.trim(),
    metadata: "",
  };

  const policy = {
    roles: [
      {
        name: "admin",
        kind: { Group: [creator] },
        permissions: [
          "*:AddProposal",
          "*:Finalize",
          "*:VoteApprove",
          "*:VoteReject",
        ],
        vote_policy: {},
      },
      {
        name: "members",
        kind: { Group: [creator] },
        permissions: ["*:VoteApprove", "*:VoteReject"],
        vote_policy: {},
      },
    ],
    default_vote_policy: {
      weight_kind: "RoleWeight",
      quorum: "0",
      threshold: [1, 2],
    },
    proposal_bond: "0",
    proposal_period: "604800000000000",
    bounty_bond: "1000000000000000000000000",
    bounty_forgiveness_period: "86400000000000",
  };

  const creationArgs = {
    config,
    policy,
  };

  return {
    name,
    args: toBase64Utf8(JSON.stringify(creationArgs)),
    daoAccountId,
  };
}
