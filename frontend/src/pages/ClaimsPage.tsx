import { useAccount } from "wagmi";
import ClaimSection from "../components/ClaimSection";

export default function ClaimsPage() {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Connect your wallet to submit claims
          </h2>
          <p className="text-sm text-gray-600">
            Create and monitor reduction claims for your registered projects
            after connecting.
          </p>
        </div>
      </div>
    );
  }

  return <ClaimSection />;
}
