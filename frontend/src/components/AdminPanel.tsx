import { useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import RegistryABI from "../contracts/abi/CarbonCreditRegistry.json";
import { CONTRACT_ADDRESSES } from "../contracts/addresses";

export default function AdminPanel() {
  const { address } = useAccount();
  const [newAuditor, setNewAuditor] = useState("");
  const { writeContract, isPending } = useWriteContract();

  const { data: isAdmin } = useReadContract({
    address: CONTRACT_ADDRESSES.REGISTRY,
    abi: RegistryABI,
    functionName: "hasRole",
    args: [ethers.utils.hexZeroPad(ethers.utils.hexlify(0), 32), address], // DEFAULT_ADMIN_ROLE = 0x00...00
    enabled: !!address,
  });

  const { data: auditors } = useReadContract({
    address: CONTRACT_ADDRESSES.REGISTRY,
    abi: RegistryABI,
    functionName: "getAllAuditors",
  });

  if (!isAdmin) return null;

  const addAuditor = () => {
    writeContract({
      address: CONTRACT_ADDRESSES.REGISTRY,
      abi: RegistryABI,
      functionName: "addAuditor",
      args: [newAuditor as `0x${string}`],
    });
  };

  const removeAuditor = (auditor: string) => {
    writeContract({
      address: CONTRACT_ADDRESSES.REGISTRY,
      abi: RegistryABI,
      functionName: "removeAuditor",
      args: [auditor as `0x${string}`],
    });
  };

  return (
    <div className="bg-gradient-to-r from-purple-100 to-indigo-100 rounded-2xl shadow-xl p-8 mt-12 border border-purple-300">
      <h2 className="text-2xl font-bold text-purple-900 mb-6">
        ⚙️ Admin Panel - Auditor Management
      </h2>

      <div className="mb-6">
        <input
          type="text"
          placeholder="New auditor address (0x...)"
          className="w-full px-4 py-3 border rounded-lg mb-4"
          value={newAuditor}
          onChange={(e) => setNewAuditor(e.target.value)}
        />
        <button
          onClick={addAuditor}
          disabled={isPending}
          className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700"
        >
          Add Auditor
        </button>
      </div>

      <h3 className="text-lg font-semibold mb-3">
        Current Auditors ({auditors?.length || 0})
      </h3>
      <div className="space-y-2">
        {auditors?.map((auditor: string) => (
          <div
            key={auditor}
            className="flex justify-between items-center bg-white p-3 rounded-lg"
          >
            <code className="text-sm">{auditor}</code>
            <button
              onClick={() => removeAuditor(auditor)}
              className="text-red-600 hover:text-red-800 text-sm"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
