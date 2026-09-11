import type { ReactNode } from "react";
import { NodeListProvider } from "./NodeListContext";
import { usePublicInfo } from "./PublicInfoContext";
import { RPC2Provider } from "./RPC2Context";

export function PublicDataProviders({ children }: { children: ReactNode }) {
  const { publicInfo } = usePublicInfo();
  const configuredTransport = publicInfo?.theme_settings?.rpcTransport;
  const transport =
    typeof configuredTransport === "string" &&
    configuredTransport.toLowerCase() === "websocket"
      ? "websocket"
      : "http";

  return (
    <RPC2Provider transport={transport}>
      <NodeListProvider>{children}</NodeListProvider>
    </RPC2Provider>
  );
}
