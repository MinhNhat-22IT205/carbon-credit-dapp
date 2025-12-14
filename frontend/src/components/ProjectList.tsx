import { useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { CONTRACT_ADDRESSES } from "../contracts/addresses";
import CarbonCreditRegistryABI from "../contracts/abi/CarbonCreditRegistry.json";

export default function ProjectList() {
  const { address } = useAccount();
  const [projectName, setProjectName] = useState("");
  const [baseline, setBaseline] = useState("");
  const { writeContract } = useWriteContract();

  const { data: projectCount } = useReadContract({
    address: CONTRACT_ADDRESSES.REGISTRY,
    abi: CarbonCreditRegistryABI,
    functionName: "projectIdCounter",
  });

  const registerProject = async () => {
    if (!projectName || !baseline) return;
    writeContract({
      address: CONTRACT_ADDRESSES.REGISTRY,
      abi: CarbonCreditRegistryABI,
      functionName: "registerProject",
      args: [projectName, BigInt(baseline)],
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h3 className="text-lg font-semibold mb-4">Register New Project</h3>
        <input
          type="text"
          placeholder="Project name (e.g. Amazon Reforestation)"
          className="w-full p-3 border rounded-lg mb-3"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
        />
        <input
          type="number"
          placeholder="Baseline emissions (tons CO2/year)"
          className="w-full p-3 border rounded-lg mb-4"
          value={baseline}
          onChange={(e) => setBaseline(e.target.value)}
        />
        <button
          onClick={registerProject}
          className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition"
        >
          Register Project
        </button>
      </div>

      {/* List projects, submit claims, view audited batches... */}
      <p className="text-sm text-gray-600">
        Total projects registered: {projectCount?.toString() || 0}
      </p>
    </div>
  );
}
