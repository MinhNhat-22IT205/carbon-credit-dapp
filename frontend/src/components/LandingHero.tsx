import LandingHero from "./components/LandingHero";
import FootprintCalculator from "./components/FootprintCalculator";
import MarketplaceFull from "./components/MarketplaceFull";
import ProjectDashboard from "./components/ProjectDashboard";
import AuditorDashboard from "./components/AuditorDashboard";
import Portfolio from "./components/Portfolio";
import { useAccount, useReadContract } from "wagmi";
import { CONTRACT_ADDRESSES } from "./contracts/addresses";
import RegistryABI from "./contracts/abi/CarbonCreditRegistry.json";

function App() {
  const { address, isConnected } = useAccount();

  // Detect nếu là auditor (cần admin grant role trước)
  const { data: isAuditor } = useReadContract({
    address: CONTRACT_ADDRESSES.REGISTRY,
    abi: RegistryABI,
    functionName: "hasRole",
    args: [
      ethers.utils.keccak256(ethers.utils.toUtf8Bytes("AUDITOR_ROLE")),
      address,
    ],
    enabled: !!address,
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-teal-50">
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-green-800">
            🌿 GreenCarbon Platform
          </h1>
          <ConnectButton />
        </div>
      </header>

      {!isConnected ? (
        <LandingHero />
      ) : (
        <main className="max-w-7xl mx-auto px-4 py-8 space-y-12">
          <FootprintCalculator />

          {isAuditor && <AuditorDashboard />}

          <ProjectDashboard />

          <section>
            <h2 className="text-3xl font-bold text-gray-800 mb-8">
              Marketplace
            </h2>
            <MarketplaceFull />
          </section>

          <Portfolio />
        </main>
      )}
    </div>
  );
}
