import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const REGION_KEY = "rk_region_v1";

const RegionContext = createContext(null);

const normalizeRegion = (value) => {
  const v = String(value || "").toUpperCase();
  if (v === "US" || v === "USA") return "US";
  return "IN";
};

const readRegion = () => {
  try {
    const raw = localStorage.getItem(REGION_KEY);
    return normalizeRegion(raw);
  } catch {
    return "IN";
  }
};

export function RegionProvider({ children }) {
  const [region, setRegionState] = useState(() => readRegion());

  useEffect(() => {
    try {
      localStorage.setItem(REGION_KEY, region);
    } catch {
      // ignore
    }
  }, [region]);

  const setRegion = (next) => setRegionState(normalizeRegion(next));

  const value = useMemo(() => ({ region, setRegion }), [region]);

  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}

export function useRegion() {
  const ctx = useContext(RegionContext);
  if (!ctx) throw new Error("useRegion must be used within RegionProvider");
  return ctx;
}
