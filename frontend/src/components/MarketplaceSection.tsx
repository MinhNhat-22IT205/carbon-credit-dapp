import { useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { parseEther } from "viem";
import MarketplaceABI from "../contracts/abi/CarbonCreditMarketplace.json";
import { CONTRACT_ADDRESSES } from "../contracts/addresses";

const PRICE_PER_TON = 0.01; // ETH

export default function MarketplaceSection() {
  const { address } = useAccount();
  const [batchId, setBatchId] = useState("");
  const [tons, setTons] = useState("");
  const { writeContract } = useWriteContract();

  const { data: sale } = useReadContract({
    address: CONTRACT_ADDRESSES.MARKETPLACE,
    abi: MarketplaceABI,
    functionName: "getSale",
    args: batchId ? [BigInt(batchId)] : undefined,
    enabled: !!batchId,
  });

  const openSale = () => {
    writeContract({
      address: CONTRACT_ADDRESSES.MARKETPLACE,
      abi: MarketplaceABI,
      functionName: "openSale",
      args: [BigInt(batchId), BigInt(tons)],
    });
  };

  const buy = () => {
    writeContract({
      address: CONTRACT_ADDRESSES.MARKETPLACE,
      abi: MarketplaceABI,
      functionName: "buyCredits",
      args: [BigInt(batchId), BigInt(tons)],
      value: parseEther((Number(tons) * PRICE_PER_TON).toString()),
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-green-800">
        🌍 Carbon Credit Marketplace
      </h2>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="font-bold mb-4">Sell Your Credits</h3>
          <input
            placeholder="Batch Token ID"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="w-full p-3 border rounded mb-3"
          />
          <input
            placeholder="Tons to sell"
            value={tons}
            onChange={(e) => setTons(e.target.value)}
            className="w-full p-3 border rounded mb-4"
          />
          <button
            onClick={openSale}
            className="w-full bg-green-600 text-white py-3 rounded hover:bg-green-700"
          >
            Open Sale
          </button>
        </div>

        <div className="bg-white p-6 rounded-xl shadow">
          <h3 className="font-bold mb-4">Buy Credits</h3>
          <input
            placeholder="Batch Token ID"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="w-full p-3 border rounded mb-3"
          />
          <input
            placeholder="Tons to buy"
            value={tons}
            onChange={(e) => setTons(e.target.value)}
            className="w-full p-3 border rounded mb-4"
          />
          <button
            onClick={buy}
            className="w-full bg-blue-600 text-white py-3 rounded hover:bg-blue-700"
          >
            Buy ({(Number(tons || 0) * PRICE_PER_TON).toFixed(3)} ETH)
          </button>
        </div>
      </div>

      {sale && sale.active && (
        <div className="bg-green-50 p-4 rounded-lg border border-green-300">
          <p>
            <strong>Batch #{batchId}</strong> đang bán:{" "}
            {sale.availableTons.toString()} tons
          </p>
          <p>Seller: {sale.seller}</p>
        </div>
      )}
    </div>
  );
}
