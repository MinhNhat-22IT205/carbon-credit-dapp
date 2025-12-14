import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "viem";
import {
  sepolia,
  mainnet,
  polygon,
  optimism,
  arbitrum,
  base,
} from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "Green Carbon Credit Marketplace",
  projectId: "YOUR_WALLET_CONNECT_PROJECT_ID", // Lấy từ https://cloud.walletconnect.com
  chains: [mainnet, polygon, optimism, arbitrum, base, sepolia],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [optimism.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
    [sepolia.id]: http(),
  },
});
