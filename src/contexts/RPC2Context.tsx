import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { RPC2Client } from "../lib/rpc2";
import type {
  RPC2ConnectionStateType,
  RPC2TransportMode,
} from "../types/rpc2";
import i18n from "../i18n/config";

interface RPC2ContextType {
  client: RPC2Client;
  connectionState: RPC2ConnectionStateType;
  isConnected: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const RPC2Context = createContext<RPC2ContextType | undefined>(undefined);

let __rpc2_singleton__: RPC2Client | null = null;
let __rpc2_refcount = 0;

export const RPC2Provider: React.FC<{
  children: React.ReactNode;
  transport?: RPC2TransportMode;
}> = ({ children, transport = "http" }) => {
  const [client] = useState(() => {
    if (!__rpc2_singleton__) {
      __rpc2_singleton__ = new RPC2Client("/api/rpc2", {
        autoConnect: true,
        transport: "http",
      });
    }
    return __rpc2_singleton__;
  });
  const [connectionState, setConnectionState] = useState(client.state);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    __rpc2_refcount++;
    client.setEventListeners({
      onConnect: () => {
        setConnectionState(client.state);
        setError(null);
      },
      onDisconnect: () => {
        setConnectionState(client.state);
      },
      onError: (err) => {
        setError(err.message);
        setConnectionState(client.state);
      },
      onReconnecting: () => {
        setConnectionState(client.state);
      },
    });

    return () => {
      __rpc2_refcount = Math.max(0, __rpc2_refcount - 1);
      if (__rpc2_refcount === 0) {
        client.clearEventListeners();
        client.disconnect();
      }
    };
  }, [client]);

  useEffect(() => {
    client.setTransportMode(transport);
    setConnectionState(client.state);
    setError(null);
  }, [client, transport]);

  const connect = useCallback(async () => {
    try {
      setError(null);
      await client.connect();
    } catch (err) {
      setError(err instanceof Error ? err.message : i18n.t("rpc2.connection_failed"));
      throw err;
    }
  }, [client]);

  const disconnect = useCallback(() => {
    client.disconnect();
  }, [client]);

  const isConnected = connectionState === "connected";
  const contextValue = useMemo(
    () => ({
      client,
      connectionState,
      isConnected,
      error,
      connect,
      disconnect,
    }),
    [client, connectionState, isConnected, error, connect, disconnect],
  );

  return (
    <RPC2Context.Provider value={contextValue}>
      {children}
    </RPC2Context.Provider>
  );
};

export const useRPC2 = (): RPC2ContextType => {
  const context = useContext(RPC2Context);
  if (context === undefined) {
    throw new Error(i18n.t("rpc2.provider_required"));
  }
  return context;
};

export const useRPC2Call = () => {
  const { client, isConnected } = useRPC2();

  const call = useCallback(<TParams = any, TResult = any>(
    method: string,
    params?: TParams,
    options?: any
  ): Promise<TResult> => client.call(method, params, options), [client]);

  const callViaWebSocket = useCallback(<TParams = any, TResult = any>(
    method: string,
    params?: TParams,
    options?: any
  ): Promise<TResult> => client.callViaWebSocket(method, params, options), [client]);

  const callViaHTTP = useCallback(<TParams = any, TResult = any>(
    method: string,
    params?: TParams,
    options?: any
  ): Promise<TResult> => client.callViaHTTP(method, params, options), [client]);

  const batchCall = useCallback((requests: Array<{ method: string; params?: any; notification?: boolean }>) =>
    client.batchCall(requests), [client]);

  return {
    call,
    callViaWebSocket,
    callViaHTTP,
    batchCall,
    isConnected,
  };
}
