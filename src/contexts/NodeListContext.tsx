import React from "react";
import { useRPC2Call } from "./RPC2Context";
import { isFleetVisible } from "@/theme-server-status/nodeMetadata";

export type NodeBasicInfo = {
  uuid: string;
  name: string;
  cpu_name: string;
  virtualization: string;
  arch: string;
  cpu_cores: number;
  os: string;
  kernel_version: string;
  gpu_name: string;
  region: string;
  mem_total: number;
  swap_total: number;
  disk_total: number;
  version: string;
  weight: number;
  price: number;
  tags: string;
  billing_cycle: number;
  currency: string;
  group: string;
  traffic_limit: number;
  traffic_limit_type: undefined | "sum" | "max" | "min" | "up" | "down";
  expired_at: string;
  created_at: string;
  updated_at: string;
  ipv4?: string; 
  ipv6?: string;
  public_remark?: string;
  hidden?: boolean;
};

interface NodeListContextType {
  nodeList: NodeBasicInfo[] | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

const NODE_LIST_CONTEXT_KEY = "__komariNodeListContext" as const;

type NodeListContextGlobal = typeof globalThis & {
  [NODE_LIST_CONTEXT_KEY]?: React.Context<NodeListContextType | undefined>;
};

const globalNodeListContext = globalThis as NodeListContextGlobal;
const NodeListContext =
  globalNodeListContext[NODE_LIST_CONTEXT_KEY] ??
  (globalNodeListContext[NODE_LIST_CONTEXT_KEY] =
    React.createContext<NodeListContextType | undefined>(undefined));

const sameNodeBasicInfo = (left: NodeBasicInfo, right: NodeBasicInfo) =>
  (Object.keys(right) as Array<keyof NodeBasicInfo>).every(
    (key) => left[key] === right[key],
  );

export const NodeListProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [nodeList, setNodeList] = React.useState<NodeBasicInfo[] | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const { call } = useRPC2Call();
  const refreshSeqRef = React.useRef(0);
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = React.useCallback(() => {
    const refreshSeq = ++refreshSeqRef.current;
    call<{ uuid?: string }, any[] | Record<string, any>>("common:getNodes")
      .then((result) => {
        if (!mountedRef.current || refreshSeq !== refreshSeqRef.current) return;
        if (!result || typeof result !== "object") {
          throw new Error("Invalid node list response");
        }
        const rawNodes = Array.isArray(result)
          ? result
          : Object.values(result).sort(
              (left: any, right: any) =>
                (left.weight ?? 0) - (right.weight ?? 0) ||
                String(left.uuid).localeCompare(String(right.uuid)),
            );
        const list: NodeBasicInfo[] = rawNodes.map((n: any) => ({
          uuid: n.uuid,
          name: n.name,
          cpu_name: n.cpu_name,
          virtualization: n.virtualization,
          arch: n.arch,
          cpu_cores: n.cpu_cores,
          os: n.os,
          kernel_version: n.kernel_version,
          gpu_name: n.gpu_name,
          region: n.region,
          mem_total: n.mem_total,
          swap_total: n.swap_total,
          disk_total: n.disk_total,
          version: n.version ?? "",
          weight: n.weight ?? 0,
          price: n.price ?? 0,
          tags: n.tags ?? "",
          billing_cycle: n.billing_cycle ?? 0,
          currency: n.currency ?? "",
          group: n.group ?? "",
          traffic_limit: n.traffic_limit ?? 0,
          traffic_limit_type: n.traffic_limit_type,
          expired_at: n.expired_at ?? "",
          created_at: n.created_at ?? "",
          updated_at: n.updated_at ?? "",
          ipv4: n.ipv4,
          ipv6: n.ipv6,
          public_remark: n.public_remark ?? "",
          hidden: n.hidden ?? false,
        })).filter((node) => isFleetVisible(node.hidden));
        setError(null);
        setNodeList((previous) => {
          if (!previous) return list;
          const previousByUuid = new Map(
            previous.map((node) => [node.uuid, node]),
          );
          let changed = previous.length !== list.length;
          const shared = list.map((node, index) => {
            const previousNode = previousByUuid.get(node.uuid);
            if (previousNode && sameNodeBasicInfo(previousNode, node)) {
              if (previous[index] !== previousNode) changed = true;
              return previousNode;
            }
            changed = true;
            return node;
          });
          return changed ? shared : previous;
        });
      })
      .catch((err: any) => {
        if (!mountedRef.current || refreshSeq !== refreshSeqRef.current) return;
        setError(err?.message || "An error occurred while fetching data");
      })
      .finally(() => {
        if (!mountedRef.current || refreshSeq !== refreshSeqRef.current) return;
        setIsLoading(false);
      });
  }, [call]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const contextValue = React.useMemo(
    () => ({ nodeList, isLoading, error, refresh }),
    [nodeList, isLoading, error, refresh],
  );

  return (
    <NodeListContext.Provider value={contextValue}>
      {children}
    </NodeListContext.Provider>
  );
};

export function useNodeList(): NodeListContextType;
export function useNodeList(required: false): NodeListContextType | undefined;
export function useNodeList(required = true) {
  const context = React.useContext(NodeListContext);
  if (!context && required) {
    throw new Error("useNodeList must be used within a NodeListProvider");
  }
  return context;
}
