"use client";

import { useEffect, useState } from "react";

export function usePersistentState<T>(key: string, initial: T) {
  // Initialize with the provided initial value to ensure server and
  // client render the same markup on first render. Read/write to
  // localStorage only after mount to avoid hydration mismatches.
  const [state, setState] = useState<T>(initial);

  // Read persisted value on mount and update state (client-only).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setState(JSON.parse(raw) as T);
    } catch {}
  }, [key]);

  // Persist state changes to localStorage.
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);
  return [state, setState] as const;
}
