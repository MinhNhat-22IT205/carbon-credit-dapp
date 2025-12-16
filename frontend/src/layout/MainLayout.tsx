import type { ReactNode } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract } from "wagmi";
import { NavLink } from "react-router-dom";
import CCTABI from "../contracts/abi/CarbonCreditToken.json";
import { CONTRACT_ADDRESSES } from "../contracts/addresses";
import { formatUnits } from "viem";
import { useIsAdmin, useIsAuditor } from "../hooks/useUserRoles";

type MainLayoutProps = {
  children: ReactNode;
};

const navItems = [
  { path: "/projects", label: "Projects", roles: ["projectOwner"] },
  { path: "/claims", label: "Claims", roles: ["projectOwner"] },
  { path: "/market", label: "Market", roles: ["projectOwner"] },
  { path: "/retire", label: "Retire", roles: ["projectOwner"] },
  { path: "/audit", label: "Audit", roles: ["auditor"] },
  { path: "/admin/add-auditor", label: "Add auditor", roles: ["admin"] },
];

export function MainLayout({ children }: MainLayoutProps) {
  const { address, isConnected } = useAccount();
  const { isAdmin } = useIsAdmin(address);
  const isAuditor = useIsAuditor(address);

  const { data: balance } = useReadContract({
    address: CONTRACT_ADDRESSES.CCT,
    abi: CCTABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const cctBalance = balance
    ? Number(formatUnits(balance as bigint, 18)).toFixed(2)
    : "0.00";

  let activeRole: "admin" | "auditor" | "projectOwner" | null = null;
  if (isAdmin) {
    activeRole = "admin";
  } else if (isAuditor) {
    activeRole = "auditor";
  } else if (isConnected) {
    activeRole = "projectOwner";
  }

  const visibleNavItems =
    activeRole == null
      ? []
      : navItems.filter((item) => item.roles.includes(activeRole));

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex flex-col">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-2xl">
              🌿
            </div>
            <div>
              <div className="text-xl font-bold text-emerald-900">
                GreenCarbon Console
              </div>
              <p className="text-xs text-gray-500">
                Enterprise carbon credits management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isConnected && (
              <div className="hidden sm:flex flex-col items-end text-right">
                <span className="text-xs text-gray-500 uppercase tracking-wide">
                  CCT Balance
                </span>
                <span className="text-sm font-semibold text-emerald-700">
                  {cctBalance} CCT
                </span>
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  {isAdmin && <span>Admin</span>}
                  {isAuditor && <span>Auditor</span>}
                  {!isAdmin && !isAuditor && <span>Project Owner</span>}
                </span>
              </div>
            )}
            <ConnectButton />
          </div>
        </div>

        <nav className="border-t border-gray-100 bg-white/80 backdrop-blur">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 flex items-center gap-2 sm:gap-4 overflow-x-auto">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  [
                    "px-3 sm:px-4 py-2 my-1 text-sm font-medium rounded-full whitespace-nowrap transition-colors",
                    isActive
                      ? "bg-emerald-600 text-white! shadow-sm"
                      : "text-emerald-700! hover:text-emerald-700 hover:bg-emerald-50",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
