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
    <div className="bg-purple-50 p-6 rounded-xl border border-purple-300 mt-8">
      <h3 className="text-lg font-bold text-purple-800 mb-4">
        🔧 Admin: Add New Auditor
      </h3>
      <input
        type="text"
        placeholder="Auditor wallet address (0x...)"
        className="w-full px-4 py-2 border rounded-lg mb-4"
        value={auditorAddress}
        onChange={(e) => setAuditorAddress(e.target.value)}
      />
      <button
        onClick={addAuditor}
        disabled={isPending || !auditorAddress}
        className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
      >
        {isPending ? "Adding..." : "Add Auditor Role"}
      </button>
    </div>
  );
}
