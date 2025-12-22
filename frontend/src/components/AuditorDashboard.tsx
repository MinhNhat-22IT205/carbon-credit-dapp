import { useState, useEffect } from "react";
import {
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, type Abi } from "viem";
import RegistryABI from "../contracts/abi/CarbonCreditRegistry.json";
import { CONTRACT_ADDRESSES } from "../contracts/addresses";
import BatchNFTCard from "./BatchNFTCard";

/* ---------- Types ---------- */
type ClaimStruct = {
  projectId: bigint;
  reductionTons: bigint;
  periodStart: bigint;
  periodEnd: bigint;
  evidenceIPFS: string;
  status: bigint;
  batchTokenId: bigint;
};

type ProjectStruct = {
  owner: string;
  name: string;
  baselineEmissions: bigint;
};

// ============================================================================
// IPFS SERVICE - Using Pinata
// ============================================================================
const PINATA_JWT = import.meta.env.VITE_PINATA_JWT as string | undefined;

async function uploadToPinata(files: File[], claimId: string): Promise<string> {
  if (!PINATA_JWT) {
    throw new Error("Pinata API keys not configured. Check .env file");
  }
  const folderName = `batch-${claimId}`;
  const formData = new FormData();

  files.forEach((file) => {
    const relativePath = `${folderName}/${file.name}`;
    formData.append("file", file, relativePath);
  });

  const metadata = JSON.stringify({
    name: `Green Carbon Batch #${claimId} - Audit Files`,
    keyvalues: {
      claimId: claimId,
      timestamp: Date.now().toString(),
      auditor: "carbon-credit-system",
    },
  });
  formData.append("pinataMetadata", metadata);

  const options = JSON.stringify({ cidVersion: 1 });
  formData.append("pinataOptions", options);

  const response = await fetch(
    "https://api.pinata.cloud/pinning/pinFileToIPFS",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${PINATA_JWT}` },
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Pinata upload failed: ${error}`);
  }
  const result = await response.json();
  return result.IpfsHash;
}

// ============================================================================
// COMPONENT
// ============================================================================
export default function AuditorDashboard() {
  const [claimId] = useState("");
  const {
    writeContract,
    isPending: txPending,
    data: hash,
  } = useWriteContract();
  const { isLoading: txConfirming, isSuccess: txSuccess } =
    useWaitForTransactionReceipt({ hash });

  // State for IPFS uploads
  const [uploadingClaims, setUploadingClaims] = useState<
    Record<string, boolean>
  >({});
  const [selectedFiles, setSelectedFiles] = useState<Record<string, File[]>>(
    {}
  );
  const [uploadStatus, setUploadStatus] = useState<Record<string, string>>({});

  /* ---------- Single claim by ID ---------- */
  const { data: claim } = useReadContract({
    address: CONTRACT_ADDRESSES.REGISTRY,
    abi: RegistryABI as Abi,
    functionName: "getClaim",
    args: claimId ? [BigInt(claimId)] : undefined,
  }) as { data?: ClaimStruct };

  /* ---------- Pending claim IDs ---------- */
  const { data: pendingClaimIds, refetch: refetchPendingClaims } =
    useReadContract({
      address: CONTRACT_ADDRESSES.REGISTRY,
      abi: RegistryABI,
      functionName: "getPendingClaims",
      query: {
        refetchInterval: 5000, // Refresh mỗi 5 giây
      },
    }) as { data?: bigint[] };

  // Refetch data sau khi transaction thành công
  useEffect(() => {
    if (txSuccess) {
      refetchPendingClaims();
    }
  }, [txSuccess, refetchPendingClaims]);

  /* ---------- Batch read claims ---------- */
  const claimContracts =
    pendingClaimIds?.map((id) => ({
      address: CONTRACT_ADDRESSES.REGISTRY,
      abi: RegistryABI as Abi,
      functionName: "getClaim",
      args: [id],
    })) || [];

  const { data: pendingClaims } = useReadContracts({
    contracts: claimContracts,
    query: {
      refetchInterval: 5000, // Refresh mỗi 5 giây
    },
  });

  /* ---------- Batch read projects ---------- */
  const projectContracts =
    pendingClaims?.map((item) => {
      const claim =
        item?.status === "success" ? (item.result as ClaimStruct) : undefined;
      return {
        address: CONTRACT_ADDRESSES.REGISTRY,
        abi: RegistryABI as Abi,
        functionName: "getProject",
        args: [claim?.projectId],
      };
    }) || [];

  const { data: projects } = useReadContracts({ 
    contracts: projectContracts,
    query: {
      refetchInterval: 5000, // Refresh mỗi 5 giây
    },
  });

  /* ---------- Handle file selection ---------- */
  const handleFileChange = (claimId: string, files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);
    setSelectedFiles((prev) => ({ ...prev, [claimId]: fileArray }));
    setUploadStatus((prev) => ({
      ...prev,
      [claimId]: `${fileArray.length} file(s) selected`,
    }));
  };

  /* ---------- Audit with IPFS upload ---------- */
  const auditClaimWithIPFS = async (claimIdStr: string) => {
    const files = selectedFiles[claimIdStr];
    if (!files || files.length === 0) {
      alert("Please select files to upload first!");
      return;
    }

    const claimIndex = pendingClaimIds?.findIndex(
      (id) => id.toString() === claimIdStr
    );
    if (claimIndex === undefined || claimIndex === -1) return;

    const claimItem = pendingClaims?.[claimIndex];
    const projectItem = projects?.[claimIndex];
    const claim =
      claimItem?.status === "success"
        ? (claimItem.result as ClaimStruct)
        : undefined;
    const project =
      projectItem?.status === "success"
        ? (projectItem.result as ProjectStruct)
        : undefined;
    if (!claim || !project) {
      alert("Loading claim/project data...");
      return;
    }

    setUploadingClaims((prev) => ({ ...prev, [claimIdStr]: true }));
    setUploadStatus((prev) => ({
      ...prev,
      [claimIdStr]: "Preparing metadata...",
    }));

    try {
      const periodStartDate = new Date(
        Number(claim.periodStart) * 1000
      ).toLocaleDateString();
      const periodEndDate = new Date(
        Number(claim.periodEnd) * 1000
      ).toLocaleDateString();
      const vintageYear = new Date(
        Number(claim.periodStart) * 1000
      ).getFullYear();

      const certificateFile = files.find((f) =>
        /\.(pdf|docx|doc|txt|jpg|jpeg|png|gif|webp)$/i.test(f.name)
      );

      const reductionTonsFormatted = formatUnits(claim.reductionTons, 18);

      const metadataContent = {
        name: `Green Carbon Batch #${claimIdStr} - ${project.name} ${vintageYear}`,
        description: `Chứng nhận giảm phát thải ${reductionTonsFormatted} tấn CO₂e đã được audit độc lập.\nDự án: ${project.name}\nKỳ: ${periodStartDate} - ${periodEndDate}.`,
        certificate: certificateFile ? `ipfs://${certificateFile.name}` : "",
        attributes: [
          { trait_type: "Project ID", value: claim.projectId.toString() },
          { trait_type: "Project Name", value: project.name },
          {
            trait_type: "Reduction Tons",
            value: reductionTonsFormatted,
          },
          { trait_type: "Vintage Year", value: vintageYear.toString() },
          {
            trait_type: "Period",
            value: `${periodStartDate} - ${periodEndDate}`,
          },
          {
            trait_type: "Evidence IPFS",
            value: "ipfs://" + claim.evidenceIPFS,
          },
        ],
      };

      const metadataBlob = new Blob(
        [JSON.stringify(metadataContent, null, 2)],
        { type: "application/json" }
      );
      const metadataFile = new File([metadataBlob], "metadata.json");

      const allFiles = [...files, metadataFile];

      const folderCID = await uploadToPinata(allFiles, claimIdStr);
      setUploadStatus((prev) => ({
        ...prev,
        [claimIdStr]: `Uploaded folder: ${folderCID}`,
      }));

      writeContract({
        address: CONTRACT_ADDRESSES.REGISTRY,
        abi: RegistryABI as Abi,
        functionName: "auditAndIssue",
        args: [BigInt(claimIdStr), `${folderCID}`],
      });
    } catch (error: unknown) {
      console.error("Audit error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setUploadStatus((prev) => ({
        ...prev,
        [claimIdStr]: `Error: ${errorMessage}`,
      }));
      alert(`Failed: ${errorMessage}`);
    } finally {
      setUploadingClaims((prev) => ({ ...prev, [claimIdStr]: false }));
    }
  };

  /* ---------- Reject Claim ---------- */
  const rejectClaim = (claimIdStr: string) => {
    if (
      !confirm(
        `Are you sure you want to REJECT Claim #${claimIdStr}? This action cannot be undone.`
      )
    ) {
      return;
    }

    writeContract({
      address: CONTRACT_ADDRESSES.REGISTRY,
      abi: RegistryABI as Abi,
      functionName: "rejectClaim", // Hàm rejectClaim phải tồn tại trong contract
      args: [BigInt(claimIdStr)],
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 border border-purple-200">
      <h2 className="text-2xl font-bold mb-2 text-purple-800">
        Auditor – Claims Review
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        Review evidence, upload audit packages, and issue or reject climate
        bundles.
      </p>

      {/* IPFS Configuration Notice */}
      {!PINATA_JWT && (
        <div className="mb-6 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700">
          <p className="font-bold">IPFS Not Configured</p>
          <p className="text-sm mt-1">Add VITE_PINATA_JWT to your .env file</p>
          <p className="text-xs mt-2 text-gray-600">
            Get free JWT at{" "}
            <a
              href="https://pinata.cloud"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              pinata.cloud
            </a>
          </p>
        </div>
      )}

      {claim && claim.batchTokenId > 0n && (
        <BatchNFTCard
          batchTokenId={claim.batchTokenId}
          claimId={BigInt(claimId)}
        />
      )}

      {/* ---------- Pending claims list ---------- */}
      <h3 className="text-xl font-semibold mb-6 mt-8">
        Pending Claims for Audit ({pendingClaimIds?.length || 0})
      </h3>

      {pendingClaims && pendingClaims.length > 0 ? (
        <div className="space-y-8">
          {pendingClaims.map((item, index: number) => {
            const claim =
              item?.status === "success"
                ? (item.result as ClaimStruct)
                : undefined;
            const project =
              projects?.[index]?.status === "success"
                ? (projects[index].result as ProjectStruct)
                : undefined;
            const currentClaimId = pendingClaimIds?.[index]?.toString() || "";
            if (!claim) return null;

            const isUploading = uploadingClaims[currentClaimId];
            const files = selectedFiles[currentClaimId] || [];
            const status = uploadStatus[currentClaimId];

            return (
              <div
                key={currentClaimId}
                className="bg-gradient-to-r from-yellow-50 to-orange-50 p-8 rounded-2xl border-2 border-yellow-400 shadow-lg"
              >
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Left: Claim Info */}
                  <div>
                    <p className="font-bold text-2xl text-purple-800 mb-4">
                      Claim #{currentClaimId}
                    </p>
                    <div className="space-y-3 text-base">
                      <div className="flex items-start gap-3">
                        <span className="font-semibold min-w-[100px]">
                          Project:
                        </span>
                        <span>{project?.name || "Loading..."}</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="font-semibold min-w-[100px]">
                          Owner:
                        </span>
                        <span className="text-xs font-mono break-all">
                          {project?.owner || "Loading..."}
                        </span>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="font-semibold min-w-[100px]">
                          Reduction:
                        </span>
                        <span className="text-green-700 font-bold text-xl">
                          {formatUnits(claim.reductionTons, 18)} tons CO₂
                        </span>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="font-semibold min-w-[100px]">
                          Baseline:
                        </span>
                        <span>
                          {project?.baselineEmissions
                            ? project.baselineEmissions.toString()
                            : "Loading..."}{" "}
                          tons/year
                        </span>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="font-semibold min-w-[100px]">
                          Evidence:
                        </span>
                        <a
                          href={`https://ipfs.io/ipfs/${claim.evidenceIPFS}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-sm break-all"
                        >
                          {claim.evidenceIPFS.slice(0, 30)}...
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-col gap-5">
                    {/* File Upload */}
                    <div className="bg-white p-5 rounded-xl border-2 border-dashed border-purple-300">
                      <label className="block font-bold mb-3 text-purple-800">
                        Upload Audit Report
                      </label>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip"
                        onChange={(e) =>
                          handleFileChange(currentClaimId, e.target.files)
                        }
                        className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                        disabled={isUploading}
                      />
                      {files.length > 0 && (
                        <div className="mt-4 text-sm">
                          <p className="font-semibold text-gray-700">
                            Selected files ({files.length}):
                          </p>
                          <div className="max-h-32 overflow-y-auto mt-2">
                            {files.map((file, idx) => (
                              <p key={idx} className="text-gray-600 truncate">
                                • {file.name} ({(file.size / 1024).toFixed(1)}{" "}
                                KB)
                              </p>
                            ))}
                          </div>
                        </div>
                      )}
                      {status && (
                        <p
                          className={`mt-4 text-sm font-medium ${
                            status.includes("Uploaded")
                              ? "text-green-600"
                              : status.includes("Error")
                              ? "text-red-600"
                              : "text-blue-600"
                          }`}
                        >
                          {status}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* APPROVE */}
                      <button
                        onClick={() => auditClaimWithIPFS(currentClaimId)}
                        disabled={
                          isUploading ||
                          files.length === 0 ||
                          txPending ||
                          txConfirming
                        }
                        className={`py-4 rounded-xl font-bold text-white transition-all ${
                          isUploading || txPending || txConfirming
                            ? "bg-gray-400 cursor-not-allowed"
                            : files.length === 0
                            ? "bg-gray-300 cursor-not-allowed"
                            : "bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg"
                        }`}
                      >
                        {isUploading
                          ? "Uploading..."
                          : txPending || txConfirming
                          ? "Processing..."
                          : files.length === 0
                          ? "Select Files"
                          : "Approve & Issue"}
                      </button>

                      {/* REJECT */}
                      <button
                        onClick={() => rejectClaim(currentClaimId)}
                        disabled={txPending || txConfirming}
                        className="py-4 rounded-xl font-bold text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg disabled:opacity-60"
                      >
                        {txPending || txConfirming
                          ? "Processing..."
                          : "Reject Claim"}
                      </button>
                    </div>

                    <p className="text-xs text-center text-gray-500 mt-2">
                      Approve: Upload files + mint NFT & CCT
                      <br />
                      Reject: Permanently reject this claim
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="text-7xl mb-6">🎉</div>
          <p className="text-gray-600 text-2xl font-semibold">
            No pending claims
          </p>
          <p className="text-gray-500 text-lg mt-3">
            All claims have been processed. Great job!
          </p>
        </div>
      )}
    </div>
  );
}
