"use client";

import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import styles from "./ai.module.css";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Community = {
  name: string;
  description?: string;
  category?: string;
  purpose?: string;
  dao_account_id: string;
};

const suggestions = [
  "Help me create a budget for our next community event.",
  "How can we reduce costs without reducing quality?",
  "Suggest a practical fundraising target for our community.",
  "Help us plan how to allocate our available funds.",
];

function CommunityAIContent() {
  const params = useParams<{ daoAccountId: string }>();
  const daoAccountId = decodeURIComponent(params.daoAccountId || "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");

  const [community, setCommunity] = useState<Community | null>(null);
  const [loadingCommunity, setLoadingCommunity] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    async function loadCommunity() {
      try {
        const response = await fetch(
          `/api/communities/${encodeURIComponent(daoAccountId)}`,
          { cache: "no-store" },
        );
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Unable to load community.");
        }

        if (active) setCommunity(payload.community);
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : "Unable to load community.",
          );
        }
      } finally {
        if (active) setLoadingCommunity(false);
      }
    }

    if (daoAccountId) void loadCommunity();

    return () => {
      active = false;
    };
  }, [daoAccountId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const sendMessage = async (
    event?: FormEvent<HTMLFormElement>,
    suggestedMessage?: string,
  ) => {
    event?.preventDefault();

    const message = (suggestedMessage ?? input).trim();
    if (!message || sending || !community) return;

    const previousMessages = messages;
    const nextMessages: Message[] = [
      ...previousMessages,
      { role: "user", content: message },
    ];

    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError("");

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          daoAccountId,
          message,
          history: previousMessages,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to get an AI response.");
      }

      setMessages([
        ...nextMessages,
        { role: "assistant", content: payload.reply },
      ]);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Message could not be sent.",
      );
    } finally {
      setSending(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError("");
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark}>C</span>
          <span>Circle<span className={styles.brandAccent}>Hub</span></span>
        </Link>
        <Link
          href={`/community/${encodeURIComponent(daoAccountId)}`}
          className={styles.backLink}
        >
          ← Community dashboard
        </Link>
      </header>

      <div className={styles.shell}>
        <aside className={styles.sidebar}>
          <div className={styles.aiIcon}>✳</div>
          <div className={styles.eyebrow}>CIRCLEHUB AI</div>
          <h1>AI Budget Planner</h1>
          <p className={styles.sidebarText}>
            Think through budgets, make better spending decisions, and plan
            community activities with your AI assistant.
          </p>

          <div className={styles.communityCard}>
            <span>YOUR COMMUNITY</span>
            <strong>
              {loadingCommunity ? "Loading..." : community?.name || "Community"}
            </strong>
            <small>{community?.dao_account_id || daoAccountId}</small>
          </div>

          <div className={styles.tip}>
            <strong>What can I help with?</strong>
            <p>
              Budgets, event costs, fundraising, expense planning, community
              ideas, and general questions.
            </p>
          </div>

          <div className={styles.sidebarBottom}>
            <span className={styles.liveDot} />
            Powered by NEAR AI
          </div>
        </aside>

        <section className={styles.chatPanel}>
          <div className={styles.chatHeader}>
            <div>
              <span className={styles.chatStatus}>
                <i /> AI ASSISTANT
              </span>
              <h2>Let's figure it out together.</h2>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                className={styles.clearButton}
                onClick={clearChat}
                disabled={sending}
              >
                New chat
              </button>
            )}
          </div>

          <div className={styles.conversation}>
            {messages.length === 0 ? (
              <div className={styles.welcome}>
                <div className={styles.welcomeIcon}>✳</div>
                <h3>
                  {loadingCommunity
                    ? "Getting your community ready..."
                    : `Hello${community?.name ? `, ${community.name}` : ""}.`}
                </h3>
                <p>
                  I'm here to help you think, plan, and make informed decisions
                  for your community. What would you like to work on?
                </p>

                <div className={styles.suggestions}>
                  {suggestions.map((suggestion) => (
                    <button
                      type="button"
                      key={suggestion}
                      onClick={() => void sendMessage(undefined, suggestion)}
                      disabled={!community || sending}
                    >
                      <span>↗</span>
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className={styles.messageList}>
                {messages.map((message, index) => (
                  <div
                    className={`${styles.messageRow} ${
                      message.role === "user" ? styles.userRow : styles.aiRow
                    }`}
                    key={`${index}-${message.role}`}
                  >
                    {message.role === "assistant" && (
                      <span className={styles.messageAvatar}>✳</span>
                    )}
                    <div
                      className={`${styles.messageBubble} ${
                        message.role === "user"
                          ? styles.userBubble
                          : styles.aiBubble
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}

                {sending && (
                  <div className={`${styles.messageRow} ${styles.aiRow}`}>
                    <span className={styles.messageAvatar}>✳</span>
                    <div className={`${styles.messageBubble} ${styles.aiBubble} ${styles.typing}`}>
                      Thinking
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <form className={styles.composer} onSubmit={(event) => void sendMessage(event)}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask anything about planning, budgeting, or your community..."
              rows={2}
              maxLength={4000}
              disabled={!community || sending}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
            />
            <div className={styles.composerBottom}>
              <span>AI can make mistakes. Review important decisions.</span>
              <button
                type="submit"
                disabled={!input.trim() || !community || sending}
              >
                {sending ? "Sending..." : "Send"} <span>↑</span>
              </button>
            </div>
          </form>

          <div className={styles.disclaimer}>
            AI Budget Planner provides guidance only. It cannot move funds or
            approve DAO transactions.
          </div>
        </section>
      </div>
    </main>
  );
}


export default function CommunityAIPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40 }}>Loading AI Budget Planner...</div>}>
      <CommunityAIContent />
    </Suspense>
  );
}
