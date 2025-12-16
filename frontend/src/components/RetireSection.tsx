import { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";

import CCTABI from "../contracts/abi/CarbonCreditToken.json";
import RetirementABI from "../contracts/abi/RetirementCertificate.json";
import { CONTRACT_ADDRESSES } from "../contracts/addresses";
import { formatUnits } from "viem";

// Pinata JWT - lấy từ biến môi trường
const PINATA_JWT = import.meta.env.VITE_PINATA_JWT as string | undefined;

// SVG Certificate Template
const generateCertificateSVG = (
  tons: string,
  purpose: string,
  date: string,
  address: string
) => {
  return `
<svg width="1000" height="700" xmlns="http://www.w3.org/2000/svg" style="background: linear-gradient(135deg, #f0fdf4, #dcfce7); font-family: 'Georgia', serif;">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#86efac" />
      <stop offset="100%" style="stop-color:#22c55e" />
    </linearGradient>
  </defs>

  <rect width="1000" height="700" fill="white" stroke="url(#grad1)" stroke-width="15" rx="30"/>
  
  <text x="500" y="120" font-size="56" text-anchor="middle" fill="#166534" font-weight="bold">
    CARBON RETIREMENT CERTIFICATE
  </text>

  <text x="500" y="220" font-size="42" text-anchor="middle" fill="#15803d">
    ${tons} tons CO₂e Permanently Retired
  </text>

  <text x="500" y="290" font-size="32" text-anchor="middle" fill="#16a34a">
    Purpose: ${purpose}
  </text>

  <text x="500" y="350" font-size="28" text-anchor="middle" fill="#15803d">
    Date: ${date}
  </text>

  <text x="500" y="420" font-size="26" text-anchor="middle" fill="#1e40af">
    Retired by:
  </text>
  <text x="500" y="470" font-size="28" text-anchor="middle" fill="#2563eb" font-weight="bold">
    ${address.slice(0, 10)}...${address.slice(-8)}
  </text>

  <text x="500" y="600" font-size="20" text-anchor="middle" fill="#166534">
    Verified on-chain • Powered by Green Carbon Protocol
  </text>

  <!-- Decorative elements -->
  <circle cx="150" cy="550" r="80" fill="#86efac" opacity="0.6"/>
  <circle cx="850" cy="150" r="100" fill="#86efac" opacity="0.5"/>
  <text x="150" y="570" font-size="80" text-anchor="middle" fill="#166534">🌿</text>
  <text x="850" y="180" font-size="100" text-anchor="middle" fill="#16a34a">🌍</text>
</svg>`;
};

async function uploadCertificateToPinata(
  svgContent: string,
  metadata: any,
  tons: string
): Promise<string> {
  if (!PINATA_JWT || PINATA_JWT === "your_real_pinata_jwt_here") {
    throw new Error("Pinata JWT not configured. Please set it in code or .env");
  }

  const timestamp = Date.now();
  const folderName = `retirement-${tons.replace(".", "-")}t-${timestamp}`;

  const svgBlob = new Blob([svgContent], { type: "image/svg+xml" });
  const svgFile = new File([svgBlob], "certificate.svg");

  const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], {
    type: "application/json",
  });
  const metadataFile = new File([metadataBlob], "metadata.json");

  const formData = new FormData();
  formData.append("file", svgFile, `${folderName}/certificate.svg`);
  formData.append("file", metadataFile, `${folderName}/metadata.json`);

  const pinataMetadata = JSON.stringify({
    name: `Retirement Certificate - ${tons} tons`,
    keyvalues: {
      tons,
      purpose: metadata.attributes.find((a: any) => a.trait_type === "Purpose")
        ?.value,
    },
  });
  formData.append("pinataMetadata", pinataMetadata);

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Pinata upload failed: ${errorText}`);
  }

  const data = await res.json();
  return data.IpfsHash; // folder CID
}

export default function RetireSection() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const [tons, setTons] = useState("");
  const [purpose, setPurpose] = useState("");
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");

  const {
    writeContract,
    data: hash,
    isPending: txPending,
    error: txError,
  } = useWriteContract();
  const { isLoading: txConfirming, isSuccess: txSuccess } =
    useWaitForTransactionReceipt({ hash });

  // CCT Balance
  const { data: balanceRaw } = useReadContract({
    address: CONTRACT_ADDRESSES.CCT,
    abi: CCTABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    enabled: !!address,
  });
  const balanceWei = balanceRaw ?? 0n; // BigInt (wei)
  const balance = formatUnits(balanceWei, 18); // string, ví dụ "10000000"

  // ================== LỊCH SỬ RETIRE THẬT (getLogs) ==================
  const [retireHistory, setRetireHistory] = useState<
    Array<{
      certificateId: bigint;
      tons: number;
      purpose: string;
      date: string;
      txHash: string;
    }>
  >([]);

  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    if (!address || !publicClient) {
      setHistoryLoading(false);
      return;
    }

    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const latestBlock = await publicClient.getBlockNumber();

        const STEP = 1000n;
        let fromBlock = 0n;
        const allLogs: any[] = [];

        while (fromBlock <= latestBlock) {
          const toBlock =
            fromBlock + STEP > latestBlock ? latestBlock : fromBlock + STEP;

          const logs = await publicClient.getLogs({
            address: CONTRACT_ADDRESSES.CCT,
            event: {
              name: "TokensRetired",
              type: "event",
              inputs: [
                { name: "retire", type: "address", indexed: true },
                { name: "tons", type: "uint256", indexed: false },
                { name: "certificateId", type: "uint256", indexed: false },
                { name: "purpose", type: "string", indexed: false },
                { name: "timestamp", type: "uint256", indexed: false },
              ],
            },
            args: { retire: address }, // ⚠️ đúng tên param trong event
            fromBlock,
            toBlock,
          });

          allLogs.push(...logs);
          fromBlock = toBlock + 1n;
        }

        const history = allLogs
          .map((log) => {
            const args = log.args!;
            return {
              certificateId: args.certificateId,
              tons: Number(args.tons) / 1e18,
              purpose: args.purpose,
              date: new Date(Number(args.timestamp) * 1000).toLocaleDateString(
                "vi-VN"
              ),
              txHash: log.transactionHash,
            };
          })
          .sort((a, b) => b.txHash.localeCompare(a.txHash));

        setRetireHistory(history);
      } catch (err) {
        console.error("Error fetching retire history:", err);
        setRetireHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchHistory();
  }, [address, publicClient]);

  // ================== HANDLE RETIRE ==================
  const handleRetire = async () => {
    const tonsBigInt = BigInt(tons); // tons là string số nguyên

    if (tonsBigInt <= 0n) {
      alert("Số tấn không hợp lệ");
      return;
    }

    if (tonsBigInt * 10n ** 18n > balanceWei) {
      alert("Số tấn vượt quá số dư");
      return;
    }

    if (!purpose.trim()) {
      alert("Vui lòng nhập mục đích retire");
      return;
    }

    setUploading(true);
    setStatus("Đang tạo certificate...");

    try {
      const date = new Date().toLocaleDateString("vi-VN");
      const svg = generateCertificateSVG(
        tons,
        purpose,
        date,
        address || "0x000...000"
      );

      const metadata = {
        name: `Carbon Retirement Certificate - ${tons} tons`,
        description: `Chứng nhận ${tons} tấn CO₂e đã được retire vĩnh viễn vào ngày ${date}. Mục đích: ${purpose}.`,
        image: "ipfs://certificate.svg",
        attributes: [
          { trait_type: "Tons Retired", value: Number(tons) },
          { trait_type: "Purpose", value: purpose },
          { trait_type: "Date", value: date },
          { trait_type: "Retiree", value: address },
        ],
      };

      setStatus("Đang upload lên IPFS...");
      const folderCID = await uploadCertificateToPinata(svg, metadata, tons);

      const certificateURI = `ipfs://${folderCID}/metadata.json`;

      setStatus("Đang gửi giao dịch...");
      writeContract({
        address: CONTRACT_ADDRESSES.CCT,
        abi: CCTABI,
        functionName: "retire",
        args: [tonsBigInt, purpose, certificateURI],
        gas: 800000n, // Giới hạn 800k gas – đủ cho burn + mint NFT
      });
    } catch (err: any) {
      console.error("Retire error:", err);
      setStatus(`Lỗi: ${err.message}`);
      alert("Retire thất bại: " + err.message);
      setUploading(false);
    }
  };

  useEffect(() => {
    if (txSuccess) {
      setStatus("✅ Retire thành công! Certificate đã được mint.");
      setTons("");
      setPurpose("");
      setTimeout(() => setStatus(""), 8000);
      setUploading(false);
    }
    if (txError) {
      setStatus(
        `Giao dịch lỗi: ${(txError as any).shortMessage || txError.message}`
      );
      setUploading(false);
    }
  }, [txSuccess, txError]);

  return (
    <div className="max-w-7xl mx-auto space-y-16 py-16 px-6">
      <h2 className="text-6xl font-bold text-center text-teal-800">
        🌿 Retire Carbon Credits & Nhận Chứng Chỉ
      </h2>

      {!isConnected && (
        <div className="text-center bg-red-100 text-red-700 p-10 rounded-3xl text-2xl font-bold">
          Vui lòng kết nối ví để retire CCT
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-12">
        {/* ================== FORM RETIRE ================== */}
        <div className="bg-gradient-to-br from-teal-50 to-green-50 p-12 rounded-3xl shadow-2xl">
          <h3 className="text-4xl font-bold text-teal-900 mb-10 text-center">
            Retire CCT Ngay
          </h3>

          <div className="bg-white/80 p-8 rounded-2xl mb-8 shadow-inner">
            <p className="text-2xl font-semibold text-gray-800">Số dư CCT:</p>
            <p className="text-5xl font-bold text-teal-600 mt-4">
              {Number(balance).toLocaleString("en-US", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 6,
              })}{" "}
              CCT
            </p>
          </div>

          <input
            type="number"
            placeholder="Số tấn muốn retire"
            value={tons}
            onChange={(e) => setTons(e.target.value)}
            className="w-full px-8 py-5 border-4 border-teal-300 rounded-2xl text-2xl mb-8 focus:border-teal-500 focus:outline-none"
            disabled={uploading || txPending || txConfirming}
            min="0.000001"
            step="0.000001"
          />

          <input
            type="text"
            placeholder="Mục đích (ví dụ: Carbon Neutral 2025)"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="w-full px-8 py-5 border-4 border-teal-300 rounded-2xl text-xl mb-10"
            disabled={uploading || txPending || txConfirming}
          />

          <button
            onClick={handleRetire}
            disabled={
              uploading ||
              txPending ||
              txConfirming ||
              !tons ||
              (tons && BigInt(tons) * 10n ** 18n > balanceWei) ||
              !purpose.trim()
            }
            className="w-full py-8 rounded-2xl font-bold text-3xl text-white bg-gradient-to-r from-teal-600 to-green-600 hover:from-teal-700 hover:to-green-700 disabled:opacity-60 shadow-2xl transition-all"
          >
            {uploading
              ? "Đang tạo & upload certificate..."
              : txPending || txConfirming
              ? "Đang xử lý giao dịch..."
              : "Retire & Nhận Certificate"}
          </button>

          {status && (
            <div
              className={`mt-8 p-6 rounded-2xl text-center text-xl font-semibold ${
                status.includes("Lỗi") || status.includes("Error")
                  ? "bg-red-100 text-red-700"
                  : status.includes("thành công")
                  ? "bg-green-100 text-green-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {status}
            </div>
          )}
        </div>

        {/* ================== LỊCH SỬ RETIRE ================== */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-12 rounded-3xl shadow-2xl">
          <h3 className="text-4xl font-bold text-teal-900 mb-10 text-center">
            Lịch sử Retire của bạn ({retireHistory.length})
          </h3>

          {historyLoading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-16 w-16 border-8 border-teal-600 border-t-transparent"></div>
              <p className="mt-6 text-xl text-gray-600">Đang tải lịch sử...</p>
            </div>
          ) : retireHistory.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-3xl text-gray-600">
                🌱 Chưa có lượt retire nào
              </p>
              <p className="text-xl text-gray-500 mt-4">
                Hãy là người đầu tiên retire CCT!
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {retireHistory.map((item) => (
                <div
                  key={item.txHash}
                  className="bg-white p-8 rounded-2xl shadow-xl hover:shadow-2xl transition"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-4xl font-bold text-green-700">
                        {item.tons.toFixed(6)} tấn
                      </p>
                      <p className="text-2xl text-gray-800 mt-3">
                        {item.purpose}
                      </p>
                      <p className="text-lg text-gray-600 mt-2">
                        Ngày: {item.date}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-purple-700 text-xl">
                        Certificate #{item.certificateId.toString()}
                      </p>
                      <a
                        href={`https://etherscan.io/tx/${item.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block mt-4 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700"
                      >
                        Xem giao dịch →
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
