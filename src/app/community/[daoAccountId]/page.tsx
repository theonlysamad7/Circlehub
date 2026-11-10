"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useNearWallet } from "@/lib/near-wallet";
import styles from "./dashboard.module.css";

const RPC = "https://rpc.mainnet.near.org";
const EXPLORER = "https://nearblocks.io";
const GAS = "150000000000000";

type Proposal = {
  id: number;
  description: string;
  kind: unknown;
  status: string;
  proposer: string;
  votes?: Record<string, string>;
  vote_counts?: Record<string, number[]>;
};

type Role = {
  name: string;
  kind: "Everyone" | { Group?: string[] };
  permissions: string[];
};

type DashboardData = {
  name: string;
  purpose: string;
  balance: string;
  members: number;
  proposals: Proposal[];
  roles: Role[];
  proposalBond: string;
};

type CommunityProfile = {
  id: string;
  name: string;
  description: string;
  category: string;
  purpose: string;
  membership: "open" | "invite";
  dao_account_id: string;
  created_by: string;
  creation_tx_hash: string | null;
  created_at: string;
};

async function rpcCall(method: string, params: unknown) {
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "circlehub", method, params }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.error?.message ||
      result?.message ||
      `NEAR RPC returned HTTP ${response.status}`,
    );
  }

  if (result.error) {
    throw new Error(result.error.message || JSON.stringify(result.error));
  }

  if (result.result?.error) {
    throw new Error(result.result.error);
  }

  return result.result;
}

async function viewMethod(accountId: string, methodName: string, args = {}) {
  return rpcCall("query", {
    request_type: "call_function",
    finality: "final",
    account_id: accountId,
    method_name: methodName,
    args_base64: btoa(JSON.stringify(args)),
  });
}

function decode(result: { result?: number[] } | null) {
  if (!result?.result) return null;
  return JSON.parse(new TextDecoder().decode(new Uint8Array(result.result)));
}

function formatNear(yocto: string) {
  const amount = Number(yocto) / 1e24;
  return Number.isFinite(amount)
    ? `${amount.toLocaleString("en-US", { maximumFractionDigits: 4 })} NEAR`
    : "Unavailable";
}

function formatBond(yocto: string) {
  return `${(Number(yocto) / 1e24).toLocaleString("en-US", {
    maximumFractionDigits: 4,
  })} NEAR`;
}

function proposalDescription(proposal: Proposal) {
  if (proposal.description) return proposal.description;
  if (typeof proposal.kind === "string") return proposal.kind;
  if (proposal.kind && typeof proposal.kind === "object") {
    const key = Object.keys(proposal.kind as object)[0];
    return key ? key.replace(/([A-Z])/g, " $1") : "DAO proposal";
  }
  return "DAO proposal";
}

function hasPermission(roles: Role[], accountId: string, action: string, kind: unknown) {
  return roles.some((role) => {
    const group = role.kind === "Everyone"
      ? []
      : (role.kind as { Group?: string[] })?.Group || [];

    const member = role.kind === "Everyone" || group.includes(accountId);
    if (!member) return false;

    return role.permissions?.some((permission) => {
      const [scope, allowedAction] = permission.split(":");
      const proposalKind =
        typeof kind === "string"
          ? kind.toLowerCase()
          : kind && typeof kind === "object"
            ? Object.keys(kind as object)[0]?.toLowerCase()
            : "";

      return (
        (scope === "*" || scope.toLowerCase() === proposalKind) &&
        (allowedAction === "*" || allowedAction === action)
      );
    });
  });
}

function CommunityDashboard() {
  const params = useParams<{ daoAccountId: string }>();
  let rawDaoAccountId = params.daoAccountId || "";
  try {
    for (let i = 0; i < 3 && rawDaoAccountId.includes("%"); i++) {
      rawDaoAccountId = decodeURIComponent(rawDaoAccountId);
    }
  } catch {
    rawDaoAccountId = "";
  }
  const daoAccountId = rawDaoAccountId.toLowerCase().replace(/[^a-z0-9._-]/g, "");
  const wallet = useNearWallet();

  const [data, setData] = useState<DashboardData | null>(null);
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [profileError, setProfileError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [proposalType, setProposalType] = useState<"Vote" | "Transfer" | "AddMember">("Vote");
  const [memberAccount, setMemberAccount] = useState("");
  const [description, setDescription] = useState("");
  const [receiver, setReceiver] = useState("");
  const [amount, setAmount] = useState("");

  const loadDashboard = useCallback(async () => {
    if (!daoAccountId) return;
    setLoading(true);
    setError("");

    try {
      setProfileError("");

      const profilePromise = fetch(
        `/api/communities/${encodeURIComponent(daoAccountId)}`,
        { cache: "no-store" },
      ).then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Unable to load community profile.");
        }
        return payload.community as CommunityProfile;
      }).catch((cause) => {
        setProfileError(
          cause instanceof Error ? cause.message : "Unable to load community profile.",
        );
        return null;
      });

      const [account, configResult, policyResult, proposalsResult, savedProfile] =
        await Promise.all([
          rpcCall("query", {
            request_type: "view_account",
            finality: "final",
            account_id: daoAccountId,
          }),
          viewMethod(daoAccountId, "get_config"),
          viewMethod(daoAccountId, "get_policy"),
          viewMethod(daoAccountId, "get_proposals", {
            from_index: 0,
            limit: 20,
          }),
          profilePromise,
        ]);

      setProfile(savedProfile);

      const config = decode(configResult) || {};
      const rawPolicy = decode(policyResult) || {};
      const policy = rawPolicy.Current || rawPolicy;
      const roles: Role[] = Array.isArray(policy.roles) ? policy.roles : [];
      const proposals = decode(proposalsResult) || [];

      const members = new Set(
        roles.flatMap((role) =>
          role.kind === "Everyone"
            ? []
            : (role.kind as { Group?: string[] })?.Group || []
        )
      ).size;

      setData({
        name: config.name || daoAccountId,
        purpose: config.purpose || "Community treasury",
        balance: formatNear(account.amount || "0"),
        members,
        proposals: Array.isArray(proposals) ? proposals.reverse() : [],
        roles,
        proposalBond: String(policy.proposal_bond || "1000000000000000000000000"),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load DAO data.");
    } finally {
      setLoading(false);
    }
  }, [daoAccountId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const submitProposal = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!wallet.accountId || !data) return;

    setBusy(true);
    setActionError("");
    setNotice("");

    try {
      if (!description.trim()) throw new Error("Enter a proposal description.");

      let kind: unknown = "Vote";

      if (proposalType === "Transfer") {
        if (!/^[a-z0-9._-]+$/.test(receiver.trim())) {
          throw new Error("Enter a valid NEAR receiver account ID.");
        }
        const nearAmount = Number(amount);
        if (!Number.isFinite(nearAmount) || nearAmount <= 0) {
          throw new Error("Enter a valid transfer amount.");
        }
        const yocto = BigInt(Math.round(nearAmount * 1e6)) * BigInt(10) ** BigInt(18);
        kind = {
          Transfer: {
            token_id: "",
            receiver_id: receiver.trim(),
            amount: yocto.toString(),
          },
        };
      }

      if (proposalType === "AddMember") {
        const account = memberAccount.trim().toLowerCase();

        if (
          account.length < 2 ||
          account.length > 64 ||
          !/^[a-z0-9]+([._-][a-z0-9]+)*$/.test(account)
        ) {
          throw new Error("Enter a valid NEAR mainnet account ID.");
        }

        const membersRole = data.roles.find((role) => role.name === "members");
        if (!membersRole || membersRole.kind === "Everyone") {
          throw new Error('This DAO does not have a configurable "members" role.');
        }

        const existingMembers =
          (membersRole.kind as { Group?: string[] })?.Group || [];

        if (existingMembers.includes(account)) {
          throw new Error("This account is already a member.");
        }

        kind = {
          AddMemberToRole: {
            member_id: account,
            role: "members",
          },
        };
      }

      await wallet.signAndSendTransaction(
        daoAccountId,
        "add_proposal",
        { proposal: { description: description.trim(), kind } },
        GAS,
        data.proposalBond,
      );

      setNotice("Proposal transaction submitted. Refreshing on-chain data...");
      setDescription("");
      setReceiver("");
      setAmount("");
      setMemberAccount("");
      setProposalType("Vote");
      setShowForm(false);
      await loadDashboard();
      setNotice("Proposal submitted. Check its on-chain status below.");
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Proposal submission failed.");
    } finally {
      setBusy(false);
    }
  };

  const vote = async (proposal: Proposal, action: "VoteApprove" | "VoteReject") => {
    if (!wallet.accountId) return;
    setBusy(true);
    setActionError("");
    setNotice("");

    try {
      await wallet.signAndSendTransaction(
        daoAccountId,
        "act_proposal",
        {
          id: proposal.id,
          action,
          proposal: proposal.kind,
          memo: null,
        },
        GAS,
        "0",
      );
      setNotice(`Your ${action === "VoteApprove" ? "approval" : "rejection"} transaction was submitted.`);
      await loadDashboard();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "Vote transaction failed.");
    } finally {
      setBusy(false);
    }
  };

  const daoUrl = `${EXPLORER}/dao/${daoAccountId}`;
  const canAdd = wallet.accountId && data
    ? hasPermission(data.roles, wallet.accountId, "AddProposal", "Vote")
    : false;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark}>C</span>
          <span>Circle<span className={styles.brandAccent}>Hub</span></span>
        </Link>
        <nav className={styles.topNav}>
          <Link href="/">Home</Link>
          <a href="#proposals">Proposals</a>
          <a href="#members">Members</a>
        </nav>
        <div className={styles.headerRight}>
          <span className={styles.network}><i /> NEAR MAINNET</span>
          {wallet.accountId ? (
            <button className={styles.refreshButton} onClick={() => void wallet.disconnect()}>
              {wallet.accountId.slice(0, 8)}… · Disconnect
            </button>
          ) : (
            <button className={styles.refreshButton} onClick={() => void wallet.connect()} disabled={wallet.connecting}>
              {wallet.connecting ? "Connecting..." : "Connect wallet"}
            </button>
          )}
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.sideLabel}>COMMUNITY</div>
          <a href="#overview" className={styles.sideActive}><span>⌂</span> Overview</a>
          <a href="#proposals"><span>▤</span> Proposals</a>
          <a href="#members"><span>♙</span> Members</a>
          <a href="#activity"><span>◷</span> Activity</a>
          <div className={styles.sidebarBottom}>
            <div className={styles.sidebarOrb}>✳</div>
            <strong>Better together.</strong>
            <p>Transparent community finance, powered by NEAR.</p>
          </div>
        </aside>

        <section className={styles.content} id="overview">
          <div className={styles.welcomeRow}>
            <div>
              <div className={styles.eyebrow}><i /> YOUR COMMUNITY</div>
              <h1>
                {loading
                  ? "Loading community..."
                  : profile?.name || data?.name || "Community dashboard"}
              </h1>
              <p className={styles.subtitle}>
                {profile?.description ||
                  profile?.purpose ||
                  data?.purpose ||
                  "Your community treasury and governance overview."}
              </p>
            </div>
            <button className={styles.refreshButton} onClick={() => void loadDashboard()} disabled={loading}>
              <span>↻</span> Refresh
            </button>
          </div>

          {error && <div className={styles.errorBox}><strong>Could not load community data</strong><p>{error}</p></div>}
          {profileError && <div className={styles.notice}>Community profile: {profileError}</div>}
          {actionError && <div className={styles.errorBox}><strong>Transaction not completed</strong><p>{actionError}</p></div>}
          {notice && <div className={styles.notice} role="status">{notice}</div>}
          {wallet.error && <div className={styles.errorBox}><p>{wallet.error}</p></div>}

          <section className={styles.treasury}>
            <div className={styles.treasuryTop}>
              <div><div className={styles.treasuryEyebrow}>COMMUNITY TREASURY</div><h2>On-chain treasury balance</h2></div>
              <div className={styles.treasuryIcon}>◈</div>
            </div>
            <div className={styles.balanceLine}><strong>{loading ? "Loading..." : data?.balance || "Unavailable"}</strong></div>
            <div className={styles.treasuryBottom}>
              <span><i /> Live NEAR mainnet data</span>
              <a href={daoUrl} target="_blank" rel="noreferrer">View on NEAR Explorer ↗</a>
            </div>
            <div className={styles.balanceWave}>
              <svg viewBox="0 0 600 40" preserveAspectRatio="none" aria-hidden="true"><path d="M0 27 C90 2 130 39 220 19 S360 4 430 22 S540 31 600 8" /></svg>
            </div>
          </section>

          <div className={styles.actionHeading}>
            <div><div className={styles.sectionLabel}>GET THINGS DONE</div><h2>Community actions</h2></div>
          </div>
          <div className={styles.actions}>
            <button className={styles.actionCard} onClick={() => setShowForm((value) => !value)}>
              <span className={`${styles.actionIcon} ${styles.iconGreen}`}>＋</span>
              <span><strong>New proposal</strong><small>Submit a poll or treasury transfer</small></span><b>→</b>
            </button>
                          <Link className={styles.actionCard} href={`/events/${encodeURIComponent(daoAccountId)}`}>
                <span className={`${styles.actionIcon} ${styles.iconGreen}`}>◈</span>
                <span><strong>Community events</strong><small>Create events and track funding</small></span><b>→</b>
              </Link>
            <a className={styles.actionCard} href={`/community/${encodeURIComponent(daoAccountId)}/ai`}>
              <span className={`${styles.actionIcon} ${styles.iconGreen}`}>✳</span>
              <span><strong>AI Budget Planner</strong><small>Chat, plan budgets and explore ideas</small></span><b>→</b>
            </a>
<a className={styles.actionCard} href="#members">
              <span className={`${styles.actionIcon} ${styles.iconPeach}`}>♙</span>
              <span><strong>Manage members</strong><small>Review membership and propose additions</small></span><b>→</b>
            </a>
            <a className={styles.actionCard} href="https://sputnik-dao.trezu.org" target="_blank" rel="noreferrer">
              <span className={`${styles.actionIcon} ${styles.iconBlue}`}>▦</span>
              <span><strong>Explore SputnikDAO</strong><small>Open the full governance interface</small></span><b>↗</b>
            </a>
            <a className={styles.actionCard} href="#proposals">
              <span className={`${styles.actionIcon} ${styles.iconGold}`}>◷</span>
              <span><strong>Review decisions</strong><small>See proposals awaiting votes</small></span><b>→</b>
            </a>
          </div>

          {showForm && (
            <section className={styles.panel} style={{ marginTop: 16 }}>
              <div className={styles.panelHeading}>
                <div><div className={styles.sectionLabel}>ON-CHAIN GOVERNANCE</div><h2>Create a proposal</h2></div>
              </div>
              {!wallet.accountId ? (
                <p>Connect your NEAR wallet to submit a proposal.</p>
              ) : !canAdd ? (
                <p>Your connected account does not have AddProposal permission in this DAO.</p>
              ) : (
                <form onSubmit={submitProposal} style={{ display: "grid", gap: 12 }}>
                  <label>Proposal type
                    <select value={proposalType} onChange={(event) => setProposalType(event.target.value as "Vote" | "Transfer" | "AddMember")} style={{ display: "block", width: "100%", padding: 12, marginTop: 6 }}>
                      <option value="Vote">Community poll</option>
                      <option value="Transfer">NEAR treasury transfer</option>
                      <option value="AddMember">Add community member</option>
                    </select>
                  </label>
                  <label>Description
                    <textarea required value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Describe the decision or purpose of this proposal..." style={{ display: "block", width: "100%", padding: 12, marginTop: 6 }} />
                  </label>
                  {proposalType === "Transfer" && (
                    <>
                      <label>Recipient NEAR account
                        <input required value={receiver} onChange={(event) => setReceiver(event.target.value)} placeholder="recipient.near" style={{ display: "block", width: "100%", padding: 12, marginTop: 6 }} />
                      </label>
                      <label>Amount (NEAR)
                        <input required type="number" min="0.000001" step="0.000001" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.1" style={{ display: "block", width: "100%", padding: 12, marginTop: 6 }} />
                      </label>
                    </>
                  )}
                  {proposalType === "AddMember" && (
                    <label>New member's NEAR account ID
                      <input
                        required
                        value={memberAccount}
                        onChange={(event) => setMemberAccount(event.target.value)}
                        placeholder="member.near"
                        autoComplete="off"
                        style={{ display: "block", width: "100%", padding: 12, marginTop: 6 }}
                      />
                      <small>The account will join the members role if the proposal is approved.</small>
                    </label>
                  )}
                  <div className={styles.notice}>
                    Proposal bond: <strong>{formatBond(data?.proposalBond || "0")}</strong>. This amount is attached to the transaction. The DAO contract handles its return or retention according to the proposal outcome.
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button className={styles.refreshButton} type="submit" disabled={busy}>{busy ? "Waiting for wallet..." : "Submit on NEAR"}</button>
                    <button className={styles.refreshButton} type="button" onClick={() => setShowForm(false)} disabled={busy}>Cancel</button>
                  </div>
                </form>
              )}
            </section>
          )}

          <div className={styles.stats}>
            <div className={styles.statCard}><span className={styles.statIcon}>♙</span><span className={styles.statLabel}>Unique members</span><strong>{loading ? "—" : data?.members ?? 0}</strong><small>Distinct accounts across DAO roles</small></div>
            <div className={styles.statCard}><span className={styles.statIcon}>▤</span><span className={styles.statLabel}>Recent proposals</span><strong>{loading ? "—" : data?.proposals.length ?? 0}</strong><small>Latest DAO proposals</small></div>
            <div className={styles.statCard}><span className={styles.statIcon}>◷</span><span className={styles.statLabel}>Pending decisions</span><strong>{loading ? "—" : data?.proposals.filter((p) => p.status === "InProgress").length ?? 0}</strong><small>Currently in progress</small></div>
            <div className={styles.statCard}><span className={styles.statIcon}>◇</span><span className={styles.statLabel}>Network</span><strong>NEAR</strong><small>Mainnet DAO treasury</small></div>
          </div>

          <div className={styles.lowerGrid}>
            <section className={styles.panel} id="proposals">
              <div className={styles.panelHeading}>
                <div><div className={styles.sectionLabel}>GOVERNANCE</div><h2>Recent proposals</h2></div>
                <span className={styles.panelMark}>▤</span>
              </div>
              {data?.proposals.length ? (
                <div className={styles.proposalList}>
                  {data.proposals.map((proposal) => {
                    const kind = proposal.kind;
                    const voted = wallet.accountId ? proposal.votes?.[wallet.accountId] : undefined;
                    const canApprove = wallet.accountId && proposal.status === "InProgress" && hasPermission(data.roles, wallet.accountId, "VoteApprove", kind);
                    const canReject = wallet.accountId && proposal.status === "InProgress" && hasPermission(data.roles, wallet.accountId, "VoteReject", kind);
                    return (
                      <div className={styles.proposalRow} key={proposal.id}>
                        <span className={styles.proposalIcon}>▤</span>
                        <span className={styles.proposalCopy}>
                          <strong>{proposalDescription(proposal)}</strong>
                          <small>{proposal.proposer} · #{proposal.id}{voted ? ` · Your vote: ${voted}` : ""}</small>
                          {canApprove || canReject ? (
                            <span style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                              {canApprove && <button className={styles.refreshButton} disabled={busy} onClick={() => void vote(proposal, "VoteApprove")}>Approve</button>}
                              {canReject && <button className={styles.refreshButton} disabled={busy} onClick={() => void vote(proposal, "VoteReject")}>Reject</button>}
                            </span>
                          ) : null}
                        </span>
                        <span className={styles.proposalStatus}>{proposal.status}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.emptyState}><span className={styles.emptyIcon}>▤</span><strong>No proposals to show yet</strong><p>New community proposals will appear here when submitted to the DAO.</p></div>
              )}
            </section>

            <section className={styles.panel} id="members">
              <div className={styles.panelHeading}>
                <div>
                  <div className={styles.sectionLabel}>COMMUNITY</div>
                  <h2>DAO members</h2>
                </div>
                <span className={styles.panelMark}>♙</span>
              </div>
              {data?.roles.length ? (
                <div className={styles.proposalList}>
                  {data.roles.map((role) => {
                    const group = role.kind === "Everyone"
                      ? []
                      : (role.kind as { Group?: string[] })?.Group || [];

                    return (
                      <div className={styles.proposalRow} key={role.name}>
                        <span className={styles.proposalIcon}>♙</span>
                        <span className={styles.proposalCopy}>
                          <strong>{role.name}</strong>
                          <small>
                            {role.kind === "Everyone"
                              ? "All DAO accounts"
                              : group.length
                                ? group.join(", ")
                                : "No accounts assigned"}
                          </small>
                        </span>
                        <span className={styles.proposalStatus}>
                          {role.kind === "Everyone" ? "Everyone" : group.length}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>♙</span>
                  <strong>No member roles found</strong>
                  <p>DAO membership information will appear here.</p>
                </div>
              )}
            </section>
          </div>

          <section className={styles.panel} id="activity" style={{ marginTop: 20 }}>
            <div className={styles.panelHeading}>
              <div>
                <div className={styles.sectionLabel}>DAO INFORMATION</div>
                <h2>Community details</h2>
              </div>
              <span className={styles.panelMark}>◈</span>
            </div>
            <div className={styles.proposalList}>
              <div className={styles.proposalRow}>
                <span className={styles.proposalCopy}>
                  <strong>Category</strong>
                  <small>{profile?.category || "Not available"}</small>
                </span>
              </div>
              <div className={styles.proposalRow}>
                <span className={styles.proposalCopy}>
                  <strong>Membership</strong>
                  <small>
                    {profile
                      ? profile.membership === "invite" ? "Invite-only" : "Open"
                      : "Not available"}
                  </small>
                </span>
              </div>
              <div className={styles.proposalRow}>
                <span className={styles.proposalCopy}>
                  <strong>Created by</strong>
                  <small>{profile?.created_by || "Not available"}</small>
                </span>
              </div>
              {profile?.created_at && (
                <div className={styles.proposalRow}>
                  <span className={styles.proposalCopy}>
                    <strong>Created on</strong>
                    <small>{new Date(profile.created_at).toLocaleDateString()}</small>
                  </span>
                </div>
              )}
              {profile?.creation_tx_hash && (
                <div className={styles.proposalRow}>
                  <span className={styles.proposalCopy}>
                    <strong>Creation transaction</strong>
                    <small>
                      <a
                        href={`https://nearblocks.io/txns/${profile.creation_tx_hash}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View transaction ↗
                      </a>
                    </small>
                  </span>
                </div>
              )}
              <div className={styles.proposalRow}>
                <span className={styles.proposalCopy}>
                  <strong>DAO account</strong>
                  <small>{daoAccountId}</small>
                </span>
              </div>
              <div className={styles.proposalRow}>
                <span className={styles.proposalCopy}>
                  <strong>Proposal bond</strong>
                  <small>Required to submit a new proposal</small>
                </span>
                <span className={styles.proposalStatus}>
                  {data ? formatBond(data.proposalBond) : "—"}
                </span>
              </div>
              <div className={styles.proposalRow}>
                <span className={styles.proposalCopy}>
                  <strong>Network</strong>
                  <small>NEAR Protocol mainnet</small>
                </span>
                <span className={styles.proposalStatus}>Live</span>
              </div>
            </div>
          </section>

          <footer className={styles.footer}>
            <span>CircleHub · Better together.</span>
            <span>Community finance powered by NEAR.</span>
          </footer>
        </section>
      </div>
    </main>
  );
}

export default function CommunityPage() {
  return (
    <Suspense fallback={<main className={styles.page}>Loading community...</main>}>
      <CommunityDashboard />
    </Suspense>
  );
}
