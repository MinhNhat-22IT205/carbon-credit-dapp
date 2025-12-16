import { Navigate } from "react-router-dom";
import { useAccount } from "wagmi";
import AddAuditorButton from "../components/AddAuditorButton";
import { useIsAdmin } from "../hooks/useUserRoles";

export default function AdminAddAuditorPage() {
  const { address, isConnected } = useAccount();
  const { isAdmin } = useIsAdmin(address);

  if (!isConnected) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Connect your wallet to access admin tools
          </h2>
          <p className="text-sm text-gray-600">
            Only the platform admin can grant auditor permissions to new accounts.
          </p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/projects" replace />;
  }

  return <AddAuditorButton />;
}


