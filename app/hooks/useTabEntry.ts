import { useEffect, useRef } from "react";

export function useTabEntry(tab: string, onEnter: Record<string, () => void>) {
  const previousTabRef = useRef("");
  const onEnterRef = useRef(onEnter);

  useEffect(() => {
    onEnterRef.current = onEnter;
  });

  useEffect(() => {
    if (tab !== previousTabRef.current) onEnterRef.current[tab]?.();
    previousTabRef.current = tab;
  }, [tab]);
}
