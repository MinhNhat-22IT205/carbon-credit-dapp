import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useReadContract, useReadContracts } from "wagmi";
import RegistryABI from "../contracts/abi/CarbonCreditRegistry.json";
import GreenNFTABI from "../contracts/abi/GreenNFTCollection.json";
import { CONTRACT_ADDRESSES } from "../contracts/addresses";
import { formatUnits } from "viem";

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

type NFTMetadata = {
  name?: string;
  description?: string;
  certificate?: string;
  external_url?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
};

export default function ClaimDetailPage() {
  const { claimId } = useParams<{ claimId: string }>();
  const [metadata, setMetadata] = useState<NFTMetadata | null>(null);
  const numericClaimId = claimId ? BigInt(claimId) : undefined;

  const { data: claim } = useReadContract({
    address: CONTRACT_ADDRESSES.REGISTRY,
    abi: RegistryABI,
    functionName: "getClaim",
    args: numericClaimId ? [numericClaimId] : undefined,
    query: {
      enabled: !!numericClaimId,
    },
  }) as { data?: ClaimStruct };

  const { data: project } = useReadContract({
    address: CONTRACT_ADDRESSES.REGISTRY,
    abi: RegistryABI,
    functionName: "getProject",
    args: claim ? [claim.projectId] : undefined,
    query: {
      enabled: !!claim,
    },
  }) as { data?: ProjectStruct };

  const tokenURIContracts =
    claim && claim.batchTokenId > 0n
      ? [
          {
            address: CONTRACT_ADDRESSES.GREEN_NFT_COLLECTION,
            abi: GreenNFTABI,
            functionName: "tokenURI",
            args: [claim.batchTokenId],
          } as const,
        ]
      : [];

  const { data: tokenURIs } = useReadContracts({
    contracts: tokenURIContracts,
  });

  useEffect(() => {
    const loadMetadata = async () => {
      if (!tokenURIs || tokenURIs.length === 0) return;
      const uriResult = tokenURIs[0]?.result as string | undefined;
      if (!uriResult) return;

      let metadataUrl = uriResult;
      if (uriResult.startsWith("ipfs://")) {
        metadataUrl = `https://ipfs.io/ipfs/${uriResult.slice(
          7
        )}/metadata.json`;
      } else if (uriResult.includes("ipfs/")) {
        metadataUrl = `https://ipfs.io/ipfs/${uriResult}/metadata.json`;
      }

      try {
        const res = await fetch(metadataUrl);
        if (!res.ok) return;
        const json = (await res.json()) as NFTMetadata;
        setMetadata(json);
      } catch (e) {
        console.error("Load claim metadata error", e);
      }
    };

    loadMetadata();
  }, [tokenURIs]);

  if (!numericClaimId) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <p className="text-sm text-gray-600">Invalid claim id.</p>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <p className="text-sm text-gray-600">Loading claim details...</p>
      </div>
    );
  }

  const statusMap: Record<number, string> = {
    0: "Pending",
    1: "Approved",
    2: "Rejected",
    3: "On Sale",
    4: "Sold",
    5: "Cancelled",
  };

  const statusLabel = statusMap[Number(claim.status)] ?? "Unknown";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Claim #{numericClaimId.toString()}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Detailed view of the Verified Batch and audit evidence for this
            claim.
          </p>
        </div>
        <Link
          to="/claims"
          className="inline-flex items-center rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to claims
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Status
                </p>
                <p className="text-sm font-semibold text-slate-900">
                  {statusLabel}
                </p>
              </div>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Verified Batch ID: {claim.batchTokenId.toString()}
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-medium text-gray-500">
                  Reduction (tons CO₂)
                </p>
                <p className="mt-1 font-semibold text-emerald-700">
                  {formatUnits(claim.reductionTons, 18)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Project ID</p>
                <p className="mt-1 font-mono text-xs text-gray-800">
                  {claim.projectId.toString()}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">Period</p>
                <p className="mt-1 text-gray-800">
                  {new Date(
                    Number(claim.periodStart) * 1000
                  ).toLocaleDateString()}{" "}
                  →{" "}
                  {new Date(
                    Number(claim.periodEnd) * 1000
                  ).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500">
                  Evidence (IPFS)
                </p>
                {claim.evidenceIPFS &&
                claim.evidenceIPFS !== "QmNoEvidenceProvided" ? (
                  <a
                    href={`https://ipfs.io/ipfs/${claim.evidenceIPFS}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline break-all"
                  >
                    <span className="text-base">📂</span>
                    <span>
                      {claim.evidenceIPFS.slice(0, 18)}...
                      {claim.evidenceIPFS.slice(-6)}
                    </span>
                  </a>
                ) : (
                  <p className="mt-1 text-xs text-gray-500">No evidence set.</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900 mb-2">
              Project
            </h2>
            {project ? (
              <div className="space-y-1 text-sm">
                <p className="font-medium text-gray-900">{project.name}</p>
                <p className="text-xs text-gray-600">
                  Baseline emissions:{" "}
                  <span className="font-semibold">
                    {project.baselineEmissions.toString()} tons/year
                  </span>
                </p>
                <p className="text-xs text-gray-600 break-all">
                  Owner: <span className="font-mono">{project.owner}</span>
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-500">Loading project info…</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">
              Verified Batch NFT
            </h2>
            {metadata ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {metadata.name || "Verified Batch"}
                  </p>
                  <p className="mt-1 text-xs text-gray-600 whitespace-pre-line">
                    {metadata.description}
                  </p>
                  <Link
                    to={`https://ipfs.io/ipfs/${tokenURIs[0].result?.slice(
                      7
                    )}/${metadata.certificate?.slice(7)}`}
                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white! hover:bg-blue-700"
                  >
                    View certificate
                  </Link>
                </div>

                {/* {metadata.attributes && metadata.attributes.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-gray-700">
                      Attributes
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {metadata.attributes.map((attr, idx) => (
                        <div
                          key={`${attr.trait_type}-${idx}`}
                          className="rounded-md bg-slate-50 px-3 py-1.5 text-[11px]"
                        >
                          <p className="font-semibold text-gray-700">
                            {attr.trait_type}
                          </p>
                          <p className="text-gray-600">{attr.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )} */}

                {metadata.external_url && (
                  <a
                    href={
                      metadata.external_url.startsWith("ipfs://")
                        ? `https://ipfs.io/ipfs/${metadata.external_url.slice(
                            7
                          )}`
                        : metadata.external_url
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-md bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700"
                  >
                    📑 View full audit package
                  </a>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                Loading NFT metadata or this claim does not have a minted batch
                yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
