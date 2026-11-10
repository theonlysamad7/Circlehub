"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useNearWallet } from "@/lib/near-wallet";
import {
  buildCreateEventMessage,
  buildContributionMessage,
  EVENT_SIGNING_RECIPIENT,
} from "@/lib/event-auth";
import assetsData from "@/data/intents-assets.json";
import styles from "./events.module.css";

type Asset = {
  assetId: string;
  symbol: string;
  blockchain: string;
  decimals: number;
};

const assets = assetsData as Asset[];

const NEAR_USDC =
  "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";

type EventItem = {
  id: string;
  title: string;
  description: string | null;
  funding_goal: string;
  currency: string;
  deadline: string | null;
  status: string;
  created_by: string;
  created_at: string;
  raised: number;
  contributorCount: number;
  contributors: {
    accountId: string;
    amount: string | number;
    token: string;
  }[];
};

type QuotePreview = {
  amountOutFormatted?: string;
  amountInFormatted?: string;
  amountOutUsd?: string | number;
  timeEstimate?: number;
  depositAddress?: string;
  depositMemo?: string;
  [key: string]: unknown;
};

type PreparedContribution = {
  contribution: {
    id: string;
    deposit_address: string;
    deposit_memo: string | null;
    status: string;
    quote_deadline: string;
  };
  quote: QuotePreview;
};

function decimalToBaseUnits(value: string, decimals: number): string {
  const clean = value.trim();

  if (!/^\d+(\.\d+)?$/.test(clean)) {
    throw new Error("Enter a valid positive amount.");
  }

  const [whole, fraction = ""] = clean.split(".");

  if (fraction.length > decimals) {
    throw new Error(
      `This asset supports at most ${decimals} decimal places.`,
    );
  }

  const baseUnits = whole + fraction.padEnd(decimals, "0");
  const normalized = BigInt(baseUnits).toString();

  if (normalized === "0") {
    throw new Error("Amount must be greater than zero.");
  }

  return normalized;
}

function baseUnitsToDisplay(value: string, decimals: number): string {
  const amount = BigInt(value);
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = (amount % divisor)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");

  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function EventsContent() {
  const params = useParams<{ daoAccountId: string }>();
  const daoAccountId = String(params.daoAccountId || "");
  const wallet = useNearWallet();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fundingGoal, setFundingGoal] = useState("");
  const [deadline, setDeadline] = useState("");

  const [activeEventId, setActiveEventId] = useState("");
  const [assetSearch, setAssetSearch] = useState("");
  const [assetId, setAssetId] = useState(NEAR_USDC);
  const [contributionAmount, setContributionAmount] = useState("");
  const [refundTo, setRefundTo] = useState("");
  const [quotePreview, setQuotePreview] = useState<QuotePreview | null>(null);
  const [prepared, setPrepared] = useState<PreparedContribution | null>(null);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [contributionBusy, setContributionBusy] = useState(false);
  const [contributionError, setContributionError] = useState("");
  const [contributionNotice, setContributionNotice] = useState("");

  const selectedAsset =
    assets.find((asset) => asset.assetId === assetId) || assets[0];

  const filteredAssets = assets
    .filter((asset) => {
      const search = assetSearch.toLowerCase().trim();

      return (
        !search ||
        asset.symbol.toLowerCase().includes(search) ||
        asset.blockchain.toLowerCase().includes(search) ||
        asset.assetId.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => {
      const aPriority = ["USDC", "USDT", "ETH", "BNB", "NEAR"].includes(a.symbol) ? 0 : 1;
      const bPriority = ["USDC", "USDT", "ETH", "BNB", "NEAR"].includes(b.symbol) ? 0 : 1;

      return (
        aPriority - bPriority ||
        a.symbol.localeCompare(b.symbol) ||
        a.blockchain.localeCompare(b.blockchain)
      );
    });

  const loadEvents = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch(
        `/api/events/${encodeURIComponent(daoAccountId)}`,
        { cache: "no-store" },
      );

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load events.");
      }

      setEvents(payload.events || []);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to load events.",
      );
    } finally {
      setLoading(false);
    }
  }, [daoAccountId]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!wallet.accountId) {
      setError("Connect your NEAR wallet before creating an event.");
      return;
    }

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const cleanGoal = fundingGoal.trim();
    const cleanDeadline = deadline || null;

    if (!cleanTitle || !cleanGoal || Number(cleanGoal) <= 0) {
      setError("Enter an event title and a valid funding goal.");
      return;
    }

    setBusy(true);

    try {
      const challengeResponse = await fetch("/api/events/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: wallet.accountId }),
      });

      const challenge = await challengeResponse.json();

      if (!challengeResponse.ok) {
        throw new Error(
          challenge.error || "Unable to prepare wallet verification.",
        );
      }

      const nonce = Uint8Array.from(challenge.nonce);

      const message = buildCreateEventMessage({
        daoAccountId,
        title: cleanTitle,
        description: cleanDescription,
        fundingGoal: cleanGoal,
        deadline: cleanDeadline,
      });

      const signed = await wallet.signMessage(
        message,
        EVENT_SIGNING_RECIPIENT,
        nonce,
      );

      const response = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          daoAccountId,
          title: cleanTitle,
          description: cleanDescription,
          fundingGoal: cleanGoal,
          deadline: cleanDeadline,
          nonce: Array.from(nonce),
          accountId: signed.accountId,
          publicKey: signed.publicKey,
          signature: signed.signature,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Event creation failed.");
      }

      setTitle("");
      setDescription("");
      setFundingGoal("");
      setDeadline("");
      setShowForm(false);
      setNotice("Your event has been created.");
      await loadEvents();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Event creation failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  function openContribution(eventId: string) {
    setActiveEventId((current) => current === eventId ? "" : eventId);
    setAssetSearch("");
    setAssetId(NEAR_USDC);
    setContributionAmount("");
    setRefundTo("");
    setQuotePreview(null);
    setPrepared(null);
    setPaymentStatus("");
    setContributionError("");
    setContributionNotice("");
  }

  async function requestQuote() {
    setContributionError("");
    setContributionNotice("");
    setQuotePreview(null);
    setPrepared(null);
    setPaymentStatus("");

    if (!selectedAsset || !activeEventId) {
      setContributionError("Select a supported asset.");
      return;
    }

    if (!refundTo.trim()) {
      setContributionError("Enter a refund address for the selected network.");
      return;
    }

    setContributionBusy(true);

    try {
      const amount = decimalToBaseUnits(
        contributionAmount,
        selectedAsset.decimals,
      );

      const response = await fetch("/api/intents/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: activeEventId,
          originAsset: selectedAsset.assetId,
          amount,
          refundTo: refundTo.trim(),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to get a quote.");
      }

      const result = payload.result;
      const quote =
        result?.quote ||
        result?.quoteResponse?.quote ||
        result;

      if (!quote || typeof quote !== "object") {
        throw new Error("The quote response was incomplete.");
      }

      setQuotePreview(quote as QuotePreview);
      setContributionNotice(
        "Quote received. Review the estimated output before continuing.",
      );
    } catch (cause) {
      setContributionError(
        cause instanceof Error ? cause.message : "Unable to get a quote.",
      );
    } finally {
      setContributionBusy(false);
    }
  }

  async function prepareDeposit() {
    setContributionError("");
    setContributionNotice("");

    if (!wallet.accountId) {
      setContributionError(
        "Connect your NEAR wallet to authorize this contribution.",
      );
      return;
    }

    if (!selectedAsset || !activeEventId) return;

    setContributionBusy(true);

    try {
      const amount = decimalToBaseUnits(
        contributionAmount,
        selectedAsset.decimals,
      );

      const challengeResponse = await fetch("/api/events/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: wallet.accountId }),
      });

      const challenge = await challengeResponse.json();

      if (!challengeResponse.ok) {
        throw new Error(
          challenge.error || "Unable to prepare wallet verification.",
        );
      }

      const nonce = Uint8Array.from(challenge.nonce);

      const message = buildContributionMessage({
        eventId: activeEventId,
        daoAccountId,
        accountId: wallet.accountId,
        originAsset: selectedAsset.assetId,
        amount,
        refundTo: refundTo.trim(),
      });

      const signed = await wallet.signMessage(
        message,
        EVENT_SIGNING_RECIPIENT,
        nonce,
      );

      const response = await fetch("/api/intents/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: activeEventId,
          accountId: signed.accountId,
          publicKey: signed.publicKey,
          signature: signed.signature,
          originAsset: selectedAsset.assetId,
          amount,
          refundTo: refundTo.trim(),
          nonce: Array.from(nonce),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error || "Unable to prepare the deposit.",
        );
      }

      setPrepared(payload as PreparedContribution);
      setPaymentStatus("PENDING_DEPOSIT");
      setQuotePreview(null);
      setContributionNotice(
        "Deposit prepared. No funds have been transferred yet.",
      );
    } catch (cause) {
      setContributionError(
        cause instanceof Error ? cause.message : "Unable to prepare deposit.",
      );
    } finally {
      setContributionBusy(false);
    }
  }

  async function checkPaymentStatus() {
    if (!prepared?.contribution?.id) return;

    setContributionError("");
    setContributionNotice("");
    setContributionBusy(true);

    try {
      const response = await fetch("/api/intents/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contributionId: prepared.contribution.id,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error || "Unable to check payment status.",
        );
      }

      setPaymentStatus(payload.status || "PENDING_DEPOSIT");

      if (payload.status === "SUCCESS") {
        setContributionNotice(
          "Contribution confirmed! The NEAR USDC has reached the community treasury.",
        );
        await loadEvents();
      } else if (payload.status === "FAILED") {
        setContributionError(
          "The swap failed. Check the status before retrying.",
        );
      } else if (payload.status === "REFUNDED") {
        setContributionNotice(
          "The contribution was refunded by the payment provider.",
        );
      } else {
        setContributionNotice(
          "Payment is not yet confirmed. You can check again shortly.",
        );
      }
    } catch (cause) {
      setContributionError(
        cause instanceof Error ? cause.message : "Unable to check payment.",
      );
    } finally {
      setContributionBusy(false);
    }
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setContributionNotice("Copied to clipboard.");
    } catch {
      setContributionError(
        "Unable to copy automatically. Select and copy the address.",
      );
    }
  }

  function money(value: number | string) {
    return Number(value || 0).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  }

  function statusLabel(status: string) {
    const labels: Record<string, string> = {
      PENDING_DEPOSIT: "Awaiting deposit",
      KNOWN_DEPOSIT_TX: "Deposit detected",
      PROCESSING: "Swap processing",
      SUCCESS: "Confirmed",
      INCOMPLETE_DEPOSIT: "Incomplete deposit",
      REFUNDED: "Refunded",
      FAILED: "Failed",
    };

    return labels[status] || status.replaceAll("_", " ");
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link
          href={`/community/${encodeURIComponent(daoAccountId)}`}
          className={styles.back}
        >
          ← Community dashboard
        </Link>
        <span className={styles.brand}>CircleHub</span>
      </header>

      <section className={styles.hero}>
        <div className={styles.eyebrow}>COMMUNITY FUNDING</div>
        <h1>Events worth<br />coming together for.</h1>
        <p>
          Create an event, set its funding goal, and let your community
          contribute transparently.
        </p>
        <button
          className={styles.primary}
          onClick={() => {
            setShowForm((value) => !value);
            setError("");
            setNotice("");
          }}
        >
          {showForm ? "Close form" : "＋ Create an event"}
        </button>
      </section>

      {error && <div className={styles.error}>{error}</div>}
      {notice && <div className={styles.notice}>{notice}</div>}

      {showForm && (
        <form className={styles.form} onSubmit={createEvent}>
          <div className={styles.formHeading}>
            <div className={styles.eyebrow}>NEW COMMUNITY EVENT</div>
            <h2>Give your idea a goal.</h2>
            <p>Only the DAO admin can publish an event.</p>
          </div>

          <label>
            Event name
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Community Tech Meetup"
              maxLength={100}
              required
            />
          </label>

          <label>
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is the event about?"
              rows={4}
              maxLength={2000}
            />
          </label>

          <div className={styles.formGrid}>
            <label>
              Funding goal (USDC)
              <input
                type="number"
                min="0.000001"
                step="0.000001"
                value={fundingGoal}
                onChange={(event) => setFundingGoal(event.target.value)}
                placeholder="500"
                required
              />
            </label>

            <label>
              Funding deadline (optional)
              <input
                type="datetime-local"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
              />
            </label>
          </div>

          <div className={styles.formNote}>
            Your wallet will sign a short verification message. This does not
            transfer funds or create an on-chain transaction.
          </div>

          <button className={styles.primary} type="submit" disabled={busy}>
            {busy ? "Verifying and creating..." : "Sign and create event"}
          </button>
        </form>
      )}

      <section className={styles.eventsSection}>
        <div className={styles.sectionTop}>
          <div>
            <div className={styles.eyebrow}>YOUR COMMUNITY</div>
            <h2>Community events</h2>
          </div>
          <span className={styles.count}>{events.length} events</span>
        </div>

        {loading ? (
          <p className={styles.empty}>Loading community events...</p>
        ) : events.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>◈</div>
            <h3>No events yet</h3>
            <p>When your community creates an event, it will appear here.</p>
          </div>
        ) : (
          <div className={styles.eventGrid}>
            {events.map((item) => {
              const goal = Number(item.funding_goal);
              const progress =
                goal > 0 ? Math.min(100, (item.raised / goal) * 100) : 0;
              const isActive = activeEventId === item.id;
              const isClosed =
                item.status !== "fundraising" ||
                (item.deadline &&
                  new Date(item.deadline).getTime() <= Date.now());

              return (
                <article className={styles.eventCard} key={item.id}>
                  <div className={styles.eventMeta}>
                    <span className={styles.status}>{item.status}</span>
                    <span>{item.currency}</span>
                  </div>

                  <h3>{item.title}</h3>

                  <p className={styles.description}>
                    {item.description ||
                      "A community event powered by shared contributions."}
                  </p>

                  <div className={styles.fundingLine}>
                    <strong>{money(item.raised)} USDC</strong>
                    <span>of {money(goal)} USDC</span>
                  </div>

                  <div className={styles.progress}>
                    <span style={{ width: `${progress}%` }} />
                  </div>

                  <div className={styles.eventFooter}>
                    <span>{item.contributorCount} contributors</span>
                    <span>{Math.round(progress)}% funded</span>
                  </div>

                  {item.deadline && (
                    <div className={styles.deadline}>
                      Deadline: {new Date(item.deadline).toLocaleString()}
                    </div>
                  )}

                  {!isClosed && (
                    <button
                      type="button"
                      className={styles.contributeButton}
                      onClick={() => openContribution(item.id)}
                    >
                      {isActive ? "Close contribution" : "＋ Contribute"}
                    </button>
                  )}

                  {isActive && !isClosed && (
                    <div className={styles.contributionPanel}>
                      <div className={styles.contributionHeading}>
                        <span className={styles.eyebrow}>SUPPORT THIS EVENT</span>
                        <h4>Contribute across networks.</h4>
                        <p>
                          Pay with a supported asset. Your contribution is
                          converted to NEAR USDC and delivered to this
                          community&apos;s treasury.
                        </p>
                      </div>

                      {!prepared && (
                        <>
                          <label className={styles.fieldLabel}>
                            Search assets
                            <input
                              className={styles.field}
                              value={assetSearch}
                              onChange={(event) =>
                                setAssetSearch(event.target.value)
                              }
                              placeholder="Search ETH, USDC, Base, Ethereum..."
                            />
                          </label>

                          <label className={styles.fieldLabel}>
                            Asset and network
                            <select
                              className={styles.field}
                              value={assetId}
                              onChange={(event) => {
                                setAssetId(event.target.value);
                                setQuotePreview(null);
                              }}
                            >
                              {filteredAssets.map((asset) => (
                                <option
                                  key={asset.assetId}
                                  value={asset.assetId}
                                >
                                  {asset.symbol} · {asset.blockchain.toUpperCase()}
                                </option>
                              ))}
                            </select>
                          </label>

                          {selectedAsset && (
                            <div className={styles.assetHint}>
                              Selected: <strong>{selectedAsset.symbol}</strong>
                              {" "}on {selectedAsset.blockchain.toUpperCase()}
                              <span>
                                {selectedAsset.decimals} decimal places
                              </span>
                            </div>
                          )}

                          <label className={styles.fieldLabel}>
                            Amount ({selectedAsset?.symbol || "asset"})
                            <input
                              className={styles.field}
                              type="number"
                              min="0"
                              step="any"
                              value={contributionAmount}
                              onChange={(event) => {
                                setContributionAmount(event.target.value);
                                setQuotePreview(null);
                              }}
                              placeholder="Enter amount"
                            />
                          </label>

                          <label className={styles.fieldLabel}>
                            Refund address on selected network
                            <input
                              className={styles.field}
                              value={refundTo}
                              onChange={(event) => {
                                setRefundTo(event.target.value);
                                setQuotePreview(null);
                              }}
                              placeholder="Your wallet address"
                            />
                          </label>

                          <p className={styles.formNote}>
                            Use an address on the selected asset&apos;s
                            network. This address is used if the swap needs
                            to refund your deposit.
                          </p>

                          {quotePreview && (
                            <div className={styles.quoteBox}>
                              <span>Estimated destination</span>
                              <strong>
                                {quotePreview.amountOutFormatted ||
                                  (typeof quotePreview.amountOut === "string"
                                    ? baseUnitsToDisplay(
                                        quotePreview.amountOut,
                                        6,
                                      )
                                    : "See quote details")} USDC
                              </strong>
                              <small>NEAR · Community DAO treasury</small>
                            </div>
                          )}

                          <div className={styles.contributionActions}>
                            {!quotePreview ? (
                              <button
                                type="button"
                                className={styles.primary}
                                disabled={contributionBusy}
                                onClick={requestQuote}
                              >
                                {contributionBusy
                                  ? "Getting quote..."
                                  : "Get conversion quote"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={styles.primary}
                                disabled={contributionBusy}
                                onClick={prepareDeposit}
                              >
                                {contributionBusy
                                  ? "Waiting for wallet..."
                                  : "Sign and prepare deposit"}
                              </button>
                            )}
                          </div>
                        </>
                      )}

                      {prepared && (
                        <div className={styles.depositBox}>
                          <div className={styles.paymentStatus}>
                            <span>Payment status</span>
                            <strong>{statusLabel(paymentStatus)}</strong>
                          </div>

                          <p>
                            Send your selected asset to this deposit address.
                            The payment is not complete until CircleHub
                            confirms settlement.
                          </p>

                          <label className={styles.fieldLabel}>
                            Deposit address
                            <div className={styles.copyRow}>
                              <input
                                className={styles.field}
                                readOnly
                                value={prepared.contribution.deposit_address}
                              />
                              <button
                                type="button"
                                className={styles.copyButton}
                                onClick={() =>
                                  copyText(
                                    prepared.contribution.deposit_address,
                                  )
                                }
                              >
                                Copy
                              </button>
                            </div>
                          </label>

                          {prepared.contribution.deposit_memo && (
                            <label className={styles.fieldLabel}>
                              Deposit memo
                              <div className={styles.copyRow}>
                                <input
                                  className={styles.field}
                                  readOnly
                                  value={prepared.contribution.deposit_memo}
                                />
                                <button
                                  type="button"
                                  className={styles.copyButton}
                                  onClick={() =>
                                    copyText(
                                      prepared.contribution.deposit_memo!,
                                    )
                                  }
                                >
                                  Copy
                                </button>
                              </div>
                              <span className={styles.memoWarning}>
                                Include this memo when sending your payment.
                              </span>
                            </label>
                          )}

                          <div className={styles.formNote}>
                            Deposit quote expires:{" "}
                            {new Date(
                              prepared.contribution.quote_deadline,
                            ).toLocaleString()}
                          </div>

                          <button
                            type="button"
                            className={styles.primary}
                            disabled={contributionBusy}
                            onClick={checkPaymentStatus}
                          >
                            {contributionBusy
                              ? "Checking..."
                              : "I've sent it — check payment"}
                          </button>

                          {paymentStatus === "SUCCESS" && (
                            <p className={styles.successText}>
                              Your contribution has been verified and added
                              to the event total.
                            </p>
                          )}

                          {(paymentStatus === "FAILED" ||
                            paymentStatus === "REFUNDED") && (
                            <p className={styles.memoWarning}>
                              This payment is no longer pending. Check the
                              payment result before preparing another deposit.
                            </p>
                          )}
                        </div>
                      )}

                      {contributionError && (
                        <div className={styles.error}>
                          {contributionError}
                        </div>
                      )}

                      {contributionNotice && (
                        <div className={styles.notice}>
                          {contributionNotice}
                        </div>
                      )}

                      <p className={styles.securityNote}>
                        CircleHub never asks for your seed phrase or private
                        key. Your NEAR wallet signs an authorization message;
                        you manually send funds to the deposit address.
                      </p>
                    </div>
                  )}

                  {item.contributors.length > 0 && (
                    <details className={styles.donors}>
                      <summary>View verified contributors</summary>
                      {item.contributors.map((donor, index) => (
                        <div
                          className={styles.donor}
                          key={`${donor.accountId}-${index}`}
                        >
                          <span>{donor.accountId}</span>
                          <strong>
                            {money(donor.amount)} {donor.token}
                          </strong>
                        </div>
                      ))}
                    </details>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

export default function EventsPage() {
  return (
    <Suspense fallback={<main className={styles.page}>Loading events...</main>}>
      <EventsContent />
    </Suspense>
  );
}
