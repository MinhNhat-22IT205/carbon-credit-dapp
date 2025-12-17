import { useEffect, useState } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, parseUnits, type Abi } from "viem";
import MarketplaceABI from "../contracts/abi/CarbonCreditMarketplace.json";
import RegistryABI from "../contracts/abi/CarbonCreditRegistry.json";
import GreenNFTABI from "../contracts/abi/GreenNFTCollection.json";
import CCTABI from "../contracts/abi/CarbonCreditToken.json";
import { CONTRACT_ADDRESSES } from "../contracts/addresses";
import { Link } from "react-router-dom";

const PRICE_PER_TON = 0.00005; // ETH/tấn

interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}

// Modal chi tiết bundle để mua
function BundleDetailModal({
  batchId,
  onClose,
}: {
  batchId: bigint;
  onClose: () => void;
}) {
  const { isConnected } = useAccount();
  const [tonsToBuy, setTonsToBuy] = useState("");
  const {
    writeContract,
    data: hash,
    isPending: writePending,
  } = useWriteContract();
  const { isLoading: txLoading } = useWaitForTransactionReceipt({ hash });

  const { data: saleRaw } = useReadContract({
    address: CONTRACT_ADDRESSES.MARKETPLACE,
    abi: MarketplaceABI,
    functionName: "getBatchSale",
    args: [batchId],
  });

  const sale =
    saleRaw && Array.isArray(saleRaw)
      ? {
          seller: saleRaw[0] as string,
          totalWei: saleRaw[1] as bigint,
          availableWei: saleRaw[2] as bigint,
          active: saleRaw[3] as boolean,
        }
      : null;

  const { data: tokenURI } = useReadContract({
    address: CONTRACT_ADDRESSES.GREEN_NFT_COLLECTION,
    abi: GreenNFTABI,
    functionName: "tokenURI",
    args: batchId ? [batchId + ""] : undefined,
  });

  const [metadata, setMetadata] = useState<NFTMetadata | null>(null);

  // Fetch metadata (an toàn, không dùng hook trong effect nữa - dùng effect thuần)
  useEffect(() => {
    if (!tokenURI || typeof tokenURI !== "string") return;
    console.log("tokenURI:", tokenURI);
    const fetchMeta = async () => {
      const uri = tokenURI.startsWith("ipfs://")
        ? tokenURI.replace("ipfs://", "https://ipfs.io/ipfs/")
        : tokenURI;
      try {
        const res = await fetch(uri + "/metadata.json");
        if (res.ok) setMetadata(await res.json());
      } catch (e) {
        console.error("Metadata fetch error:", e);
      }
    };
    fetchMeta();
  }, [tokenURI]);

  if (!sale?.active) return null;

  // availableWei là bigint (wei), cần chia 1e18 để lấy số ton
  const availableTons = Number(formatUnits(sale.availableWei, 18));

  // giữ input dưới dạng string
  const tonsInput = tonsToBuy?.trim() || "0";
  const tonsNumber = Number(tonsInput) || 0;

  // Tính totalPrice từ số ton nhập vào
  const totalPrice = tonsNumber * PRICE_PER_TON;

  const handleBuy = () => {
    const tonsNumber = Number(tonsInput);

    if (
      !tonsInput ||
      isNaN(tonsNumber) ||
      tonsNumber <= 0 ||
      tonsNumber > availableTons
    ) {
      return;
    }

    // tons -> wei (18 decimals)
    const tonsWei = parseUnits(tonsInput, 18);

    const pricePerTonWei = parseUnits(PRICE_PER_TON + "", 18);
    const ONE_ETHER = 10n ** 18n;
    // total price = tonsWei * pricePerTon / 1e18
    const totalValue = (tonsWei * pricePerTonWei) / ONE_ETHER;

    writeContract({
      address: CONTRACT_ADDRESSES.MARKETPLACE,
      abi: MarketplaceABI,
      functionName: "buyCredits",
      args: [batchId, tonsWei],
      value: totalValue,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full my-8">
        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-3xl font-bold text-green-800">
              Verified Carbon Bundle #{batchId.toString()}
            </h2>
            <button
              onClick={onClose}
              className="text-3xl text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <div className="mt-6">
                <h3 className="text-2xl font-bold text-gray-800">
                  {metadata?.name || "Carbon Bundle"}
                </h3>
                <p className="text-gray-600 mt-3 leading-relaxed">
                  {metadata?.description}
                </p>
                <Link
                  to={`https://ipfs.io/ipfs/${tokenURI.slice(
                    7
                  )}/${metadata.certificate?.slice(7)}`}
                  className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white! hover:bg-blue-700"
                >
                  View certificate
                </Link>
                {metadata?.attributes && (
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    {metadata.attributes.map((attr, i) => {
                      const valueIsIpfs =
                        typeof attr.value === "string" &&
                        attr.value.startsWith("ipfs://");
                      return (
                        <div key={i} className="bg-gray-50 p-4 rounded-xl">
                          <p className="text-sm text-gray-500">
                            {attr.trait_type}
                          </p>
                          {valueIsIpfs ? (
                            <a
                              href={`https://ipfs.io/ipfs/${attr.value.slice(
                                7
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white! hover:bg-blue-700 mt-2"
                            >
                              View IPFS
                            </a>
                          ) : (
                            <p className="font-semibold">{attr.value}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-8 rounded-2xl">
              <div className="space-y-6">
                <div>
                  <p className="text-lg text-gray-700">
                    Available for Purchase
                  </p>
                  <p className="text-4xl font-bold text-green-700">
                    {availableTons.toFixed(6)} tons CO₂e
                  </p>
                </div>

                <input
                  type="number"
                  min="0.000001"
                  step="0.000001"
                  placeholder="Enter tons to buy"
                  value={tonsToBuy}
                  onChange={(e) => setTonsToBuy(e.target.value)}
                  className="w-full px-5 py-4 border-2 border-gray-300 rounded-xl text-xl focus:border-green-500"
                  disabled={!isConnected}
                />

                {tonsNumber > 0 && (
                  <div className="bg-white p-6 rounded-xl">
                    <div className="flex justify-between text-xl">
                      <span>Total Cost</span>
                      <span className="font-bold text-blue-600">
                        {totalPrice.toFixed(6)} ETH
                      </span>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleBuy}
                  disabled={
                    !isConnected ||
                    tonsNumber <= 0 ||
                    tonsNumber > availableTons ||
                    txLoading ||
                    writePending
                  }
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-5 rounded-xl font-bold text-xl hover:from-green-700 hover:to-emerald-700 disabled:opacity-60"
                >
                  {txLoading || writePending
                    ? "Processing..."
                    : "Purchase Credits"}
                </button>

                <p className="text-sm text-center text-gray-600">
                  Seller: {sale?.seller}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MarketplaceSection() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<
    "available" | "myListings" | "history"
  >("available");
  const [selectedBundle, setSelectedBundle] = useState<bigint | null>(null);
  const [sellBundleId, setSellBundleId] = useState("");

  const { writeContract, data: hash } = useWriteContract();
  // Sửa lỗi 2: Đúng cách dùng useWaitForTransactionReceipt
  const { isLoading: txLoading } = useWaitForTransactionReceipt({ hash });

  // === Danh sách bundle đang bán ===
  const { data: activeBatchIdsRaw } = useReadContract({
    address: CONTRACT_ADDRESSES.MARKETPLACE,
    abi: MarketplaceABI,
    functionName: "getActiveBatchSales",
  });

  const activeBatchIds = (activeBatchIdsRaw as bigint[]) || [];

  // Batch read sale info
  const { data: salesData } = useReadContracts({
    contracts: activeBatchIds.map((id: bigint) => ({
      address: CONTRACT_ADDRESSES.MARKETPLACE,
      abi: MarketplaceABI as Abi,
      functionName: "getBatchSale",
      args: [id],
    })),
    allowFailure: false,
  });

  // Sửa lỗi 3: Dùng useReadContracts để lấy tất cả tokenURI cùng lúc
  const { data: tokenURIs } = useReadContracts({
    contracts: activeBatchIds.map((id: bigint) => ({
      address: CONTRACT_ADDRESSES.GREEN_NFT_COLLECTION,
      abi: GreenNFTABI as Abi,
      functionName: "tokenURI",
      args: [id],
    })),
    allowFailure: false,
  });

  const { data: purchaseHistory } = useReadContract({
    address: isConnected ? CONTRACT_ADDRESSES.MARKETPLACE : undefined,
    abi: MarketplaceABI,
    functionName: "getPurchaseHistory",
    args: address ? [address] : undefined,
  });

  const [metadataCache, setMetadataCache] = useState<
    Record<string, NFTMetadata>
  >({});

  // Fetch metadata từ tokenURIs (an toàn, không dùng hook trong effect)
  useEffect(() => {
    if (!tokenURIs || tokenURIs.length === 0) return;
    tokenURIs.forEach(async (uriResult: unknown, i: number) => {
      const idStr = activeBatchIds[i]?.toString();
      if (!idStr || !uriResult) return;
      // Skip if already cached
      if (metadataCache[idStr]) return;
      let uri = typeof uriResult === "string" ? uriResult : "";
      if (uri.startsWith("ipfs://"))
        uri = uri.replace("ipfs://", "https://ipfs.io/ipfs/");
      try {
        const res = await fetch(uri);
        if (res.ok) {
          const meta = await res.json();
          setMetadataCache((prev) => ({ ...prev, [idStr]: meta }));
        }
      } catch (e) {
        console.error("Failed to fetch metadata:", e);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenURIs, activeBatchIds]);

  // Filter batches: available batches (not owned by user) và my listings (owned by user)
  const availableBatches = activeBatchIds
    .map((id: bigint, i: number) => {
      const sale = salesData?.[i];
      if (!sale || !Array.isArray(sale) || !(sale[3] as boolean)) return null;
      const seller = sale[0] as string;
      // Chỉ lấy batch không phải của mình
      if (address && seller.toLowerCase() === address.toLowerCase())
        return null;
      return { id, sale, index: i };
    })
    .filter(
      (item): item is { id: bigint; sale: unknown[]; index: number } =>
        item !== null
    );

  const myListings = activeBatchIds
    .map((id: bigint, i: number) => {
      const sale = salesData?.[i];
      if (!sale || !Array.isArray(sale) || !(sale[3] as boolean)) return null;
      const seller = sale[0] as string;
      // Chỉ lấy batch của mình
      if (!address || seller.toLowerCase() !== address.toLowerCase())
        return null;
      return { id, sale, index: i };
    })
    .filter(
      (item): item is { id: bigint; sale: unknown[]; index: number } =>
        item !== null
    );

  // === Phần My Listings (giữ nguyên logic cũ, chỉ sửa nhỏ) ===
  const sellBigId = sellBundleId ? BigInt(sellBundleId) : undefined;

  const { data: owner } = useReadContract({
    address: sellBigId ? CONTRACT_ADDRESSES.GREEN_NFT_COLLECTION : undefined,
    abi: GreenNFTABI,
    functionName: "ownerOf",
    args: sellBigId ? [sellBigId] : undefined,
  });

  const { data: claimIdRaw } = useReadContract({
    address: sellBigId ? CONTRACT_ADDRESSES.REGISTRY : undefined,
    abi: RegistryABI,
    functionName: "batchToClaimId",
    args: sellBigId ? [sellBigId] : undefined,
  });

  const claimId = claimIdRaw as bigint | undefined;

  const { data: claim } = useReadContract({
    address: claimId ? CONTRACT_ADDRESSES.REGISTRY : undefined,
    abi: RegistryABI,
    functionName: "getClaim",
    args: claimId ? [claimId] : undefined,
  });

  const actualTons =
    claim && typeof claim === "object" && "reductionTons" in claim
      ? (claim as { reductionTons: bigint }).reductionTons
      : 0n;

  const { data: saleInfoRaw } = useReadContract({
    address: sellBigId ? CONTRACT_ADDRESSES.MARKETPLACE : undefined,
    abi: MarketplaceABI,
    functionName: "getBatchSale",
    args: sellBigId ? [sellBigId] : undefined,
  });

  const saleInfo =
    saleInfoRaw && Array.isArray(saleInfoRaw)
      ? {
          availableWei: saleInfoRaw[2] as bigint,
          active: saleInfoRaw[3] as boolean,
        }
      : null;

  const { data: allowance } = useReadContract({
    address: address ? CONTRACT_ADDRESSES.CCT : undefined,
    abi: CCTABI,
    functionName: "allowance",
    args: address ? [address, CONTRACT_ADDRESSES.MARKETPLACE] : undefined,
  });

  const isOwner = owner === address;
  const hasEnoughAllowance =
    allowance && typeof allowance === "bigint"
      ? allowance >= actualTons
      : false;

  const approveCCT = () => {
    writeContract({
      address: CONTRACT_ADDRESSES.CCT,
      abi: CCTABI,
      functionName: "approve",
      args: [CONTRACT_ADDRESSES.MARKETPLACE, actualTons],
    });
  };

  const openSale = () =>
    writeContract({
      address: CONTRACT_ADDRESSES.MARKETPLACE,
      abi: MarketplaceABI,
      functionName: "openBatchSale",
      args: [sellBigId!],
    });

  const cancelSale = () =>
    writeContract({
      address: CONTRACT_ADDRESSES.MARKETPLACE,
      abi: MarketplaceABI,
      functionName: "cancelBatchSale",
      args: [sellBigId!],
    });

  return (
    <div className=" mx-auto py-12 px-6">
      {/* Header và Tabs giữ nguyên như phiên bản trước */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold text-green-800 mb-4">
          🌍 Carbon Credit Marketplace
        </h1>
        <p className="text-xl text-gray-600">
          Buy and sell verified, tokenized carbon credits from audited projects
        </p>
      </div>

      {!isConnected && (
        <div className="text-center bg-amber-50 border border-amber-300 text-amber-800 p-8 rounded-2xl text-xl font-medium mb-10">
          Please connect your wallet to access the marketplace
        </div>
      )}

      {/* Tabs */}
      <div className="flex justify-center mb-12">
        <div className="bg-gray-100 p-1 rounded-xl inline-flex">
          <button
            onClick={() => setActiveTab("available")}
            className={`px-8 py-3 rounded-lg font-semibold transition ${
              activeTab === "available"
                ? "bg-white text-green-700 shadow-md"
                : "text-gray-600"
            }`}
          >
            Available Bundles ({availableBatches.length})
          </button>
          <button
            onClick={() => setActiveTab("myListings")}
            className={`px-8 py-3 rounded-lg font-semibold transition ${
              activeTab === "myListings"
                ? "bg-white text-green-700 shadow-md"
                : "text-gray-600"
            }`}
          >
            My Listings
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-8 py-3 rounded-lg font-semibold transition ${
              activeTab === "history"
                ? "bg-white text-green-700 shadow-md"
                : "text-gray-600"
            }`}
          >
            Purchase History
          </button>
        </div>
      </div>

      {/* Tab: Available Bundles */}
      {activeTab === "available" && (
        <div>
          {availableBatches.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-3xl text-gray-500">
                No bundles currently available
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {availableBatches.map(({ id, sale }) => {
                // sale[2] là bigint (wei), cần chia 1e18 để lấy số ton
                const tons = Number(formatUnits(sale[2] as bigint, 18));
                const price = tons * PRICE_PER_TON;
                const meta = metadataCache[id.toString()];

                return (
                  <div
                    key={id.toString()}
                    onClick={() => setSelectedBundle(id)}
                    className="bg-white rounded-3xl shadow-xl overflow-hidden hover:shadow-2xl transition cursor-pointer"
                  >
                    {meta?.image && (
                      <img
                        src={meta.image.replace(
                          "ipfs://",
                          "https://ipfs.io/ipfs/"
                        )}
                        alt="Bundle"
                        className="w-full h-48 object-cover"
                      />
                    )}
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gray-800 mb-2">
                        {meta?.name || `Bundle #${id}`}
                      </h3>
                      <p className="text-3xl font-bold text-green-600">
                        {tons.toFixed(6)} tons
                      </p>
                      <p className="text-2xl font-semibold text-blue-600">
                        {price.toFixed(6)} ETH
                      </p>
                      <button className="mt-6 w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 rounded-xl font-bold">
                        View & Buy
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: My Listings (phần bán) */}
      {activeTab === "myListings" && (
        <div>
          {/* Phần List Bundle Mới */}
          <div className="bg-white rounded-3xl shadow-2xl p-10 mb-8">
            <h2 className="text-3xl font-bold text-green-800 mb-8">
              List Your Verified Bundle
            </h2>
            <input
              type="number"
              placeholder="Enter your Bundle Token ID"
              value={sellBundleId}
              onChange={(e) => setSellBundleId(e.target.value)}
              className="w-full px-6 py-4 border-2 border-gray-300 rounded-xl text-xl mb-6 focus:border-green-500"
              disabled={!isConnected}
            />

            {sellBigId && !isOwner && (
              <p className="text-red-600 font-bold text-xl">
                You do not own this bundle
              </p>
            )}

            {sellBigId && isOwner && actualTons > 0n && (
              <div className="bg-green-50 p-8 rounded-2xl mb-8">
                <p className="text-2xl font-bold text-green-800">
                  Verified: {Number(formatUnits(actualTons, 18))} tons CO₂e
                </p>
                {saleInfo && (
                  <p className="text-lg mt-4">
                    Status:{" "}
                    {saleInfo.active
                      ? `On sale (${Number(
                          formatUnits(saleInfo.availableWei, 18)
                        ).toFixed(6)} tons left)`
                      : "Not listed"}
                  </p>
                )}
              </div>
            )}

            {isOwner &&
              actualTons > 0n &&
              !hasEnoughAllowance &&
              !saleInfo?.active && (
                <button
                  onClick={approveCCT}
                  disabled={txLoading}
                  className="w-full bg-orange-600 text-white py-5 rounded-xl font-bold text-xl mb-4"
                >
                  {txLoading
                    ? "Approving..."
                    : "1. Approve CCT for Marketplace"}
                </button>
              )}

            {isOwner && hasEnoughAllowance && !saleInfo?.active && (
              <button
                onClick={openSale}
                disabled={txLoading}
                className="w-full bg-green-600 text-white py-5 rounded-xl font-bold text-xl mb-4"
              >
                {txLoading ? "Listing..." : "2. List Entire Bundle for Sale"}
              </button>
            )}

            {isOwner && saleInfo?.active && (
              <button
                onClick={cancelSale}
                disabled={txLoading}
                className="w-full bg-red-600 text-white py-5 rounded-xl font-bold text-xl"
              >
                {txLoading ? "Cancelling..." : "Cancel Listing"}
              </button>
            )}
          </div>

          {/* Phần Danh sách Batch Đang Bán của Mình */}
          <div className="bg-white rounded-3xl shadow-2xl p-10">
            <h2 className="text-3xl font-bold text-green-800 mb-8">
              My Active Listings ({myListings.length})
            </h2>
            {myListings.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-xl text-gray-500">
                  You don't have any active listings
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {myListings.map(({ id, sale }) => {
                  // sale[2] là bigint (wei), cần chia 1e18 để lấy số ton
                  const tons = Number(formatUnits(sale[2] as bigint, 18));
                  const price = tons * PRICE_PER_TON;
                  const meta = metadataCache[id.toString()];

                  return (
                    <div
                      key={id.toString()}
                      className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl shadow-xl overflow-hidden"
                    >
                      {meta?.image && (
                        <img
                          src={meta.image.replace(
                            "ipfs://",
                            "https://ipfs.io/ipfs/"
                          )}
                          alt="Bundle"
                          className="w-full h-48 object-cover"
                        />
                      )}
                      <div className="p-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-2">
                          {meta?.name || `Bundle #${id}`}
                        </h3>
                        <p className="text-3xl font-bold text-green-600">
                          {tons.toFixed(6)} tons
                        </p>
                        <p className="text-2xl font-semibold text-blue-600">
                          {price.toFixed(6)} ETH
                        </p>
                        <button
                          onClick={() => setSellBundleId(id.toString())}
                          className="mt-6 w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-xl font-bold hover:from-blue-700 hover:to-indigo-700"
                        >
                          Manage Listing
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Purchase History (placeholder) */}
      {activeTab === "history" && (
        <div className="bg-white rounded-3xl shadow-xl p-10">
          <h2 className="text-3xl font-bold mb-8">Purchase History</h2>

          {!purchaseHistory || purchaseHistory.length === 0 ? (
            <p className="text-gray-500 text-xl text-center">
              No purchases yet
            </p>
          ) : (
            <div className="space-y-6">
              {purchaseHistory.map((p: any, i: number) => (
                <div
                  key={i}
                  className="border rounded-xl p-6 flex justify-between"
                >
                  <div>
                    <p className="font-bold">
                      Bundle #{p.batchTokenId.toString()}
                    </p>
                    <p>Tons: {formatUnits(p.tonsWei, 18)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blue-600">
                      {formatUnits(p.ethPaid, 18)} ETH
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(Number(p.timestamp) * 1000).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Modal */}
      {selectedBundle && (
        <BundleDetailModal
          batchId={selectedBundle}
          onClose={() => setSelectedBundle(null)}
        />
      )}
    </div>
  );
}
