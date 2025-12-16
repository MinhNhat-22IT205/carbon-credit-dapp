import { Navigate } from "react-router-dom";
import { useAccount } from "wagmi";
import AuditorDashboard from "../components/AuditorDashboard";
import { useIsAuditor } from "../hooks/useUserRoles";

export default function AuditPage() {
  const { address, isConnected } = useAccount();
  const isAuditor = useIsAuditor(address);

  if (!isConnected) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Connect your wallet to access the auditor workspace
          </h2>
          <p className="text-sm text-gray-600">
            Only whitelisted auditors can review claims and issue verified batches.
          </p>
        </div>
      </div>
    );
  }

  if (!isAuditor) {
    return <Navigate to="/projects" replace />;
  }

  return <AuditorDashboard />;
}


