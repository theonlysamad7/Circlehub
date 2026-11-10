"use client";

import { useEffect, useState } from "react";
import { useNearWallet } from "@/lib/near-wallet";
import styles from "./communities.module.css";

type Community = {
  id: string;
  name: string;
  description: string | null;
  purpose: string | null;
  category: string | null;
  dao_account_id: string;
};

export default function MyCommunitiesPage() {
  const { accountId } = useNearWallet();

  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accountId) {
      setCommunities([]);
      setLoading(false);
      return;
    }

    let active = true;

    async function loadCommunities() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/communities?member=${encodeURIComponent(accountId!)}`,
          { cache: "no-store" },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load your communities.");
        }

        if (active) setCommunities(data.communities || []);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong. Please try again.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadCommunities();

    return () => {
      active = false;
    };
  }, [accountId]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a href="/" className={styles.brand}>
          Circle<span>Hub</span>
        </a>

        <a href="/" className={styles.backLink}>
          ← Back home
        </a>
      </header>

      <section className={styles.content}>
        <span className={styles.eyebrow}>YOUR CIRCLEHUB SPACE</span>
        <h1>My communities</h1>
        <p className={styles.intro}>
          Communities where your NEAR wallet is a registered DAO member.
        </p>

        {!accountId ? (
          <div className={styles.message}>
            <h2>Connect your wallet</h2>
            <p>
              Connect your NEAR wallet to see the communities you belong to.
            </p>
          </div>
        ) : loading ? (
          <div className={styles.message}>Checking your DAO memberships...</div>
        ) : error ? (
          <div className={styles.message}>
            <p>{error}</p>
            <button onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        ) : communities.length === 0 ? (
          <div className={styles.message}>
            <h2>No communities found</h2>
            <p>
              This wallet is not currently listed as a member of any registered
              CircleHub DAO.
            </p>
            <a href="/create">Create a community ↗</a>
          </div>
        ) : (
          <div className={styles.grid}>
            {communities.map((community) => (
              <a
                href={`/community/${encodeURIComponent(community.dao_account_id)}`}
                className={styles.card}
                key={community.id}
              >
                <div className={styles.cardTop}>
                  <span className={styles.symbol}>
                    {community.name.charAt(0).toUpperCase()}
                  </span>
                  <span className={styles.category}>
                    {community.category || "COMMUNITY"}
                  </span>
                </div>

                <h2>{community.name}</h2>
                <p>
                  {community.description ||
                    community.purpose ||
                    "A community built on CircleHub."}
                </p>

                <div className={styles.cardBottom}>
                  <span>{community.dao_account_id}</span>
                  <span>↗</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
