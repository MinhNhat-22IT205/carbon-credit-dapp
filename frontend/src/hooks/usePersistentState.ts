import { useEffect, useState } from "react";

/**
 * usePersistentState
 * Lưu state vào sessionStorage theo key, để khi chuyển màn / unmount
 * rồi quay lại thì tự restore lại giá trị cũ.
 */
export function usePersistentState<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const stored = window.sessionStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore quota / privacy errors
    }
  }, [key, value]);

  return [value, setValue];
}

