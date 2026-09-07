import { useEffect, useRef } from "react";

// Загрузка на монтировании читает свежие колбэки из рефа, поэтому список
// зависимостей честно пуст и exhaustive-deps нечего требовать.
export function useMount(run: () => void) {
  const runRef = useRef(run);

  useEffect(() => {
    runRef.current = run;
  });

  useEffect(() => {
    runRef.current();
  }, []);
}
