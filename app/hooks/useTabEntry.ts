import { useEffect, useRef } from "react";

export function useTabEntry(tab: string, onEnter: Record<string, () => void>) {
  const previousTabRef = useRef("");

  useEffect(() => {
    if (tab !== previousTabRef.current) onEnter[tab]?.();
    previousTabRef.current = tab;
  }, [tab]);
}
