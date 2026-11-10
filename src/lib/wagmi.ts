import { createConfig, http } from "wagmi";
import { arbitrum, base } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [arbitrum, base],
  connectors: [injected()],
  transports: {
    [arbitrum.id]: http(),
    [base.id]: http(),
  },
  ssr: true,
});
