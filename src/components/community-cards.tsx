"use client";

import { useEffect, useState } from "react";

type Community = {
  id: string;
  name: string;
  description: string | null;
  purpose: string | null;
  category: string | null;
  dao_account_id: string;
};

export default function CommunityCards() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetch("/api/communities", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load communities.");
        return response.json();
      })
      .then((data) => {
        if (active) setCommunities(data.communities || []);
      })
      .catch(() => {
        if (active) setCommunities([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <p className="community-list-message">Loading communities...</p>;
  }

  if (communities.length === 0) {
    return (
      <div className="community-list-message">
        <p>No communities have been created yet.</p>
        <a href="/create" className="text-link">
          Create a community ↗
        </a>
      </div>
    );
  }

  return (
    <div className="community-grid">
      {communities.map((community) => {
        const category = (community.category || "COMMUNITY").toUpperCase();
        const categoryKey = category.toLowerCase();

        const style = categoryKey.includes("education")
          ? "uni"
          : categoryKey.includes("creative")
            ? "creative"
            : "events";

        return (
          <a
            className="community-card"
            key={community.id}
            href={`/community/${encodeURIComponent(community.dao_account_id)}`}
          >
            <div className={`community-art ${style}`}>
              <span className="art-symbol">
                {community.name?.charAt(0).toUpperCase() || "C"}
              </span>
              <span className="art-label">{category}</span>
            </div>

            <div className="community-content">
              <div className="community-title-row">
                <h3>{community.name}</h3>
                <span className="community-arrow">↗</span>
              </div>

              <p>
                {community.description ||
                  community.purpose ||
                  "A community built on CircleHub."}
              </p>

              <div className="funding-foot">
                <span>View community</span>
                <span>NEAR DAO ↗</span>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}
