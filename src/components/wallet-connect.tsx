"use client";

import { useState } from "react";
import { useNearWallet } from "@/lib/near-wallet";

export default function WalletConnectButton() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);

  const {
    accountId,
    walletName,
    connecting,
    error,
    connect,
    disconnect,
  } = useNearWallet();

  const shortAddress = accountId
    ? accountId.length > 26
      ? `${accountId.slice(0, 12)}...${accountId.slice(-8)}`
      : accountId
    : "";

  async function connectWallet() {
    try {
      await connect();
      setWalletDialogOpen(false);
    } catch {
      // The wallet context exposes the error.
    }
  }

  async function disconnectWallet() {
    try {
      await disconnect();
      setMenuOpen(false);
    } catch {
      // The wallet context exposes the error.
    }
  }

  return (
    <div className="profile-menu-root">
      <button
        type="button"
        className="profile-icon-button"
        aria-label="Open profile menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <svg
          viewBox="0 0 24 24"
          width="21"
          height="21"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c.5-4 3-6 7-6s6.5 2 7 6" />
        </svg>

        {accountId && <span className="profile-connected-dot" />}
      </button>

      {menuOpen && (
        <>
          <button
            type="button"
            className="profile-menu-dismiss"
            aria-label="Close profile menu"
            onClick={() => setMenuOpen(false)}
          />

          <div className="profile-popover">
            

            {accountId ? (
              <>
                <div className="profile-wallet-info">
                  <span className="profile-wallet-label">
                    NEAR WALLET CONNECTED
                  </span>

                  <span className="profile-wallet-address">
                    <span className="profile-connected-dot" />
                    {shortAddress}
                  </span>

                  <span className="profile-wallet-network">
                    {walletName ?? "NEAR wallet"} · Mainnet
                  </span>

                  <span className="profile-wallet-network">
                    Wallet connected
                  </span>
                </div>

                <button
                  type="button"
                  className="profile-menu-item profile-menu-action"
                  onClick={() => {
                    setMenuOpen(false);
                    setWalletDialogOpen(true);
                  }}
                >
                  <span className="profile-menu-icon">↔</span>
                  <span>Change wallet</span>
                  <span className="profile-menu-arrow">›</span>
                </button>

                <button
                  type="button"
                  className="profile-menu-item profile-menu-action"
                  onClick={() => void disconnectWallet()}
                >
                  <span className="profile-menu-icon">↗</span>
                  <span>Disconnect wallet</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                className="profile-menu-item profile-menu-action"
                onClick={() => {
                  setMenuOpen(false);
                  setWalletDialogOpen(true);
                }}
              >
                <span className="profile-menu-icon">↗</span>
                <span>Connect NEAR wallet</span>
                <span className="profile-menu-arrow">›</span>
              </button>
            )}

            {error && (
              <p className="wallet-dialog-error" role="alert">
                {error}
              </p>
            )}
          </div>
        </>
      )}

      {walletDialogOpen && (
        <div
          className="wallet-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setWalletDialogOpen(false);
            }
          }}
        >
          <section
            className="wallet-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-dialog-title"
          >
            <button
              type="button"
              className="wallet-dialog-close"
              aria-label="Close dialog"
              onClick={() => setWalletDialogOpen(false)}
            >
              ×
            </button>

            <div className="wallet-dialog-mark">◇</div>

            <h2 id="wallet-dialog-title">
              {accountId ? "Change NEAR wallet" : "Connect NEAR wallet"}
            </h2>

            <p className="wallet-dialog-description">
              Connect your NEAR wallet to join communities, contribute funds,
              vote on proposals and manage shared treasuries.
            </p>

            <div className="wallet-options">
              <button
                type="button"
                className="wallet-option"
                disabled={connecting}
                onClick={() => void connectWallet()}
              >
                <span className="wallet-option-icon">◇</span>

                <span className="wallet-option-text">
                  <strong>
                    {connecting ? "Connecting..." : "Choose a wallet"}
                  </strong>

                  <small>
                    {connecting
                      ? "Approve the connection in your wallet"
                      : "HOT Connect · NEAR Mainnet"}
                  </small>
                </span>

                <span className="profile-menu-arrow">›</span>
              </button>
            </div>

            {error && (
              <p className="wallet-dialog-error" role="alert">
                {error}
              </p>
            )}

            <p className="wallet-dialog-footnote">
              Connecting does not transfer funds or require a message
              signature. Transactions require your approval in your wallet.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
