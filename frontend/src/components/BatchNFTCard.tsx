import { useReadContract } from "wagmi";
import axios from "axios";
import { useState, useEffect } from "react";
import RegistryABI from "../contracts/abi/CarbonCreditRegistry.json";
import GreenNFTABI from "../contracts/abi/GreenNFTCollection.json";
import { CONTRACT_ADDRESSES } from "../contracts/addresses";

type Props = { batchTokenId: bigint; claimId: bigint };

export default function BatchNFTCard({ batchTokenId, claimId }: Props) {
  const [metadata, setMetadata] = useState<any>(null);

  const { data: tokenURI } = useReadContract({
    address: CONTRACT_ADDRESSES.GREEN_NFT_COLLECTION,
    abi: GreenNFTABI,
    functionName: "tokenURI",
    args: [batchTokenId],
  });

  const { data: claim } = useReadContract({
    address: CONTRACT_ADDRESSES.REGISTRY,
    abi: RegistryABI,
    functionName: "getClaim",
    args: [claimId],
  });

  useEffect(() => {
    if (tokenURI && tokenURI.startsWith("ipfs://")) {
      const ipfsHash = tokenURI.slice(7);
      axios
        .get(`https://ipfs.io/ipfs/${ipfsHash}`)
        .then((res) => setMetadata(res.data));
    }
  }, [tokenURI]);

  if (!claim) return null;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-green-300">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xl font-bold">
          Batch Certificate #{batchTokenId.toString()}
        </h3>
        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
          Verified
        </span>
      </div>

      {metadata?.image && (
        <img
          src={metadata.image.replace("ipfs://", "https://ipfs.io/ipfs/")}
          alt="Certificate"
          className="w-full rounded-lg mb-4"
        />
      )}

      <div className="space-y-2 text-sm">
        <p>
          <strong>Reduction:</strong> {claim.reductionTons.toString()} tons CO₂
        </p>
        <p>
          <strong>Period:</strong>{" "}
          {new Date(Number(claim.periodStart) * 1000).toLocaleDateString()} →{" "}
          {new Date(Number(claim.periodEnd) * 1000).toLocaleDateString()}
        </p>
        <p>
          <strong>Status:</strong>{" "}
          <span className="text-green-600 font-medium">Audited & Issued</span>
        </p>
      </div>
    </div>
  );
}
