"use client";

import type { ReactNode } from "react";
import { NearWalletProvider } from "@/lib/near-wallet";

export default function Providers({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <NearWalletProvider>
      {children}
    </NearWalletProvider>
  );
}
