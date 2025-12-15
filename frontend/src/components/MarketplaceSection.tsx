import { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther } from "viem";
import MarketplaceABI from "../contracts/abi/CarbonCreditMarketplace.json";
import RegistryABI from "../contracts/abi/CarbonCreditRegistry.json";
import GreenNFTABI from "../contracts/abi/GreenNFTCollection.json";
import CCTABI from "../contracts/abi/CarbonCreditToken.json";
import { CONTRACT_ADDRESSES } from "../contracts/addresses";

const PRICE_PER_TON = 0.01; // ETH/tấn

interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: any }>;
}

export default function MarketplaceSection() {
  const { address, isConnected } = useAccount();

  const [sellBatchId, setSellBatchId] = useState("");
  const [buyBatchId, setBuyBatchId] = useState("");
  const [buyTons, setBuyTons] = useState("");

  const [metadataCache, setMetadataCache] = useState<
    Record<string, NFTMetadata>
  >({});

  const {
    writeContract,
    data: hash,
    error: writeError,
    reset,
  } = useWriteContract();
  const { isLoading: txLoading, isSuccess: txSuccess } =
    useWaitForTransactionReceipt({ hash });

  // ================== SELL SECTION ==================
  const sellBigId = sellBatchId ? BigInt(sellBatchId) : undefined;

  // Kiểm tra owner NFT
  const { data: sellBatchOwner } = useReadContract({
    address: CONTRACT_ADDRESSES.GREEN_NFT_COLLECTION,
    abi: GreenNFTABI,
    functionName: "ownerOf",
    args: sellBigId ? [sellBigId] : undefined,
    enabled: !!sellBigId,
  });

  // Lấy claimId từ Registry
  const { data: claimId } = useReadContract({
    address: CONTRACT_ADDRESSES.REGISTRY,
    abi: RegistryABI,
    functionName: "batchToClaimId",
    args: sellBigId ? [sellBigId] : undefined,
    enabled: !!sellBigId,
  });

  // Lấy claim để biết số tấn thực tế
  const { data: claim } = useReadContract({
    address: CONTRACT_ADDRESSES.REGISTRY,
    abi: RegistryABI,
    functionName: "getClaim",
    args: claimId ? [claimId] : undefined,
    enabled: !!claimId,
  });

  const actualTons = claim?.reductionTons || 0n; // Số tấn đúng từ audit

  // Lấy tokenURI để fetch metadata
  const { data: sellTokenURI } = useReadContract({
    address: CONTRACT_ADDRESSES.GREEN_NFT_COLLECTION,
    abi: GreenNFTABI,
    functionName: "tokenURI",
    args: sellBigId ? [sellBigId] : undefined,
    enabled: !!sellBigId,
  });

  // Lấy thông tin sale từ Marketplace (nếu đã mở bán)
  const { data: sellSaleRaw } = useReadContract({
    address: CONTRACT_ADDRESSES.MARKETPLACE,
    abi: MarketplaceABI,
    functionName: "getBatchSale",
    args: sellBigId ? [sellBigId] : undefined,
    enabled: !!sellBigId,
  });

  const sellSale = sellSaleRaw
    ? {
        seller: sellSaleRaw[0] as string,
        totalTons: sellSaleRaw[1] as bigint,
        availableTons: sellSaleRaw[2] as bigint,
        active: sellSaleRaw[3] as boolean,
      }
    : null;

  // Allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.CCT,
    abi: CCTABI,
    functionName: "allowance",
    args: address ? [address, CONTRACT_ADDRESSES.MARKETPLACE] : undefined,
    enabled: !!address,
    watch: true,
  });

  const isSellOwner = sellBatchOwner === address;
  const hasEnoughAllowance =
    allowance && actualTons > 0n
      ? allowance >= actualTons * 1000000000000000000n
      : false;

  // ================== BUY SECTION ==================
  const buyBigId = buyBatchId ? BigInt(buyBatchId) : undefined;
  const buyBigTons = buyTons ? BigInt(Math.floor(Number(buyTons))) : 0n;

  const { data: buySaleRaw } = useReadContract({
    address: CONTRACT_ADDRESSES.MARKETPLACE,
    abi: MarketplaceABI,
    functionName: "getBatchSale",
    args: buyBigId ? [buyBigId] : undefined,
    enabled: !!buyBigId,
  });

  const buySale = buySaleRaw
    ? {
        seller: buySaleRaw[0] as string,
        totalTons: buySaleRaw[1] as bigint,
        availableTons: buySaleRaw[2] as bigint,
        active: buySaleRaw[3] as boolean,
      }
    : null;

  const availableTonsBuy = buySale?.availableTons || 0n;
  const totalPriceBuy = Number(buyTons || 0) * PRICE_PER_TON;

  const { data: buyTokenURI } = useReadContract({
    address: CONTRACT_ADDRESSES.GREEN_NFT_COLLECTION,
    abi: GreenNFTABI,
    functionName: "tokenURI",
    args: buyBigId ? [buyBigId] : undefined,
    enabled: !!buyBigId,
  });

  // ================== DANH SÁCH BATCH ĐANG BÁN ==================
  const { data: activeBatchIds = [] } = useReadContract({
    address: CONTRACT_ADDRESSES.MARKETPLACE,
    abi: MarketplaceABI,
    functionName: "getActiveBatchSales",
  });

  const { data: saleInfos } = useReadContract({
    address: CONTRACT_ADDRESSES.MARKETPLACE,
    abi: MarketplaceABI,
    functionName: "getMultipleBatchSales",
    args: activeBatchIds.length > 0 ? [activeBatchIds] : undefined,
    enabled: activeBatchIds.length > 0,
  });

  // ================== FETCH METADATA ==================
  useEffect(() => {
    const fetchMetadata = async (uri: string, batchIdStr: string) => {
      if (!uri || metadataCache[batchIdStr]) return;
      try {
        let gatewayURI = uri;
        if (uri.startsWith("ipfs://")) {
          gatewayURI = uri.replace("ipfs://", "https://ipfs.io/ipfs/");
        }
        const res = await fetch(gatewayURI);
        if (res.ok) {
          const meta = await res.json();
          setMetadataCache((prev) => ({ ...prev, [batchIdStr]: meta }));
        }
      } catch (e) {
        console.error("Fetch metadata error:", e);
      }
    };

    if (sellTokenURI) fetchMetadata(sellTokenURI, sellBatchId);
    if (buyTokenURI) fetchMetadata(buyTokenURI, buyBatchId);
  }, [sellTokenURI, buyTokenURI, sellBatchId, buyBatchId, metadataCache]);

  // ================== FUNCTIONS ==================
  const approveCCT = () => {
    if (actualTons === 0n) {
      alert("Không tìm thấy số tấn từ claim. Kiểm tra lại batch ID.");
      return;
    }
    writeContract({
      address: CONTRACT_ADDRESSES.CCT,
      abi: CCTABI,
      functionName: "approve",
      args: [CONTRACT_ADDRESSES.MARKETPLACE, actualTons * 1000000000000000000n],
    });
  };

  const openBatchSale = () => {
    if (!sellBigId) return;
    writeContract({
      address: CONTRACT_ADDRESSES.MARKETPLACE,
      abi: MarketplaceABI,
      functionName: "openBatchSale",
      args: [sellBigId],
    });
  };

  const cancelBatchSale = () => {
    if (!sellBigId) return;
    writeContract({
      address: CONTRACT_ADDRESSES.MARKETPLACE,
      abi: MarketplaceABI,
      functionName: "cancelBatchSale",
      args: [sellBigId],
    });
  };

  const buyCredits = () => {
    if (!buyBigId || buyBigTons <= 0n || buyBigTons > availableTonsBuy) return;
    writeContract({
      address: CONTRACT_ADDRESSES.MARKETPLACE,
      abi: MarketplaceABI,
      functionName: "buyCredits",
      args: [buyBigId, buyBigTons],
      value: parseEther(totalPriceBuy.toFixed(18)),
    });
  };

  // Reset form sau thành công
  useEffect(() => {
    if (txSuccess) {
      setTimeout(() => {
        reset();
        refetchAllowance();
        setSellBatchId("");
        setBuyBatchId("");
        setBuyTons("");
      }, 3000);
    }
  }, [txSuccess, reset, refetchAllowance]);

  return (
    <div className="max-w-7xl mx-auto space-y-12 py-12 px-6">
      <h2 className="text-5xl font-bold text-center text-green-800">
        🌍 Carbon Credit Marketplace
      </h2>

      {!isConnected && (
        <div className="text-center bg-red-50 text-red-600 p-8 rounded-2xl text-xl font-semibold">
          Vui lòng kết nối ví để sử dụng marketplace
        </div>
      )}

      {/* Notification */}
      {txLoading && (
        <div className="fixed top-4 right-4 bg-blue-600 text-white p-6 rounded-xl shadow-2xl z-50 text-lg">
          Đang xử lý giao dịch...
        </div>
      )}
      {txSuccess && (
        <div className="fixed top-4 right-4 bg-green-600 text-white p-6 rounded-xl shadow-2xl z-50 text-lg animate-pulse">
          ✅ Giao dịch thành công!
        </div>
      )}
      {writeError && (
        <div className="fixed top-4 right-4 bg-red-600 text-white p-6 rounded-xl shadow-2xl z-50 text-lg">
          Lỗi: {(writeError as any).shortMessage || "Giao dịch thất bại"}
        </div>
      )}

      {/* DANH SÁCH BATCH ĐANG BÁN */}
      <div className="bg-gradient-to-br from-green-50 to-cyan-50 p-10 rounded-3xl shadow-xl">
        <h3 className="text-4xl font-bold text-green-800 mb-8">
          Batch đang mở bán ({activeBatchIds.length})
        </h3>
        {activeBatchIds.length === 0 ? (
          <p className="text-gray-600 italic text-xl">
            Chưa có batch nào đang bán
          </p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {activeBatchIds.map((id, i) => {
              const sale = saleInfos?.[i];
              if (!sale || !sale.active) return null;
              const tons = Number(sale.availableTons);
              const price = tons * PRICE_PER_TON;
              return (
                <div
                  key={id.toString()}
                  className="bg-white p-8 rounded-2xl shadow-xl hover:shadow-2xl transition duration-300"
                >
                  <h4 className="font-bold text-2xl mb-2">
                    Batch #{id.toString()}
                  </h4>
                  <p className="text-4xl font-bold text-green-600">
                    {tons} tấn
                  </p>
                  <p className="text-2xl text-blue-600 mt-2">
                    Giá: {price.toFixed(3)} ETH
                  </p>
                  <p className="text-sm text-gray-600 mt-3">
                    Seller: {sale.seller.slice(0, 8)}...{sale.seller.slice(-6)}
                  </p>
                  <button
                    onClick={() => {
                      setBuyBatchId(id.toString());
                      setBuyTons("");
                    }}
                    className="mt-6 w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition"
                  >
                    Xem chi tiết & Mua
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-12">
        {/* ================== BÁN BATCH ================== */}
        <div className="bg-white rounded-3xl shadow-2xl p-10 border-4 border-green-400">
          <h3 className="text-4xl font-bold text-green-700 mb-8">
            Mở bán toàn bộ Batch
          </h3>
          <input
            type="number"
            placeholder="Batch Token ID"
            value={sellBatchId}
            onChange={(e) => setSellBatchId(e.target.value)}
            className="w-full p-5 border-2 border-gray-300 rounded-xl text-xl mb-8 focus:border-green-500 focus:outline-none"
            disabled={!isConnected}
          />

          {sellBigId && !isSellOwner && (
            <p className="text-red-600 font-bold text-xl mb-6">
              ❌ Bạn không sở hữu batch này
            </p>
          )}

          {sellBigId && isSellOwner && actualTons > 0n && (
            <div className="bg-green-50 p-8 rounded-2xl mb-8">
              <p className="text-3xl font-bold text-green-800">
                Số tấn từ audit: {Number(actualTons)} tấn
              </p>
              {sellSale && (
                <p className="text-2xl mt-4">
                  Trạng thái:{" "}
                  {sellSale.active
                    ? `Đang bán (còn ${Number(sellSale.availableTons)} tấn)`
                    : "Chưa mở bán"}
                </p>
              )}
              {metadataCache[sellBatchId] && (
                <div className="mt-6 p-6 bg-white rounded-xl">
                  <p className="font-bold text-xl">
                    {metadataCache[sellBatchId].name || "Batch Certificate"}
                  </p>
                  <p className="text-gray-700 mt-2">
                    {metadataCache[sellBatchId].description}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Approve */}
          {isSellOwner &&
            actualTons > 0n &&
            !hasEnoughAllowance &&
            !sellSale?.active && (
              <button
                onClick={approveCCT}
                disabled={txLoading}
                className="w-full bg-orange-500 text-white py-6 rounded-xl font-bold text-2xl hover:bg-orange-600 disabled:opacity-60"
              >
                {txLoading
                  ? "Đang approve..."
                  : `1. Approve ${Number(actualTons)} CCT`}
              </button>
            )}

          {/* Mở bán */}
          {isSellOwner &&
            actualTons > 0n &&
            hasEnoughAllowance &&
            !sellSale?.active && (
              <button
                onClick={openBatchSale}
                disabled={txLoading}
                className="w-full bg-green-600 text-white py-6 rounded-xl font-bold text-2xl hover:bg-green-700 disabled:opacity-60 mt-4"
              >
                {txLoading ? "Đang mở bán..." : "2. Mở bán toàn bộ batch"}
              </button>
            )}

          {/* Hủy bán */}
          {isSellOwner && sellSale?.active && (
            <button
              onClick={cancelBatchSale}
              disabled={txLoading}
              className="w-full bg-red-600 text-white py-6 rounded-xl font-bold text-2xl hover:bg-red-700 disabled:opacity-60 mt-4"
            >
              {txLoading ? "Đang hủy..." : "Hủy bán batch"}
            </button>
          )}
        </div>

        {/* ================== MUA LẺ ================== */}
        <div className="bg-white rounded-3xl shadow-2xl p-10 border-4 border-blue-400">
          <h3 className="text-4xl font-bold text-blue-700 mb-8">
            Mua Carbon Credits
          </h3>
          <input
            type="number"
            placeholder="Batch Token ID"
            value={buyBatchId}
            onChange={(e) => setBuyBatchId(e.target.value)}
            className="w-full p-5 border-2 border-gray-300 rounded-xl text-xl mb-6 focus:border-blue-500 focus:outline-none"
            disabled={!isConnected}
          />
          <input
            type="number"
            min="0.000001"
            step="0.000001"
            placeholder="Số tấn muốn mua"
            value={buyTons}
            onChange={(e) => setBuyTons(e.target.value)}
            className="w-full p-5 border-2 border-gray-300 rounded-xl text-xl mb-8 focus:border-blue-500 focus:outline-none"
            disabled={!isConnected || !buySale?.active}
          />

          {buySale && buySale.active && (
            <div className="bg-blue-50 p-8 rounded-2xl mb-8">
              <p className="text-3xl font-bold text-green-700">
                Còn lại: {Number(availableTonsBuy)} tấn
              </p>
              <p className="text-3xl font-bold text-blue-600 mt-4">
                Tổng tiền: {totalPriceBuy.toFixed(4)} ETH
              </p>
              <p className="text-lg mt-4 text-gray-700">
                Seller: {buySale.seller.slice(0, 10)}...
                {buySale.seller.slice(-8)}
              </p>
              {metadataCache[buyBatchId] && (
                <div className="mt-6 p-6 bg-white rounded-xl">
                  <p className="font-bold text-2xl">
                    {metadataCache[buyBatchId].name}
                  </p>
                  <p className="text-gray-700 mt-3">
                    {metadataCache[buyBatchId].description}
                  </p>
                  {metadataCache[buyBatchId].image && (
                    <img
                      src={metadataCache[buyBatchId].image!.replace(
                        "ipfs://",
                        "https://ipfs.io/ipfs/"
                      )}
                      alt="Certificate"
                      className="mt-6 rounded-xl w-full shadow-lg"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {buyBatchId && !buySale?.active && (
            <p className="text-red-600 font-bold text-xl mb-6">
              Batch này không đang bán
            </p>
          )}
          {buyBigTons > availableTonsBuy && buyBigTons > 0n && (
            <p className="text-red-600 font-bold text-xl mb-6">
              Số tấn vượt quá còn lại
            </p>
          )}

          <button
            onClick={buyCredits}
            disabled={
              !isConnected ||
              !buySale?.active ||
              buyBigTons <= 0n ||
              buyBigTons > availableTonsBuy ||
              txLoading
            }
            className="w-full bg-blue-600 text-white py-7 rounded-xl font-bold text-3xl hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {txLoading
              ? "Đang mua..."
              : `Mua ${buyTons || 0} tấn (${totalPriceBuy.toFixed(4)} ETH)`}
          </button>
        </div>
      </div>
    </div>
  );
}
