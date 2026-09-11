import { createContext, useContext, type ReactNode } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

type ServerStatusSettings = {
  grouped: boolean;
  setGrouped: (value: boolean | ((current: boolean) => boolean)) => void;
  semiTransparent: boolean;
  setSemiTransparent: (value: boolean | ((current: boolean) => boolean)) => void;
};

const SettingsContext = createContext<ServerStatusSettings | null>(null);

export function ServerStatusSettingsProvider({ children }: { children: ReactNode }) {
  const [grouped, setGrouped] = useLocalStorage("serverStatusGrouped", true);
  const [semiTransparent, setSemiTransparent] = useLocalStorage(
    "serverStatusSemiTransparent",
    false,
  );

  return (
    <SettingsContext.Provider
      value={{ grouped, setGrouped, semiTransparent, setSemiTransparent }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useServerStatusSettings(): ServerStatusSettings {
  const settings = useContext(SettingsContext);
  if (!settings) {
    throw new Error("useServerStatusSettings must be used inside ServerStatusSettingsProvider");
  }
  return settings;
}
