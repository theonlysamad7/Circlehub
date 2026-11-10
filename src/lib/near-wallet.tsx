"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { NearConnector } from "@hot-labs/near-connect";

type SignedNearMessage = {
  accountId: string;
  publicKey: string;
  signature: string;
};

type NearWalletContextValue = {
  accountId: string | null;
  walletName: string | null;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signMessage: (
    message: string,
    recipient: string,
    nonce: Uint8Array,
  ) => Promise<SignedNearMessage>;
  signAndSendTransaction: (
    receiverId: string,
    methodName: string,
    args: Record<string, unknown>,
    gas: string,
    deposit: string,
  ) => Promise<unknown>;
};

const NearWalletContext =
  createContext<NearWalletContextValue | null>(null);

export function NearWalletProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [connector, setConnector] = useState<NearConnector | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const instance = new NearConnector({
      network: "mainnet",
      autoConnect: false,
      footerBranding: null,
    });

    const handleSignIn = (event: {
      accounts: Array<{ accountId: string }>;
      wallet: { manifest: { name: string } };
      success: boolean;
    }) => {
      if (!active || !event.success) return;

      setAccountId(event.accounts[0]?.accountId ?? null);
      setWalletName(event.wallet.manifest.name);
      setError(null);
    };

    const handleSignOut = () => {
      if (!active) return;

      setAccountId(null);
      setWalletName(null);
    };

    instance.on("wallet:signIn", handleSignIn);
    instance.on("wallet:signOut", handleSignOut);
    setConnector(instance);

    void instance
      .getConnectedWallet()
      .then(({ wallet, accounts }) => {
        if (!active) return;

        setAccountId(accounts[0]?.accountId ?? null);
        setWalletName(wallet.manifest.name);
      })
      .catch(() => {
        // No existing connection is normal for a first visit.
      });

    return () => {
      active = false;
      instance.off("wallet:signIn", handleSignIn);
      instance.off("wallet:signOut", handleSignOut);
      instance.removeAllListeners();
    };
  }, []);

  const connect = useCallback(async () => {
    if (!connector || connecting) return;

    setConnecting(true);
    setError(null);

    try {
      const wallet = await connector.connect();
      const accounts = await wallet.getAccounts({ network: "mainnet" });

      if (!accounts.length) {
        throw new Error("The selected wallet returned no NEAR accounts.");
      }

      setAccountId(accounts[0].accountId);
      setWalletName(wallet.manifest.name);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Wallet connection failed.";

      setError(message);
      throw cause;
    } finally {
      setConnecting(false);
    }
  }, [connector, connecting]);

  const disconnect = useCallback(async () => {
    if (!connector) return;

    setError(null);

    try {
      await connector.disconnect();
      setAccountId(null);
      setWalletName(null);
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Unable to disconnect wallet.";

      setError(message);
      throw cause;
    }
  }, [connector]);

  const signMessage = useCallback(
    async (
      message: string,
      recipient: string,
      nonce: Uint8Array,
    ): Promise<SignedNearMessage> => {
      if (!connector || !accountId) {
        throw new Error("Connect your NEAR wallet before signing a message.");
      }

      setError(null);

      try {
        const { wallet, accounts } = await connector.getConnectedWallet();

        const activeAccount = accounts.find(
          (account) => account.accountId === accountId,
        );

        if (!activeAccount) {
          throw new Error(
            "Your connected wallet account could not be verified. Reconnect your wallet.",
          );
        }

        if (nonce.length !== 32) {
          throw new Error("The signing nonce must contain exactly 32 bytes.");
        }

        const signed = await wallet.signMessage({
          message,
          recipient,
          nonce,
          network: "mainnet",
          signerId: activeAccount.accountId,
        });

        if (signed.accountId !== activeAccount.accountId) {
          throw new Error("The wallet signed with an unexpected account.");
        }

        return signed;
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : "Message signing failed.";

        setError(message);
        throw cause;
      }
    },
    [connector, accountId],
  );

  const signAndSendTransaction = useCallback(
    async (
      receiverId: string,
      methodName: string,
      args: Record<string, unknown>,
      gas: string,
      deposit: string,
    ): Promise<unknown> => {
      if (!connector || !accountId) {
        throw new Error(
          "Connect your NEAR wallet before signing a transaction.",
        );
      }

      setError(null);

      try {
        const { wallet, accounts } = await connector.getConnectedWallet();

        const activeAccount = accounts.find(
          (account) => account.accountId === accountId,
        );

        if (!activeAccount) {
          throw new Error(
            "Your connected wallet account could not be verified. Reconnect your wallet.",
          );
        }

        return await wallet.signAndSendTransaction({
          network: "mainnet",
          signerId: activeAccount.accountId,
          receiverId,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName,
                args,
                gas,
                deposit,
              },
            },
          ],
        });
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : "The wallet transaction failed.";

        setError(message);
        throw cause;
      }
    },
    [connector, accountId],
  );

  return (
    <NearWalletContext.Provider
      value={{
        accountId,
        walletName,
        connecting,
        error,
        connect,
        disconnect,
        signMessage,
        signAndSendTransaction,
      }}
    >
      {children}
    </NearWalletContext.Provider>
  );
}

export function useNearWallet() {
  const context = useContext(NearWalletContext);

  if (!context) {
    throw new Error("useNearWallet must be used inside NearWalletProvider.");
  }

  return context;
}
