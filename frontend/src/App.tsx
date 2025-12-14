import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import ProjectSection from "./components/ProjectSection";
import ClaimSection from "./components/ClaimSection";
import AuditorDashboard from "./components/AuditorDashboard";
import MarketplaceSection from "./components/MarketplaceSection";
import { useIsAuditor } from "./hooks/useUserRoles";
import AddAuditorButton from "./components/AddAuditorButton";

function App() {
  const { address, isConnected } = useAccount();
  const isAuditor = useIsAuditor(address);

  console.log("isAuditor", isAuditor);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100">
      <header className="bg-white shadow-md border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-green-800">
            🌿 GreenCarbon Platform
          </h1>
          <ConnectButton />
        </div>
        <AddAuditorButton />
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {!isConnected ? (
          <div className="text-center py-20">
            <h2 className="text-4xl font-bold text-gray-800 mb-6">
              Welcome to Carbon Credit Future
            </h2>
            <p className="text-xl text-gray-600">
              Connect wallet to register projects, verify reductions, and trade
              credits.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            <ProjectSection />
            <ClaimSection />
            {isAuditor && <AuditorDashboard />}
            <MarketplaceSection />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
