import { useReadContract } from "wagmi";
import { CONTRACT_ADDRESSES } from "../contracts/addresses";
import RegistryABI from "../contracts/abi/CarbonCreditRegistry.json";

import { keccak256, toBytes, zeroHash } from "viem";

const AUDITOR_ROLE = keccak256(toBytes("AUDITOR_ROLE"));
const DEFAULT_ADMIN_ROLE = zeroHash;

export function useIsAuditor(address?: `0x${string}`) {
  const { data: hasRole, isLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.REGISTRY,
    abi: RegistryABI,
    functionName: "hasRole",
    args: AUDITOR_ROLE && address ? [AUDITOR_ROLE, address] : undefined,
    query: {
      enabled: !!AUDITOR_ROLE && !!address,
    },
  });

  console.log("AUDITOR_ROLE", AUDITOR_ROLE);
  console.log("hasRole", hasRole, address, "isLoading", isLoading);

  return { isAuditor: !!hasRole, isLoading };
}
export function useIsAdmin(address?: `0x${string}`) {
  const { data: hasRole, ...rest } = useReadContract({
    address: CONTRACT_ADDRESSES.REGISTRY,
    abi: RegistryABI,
    functionName: "hasRole",
    args: address ? [DEFAULT_ADMIN_ROLE, address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  return { isAdmin: !!hasRole, ...rest };
}
