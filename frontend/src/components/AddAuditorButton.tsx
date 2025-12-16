import { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import RegistryABI from "../contracts/abi/CarbonCreditRegistry.json";
import { CONTRACT_ADDRESSES } from "../contracts/addresses";

export default function AddAuditorButton() {
  const { address } = useAccount();
  const [auditorAddress, setAuditorAddress] = useState("");
  const { writeContract, isPending } = useWriteContract();

  // Chỉ hiển thị nếu bạn là admin (deployer thường là admin)
  // Bạn có thể check hasRole(DEFAULT_ADMIN_ROLE) nếu muốn chính xác hơn

  const addAuditor = () => {
    if (!auditorAddress) return;
    writeContract({
      address: CONTRACT_ADDRESSES.REGISTRY,
      abi: RegistryABI,
      functionName: "addAuditor",
      args: [auditorAddress as `0x${string}`],
    });
  };

  return (
    <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-lg border border-purple-200 mt-4 p-8">
      <h2 className="text-2xl font-bold text-purple-800 mb-2">
        Admin – Manage Auditor Access
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        Grant <span className="font-semibold">AUDITOR_ROLE</span> to trusted
        verification partners.
      </p>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Auditor wallet address
      </label>
      <input
        type="text"
        placeholder="0x..."
        className="w-full px-4 py-3 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
        value={auditorAddress}
        onChange={(e) => setAuditorAddress(e.target.value)}
      />
      <button
        onClick={addAuditor}
        disabled={isPending || !auditorAddress}
        className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 font-semibold"
      >
        {isPending ? "Adding..." : "Add Auditor Role"}
      </button>
    </div>
  );
}
