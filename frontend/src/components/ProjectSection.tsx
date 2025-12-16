import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import { formatUnits } from "viem";
import RegistryABI from "../contracts/abi/CarbonCreditRegistry.json";
import CCTABI from "../contracts/abi/CarbonCreditToken.json";
import { CONTRACT_ADDRESSES } from "../contracts/addresses";

export default function ProjectSection() {
  const { address } = useAccount();
  const [projectName, setProjectName] = useState("");
  const [baselineEmissions, setBaselineEmissions] = useState("");
  const { writeContract, isPending } = useWriteContract();

  const { data: projectCount } = useReadContract({
    address: CONTRACT_ADDRESSES.REGISTRY,
    abi: RegistryABI,
    functionName: "projectIdCounter",
  });

  const { data: balance } = useReadContract({
    address: CONTRACT_ADDRESSES.CCT,
    abi: CCTABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    enabled: !!address,
  });

  const { data: projectIds } = useReadContract({
    address: CONTRACT_ADDRESSES.REGISTRY,
    abi: RegistryABI,
    functionName: "getProjectsByOwner",
    args: address ? [address] : undefined,
  }) as { data: bigint[] };

  const projectContracts =
    projectIds?.map((id: bigint) => ({
      address: CONTRACT_ADDRESSES.REGISTRY,
      abi: RegistryABI,
      functionName: "getProject",
      args: [id],
    })) || [];

  const { data: projects } = useReadContracts({
    contracts: projectContracts,
    allowFailure: false,
  });

  const registerProject = () => {
    if (!projectName || !baselineEmissions) return;

    writeContract({
      address: CONTRACT_ADDRESSES.REGISTRY,
      abi: RegistryABI,
      functionName: "registerProject",
      args: [projectName, BigInt(baselineEmissions)],
    });

    // Reset form
    setProjectName("");
    setBaselineEmissions("");
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 border border-green-200">
      <h2 className="text-2xl font-bold text-green-800 mb-8 flex items-center gap-3">
        🌱 Your Projects & CCT Balance
      </h2>

      <div className="grid md:grid-cols-2 gap-8">
        {/* CCT Balance */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-6 rounded-xl">
          <p className="text-lg opacity-90">Your Carbon Credits (CCT)</p>
          <p className="text-4xl font-bold mt-3">
            {balance ? Number(formatUnits(balance, 36)).toFixed(2) : "0.00"}
          </p>
          <p className="text-sm opacity-80 mt-2">tons CO₂ verified</p>
        </div>

        {/* Register New Project */}
        <div>
          <h3 className="text-xl font-semibold mb-5 text-gray-800">
            Register New Project
          </h3>
          <input
            type="text"
            placeholder="Project name (e.g. Amazon Reforestation 2025)"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-green-500"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
          <input
            type="number"
            placeholder="Baseline emissions (tons CO₂/year)"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-6 focus:outline-none focus:ring-2 focus:ring-green-500"
            value={baselineEmissions}
            onChange={(e) => setBaselineEmissions(e.target.value)}
          />
          <button
            onClick={registerProject}
            disabled={isPending || !projectName || !baselineEmissions}
            className="w-full bg-green-600 text-white font-semibold py-3 rounded-lg hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {isPending ? "Registering..." : "Register Project"}
          </button>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-gray-200">
        <p className="text-sm text-gray-600">
          <strong>Total projects registered on platform:</strong>{" "}
          <span className="text-green-700 font-bold text-lg">
            {projectCount?.toString() || "0"}
          </span>
        </p>
      </div>

      <div className="mt-10">
        <h3 className="text-xl font-semibold mb-4">
          Your Registered Projects ({projectIds?.length || 0})
        </h3>
        {projects && projects.length > 0 ? (
          <div className="grid gap-4">
            {projects.map((project: any, index: number) => (
              <div
                key={projectIds[index]}
                className="bg-green-50 p-5 rounded-lg border border-green-300"
              >
                <p className="font-bold text-lg">{project.name}</p>
                <p className="text-sm text-gray-700">
                  Project ID: <strong>{projectIds[index].toString()}</strong> |
                  Baseline:{" "}
                  <strong>
                    {project.baselineEmissions.toString()} tons/year
                  </strong>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 italic">
            No projects registered yet. Create one above!
          </p>
        )}
      </div>
    </div>
  );
}
