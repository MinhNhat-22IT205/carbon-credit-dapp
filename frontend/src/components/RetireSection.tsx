import { useEffect, useState, useCallback } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import { formatUnits, parseUnits } from "viem";

import CCTABI from "../contracts/abi/CarbonCreditToken.json";
import RetirementABI from "../contracts/abi/RetirementCertificate.json";
import { CONTRACT_ADDRESSES } from "../contracts/addresses";
import { usePersistentState } from "../hooks/usePersistentState";

/* ================= TYPES ================= */

interface Attribute {
  trait_type: string;
  value: string | number;
}

interface CertificateMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Attribute[];
}

interface RetireHistoryItem {
  certificateId: bigint;
  metadata: CertificateMetadata;
  metadataUrl: string;
  svgUrl: string;
}

/* ================= PINATA ================= */

const PINATA_JWT = import.meta.env.VITE_PINATA_JWT as string | undefined;

/* ================= SVG ================= */

const generateCertificateSVG = (
  tons: string,
  purpose: string,
  date: string,
  address: string
) => `
<svg width="1000" height="700" xmlns="http://www.w3.org/2000/svg"
  style="background:#f0fdf4;font-family:Georgia,serif">

  <rect width="1000" height="700" rx="28"
    fill="white" stroke="#22c55e" stroke-width="10"/>

  <text x="500" y="100" font-size="48" text-anchor="middle"
    fill="#14532d" font-weight="bold">
    CARBON RETIREMENT CERTIFICATE
  </text>

  <text x="500" y="190" font-size="34" text-anchor="middle" fill="#166534">
    ${tons} tons CO₂e Permanently Retired
  </text>

  <text x="500" y="260" font-size="26" text-anchor="middle">
    Purpose: ${purpose}
  </text>

  <text x="500" y="320" font-size="22" text-anchor="middle">
    Date: ${date}
  </text>

  <text x="500" y="390" font-size="20" text-anchor="middle">
    Retired by:
  </text>

  <text x="500" y="430" font-size="18" text-anchor="middle"
    fill="#1e40af">
    ${address}
  </text>

  <text x="500" y="610" font-size="16" text-anchor="middle" fill="#166534">
    Verified on-chain • Green Carbon Protocol
  </text>
</svg>
`;

/* ================= PINATA UPLOAD ================= */

async function uploadToPinata(
  svg: string,
  metadata: CertificateMetadata,
  tons: string
): Promise<string> {
  if (!PINATA_JWT) throw new Error("Missing Pinata JWT");

  const folder = `retire-${tons}-${Date.now()}`;

  const formData = new FormData();
  formData.append(
    "file",
    new File([svg], "certificate.svg", { type: "image/svg+xml" }),
    `${folder}/certificate.svg`
  );
  formData.append(
    "file",
    new File([JSON.stringify(metadata, null, 2)], "metadata.json", {
      type: "application/json",
    }),
    `${folder}/metadata.json`
  );

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: formData,
  });

  if (!res.ok) throw new Error("Pinata upload failed");

  const data = await res.json();
  return data.IpfsHash;
}

/* ================= COMPONENT ================= */

export default function RetireSection() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();

  const [tons, setTons] = usePersistentState<string>("retire_form_tons", "");
  const [purpose, setPurpose] = usePersistentState<string>(
    "retire_form_purpose",
    ""
  );
  const [status, setStatus] = useState("");
  const [uploading, setUploading] = useState(false);

  /* ===== BALANCE ===== */

  const { data: balanceRaw } = useReadContract({
    address: CONTRACT_ADDRESSES.CCT,
    abi: CCTABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      refetchInterval: 5000, // Refresh mỗi 5 giây
    },
  });

  const balanceWei = (balanceRaw as bigint) ?? 0n;
  const balance = formatUnits(balanceWei, 18);

  /* ===== TX ===== */

  const {
    writeContract,
    data: txHash,
    error: txError,
    isPending,
  } = useWriteContract();

  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  /* ================= RETIRE ================= */

  const handleRetire = async () => {
    if (!address) return;

    const tonsWei = parseUnits(tons || "0", 18);
    if (tonsWei <= 0n) return alert("Invalid tons");
    if (tonsWei > balanceWei) return alert("Insufficient balance");
    if (!purpose.trim()) return alert("Purpose required");

    setUploading(true);
    setStatus("Generating certificate...");

    try {
      const date = new Date().toLocaleDateString("vi-VN");
      const svg = generateCertificateSVG(tons, purpose, date, address);

      const metadata: CertificateMetadata = {
        name: `Carbon Retirement Certificate`,
        description: `${tons} tons CO₂e retired`,
        image: "ipfs://certificate.svg",
        attributes: [
          { trait_type: "Tons Retired", value: tons },
          { trait_type: "Purpose", value: purpose },
          { trait_type: "Date", value: date },
          { trait_type: "Retiree", value: address },
        ],
      };

      setStatus("Uploading to IPFS...");
      const cid = await uploadToPinata(svg, metadata, tons);

      writeContract({
        address: CONTRACT_ADDRESSES.CCT,
        abi: CCTABI,
        functionName: "retire",
        args: [tonsWei, purpose, `ipfs://${cid}/metadata.json`],
      });
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
      setUploading(false);
    }
  };

  useEffect(() => {
    if (isSuccess) {
      setStatus("✅ Retire successful");
      setTons("");
      setPurpose("");
      setUploading(false);
    }
    if (txError) {
      setStatus(`❌ ${txError.message}`);
      setUploading(false);
    }
  }, [isSuccess, txError]);

  /* ================= HISTORY ================= */

  const [history, setHistory] = useState<RetireHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = useCallback(async () => {
    if (!address || !publicClient) return;
    
    setLoadingHistory(true);
    try {
      const ids = (await publicClient.readContract({
        address: CONTRACT_ADDRESSES.RETIREMENT_CERTIFICATE,
        abi: RetirementABI,
        functionName: "getRetirements",
        args: [address],
      })) as bigint[];

      const items = await Promise.all(
        ids.map(async (id) => {
          const uri = (await publicClient.readContract({
            address: CONTRACT_ADDRESSES.RETIREMENT_CERTIFICATE,
            abi: RetirementABI,
            functionName: "tokenURI",
            args: [id],
          })) as string;

          const base = uri.replace("ipfs://", "https://ipfs.io/ipfs/");
          const svgUrl = base.replace("metadata.json", "certificate.svg");

          const meta = await (await fetch(base)).json();

          return {
            certificateId: id,
            metadata: meta,
            metadataUrl: base,
            svgUrl,
          };
        })
      );

      setHistory(items.reverse());
    } finally {
      setLoadingHistory(false);
    }
  }, [address, publicClient]);

  // Load history khi component mount hoặc address thay đổi
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Cập nhật history sau khi retire thành công
  useEffect(() => {
    if (isSuccess) {
      // Đợi blockchain cập nhật (thường cần 1-2 block confirmations)
      setTimeout(() => {
        loadHistory();
      }, 3000);
    }
  }, [isSuccess, loadHistory]);

  /* ================= UI ================= */

  return (
    <div className="max-w-6xl mx-auto py-12 space-y-14">
      <h2 className="text-4xl font-bold text-center text-emerald-800">
        🌿 Retire Carbon Credits
      </h2>

      {/* ===== FORM ===== */}
      <div className="bg-white p-8 rounded-xl shadow space-y-4">
        <p className="text-sm text-gray-600">
          Balance: <b>{balance}</b> CCT
        </p>

        <input
          value={tons}
          onChange={(e) => setTons(e.target.value)}
          placeholder="Tons to retire"
          type="number"
          className="w-full border px-4 py-2 rounded"
        />

        <input
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          placeholder="Purpose"
          className="w-full border px-4 py-2 rounded"
        />

        <button
          disabled={!isConnected || uploading || isPending || confirming}
          onClick={handleRetire}
          className="w-full bg-emerald-600 text-white py-2 rounded disabled:opacity-50"
        >
          {uploading || isPending ? "Processing..." : "Retire & Mint NFT"}
        </button>

        {status && <p className="text-sm text-center">{status}</p>}
      </div>

      {/* ===== HISTORY ===== */}
      <div>
        <h3 className="text-2xl font-semibold mb-6">Your Certificates</h3>

        {loadingHistory ? (
          <p>Loading...</p>
        ) : history.length === 0 ? (
          <p>No certificates yet</p>
        ) : (
          <div className="space-y-6">
            {history.map((item) => (
              <div
                key={item.certificateId.toString()}
                className="border rounded-lg p-5 flex gap-6"
              >
                <img src={item.svgUrl} className="w-52 border rounded" />

                <div className="text-sm space-y-1">
                  <p className="font-semibold">
                    Certificate #{item.certificateId.toString()}
                  </p>
                  {item.metadata.attributes.map((a) => (
                    <p key={a.trait_type}>
                      <b>{a.trait_type}:</b> {a.value}
                    </p>
                  ))}
                  <div className="pt-2 flex gap-4 text-emerald-700">
                    <a href={item.metadataUrl} target="_blank">
                      Metadata
                    </a>
                    <a href={item.svgUrl} target="_blank">
                      SVG
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
