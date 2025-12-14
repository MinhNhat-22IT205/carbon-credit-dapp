import { useState } from "react";
import { useReadContract, useReadContracts, useWriteContract } from "wagmi";
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
const PINATA_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI5OTNlZjk2Ny0xNWYwLTQ1NjAtODcxYS00ZDRmNjM0MDc1MmUiLCJlbWFpbCI6Im5oYXRtaW5obGVkYW8yMDA0QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiI5NzdkZjAxM2EzMGNmM2I3OGU3NSIsInNjb3BlZEtleVNlY3JldCI6Ijc4NTZkOTA5MGJhMTgyYTQwZWJiYmNkMzRhMmY3Mzk5YWE4NWYxNDE1ODI3ZjBhZDkzMzIyZWQzMDEyMmEyYWMiLCJleHAiOjE3OTY1MTc5MjB9.5YHMne_ORNXqhu8BKydvtCJjD5C1F4S0TaGLI5F2i3s";

async function uploadToPinata(files: File[], claimId: string): Promise<string> {
  if (!PINATA_JWT) {
    throw new Error("Pinata API keys not configured. Check .env file");
  }

  const folderName = `batch-${claimId}`; // Tên folder chung trên IPFS

  const formData = new FormData();

  // Add từng file với relative path: folderName/filename
  files.forEach((file) => {
    const relativePath = `${folderName}/${file.name}`;
    formData.append("file", file, relativePath);
  });

  // pinataMetadata: tên folder hiển thị trên Pinata dashboard
  const metadata = JSON.stringify({
    name: `Green Carbon Batch #${claimId} - Audit Files`,
    keyvalues: {
      claimId: claimId,
      timestamp: Date.now().toString(),
      auditor: "carbon-credit-system",
    },
  });
  formData.append("pinataMetadata", metadata);

  const options = JSON.stringify({
    cidVersion: 1,
  });
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
  return result.IpfsHash; // Đây là CID của folder
}

// ============================================================================
// COMPONENT
// ============================================================================
export default function AuditorDashboard() {
  const [claimId, setClaimId] = useState("");
  const { writeContract, isPending } = useWriteContract();

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
    abi: RegistryABI,
    functionName: "getClaim",
    args: claimId ? [BigInt(claimId)] : undefined,
    enabled: !!claimId,
  }) as { data?: ClaimStruct };

  /* ---------- Pending claim IDs ---------- */
  const { data: pendingClaimIds } = useReadContract({
    address: CONTRACT_ADDRESSES.REGISTRY,
    abi: RegistryABI,
    functionName: "getPendingClaims",
  }) as { data?: bigint[] };

  /* ---------- Batch read claims ---------- */
  const claimContracts =
    pendingClaimIds?.map((id) => ({
      address: CONTRACT_ADDRESSES.REGISTRY,
      abi: RegistryABI,
      functionName: "getClaim",
      args: [id],
    })) || [];

  const { data: pendingClaims } = useReadContracts({
    contracts: claimContracts,
  });

  /* ---------- Batch read projects ---------- */
  const projectContracts =
    pendingClaims?.map((item: any) => ({
      address: CONTRACT_ADDRESSES.REGISTRY,
      abi: RegistryABI,
      functionName: "getProject",
      args: [item?.result?.projectId],
    })) || [];

  const { data: projects } = useReadContracts({
    contracts: projectContracts,
  });

  /* ---------- Handle file selection ---------- */
  const handleFileChange = (claimId: string, files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);
    setSelectedFiles((prev) => ({
      ...prev,
      [claimId]: fileArray,
    }));

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

    // Lấy data claim & project (giống trước)
    const claimIndex = pendingClaimIds?.findIndex(
      (id) => id.toString() === claimIdStr
    );
    if (claimIndex === undefined || claimIndex === -1) return;
    const claim = pendingClaims?.[claimIndex]?.result as ClaimStruct;
    const project = projects?.[claimIndex]?.result as ProjectStruct;

    if (!claim || !project) {
      alert("Loading claim/project data...");
      return;
    }

    setUploadingClaims((prev) => ({ ...prev, [claimIdStr]: true }));
    setUploadStatus((prev) => ({
      ...prev,
      [claimIdStr]: "📤 Preparing metadata...",
    }));

    try {
      // 1. Tạo metadata.json tự động
      const periodStartDate = new Date(
        Number(claim.periodStart) * 1000
      ).toLocaleDateString();
      const periodEndDate = new Date(
        Number(claim.periodEnd) * 1000
      ).toLocaleDateString();
      const vintageYear = new Date(
        Number(claim.periodStart) * 1000
      ).getFullYear();

      // Tìm cover image (file đầu tiên có extension image, hoặc dùng placeholder text)
      const coverFile = files.find((f) =>
        /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name)
      );
      const imagePath = coverFile ? `${coverFile.name}` : ""; // sẽ thay bằng relative sau

      const metadataContent = {
        name: `Green Carbon Batch #${claimIdStr} - ${project.name} ${vintageYear}`,
        description: `Chứng nhận giảm phát thải ${claim.reductionTons} tấn CO₂e đã được audit độc lập.\nDự án: ${project.name}\nKỳ: ${periodStartDate} - ${periodEndDate}.`,
        image: imagePath ? `ipfs://${imagePath}` : "", // sẽ cập nhật sau nếu có
        external_url: files.find(
          (f) => f.name.includes("audit") || f.name.includes("report")
        )
          ? `ipfs://${
              files.find(
                (f) => f.name.includes("audit") || f.name.includes("report")
              )?.name
            }`
          : "",
        attributes: [
          { trait_type: "Project ID", value: claim.projectId.toString() },
          { trait_type: "Project Name", value: project.name },
          {
            trait_type: "Reduction Tons",
            value: claim.reductionTons.toString(),
          },
          { trait_type: "Vintage Year", value: vintageYear.toString() },
          {
            trait_type: "Period",
            value: `${periodStartDate} - ${periodEndDate}`,
          },
          { trait_type: "Evidence IPFS", value: claim.evidenceIPFS },
        ],
      };

      const metadataBlob = new Blob(
        [JSON.stringify(metadataContent, null, 2)],
        { type: "application/json" }
      );
      const metadataFile = new File([metadataBlob], "metadata.json");

      // 2. All files bao gồm metadata.json
      const allFiles = [...files, metadataFile];

      // 3. Upload → nhận folderCID
      const folderCID = await uploadToPinata(allFiles, claimIdStr);

      setUploadStatus((prev) => ({
        ...prev,
        [claimIdStr]: `✅ Uploaded folder: ${folderCID}`,
      }));

      // 4. Call contract với tokenURI chuẩn
      writeContract({
        address: CONTRACT_ADDRESSES.REGISTRY,
        abi: RegistryABI,
        functionName: "auditAndIssue",
        args: [BigInt(claimIdStr), `${folderCID}/metadata.json`], // hoặc chỉ folderCID nếu muốn marketplace tự đọc
      });
    } catch (error: any) {
      console.error("Audit error:", error);
      setUploadStatus((prev) => ({
        ...prev,
        [claimIdStr]: `❌ Error: ${error.message}`,
      }));
      alert(`Failed: ${error.message}`);
    } finally {
      setUploadingClaims((prev) => ({ ...prev, [claimIdStr]: false }));
    }
  };

  /* ---------- Quick audit (for testing) ---------- */
  const quickAudit = (claimIdStr: string) => {
    writeContract({
      address: CONTRACT_ADDRESSES.REGISTRY,
      abi: RegistryABI,
      functionName: "auditAndIssue",
      args: [BigInt(claimIdStr), "QmTestHash123456789"],
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-2xl font-bold mb-6 text-purple-800">
        🔍 Auditor Dashboard
      </h2>

      {/* IPFS Configuration Notice */}
      {!PINATA_JWT && (
        <div className="mb-6 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700">
          <p className="font-bold">⚠️ IPFS Not Configured</p>
          <p className="text-sm mt-1">
            Add VITE_PINATA_API_KEY and VITE_PINATA_SECRET_KEY to your .env file
          </p>
          <p className="text-xs mt-2 text-gray-600">
            Get free API keys at{" "}
            <a
              href="https://pinata.cloud"
              target="_blank"
              className="underline"
            >
              pinata.cloud
            </a>
          </p>
        </div>
      )}

      {/* ---------- Audit by ID (Simple) ---------- */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-3">Quick Audit (Testing)</h3>
        <div className="flex gap-3">
          <input
            type="number"
            value={claimId}
            onChange={(e) => setClaimId(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-lg"
            placeholder="Enter claim ID"
          />
          <button
            onClick={() => quickAudit(claimId)}
            disabled={isPending || !claimId}
            className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50"
          >
            {isPending ? "Processing..." : "Quick Audit"}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          ℹ️ Uses test IPFS hash - for development only
        </p>
      </div>

      {claim && claim.batchTokenId > 0n && (
        <BatchNFTCard
          batchTokenId={claim.batchTokenId}
          claimId={BigInt(claimId)}
        />
      )}

      {/* ---------- Pending claims list with IPFS upload ---------- */}
      <h3 className="text-xl font-semibold mb-6 mt-8">
        📋 Pending Claims for Audit ({pendingClaimIds?.length || 0})
      </h3>

      {pendingClaims && pendingClaims.length > 0 ? (
        <div className="space-y-6">
          {pendingClaims.map((item: any, index: number) => {
            const claim = item?.result as ClaimStruct | undefined;
            const project = projects?.[index]?.result as
              | ProjectStruct
              | undefined;
            const currentClaimId = pendingClaimIds?.[index]?.toString() || "";

            if (!claim) return null;

            const isUploading = uploadingClaims[currentClaimId];
            const files = selectedFiles[currentClaimId] || [];
            const status = uploadStatus[currentClaimId];

            return (
              <div
                key={currentClaimId}
                className="bg-gradient-to-r from-yellow-50 to-orange-50 p-6 rounded-xl border-2 border-yellow-400 shadow-sm"
              >
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Left: Claim Info */}
                  <div>
                    <p className="font-bold text-xl text-purple-800 mb-3">
                      Claim #{currentClaimId}
                    </p>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <span className="font-semibold min-w-[100px]">
                          Project:
                        </span>
                        <span>{project?.name || "Loading..."}</span>
                      </div>

                      <div className="flex items-start gap-2">
                        <span className="font-semibold min-w-[100px]">
                          Owner:
                        </span>
                        <span className="text-xs font-mono break-all">
                          {project?.owner || "Loading..."}
                        </span>
                      </div>

                      <div className="flex items-start gap-2">
                        <span className="font-semibold min-w-[100px]">
                          Reduction:
                        </span>
                        <span className="text-green-700 font-bold">
                          {claim.reductionTons.toString()} tons CO₂
                        </span>
                      </div>

                      <div className="flex items-start gap-2">
                        <span className="font-semibold min-w-[100px]">
                          Baseline:
                        </span>
                        <span>
                          {project?.baselineEmissions.toString()} tons/year
                        </span>
                      </div>

                      <div className="flex items-start gap-2">
                        <span className="font-semibold min-w-[100px]">
                          Evidence:
                        </span>
                        <a
                          href={`https://ipfs.io/ipfs/${claim.evidenceIPFS}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-xs break-all"
                        >
                          {claim.evidenceIPFS.slice(0, 20)}...
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Right: Upload & Audit */}
                  <div className="flex flex-col gap-3">
                    <div className="bg-white p-4 rounded-lg border-2 border-dashed border-purple-300">
                      <label className="block font-semibold mb-2 text-sm">
                        📄 Upload Audit Report
                      </label>

                      <input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={(e) =>
                          handleFileChange(currentClaimId, e.target.files)
                        }
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                        disabled={isUploading}
                      />

                      {files.length > 0 && (
                        <div className="mt-3 text-xs space-y-1">
                          <p className="font-semibold text-gray-700">
                            Selected files:
                          </p>
                          {files.map((file, idx) => (
                            <p key={idx} className="text-gray-600 truncate">
                              • {file.name} ({(file.size / 1024).toFixed(1)} KB)
                            </p>
                          ))}
                        </div>
                      )}

                      {status && (
                        <p
                          className={`mt-3 text-sm font-medium ${
                            status.includes("✅")
                              ? "text-green-600"
                              : status.includes("❌")
                              ? "text-red-600"
                              : "text-blue-600"
                          }`}
                        >
                          {status}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => auditClaimWithIPFS(currentClaimId)}
                      disabled={isUploading || files.length === 0 || isPending}
                      className={`w-full px-6 py-3 rounded-lg font-semibold transition-all ${
                        isUploading || isPending
                          ? "bg-gray-400 cursor-not-allowed"
                          : files.length === 0
                          ? "bg-gray-300 cursor-not-allowed"
                          : "bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg hover:shadow-xl"
                      }`}
                    >
                      {isUploading ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg
                            className="animate-spin h-5 w-5"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Uploading to IPFS...
                        </span>
                      ) : isPending ? (
                        "⏳ Processing Transaction..."
                      ) : files.length === 0 ? (
                        "📁 Select Files First"
                      ) : (
                        "✅ Upload & Approve Claim"
                      )}
                    </button>

                    <p className="text-xs text-gray-500 text-center">
                      Files will be uploaded to IPFS before blockchain
                      transaction
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎉</div>
          <p className="text-gray-600 text-lg">
            No pending claims at the moment.
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Great job! All claims have been audited.
          </p>
        </div>
      )}
    </div>
  );
}
