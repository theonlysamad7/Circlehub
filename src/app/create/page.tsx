"use client";

import CircleHubSymbol from "@/components/circlehub-symbol";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import WalletConnectButton from "@/components/wallet-connect";
import { useNearWallet } from "@/lib/near-wallet";
import { buildCommunityDaoArgs, SPUTNIK_CREATE_DEPOSIT, SPUTNIK_CREATE_GAS, SPUTNIK_FACTORY } from "@/lib/sputnik-dao";
import styles from "./create.module.css";

const categories = [
  { id: "education", label: "Education", icon: "✳", description: "Student groups & learning" },
  { id: "creative", label: "Creative", icon: "✳", description: "Artists & creative projects" },
  { id: "events", label: "Events", icon: "✳", description: "Gatherings & experiences" },
  { id: "technology", label: "Technology", icon: "⌘", description: "Builders & tech communities" },
  { id: "social", label: "Social impact", icon: "♡", description: "Causes & shared missions" },
  { id: "other", label: "Something else", icon: "＋", description: "A community of your own" },
];

function Brand() {
  return (
    <Link href="/" className={styles.brand} aria-label="CircleHub home">
      <CircleHubSymbol className={styles.brandSymbol} />
      <span>Circle<span className={styles.brandStrong}>Hub</span></span>
    </Link>
  );
}

function CommunityArtwork() {
  return (
    <div className={styles.artwork} aria-label="Illustration of a connected community and its shared treasury" role="img">
      <div className={styles.artGlow} />
      <div className={styles.artGrid} />

      <svg className={styles.orbitSvg} viewBox="0 0 520 350" fill="none" aria-hidden="true">
        <ellipse cx="260" cy="174" rx="202" ry="93" transform="rotate(-23 260 174)" stroke="#C8D8C6" strokeWidth="1.5" strokeDasharray="5 8" />
        <ellipse cx="260" cy="174" rx="158" ry="128" transform="rotate(31 260 174)" stroke="#D9E3D4" strokeWidth="1.5" strokeDasharray="3 7" />
        <path d="M100 104 L192 139 L320 91 L410 147 L352 248 L210 254 L100 104" stroke="#D3DFCF" strokeWidth="1.5" />
        <path d="M192 139 L210 254 M320 91 L352 248" stroke="#D3DFCF" strokeWidth="1.5" />
        <circle cx="100" cy="104" r="5" fill="#7FA68A" />
        <circle cx="410" cy="147" r="5" fill="#7FA68A" />
        <circle cx="210" cy="254" r="5" fill="#7FA68A" />
        <circle cx="320" cy="91" r="5" fill="#7FA68A" />
      </svg>

      <div className={`${styles.personCard} ${styles.personOne}`}>
        <span className={`${styles.avatar} ${styles.avatarOlive}`}>A</span>
        <span><strong>Alex</strong><small>Community builder</small></span>
        <span className={styles.personCheck}>✓</span>
      </div>

      <div className={`${styles.personCard} ${styles.personTwo}`}>
        <span className={`${styles.avatar} ${styles.avatarPeach}`}>M</span>
        <span><strong>Maya</strong><small>Member</small></span>
      </div>

      <div className={`${styles.personCard} ${styles.personThree}`}>
        <span className={`${styles.avatar} ${styles.avatarLavender}`}>T</span>
        <span><strong>Tobi</strong><small>Contributor</small></span>
      </div>

      <div className={styles.treasuryCard}>
        <div className={styles.treasuryTop}>
          <span className={styles.treasuryIcon}>↗</span>
          <span className={styles.treasuryStatus}><i /> SHARED TREASURY</span>
        </div>
        <span className={styles.treasuryLabel}>Together, we can do more.</span>
        <div className={styles.treasuryVisual}>
          <div className={styles.treasuryCircle}>C</div>
          <div className={styles.treasuryLine}><i /><i /><i /><i /><i /></div>
        </div>
        <div className={styles.treasuryBottom}>
          <span>One community</span>
          <strong>Shared purpose <span>↗</span></strong>
        </div>
      </div>

      <div className={styles.artNote}>
        <span>✳</span>
        Better things happen together.
      </div>
    </div>
  );
}

export default function CreateCommunityPage() {
  const { accountId, signAndSendTransaction } = useNearWallet();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("education");
  const [description, setDescription] = useState("");
  const [purpose, setPurpose] = useState("");
  const [membership, setMembership] = useState("open");
  const [submitted, setSubmitted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdDao, setCreatedDao] = useState("");
  const [creationTx, setCreationTx] = useState("");
  const [error, setError] = useState("");

  const selectedCategory = categories.find((item) => item.id === category);
  const initials = name.trim()
    ? name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase()
    : "CH";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitted(false);
    setCreatedDao("");
    setCreationTx("");

    if (!name.trim() || !description.trim() || !purpose.trim()) {
      setError("Please complete the required fields before continuing.");
      return;
    }

    if (!accountId) {
      setError("Connect your NEAR wallet before creating your community.");
      return;
    }

    let dao;
    try {
      dao = buildCommunityDaoArgs({
        name,
        description,
        purpose,
        creatorAccountId: accountId,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Community details are invalid.");
      return;
    }

    const confirmed = window.confirm(
      "Create a SputnikDAO on NEAR MAINNET?\n\n" +
      "DAO account: " + dao.daoAccountId + "\n" +
      "Factory: " + SPUTNIK_FACTORY + "\n" +
      "Attached deposit: 0.01 NEAR\n\n" +
      "This is a real blockchain transaction. The minimum deposit may not cover the full creation cost."
    );

    if (!confirmed) return;

    setCreating(true);
    try {
      const result = await signAndSendTransaction(
        SPUTNIK_FACTORY,
        "create",
        { name: dao.name, args: dao.args },
        SPUTNIK_CREATE_GAS,
        SPUTNIK_CREATE_DEPOSIT,
      );

      const response = result && typeof result === "object"
        ? result as Record<string, unknown>
        : {};
      const status = response.status && typeof response.status === "object"
        ? response.status as Record<string, unknown>
        : {};

      if ("Failure" in status) {
        throw new Error("The NEAR transaction failed on-chain. No successful DAO creation was confirmed.");
      }

      if (!("SuccessValue" in status) && !("SuccessReceiptId" in status)) {
        throw new Error("The wallet returned no confirmed successful execution status. Check the transaction on NEAR Explorer before retrying.");
      }

      if (typeof status.SuccessValue === "string") {
        try {
          const returnedValue = JSON.parse(atob(status.SuccessValue));
          if (returnedValue !== true) {
            throw new Error("SputnikDAO's factory did not confirm successful DAO creation.");
          }
        } catch (cause) {
          if (cause instanceof Error && cause.message.includes("SputnikDAO's factory did not confirm")) {
            throw cause;
          }
          throw new Error("Could not verify SputnikDAO's creation result. Check the transaction before retrying.");
        }
      } else if ("SuccessReceiptId" in status) {
        throw new Error("The transaction returned a receipt ID instead of a confirmed creation result. Verify the DAO account before retrying.");
      }

      const tx = response.transaction && typeof response.transaction === "object"
        ? response.transaction as Record<string, unknown>
        : {};
      const hash = [
        response.transaction_hash,
        response.transactionHash,
        tx.hash,
      ].find((value) => typeof value === "string" && value.length > 0);

      const verificationResponse = await fetch("/api/near/verify-dao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: dao.daoAccountId,
          creatorAccountId: accountId,
          name: name.trim(),
          category,
          description: description.trim(),
          purpose: purpose.trim(),
          membership,
          creationTxHash: typeof hash === "string" ? hash : null,
        }),
        cache: "no-store",
      });

      const verification = await verificationResponse.json();

      if (!verificationResponse.ok || verification.verified !== true) {
        throw new Error(
          typeof verification.error === "string"
            ? verification.error
            : "The DAO account could not be verified on NEAR mainnet. Check the transaction before retrying."
        );
      }

      setCreatedDao(dao.daoAccountId);
      setCreationTx(typeof hash === "string" ? hash : "");
      setSubmitted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The transaction failed or was cancelled.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.navInner}>
          <Brand />
          <nav className={styles.breadcrumb} aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span>/</span>
            <strong>Create a community</strong>
          </nav>
          <div className={styles.navActions}>
            <span className={styles.networkBadge}><i /> NEAR Mainnet</span>
            <WalletConnectButton />
          </div>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}><span /> YOUR COMMUNITY STARTS HERE</div>
            <h1>Big things begin<br />with <em>people</em> like you.</h1>
            <p className={styles.heroDescription}>
              Bring your people together around a shared purpose.
              Create a home for your community, its contributions,
              and the decisions you make together.
            </p>
            <div className={styles.heroProof}>
              <div className={styles.proofAvatars}>
                <span>A</span><span>M</span><span>T</span><span>+</span>
              </div>
              <div><strong>Built around belonging.</strong><small>Designed for communities that want to grow together.</small></div>
            </div>
          </div>
          <CommunityArtwork />
        </div>
      </section>

      <section className={styles.workspace}>
        <div className={styles.workspaceHeading}>
          <div>
            <span className={styles.sectionEyebrow}>LET'S MAKE IT OFFICIAL</span>
            <h2>Give your community a home.</h2>
            <p>Start with the essentials. You can build on the details as your community grows.</p>
          </div>
          <div className={styles.stepBadge}><span>01</span> Community details <i /> <span>02</span> Treasury setup</div>
        </div>

        <div className={styles.formLayout}>
          <form className={styles.formCard} onSubmit={handleSubmit}>
            <div className={styles.formSection}>
              <div className={styles.formSectionHeading}>
                <span className={styles.sectionNumber}>01</span>
                <div><h3>The basics</h3><p>What should people know about your community?</p></div>
              </div>

              <label className={styles.fieldLabel} htmlFor="community-name">Community name <span>*</span></label>
              <input
                id="community-name"
                className={styles.textInput}
                value={name}
                onChange={(event) => { setName(event.target.value); setSubmitted(false); }}
                placeholder="e.g. UniTech Builders"
                maxLength={60}
                required
              />
              <div className={styles.inputMeta}><span>Make it memorable and easy to recognise.</span><span>{name.length}/60</span></div>

              <div className={styles.labelRow}><label className={styles.fieldLabel}>Choose a category <span>*</span></label><span className={styles.optional}>PICK ONE</span></div>
              <div className={styles.categoryGrid}>
                {categories.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.categoryCard} ${category === item.id ? styles.categorySelected : ""}`}
                    onClick={() => { setCategory(item.id); setSubmitted(false); }}
                    aria-pressed={category === item.id}
                  >
                    <span className={styles.categoryIcon}>{item.icon}</span>
                    <span className={styles.categoryText}><strong>{item.label}</strong><small>{item.description}</small></span>
                    <span className={styles.radioMark}>{category === item.id ? "✓" : ""}</span>
                  </button>
                ))}
              </div>

              <label className={styles.fieldLabel} htmlFor="community-description">A little about your community <span>*</span></label>
              <textarea
                id="community-description"
                className={styles.textArea}
                value={description}
                onChange={(event) => { setDescription(event.target.value); setSubmitted(false); }}
                placeholder="Tell people who you are, what brings you together, and what makes this community special..."
                rows={4}
                maxLength={400}
                required
              />
              <div className={styles.inputMeta}><span>Give people a reason to be part of it.</span><span>{description.length}/400</span></div>
            </div>

            <div className={styles.formDivider} />

            <div className={styles.formSection}>
              <div className={styles.formSectionHeading}>
                <span className={styles.sectionNumber}>02</span>
                <div><h3>Your shared purpose</h3><p>What are you hoping to accomplish together?</p></div>
              </div>

              <label className={styles.fieldLabel} htmlFor="community-purpose">What brings everyone together? <span>*</span></label>
              <textarea
                id="community-purpose"
                className={styles.textArea}
                value={purpose}
                onChange={(event) => { setPurpose(event.target.value); setSubmitted(false); }}
                placeholder="e.g. Fund student projects, host events, and support members as they learn and build..."
                rows={3}
                maxLength={300}
                required
              />
              <div className={styles.inputMeta}><span>A shared goal gives your community direction.</span><span>{purpose.length}/300</span></div>
            </div>

            <div className={styles.formDivider} />

            <div className={styles.formSection}>
              <div className={styles.formSectionHeading}>
                <span className={styles.sectionNumber}>03</span>
                <div><h3>Who can join?</h3><p>Choose how people become members.</p></div>
              </div>

              <div className={styles.membershipOptions}>
                <button type="button" className={`${styles.membershipCard} ${membership === "open" ? styles.membershipSelected : ""}`} onClick={() => { setMembership("open"); setSubmitted(false); }} aria-pressed={membership === "open"}>
                  <span className={styles.membershipIcon}>◎</span>
                  <span className={styles.membershipCopy}><strong>Open community</strong><small>Anyone can discover and request to join.</small></span>
                  <span className={styles.radioMark}>{membership === "open" ? "✓" : ""}</span>
                </button>
                <button type="button" className={`${styles.membershipCard} ${membership === "invite" ? styles.membershipSelected : ""}`} onClick={() => { setMembership("invite"); setSubmitted(false); }} aria-pressed={membership === "invite"}>
                  <span className={styles.membershipIcon}>⌑</span>
                  <span className={styles.membershipCopy}><strong>Invite-only</strong><small>Keep membership limited to invited people.</small></span>
                  <span className={styles.radioMark}>{membership === "invite" ? "✓" : ""}</span>
                </button>
              </div>
            </div>

            <div className={styles.formFooter}>
              <div className={styles.secureNote}><span>◇</span><span><strong>Your community, your control.</strong><small>Creating a draft won't move any funds.</small></span></div>
              <button className={styles.submitButton} type="submit" disabled={creating}>{creating ? "Creating DAO…" : "Create community"} <span>↗</span></button>
            </div>

            {error && <p className={styles.formError} role="alert">{error}</p>}
            {submitted && (
              <div className={styles.successPanel} role="status">
                <span className={styles.successIcon}>✓</span>
                <div>
                  <strong>Community created successfully!</strong>
                  <p>Your community treasury has been deployed and verified on NEAR Mainnet.</p>
                  <p>DAO account: <strong>{createdDao}</strong></p>
                  <p><Link href={`/community/${encodeURIComponent(createdDao)}`} className={styles.submitButton}>Visit your community ↗</Link></p>
                  <p><a href={`https://nearblocks.io/address/${createdDao}`} target="_blank" rel="noreferrer">View DAO on NEAR Explorer ↗</a></p>
                  {creationTx && <p><a href={`https://nearblocks.io/txns/${creationTx}`} target="_blank" rel="noreferrer">View creation transaction ↗</a></p>}
                </div>
              </div>
            )}

            </form>

          <aside className={styles.previewColumn}>
            <div className={styles.previewIntro}>
              <span className={styles.previewLive}><i /> LIVE PREVIEW</span>
              <span>Updates as you type</span>
            </div>

            <div className={styles.previewCard}>
              <div className={styles.previewCover}>
                <div className={styles.coverOrbOne} /><div className={styles.coverOrbTwo} />
                <span className={styles.coverCategory}>{selectedCategory?.label ?? "Community"}</span>
                <div className={styles.coverMark}>{initials}</div>
              </div>
              <div className={styles.previewBody}>
                <span className={styles.previewType}>COMMUNITY PROFILE</span>
                <h3>{name.trim() || "Your community name"}</h3>
                <p>{description.trim() || "Your community description will appear here. Tell people what makes your community worth joining."}</p>

                <div className={styles.previewTags}>
                  <span>◇ NEAR ecosystem</span>
                  <span>{membership === "open" ? "◎ Open community" : "⌑ Invite-only"}</span>
                </div>

                <div className={styles.previewDivider} />
                <span className={styles.previewLabel}>OUR SHARED PURPOSE</span>
                <p className={styles.previewPurpose}>{purpose.trim() || "Your shared purpose will help people understand what you're working towards."}</p>

                <div className={styles.previewMembers}>
                  <div className={styles.previewMemberAvatars}><span>A</span><span>M</span><span>T</span></div>
                  <span><strong>Made for your people</strong><small>Growing together starts here.</small></span>
                </div>
              </div>
            </div>

            <div className={styles.previewTip}>
              <span className={styles.tipIcon}>✳</span>
              <div><strong>A little tip</strong><p>Communities with a clear purpose make it easier for people to understand why they belong.</p></div>
            </div>

            <div className={styles.walletStatus}>
              <div className={styles.walletStatusIcon}>{accountId ? "✓" : "◇"}</div>
              <div className={styles.walletStatusText}>
                <strong>{accountId ? "NEAR wallet connected" : "Your wallet, your authority"}</strong>
                <p>{accountId ? accountId : "Connect your NEAR wallet when you're ready to create your on-chain community."}</p>
              </div>
              <span className={accountId ? styles.walletReady : styles.walletPending}><i />{accountId ? "Connected" : "Not connected"}</span>
            </div>
          </aside>
        </div>
      </section>

      <footer className={styles.footer}>
        <Link href="/" className={styles.footerBrand}>Circle<span>Hub</span></Link>
        <span>Better things happen together.</span>
        <Link href="/" className={styles.footerBack}>Back to home ↗</Link>
      </footer>
    </main>
  );
}
