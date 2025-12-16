import { useAccount } from "wagmi";
import RetireSection from "../components/RetireSection";

export default function RetirePage() {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Connect your wallet to retire CCT
          </h2>
          <p className="text-sm text-gray-600">
            Retire carbon credits and mint on-chain retirement certificates with your wallet.
          </p>
        </div>
      </div>
    );
  }

  return <RetireSection />;
}


