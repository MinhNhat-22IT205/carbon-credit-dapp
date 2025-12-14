import { useEffect, useState } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import RegistryABI from "../contracts/abi/CarbonCreditRegistry.json";
import GreenNFTABI from "../contracts/abi/GreenNFTCollection.json";
import { CONTRACT_ADDRESSES } from "../contracts/addresses";

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

// Thêm type cho NFT metadata
type NFTMetadata = {
  name?: string;
  description?: string;
  image?: string;
  external_url?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
};

// ============================================================================
// IPFS SERVICE - Pinata (dùng chung với AuditorDashboard)
// ============================================================================
const PINATA_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI5OTNlZjk2Ny0xNWYwLTQ1NjAtODcxYS00ZDRmNjM0MDc1MmUiLCJlbWFpbCI6Im5oYXRtaW5obGVkYW8yMDA0QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiI5NzdkZjAxM2EzMGNmM2I3OGU3NSIsInNjb3BlZEtleVNlY3JldCI6Ijc4NTZkOTA5MGJhMTgyYTQwZWJiYmNkMzRhMmY3Mzk5YWE4NWYxNDE1ODI3ZjBhZDkzMzIyZWQzMDEyMmEyYWMiLCJleHAiOjE3OTY1MTc5MjB9.5YHMne_ORNXqhu8BKydvtCJjD5C1F4S0TaGLI5F2i3s"; // Đảm bảo đã set trong .env
async function uploadEvidenceToPinata(
  files: File[],
  projectId: string
): Promise<string> {
  if (!PINATA_JWT) {
    throw new Error(
      "Pinata JWT not configured. Please add VITE_PINATA_JWT to .env"
    );
  }

  if (files.length === 0) throw new Error("No files selected");

  const timestamp = Date.now();
  const folderName = `evidence-project-${projectId}-${timestamp}`;

  const formData = new FormData();

  files.forEach((file) => {
    const relativePath = `${folderName}/${file.name}`;
    formData.append("file", file, relativePath);
  });

  const metadata = JSON.stringify({
    name: `Evidence - Project ${projectId} - ${new Date().toISOString()}`,
    keyvalues: {
      projectId,
      type: "carbon-claim-evidence",
      timestamp: timestamp.toString(),
    },
  });
  formData.append("pinataMetadata", metadata);
  formData.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

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
  return result.IpfsHash; // CID của folder
}

// ============================================================================
// COMPONENT
// ============================================================================
export default function ClaimSection() {
  const { address } = useAccount();

  const [projectId, setProjectId] = useState("");
  const [reductionTons, setReductionTons] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  // Upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");

  const { writeContract, isPending } = useWriteContract();

  /* ---------- Project by ID ---------- */
  const { data: project } = useReadContract({
    address: CONTRACT_ADDRESSES.REGISTRY,
    abi: RegistryABI,
    functionName: "getProject",
    args: projectId ? [BigInt(projectId)] : undefined,
    enabled: !!projectId,
  }) as { data?: ProjectStruct };

  /* ---------- User projects & claims ---------- */
  const { data: projectIds } = useReadContract({
    address: CONTRACT_ADDRESSES.REGISTRY,
    abi: RegistryABI,
    functionName: "getProjectsByOwner",
    args: address ? [address] : undefined,
  }) as { data?: bigint[] };

  const claimIdContracts =
    projectIds?.map((pid) => ({
      address: CONTRACT_ADDRESSES.REGISTRY,
      abi: RegistryABI,
      functionName: "getClaimsByProject",
      args: [pid],
    })) || [];

  const { data: allClaimIdsArray } = useReadContracts({
    contracts: claimIdContracts,
  });

  const allClaimIds: bigint[] =
    allClaimIdsArray
      ?.map((item: any) => item?.result as bigint[])
      .flat()
      .filter(Boolean) || [];

  const claimContracts = allClaimIds.map((id) => ({
    address: CONTRACT_ADDRESSES.REGISTRY,
    abi: RegistryABI,
    functionName: "getClaim",
    args: [id],
  }));

  const { data: claims } = useReadContracts({ contracts: claimContracts });

  /* ---------- Handle file selection ---------- */
  const handleFileChange = (files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);
    setSelectedFiles(fileArray);
    setUploadStatus(`${fileArray.length} file(s) selected`);
  };

  /* ---------- Submit claim with IPFS upload ---------- */
  const submitClaimWithUpload = async () => {
    if (!projectId || !reductionTons || !periodStart || !periodEnd) {
      alert("Please fill all required fields");
      return;
    }

    if (!project || project.owner.toLowerCase() !== address?.toLowerCase()) {
      alert("You are not the owner of this project");
      return;
    }

    if (selectedFiles.length === 0) {
      if (
        !confirm("No evidence files selected. Submit claim without evidence?")
      ) {
        return;
      }
    }

    setUploading(true);
    setUploadStatus("Uploading evidence to IPFS...");

    let evidenceCID = "QmNoEvidenceProvided";

    try {
      if (selectedFiles.length > 0) {
        evidenceCID = await uploadEvidenceToPinata(selectedFiles, projectId);
        setUploadStatus(`Uploaded: ${evidenceCID.slice(0, 10)}...`);
      }

      // Submit to blockchain
      writeContract({
        address: CONTRACT_ADDRESSES.REGISTRY,
        abi: RegistryABI,
        functionName: "submitClaim",
        args: [
          BigInt(projectId),
          BigInt(reductionTons),
          BigInt(new Date(periodStart).getTime() / 1000),
          BigInt(new Date(periodEnd).getTime() / 1000),
          evidenceCID,
        ],
      });

      // Reset after submit
      setSelectedFiles([]);
      setProjectId("");
      setReductionTons("");
      setPeriodStart("");
      setPeriodEnd("");
      setUploadStatus("Claim submitted successfully!");
    } catch (error: any) {
      console.error(error);
      setUploadStatus(`Error: ${error.message}`);
      alert(`Failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const auditedClaims = claims
    ?.map((item: any, index: number) => {
      const claim = item?.result as ClaimStruct | undefined;
      if (claim && claim.status !== 0n && claim.batchTokenId > 0n) {
        return {
          claimId: allClaimIds[index],
          batchTokenId: claim.batchTokenId,
        };
      }
      return null;
    })
    .filter(Boolean);

  const tokenURIContracts =
    auditedClaims?.map((ac: any) => ({
      address: CONTRACT_ADDRESSES.GREEN_NFT_COLLECTION, // Thêm address GreenNFT vào addresses.ts
      abi: GreenNFTABI,
      functionName: "tokenURI",
      args: [ac.batchTokenId],
    })) || [];

  const { data: tokenURIs } = useReadContracts({
    contracts: tokenURIContracts,
  });

  // State lưu metadata đã fetch
  const [nftMetadatas, setNftMetadatas] = useState<
    Record<string, NFTMetadata | null>
  >({});

  // Fetch metadata khi có tokenURI
  useEffect(() => {
    const fetchMetadatas = async () => {
      if (!tokenURIs) return;
      console.log(tokenURIs);

      const newMetadatas: Record<string, NFTMetadata | null> = {};
      for (let i = 0; i < tokenURIs.length; i++) {
        const uriResult = tokenURIs[i]?.result as string | undefined;
        if (!uriResult) {
          newMetadatas[auditedClaims![i].claimId.toString()] = null;
          continue;
        }

        // Chuyển ipfs:// thành gateway (Pinata nhanh & ổn định)
        let metadataUrl = uriResult;
        if (uriResult.startsWith("ipfs://")) {
          metadataUrl = `https://gateway.pinata.cloud/ipfs/${uriResult.slice(
            7
          )}`;
        } else if (uriResult.includes("ipfs/")) {
          metadataUrl = `https://gateway.pinata.cloud/${uriResult}`;
        }

        try {
          const res = await fetch(metadataUrl);
          if (res.ok) {
            const json = await res.json();
            newMetadatas[auditedClaims![i].claimId.toString()] = json;
          } else {
            newMetadatas[auditedClaims![i].claimId.toString()] = null;
          }
        } catch (err) {
          console.error("Fetch metadata error:", err);
          newMetadatas[auditedClaims![i].claimId.toString()] = null;
        }
      }
      setNftMetadatas(newMetadatas);
    };

    fetchMetadatas();
  }, [tokenURIs]);

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 border border-blue-200">
      <h2 className="text-2xl font-bold text-blue-800 mb-8">
        Submit CO₂ Reduction Claim
      </h2>

      <div className="grid md:grid-cols-2 gap-8">
        {/* ---------- Submit form ---------- */}
        <div>
          <h3 className="text-xl font-semibold mb-5">Submit New Claim</h3>

          <input
            type="number"
            placeholder="Your Project ID"
            className="w-full px-4 py-3 border rounded-lg mb-4"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          />

          {project && project.owner.toLowerCase() === address?.toLowerCase() ? (
            <p className="text-green-600 text-sm mb-4">
              Valid project: {project.name}
            </p>
          ) : projectId && project ? (
            <p className="text-red-600 text-sm mb-4">
              You are not the owner of this project
            </p>
          ) : null}

          <input
            type="number"
            placeholder="CO₂ reduction achieved (tons)"
            className="w-full px-4 py-3 border rounded-lg mb-4"
            value={reductionTons}
            onChange={(e) => setReductionTons(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg"
              />
            </div>
          </div>

          {/* Upload Evidence */}
          <div className="mb-6">
            <label className="block font-semibold mb-2 text-sm">
              Upload Evidence Files (PDF, images, data...)
            </label>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.csv"
              onChange={(e) => handleFileChange(e.target.files)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              disabled={uploading || isPending}
            />

            {selectedFiles.length > 0 && (
              <div className="mt-3 text-xs space-y-1">
                <p className="font-semibold text-gray-700">Selected files:</p>
                {selectedFiles.map((file, idx) => (
                  <p key={idx} className="text-gray-600 truncate">
                    • {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                ))}
              </div>
            )}

            {uploadStatus && (
              <p
                className={`mt-3 text-sm font-medium ${
                  uploadStatus.includes("Error")
                    ? "text-red-600"
                    : "text-blue-600"
                }`}
              >
                {uploadStatus}
              </p>
            )}
          </div>

          <button
            onClick={submitClaimWithUpload}
            disabled={uploading || isPending || !projectId || !reductionTons}
            className={`w-full py-3 rounded-lg font-semibold transition-all ${
              uploading || isPending
                ? "bg-gray-400 cursor-not-allowed text-white"
                : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg"
            }`}
          >
            {uploading
              ? "Uploading Evidence..."
              : isPending
              ? "Submitting Claim..."
              : "Submit Claim"}
          </button>

          <p className="text-xs text-gray-500 text-center mt-3">
            Evidence files will be permanently stored on IPFS
          </p>
        </div>

        {/* ---------- Claims list (giữ nguyên) ---------- */}
        <div>
          <h3 className="text-xl font-semibold mb-4">Your Submitted Claims</h3>

          {claims && claims.length > 0 ? (
            <div className="space-y-6">
              {claims.map((item: any, index: number) => {
                const claim = item?.result as ClaimStruct | undefined;
                if (!claim) return null;

                const claimIdStr = allClaimIds[index].toString();
                const metadata = nftMetadatas[claimIdStr];

                return (
                  <div
                    key={claimIdStr}
                    className={`p-6 rounded-xl border-2 ${
                      claim.status === 0n
                        ? "bg-yellow-50 border-yellow-400"
                        : "bg-gradient-to-r from-green-50 to-emerald-50 border-green-500"
                    } shadow-md`}
                  >
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Left: Basic info */}
                      <div>
                        <p className="text-xl font-bold text-purple-800">
                          Claim #{claimIdStr}
                        </p>
                        <p className="mt-2">
                          <strong>Reduction:</strong>{" "}
                          <span className="text-green-700 font-bold">
                            {claim.reductionTons.toString()} tons CO₂
                          </span>
                        </p>
                        <p>
                          <strong>Period:</strong>{" "}
                          {new Date(
                            Number(claim.periodStart) * 1000
                          ).toLocaleDateString()}{" "}
                          →{" "}
                          {new Date(
                            Number(claim.periodEnd) * 1000
                          ).toLocaleDateString()}
                        </p>
                        <p>
                          <strong>Status:</strong>{" "}
                          <span
                            className={
                              claim.status === 0n
                                ? "text-orange-600"
                                : "text-green-600"
                            }
                          >
                            {claim.status === 0n
                              ? "Pending Audit"
                              : "Audited & Issued"}
                          </span>
                        </p>

                        {claim.evidenceIPFS &&
                          claim.evidenceIPFS !== "QmNoEvidenceProvided" && (
                            <p className="mt-3">
                              <a
                                href={`https://ipfs.io/ipfs/${claim.evidenceIPFS}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                📄 View Evidence Folder →
                              </a>
                            </p>
                          )}
                      </div>

                      {/* Right: NFT Detail nếu đã audit */}
                      {claim.status !== 0n && claim.batchTokenId > 0n && (
                        <div className="space-y-3">
                          <p className="font-semibold text-green-800">
                            ✅ Certificate NFT Issued (Token ID:{" "}
                            {claim.batchTokenId.toString()})
                          </p>

                          {metadata ? (
                            <>
                              {metadata.image && (
                                <img
                                  src={
                                    metadata.image.startsWith("ipfs://")
                                      ? `https://gateway.pinata.cloud/ipfs/${metadata.image.slice(
                                          7
                                        )}`
                                      : metadata.image
                                  }
                                  alt="NFT Cover"
                                  className="w-full max-w-sm rounded-lg shadow-lg"
                                />
                              )}

                              <p className="font-bold text-lg">
                                {metadata.name || "Green Carbon Batch"}
                              </p>
                              <p className="text-sm text-gray-700">
                                {metadata.description}
                              </p>

                              {metadata.attributes &&
                                metadata.attributes.length > 0 && (
                                  <div className="mt-4">
                                    <p className="font-semibold">Attributes:</p>
                                    <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                                      {metadata.attributes.map((attr, i) => (
                                        <div
                                          key={i}
                                          className="bg-gray-100 rounded px-3 py-1"
                                        >
                                          <strong>{attr.trait_type}:</strong>{" "}
                                          {attr.value}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                              {metadata.external_url && (
                                <a
                                  href={
                                    metadata.external_url.startsWith("ipfs://")
                                      ? `https://gateway.pinata.cloud/ipfs/${metadata.external_url.slice(
                                          7
                                        )}`
                                      : metadata.external_url
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-block mt-3 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                                >
                                  📑 View Full Audit Report
                                </a>
                              )}
                            </>
                          ) : (
                            <p className="text-gray-500 italic">
                              Loading NFT metadata...
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 italic">No claims submitted yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
