import { Navigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { useIsAdmin, useIsAuditor } from "../hooks/useUserRoles";

/**
 * Component để redirect về trang mặc định dựa trên role của user
 * - Auditor → /audit
 * - Admin → /projects (hoặc có thể đổi thành /admin/add-auditor nếu muốn)
 * - Project Owner hoặc chưa connect → /projects
 */
export default function HomeRedirect() {
  const { address, isConnected } = useAccount();
  const { isAdmin, isLoading: isLoadingAdmin } = useIsAdmin(address);
  const { isAuditor, isLoading: isLoadingAuditor } = useIsAuditor(address);

  // Nếu chưa connect wallet, redirect đến projects
  if (!isConnected) {
    return <Navigate to="/projects" replace />;
  }

  // Đợi cho đến khi cả hai hooks đã load xong
  if (isLoadingAdmin || isLoadingAuditor) {
    // Hiển thị loading hoặc đợi một chút
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-emerald-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Checking your role...</p>
        </div>
      </div>
    );
  }

  // Nếu là auditor, redirect đến audit page
  if (isAuditor) {
    return <Navigate to="/audit" replace />;
  }

  // Nếu là admin hoặc project owner, redirect đến projects
  return <Navigate to="/projects" replace />;
}
