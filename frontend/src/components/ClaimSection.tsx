import { useEffect, useState } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import { Link } from "react-router-dom";
import RegistryABI from "../contracts/abi/CarbonCreditRegistry.json";
import GreenNFTABI from "../contracts/abi/GreenNFTCollection.json";
import { CONTRACT_ADDRESSES } from "../contracts/addresses";
import { parseUnits, formatUnits, type Abi } from "viem";

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
const PINATA_JWT = import.meta.env.VITE_PINATA_JWT as string | undefined;
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
  const [tab, setTab] = useState<
    | "pending"
    | "approved"
    | "rejected"
    | "onsale"
    | "sold"
    | "cancelled"
    | "all"
  >("all");

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
    query: {
      enabled: !!projectId,
    },
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
      abi: RegistryABI as Abi,
      functionName: "getClaimsByProject",
      args: [pid],
    })) || [];

  const { data: allClaimIdsArray } = useReadContracts({
    contracts: claimIdContracts,
  });

  const allClaimIds: bigint[] =
    allClaimIdsArray
      ?.map((item) => {
        if (item.status === "success" && item.result) {
          return item.result as bigint[];
        }
        return [];
      })
      .flat()
      .filter(Boolean) || [];

  const claimContracts = allClaimIds.map((id) => ({
    address: CONTRACT_ADDRESSES.REGISTRY,
    abi: RegistryABI as Abi,
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
          parseUnits(reductionTons, 18),
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
    } catch (error: unknown) {
      console.error(error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setUploadStatus(`Error: ${errorMessage}`);
      alert(`Failed: ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  const auditedClaims =
    claims
      ?.map((item, index: number) => {
        const claim = item?.result as ClaimStruct | undefined;
        if (claim && claim.status !== 0n && claim.batchTokenId > 0n) {
          return {
            claimId: allClaimIds[index],
            batchTokenId: claim.batchTokenId,
          };
        }
        return null;
      })
      .filter(
        (ac): ac is { claimId: bigint; batchTokenId: bigint } => ac !== null
      ) || [];

  const tokenURIContracts =
    auditedClaims.map((ac) => ({
      address: CONTRACT_ADDRESSES.GREEN_NFT_COLLECTION, // Thêm address GreenNFT vào addresses.ts
      abi: GreenNFTABI as Abi,
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
      if (!tokenURIs || auditedClaims.length === 0) return;
      console.log(tokenURIs);

      const newMetadatas: Record<string, NFTMetadata | null> = {};
      for (let i = 0; i < tokenURIs.length; i++) {
        const uriResult = tokenURIs[i]?.result as string | undefined;
        const auditedClaim = auditedClaims[i];
        if (!auditedClaim) {
          continue;
        }
        if (!uriResult) {
          newMetadatas[auditedClaim.claimId.toString()] = null;
          continue;
        }

        // Chuyển ipfs:// thành gateway (Pinata nhanh & ổn định)
        let metadataUrl = uriResult;
        if (uriResult.startsWith("ipfs://")) {
          metadataUrl = `https://ipfs.io/ipfs/${uriResult.slice(
            7
          )}/metadata.json`;
          console.log(uriResult);
        } else if (uriResult.includes("ipfs/")) {
          metadataUrl = `https://ipfs.io/ipfs/${uriResult}/metadata.json`;
        }

        try {
          const res = await fetch(metadataUrl);
          if (res.ok) {
            const json = (await res.json()) as NFTMetadata;
            newMetadatas[auditedClaim.claimId.toString()] = json;
          } else {
            newMetadatas[auditedClaim.claimId.toString()] = null;
          }
        } catch (err) {
          console.error("Fetch metadata error:", err);
          newMetadatas[auditedClaim.claimId.toString()] = null;
        }
      }
      setNftMetadatas(newMetadatas);
    };

    fetchMetadatas();
  }, [tokenURIs, auditedClaims]);

  const statusLabel = (status: bigint) => {
    switch (Number(status)) {
      case 0:
        return "Pending";
      case 1:
        return "Approved";
      case 2:
        return "Rejected";
      case 3:
        return "On Sale";
      case 4:
        return "Sold";
      case 5:
        return "Cancelled";
      default:
        return "Unknown";
    }
  };

  const selectedStatus =
    tab === "approved"
      ? [1]
      : tab === "pending"
      ? [0]
      : tab === "rejected"
      ? [2]
      : tab === "sold"
      ? [4]
      : tab === "onsale"
      ? [3]
      : tab === "cancelled"
      ? [5]
      : [0, 1, 2, 3, 4, 5];

  const enrichedClaims =
    claims
      ?.map((item, index: number) => {
        const claim = item?.result as ClaimStruct | undefined;
        const claimId = allClaimIds[index];
        if (!claim || !claimId) return null;
        return { claim, claimId };
      })
      .filter(
        (ec): ec is { claim: ClaimStruct; claimId: bigint } => ec !== null
      ) || [];

  const filteredClaims = enrichedClaims.filter(({ claim }) =>
    selectedStatus.includes(Number(claim.status))
  );

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 border border-blue-200">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-blue-800">
            Project Owner – Claims
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Submit new reduction claims and track their lifecycle across audits
            and market.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-10">
        {/* ---------- Submit form ---------- */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Submit New Claim</h3>

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

        {/* ---------- Claims list with status tabs ---------- */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Your Claims</h3>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { id: "pending", label: "Pending" },
              { id: "approved", label: "Approved" },
              { id: "rejected", label: "Rejected" },
              { id: "onsale", label: "On Sale" },
              { id: "sold", label: "Sold" },
              { id: "cancelled", label: "Cancelled" },
              { id: "all", label: "All" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as typeof tab)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  tab === t.id
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-blue-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {filteredClaims.length > 0 ? (
            <div className="space-y-4 max-h-[540px] overflow-y-auto pr-1">
              {filteredClaims.map(({ claim, claimId }) => {
                const claimIdStr = claimId.toString();
                const metadata = nftMetadatas[claimIdStr];

                return (
                  <div
                    key={claimIdStr}
                    className={`p-5 rounded-xl border ${
                      claim.status === 0n
                        ? "bg-yellow-50/70 border-yellow-300"
                        : "bg-slate-50 border-slate-200"
                    } shadow-sm`}
                  >
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Left: Basic info */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold text-slate-900">
                            Claim #{claimIdStr}
                          </p>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              claim.status === 0n
                                ? "bg-amber-100 text-amber-800"
                                : claim.status === 1n
                                ? "bg-emerald-100 text-emerald-800"
                                : claim.status === 4n
                                ? "bg-sky-100 text-sky-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {statusLabel(claim.status)}
                          </span>
                        </div>
                        <p className="mt-2">
                          <strong>Reduction:</strong>{" "}
                          <span className="text-green-700 font-bold">
                            {formatUnits(claim.reductionTons, 18)} tons CO₂
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
                        {claim.evidenceIPFS &&
                          claim.evidenceIPFS !== "QmNoEvidenceProvided" && (
                            <div className="mt-3">
                              <p className="text-xs text-gray-500 mb-1">
                                Evidence (IPFS folder)
                              </p>
                              <a
                                href={`https://ipfs.io/ipfs/${claim.evidenceIPFS}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline break-all"
                              >
                                <span className="text-base">📂</span>
                                <span>
                                  {claim.evidenceIPFS.slice(0, 16)}...
                                  {claim.evidenceIPFS.slice(-6)}
                                </span>
                              </a>
                            </div>
                          )}
                      </div>

                      {/* Right: Issued Verified Batch (NFT) */}
                      {claim.status !== 0n && claim.batchTokenId > 0n && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-emerald-800">
                            ✅ Verified Batch issued (Token ID:{" "}
                            {claim.batchTokenId.toString()})
                          </p>

                          {metadata ? (
                            <>
                              <p className="font-semibold text-sm">
                                {metadata.name || "Verified Batch"}
                              </p>
                              <p className="text-xs text-gray-600 line-clamp-3">
                                {metadata.description}
                              </p>

                              {/* {metadata.attributes &&
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
                                )} */}

                              <Link
                                to={`/claims/${claimIdStr}`}
                                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white! hover:bg-blue-700"
                              >
                                View verified batch details
                              </Link>
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
