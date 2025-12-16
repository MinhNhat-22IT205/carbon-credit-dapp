import { useAccount } from "wagmi";
import MarketplaceSection from "../components/MarketplaceSection";

export default function MarketPage() {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Connect your wallet to trade carbon credits
          </h2>
          <p className="text-sm text-gray-600">
            Open sales and purchase tokenized carbon credit bundles securely via
            your wallet.
          </p>
        </div>
      </div>
    );
  }

  return <MarketplaceSection />;
}
