import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther } from "viem";
import MarketplaceABI from "../contracts/abi/CarbonCreditMarketplace.json";
import GreenNFTABI from "../contracts/abi/GreenNFTCollection.json";
import CCTABI from "../contracts/abi/CarbonCreditToken.json";
import { CONTRACT_ADDRESSES } from "../contracts/addresses";

const PRICE_PER_TON = 0.01; // ETH per ton

export default function MarketplaceSection() {
  const { address, isConnected } = useAccount();

  // State riêng cho Sell và Buy
  const [sellBatchId, setSellBatchId] = useState("");
  const [sellTons, setSellTons] = useState("");
  const [buyBatchId, setBuyBatchId] = useState("");
  const [buyTons, setBuyTons] = useState("");

  // Write contract
  const {
    writeContract,
    data: hash,
    error: writeError,
    reset,
  } = useWriteContract();

  const { isLoading: txLoading, isSuccess: txSuccess } =
    useWaitForTransactionReceipt({
      hash,
    });

  // === SELL SECTION ===
  const sellBigBatchId = sellBatchId ? BigInt(sellBatchId) : undefined;
  const sellBigTons = sellTons
    ? BigInt(Math.floor(Number(sellTons)))
    : undefined;

  const { data: sellBatchOwner } = useReadContract({
    address: CONTRACT_ADDRESSES.GREEN_NFT_COLLECTION,
    abi: GreenNFTABI,
    functionName: "ownerOf",
    args: sellBigBatchId ? [sellBigBatchId] : undefined,
    enabled: !!sellBigBatchId,
  });

  const { data: sellSale } = useReadContract({
    address: CONTRACT_ADDRESSES.MARKETPLACE,
    abi: MarketplaceABI,
    functionName: "getSale",
    args: sellBigBatchId ? [sellBigBatchId] : undefined,
    enabled: !!sellBigBatchId,
  });

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
    allowance && sellBigTons ? allowance >= sellBigTons * BigInt(1e18) : false;

  // === BUY SECTION ===
  const buyBigBatchId = buyBatchId ? BigInt(buyBatchId) : undefined;
  const buyBigTons = buyTons ? BigInt(Math.floor(Number(buyTons))) : undefined;

  const {
    data: buySale,
    refetch: refetchBuySale,
    isLoading: buySaleLoading,
  } = useReadContract({
    address: CONTRACT_ADDRESSES.MARKETPLACE,
    abi: MarketplaceABI,
    functionName: "getSale",
    args: buyBigBatchId ? [buyBigBatchId] : undefined,
    enabled: !!buyBigBatchId,
  });

  const totalPriceEth = buyTons
    ? (Number(buyTons) * PRICE_PER_TON).toFixed(4)
    : "0";

  // === FUNCTIONS ===
  const approveCCT = () => {
    if (!sellBigTons) return;
    writeContract({
      address: CONTRACT_ADDRESSES.CCT,
      abi: CCTABI,
      functionName: "approve",
      args: [CONTRACT_ADDRESSES.MARKETPLACE, sellBigTons * BigInt(1e18)],
    });
  };

  const openSale = () => {
    if (!sellBigBatchId || !sellBigTons) return;
    writeContract({
      address: CONTRACT_ADDRESSES.MARKETPLACE,
      abi: MarketplaceABI,
      functionName: "openSale",
      args: [sellBigBatchId, sellBigTons],
    });
  };

  const cancelSale = () => {
    if (!sellBigBatchId) return;
    writeContract({
      address: CONTRACT_ADDRESSES.MARKETPLACE,
      abi: MarketplaceABI,
      functionName: "cancelSale",
      args: [sellBigBatchId],
    });
  };

  const buyCredits = () => {
    if (!buyBigBatchId || !buyBigTons) return;
    writeContract({
      address: CONTRACT_ADDRESSES.MARKETPLACE,
      abi: MarketplaceABI,
      functionName: "buyCredits",
      args: [buyBigBatchId, buyBigTons],
      value: parseEther((Number(buyTons) * PRICE_PER_TON).toString()),
    });
  };

  // Reset form và refetch sau thành công
  if (txSuccess) {
    setTimeout(() => {
      reset();
      refetchAllowance();
      refetchBuySale();
      // Reset form nếu cần
      // setSellTons(""); setBuyTons("");
    }, 3000);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-10">
      <h2 className="text-4xl font-bold text-center text-green-800">
        🌍 Carbon Credit Marketplace
      </h2>

      {!isConnected && (
        <div className="text-center text-red-600 bg-red-50 p-6 rounded-xl">
          Vui lòng kết nối ví để sử dụng marketplace
        </div>
      )}

      {/* Notification */}
      {txLoading && (
        <div className="fixed top-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg">
          Đang xử lý giao dịch...
        </div>
      )}

      {txSuccess && (
        <div className="fixed top-4 right-4 bg-green-600 text-white p-4 rounded-lg shadow-lg animate-pulse">
          ✅ Giao dịch thành công!
        </div>
      )}

      {writeError && (
        <div className="fixed top-4 right-4 bg-red-600 text-white p-4 rounded-lg shadow-lg">
          Lỗi: {(writeError as any).shortMessage || writeError.message}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-10">
        {/* =================== BÁN =================== */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border">
          <h3 className="text-2xl font-bold text-green-700 mb-6">
            Bán Carbon Credits
          </h3>

          <input
            type="number"
            min="1"
            placeholder="Batch Token ID"
            value={sellBatchId}
            onChange={(e) => setSellBatchId(e.target.value)}
            className="w-full p-4 border rounded-lg mb-4"
            disabled={!isConnected}
          />

          <input
            type="number"
            min="0.000001"
            step="0.000001"
            placeholder="Số tấn muốn bán"
            value={sellTons}
            onChange={(e) => setSellTons(e.target.value)}
            className="w-full p-4 border rounded-lg mb-6"
            disabled={!isConnected}
          />

          {sellBigBatchId && !isSellOwner && isConnected && (
            <p className="text-red-600 mb-4">❌ Bạn không sở hữu batch này</p>
          )}

          {sellSale?.active && sellSale.seller === address && (
            <div className="mb-6 p-4 bg-green-100 rounded-lg">
              <p className="font-semibold">
                Bạn đang bán {sellSale.availableTons.toString()} tấn
              </p>
            </div>
          )}

          {isSellOwner && sellBigTons && !hasEnoughAllowance && (
            <button
              onClick={approveCCT}
              disabled={txLoading}
              className="w-full bg-orange-500! text-white py-4 rounded-lg font-bold hover:bg-orange-600! disabled:opacity-50"
            >
              {txLoading ? "Đang approve..." : "1. Approve CCT cho Marketplace"}
            </button>
          )}

          {isSellOwner && hasEnoughAllowance && !sellSale?.active && (
            <button
              onClick={openSale}
              disabled={txLoading}
              className="w-full bg-green-600! text-white py-4 rounded-lg font-bold hover:bg-green-700! disabled:opacity-50"
            >
              {txLoading ? "Đang mở bán..." : "2. Mở bán"}
            </button>
          )}

          {sellSale?.active && sellSale.seller === address && (
            <button
              onClick={cancelSale}
              disabled={txLoading}
              className="w-full mt-4 bg-red-600! text-white py-4 rounded-lg font-bold hover:bg-red-700!"
            >
              Hủy bán batch này
            </button>
          )}
        </div>

        {/* =================== MUA =================== */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border">
          <h3 className="text-2xl font-bold text-blue-700 mb-6">
            Mua Carbon Credits
          </h3>

          <input
            type="number"
            min="1"
            placeholder="Batch Token ID"
            value={buyBatchId}
            onChange={(e) => setBuyBatchId(e.target.value)}
            className="w-full p-4 border rounded-lg mb-4"
            disabled={!isConnected}
          />

          <input
            type="number"
            min="0.000001"
            step="0.000001"
            placeholder="Số tấn muốn mua"
            value={buyTons}
            onChange={(e) => setBuyTons(e.target.value)}
            className="w-full p-4 border rounded-lg mb-6"
            disabled={!isConnected || buySaleLoading}
          />

          {buySale && buySale.active && (
            <div className="mb-6 p-5 bg-blue-50 rounded-lg border border-blue-200">
              <p className="font-bold text-lg">Batch #{buyBatchId} đang bán</p>
              <p>
                Còn lại: <strong>{buySale.availableTons.toString()} tấn</strong>
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Seller: {buySale.seller.slice(0, 6)}...
                {buySale.seller.slice(-4)}
              </p>
              <p className="text-xl font-bold text-blue-700 mt-4">
                Tổng tiền: {totalPriceEth} ETH
              </p>
            </div>
          )}

          {buySale && !buySale.active && buyBatchId && (
            <p className="text-red-600 mb-4">Batch này không đang mở bán</p>
          )}

          {buyBigTons &&
            buySale?.availableTons &&
            buyBigTons > buySale.availableTons && (
              <p className="text-red-600 mb-4">Không đủ số tấn còn lại</p>
            )}

          <button
            onClick={buyCredits}
            disabled={
              !isConnected ||
              !buySale?.active ||
              !buyBigTons ||
              buyBigTons > (buySale?.availableTons || 0n) ||
              txLoading
            }
            className="w-full bg-blue-600! text-white py-5 rounded-lg font-bold text-lg hover:bg-blue-700! disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {txLoading
              ? "Đang mua..."
              : `Mua ${buyTons || 0} tấn (${totalPriceEth} ETH)`}
          </button>
        </div>
      </div>
    </div>
  );
}
