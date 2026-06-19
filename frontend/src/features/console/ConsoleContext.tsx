import { useEffect } from "react";
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useProduct, useRegions } from "@/lib/hooks";

type ClientCoords = { lat: number; lon: number; label?: string };

type ConsoleContextValue = {
  region: string;
  setRegion: (r: string) => void;
  client: ClientCoords;
  setClient: (c: ClientCoords) => void;
  isGateway: boolean;
  localRegion: string;
  regionIds: string[];
};

const ConsoleContext = createContext<ConsoleContextValue | null>(null);

export function ConsoleProvider({ children }: { children: ReactNode }) {
  const { data: product } = useProduct();
  const { data: regionsData } = useRegions();
  const localRegion = regionsData?.local_region ?? product?.local_region ?? "us-east-1";
  const regionIds = regionsData?.regions.map((r) => r.id) ?? [];

  const [region, setRegionState] = useState(localRegion);
  const [client, setClientState] = useState<ClientCoords>({
    lat: 40.71,
    lon: -74.01,
    label: "NYC",
  });

  useEffect(() => {
    if (regionIds.length && !regionIds.includes(region)) {
      setRegionState(localRegion);
    }
  }, [regionIds, localRegion, region]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setClientState({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          label: "You",
        });
      },
      () => {
        /* keep NYC default if denied */
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const setRegion = useCallback((r: string) => setRegionState(r), []);
  const setClient = useCallback((c: ClientCoords) => setClientState(c), []);

  const isGateway = product?.deployment_mode === "gateway";

  return (
    <ConsoleContext.Provider
      value={{
        region: regionIds.includes(region) ? region : localRegion,
        setRegion,
        client,
        setClient,
        isGateway,
        localRegion,
        regionIds,
      }}
    >
      {children}
    </ConsoleContext.Provider>
  );
}

export function useConsole() {
  const ctx = useContext(ConsoleContext);
  if (!ctx) throw new Error("useConsole must be used within ConsoleProvider");
  return ctx;
}
