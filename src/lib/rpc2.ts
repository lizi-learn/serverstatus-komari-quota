import type {
  JSONRPC2Request,
  JSONRPC2Response,
  JSONRPC2BatchRequest,
  JSONRPC2BatchResponse,
  RPC2ConnectionStateType,
  RPC2ConnectionOptions,
  RPC2TransportMode,
  RPC2CallOptions,
  RPC2EventListeners,
} from "../types/rpc2";
import { RPC2ConnectionState } from "../types/rpc2";
import i18n from "../i18n/config";

export class RPC2Client {
  private ws: WebSocket | null = null;
  private connectionState: RPC2ConnectionStateType = RPC2ConnectionState.DISCONNECTED;
  private requestId = 0;
  private pendingRequests = new Map<string | number, {
    resolve: (value: any) => void;
    reject: (reason?: any) => void;
    timeout?: NodeJS.Timeout;
  }>();
  private reconnectAttempts = 0;
  private reconnectTimeout?: NodeJS.Timeout;
  private heartbeatInterval?: NodeJS.Timeout;
  private eventListeners: RPC2EventListeners = {};
  private transportMode: RPC2TransportMode;
  private manuallyDisconnected = false;

  private readonly baseUrl: string;
  private readonly options: Required<RPC2ConnectionOptions>;

  constructor(
    baseUrl = "/api/rpc2",
    options: RPC2ConnectionOptions = {}
  ) {
    this.baseUrl = baseUrl;
    this.options = {
      transport: "auto",
      autoConnect: true,
      autoReconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
      requestTimeout: 30000,
      enableHeartbeat: true,
      heartbeatInterval: 15000,
      headers: {
        "Content-Type": "application/json",
      },
      ...options,
    };
    this.transportMode = this.options.transport;

    if (this.options.autoConnect && this.transportMode !== "http") {
      this.autoConnect();
    }
  }

  get state(): RPC2ConnectionStateType {
    return this.connectionState;
  }

  get transport(): RPC2TransportMode {
    return this.transportMode;
  }

  setTransportMode(mode: RPC2TransportMode): void {
    this.transportMode = mode;

    if (mode === "http") {
      this.disconnect();
      return;
    }

    this.manuallyDisconnected = false;
    if (
      this.options.autoConnect &&
      this.connectionState !== RPC2ConnectionState.CONNECTED &&
      this.connectionState !== RPC2ConnectionState.CONNECTING
    ) {
      void this.connect().catch((error) => {
        console.warn(i18n.t("rpc2.automatic_connection_failed"), error.message);
      });
    }
  }

  setEventListeners(listeners: RPC2EventListeners): void {
    this.eventListeners = { ...this.eventListeners, ...listeners };
  }

  clearEventListeners(): void {
    this.eventListeners = {};
  }

  async connect(): Promise<void> {
    if (this.transportMode === "http") return;
    if (this.connectionState === RPC2ConnectionState.CONNECTED ||
        this.connectionState === RPC2ConnectionState.CONNECTING) {
      return;
    }

    this.manuallyDisconnected = false;
    this.setConnectionState(RPC2ConnectionState.CONNECTING);
    let attemptedSocket: WebSocket | null = null;

    try {
      const wsUrl = this.getWebSocketUrl();
      const ws = new WebSocket(wsUrl);
      attemptedSocket = ws;
      this.ws = ws;
      this.setupWebSocketHandlers();

      await new Promise<void>((resolve, reject) => {
        const handleOpen = () => {
          cleanup();
          if (this.ws !== ws) {
            reject(new Error(i18n.t("rpc2.connection_disconnected")));
            return;
          }
          resolve();
        };
        const handleError = () => {
          cleanup();
          reject(new Error(i18n.t("rpc2.websocket_connection_failed")));
        };
        const handleClose = () => {
          cleanup();
          reject(new Error(i18n.t("rpc2.connection_disconnected")));
        };
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error(i18n.t("rpc2.websocket_connection_timed_out")));
        }, 10000);

        const cleanup = () => {
          clearTimeout(timeout);
          ws.removeEventListener("open", handleOpen);
          ws.removeEventListener("error", handleError);
          ws.removeEventListener("close", handleClose);
        };

        ws.addEventListener("open", handleOpen, { once: true });
        ws.addEventListener("error", handleError, { once: true });
        ws.addEventListener("close", handleClose, { once: true });
      });
    } catch (error) {
      if (this.ws !== attemptedSocket) throw error;
      this.setConnectionState(RPC2ConnectionState.ERROR);
      this.eventListeners.onError?.(error as Error);
      throw error;
    }
  }

  private autoConnect(): void {
    if (
      this.transportMode === "http" ||
      this.connectionState !== RPC2ConnectionState.DISCONNECTED
    ) {
      return;
    }

    this.connect().catch((error) => {
      console.warn(i18n.t("rpc2.automatic_connection_failed"), error.message);
    });
  }

  disconnect(): void {
    this.manuallyDisconnected = true;
    const wasConnected =
      this.connectionState !== RPC2ConnectionState.DISCONNECTED;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }

    const socket = this.ws;
    this.ws = null;
    if (socket) {
      socket.close();
    }

    this.setConnectionState(RPC2ConnectionState.DISCONNECTED);
    this.clearPendingRequests(new Error(i18n.t("rpc2.connection_disconnected")));
    if (wasConnected) this.eventListeners.onDisconnect?.();
  }

  async callViaWebSocket<TParams = any, TResult = any>(
    method: string,
    params?: TParams,
    options: RPC2CallOptions = {}
  ): Promise<TResult> {
    if (this.connectionState !== RPC2ConnectionState.CONNECTED) {
      throw new Error(i18n.t("rpc2.websocket_not_connected"));
    }

    const request: JSONRPC2Request<TParams> = {
      jsonrpc: "2.0",
      method,
      params,
      id: options.notification ? undefined : this.generateRequestId(),
    };

    if (options.notification) {
      this.sendMessage(request);
      return undefined as TResult;
    }

    return new Promise<TResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id!);
        reject(
          new Error(i18n.t("rpc2.request_timed_out", { method }))
        );
      }, options.timeout || this.options.requestTimeout);

      this.pendingRequests.set(request.id!, {
        resolve,
        reject,
        timeout,
      });

      this.sendMessage(request);
    });
  }

  async callViaHTTP<TParams = any, TResult = any>(
    method: string,
    params?: TParams,
    options: RPC2CallOptions = {}
  ): Promise<TResult> {
    const request: JSONRPC2Request<TParams> = {
      jsonrpc: "2.0",
      method,
      params,
      id: options.notification ? undefined : this.generateRequestId(),
    };

    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: this.options.headers,
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(options.timeout ?? this.options.requestTimeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (options.notification) {
        return undefined as TResult;
      }

      const jsonResponse: JSONRPC2Response<TResult> = await response.json();

      if ("error" in jsonResponse) {
        throw new Error(`RPC Error ${jsonResponse.error.code}: ${jsonResponse.error.message}`);
      }

      return jsonResponse.result;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(i18n.t("rpc2.request_failed", { method }));
    }
  }

  async batchCall(requests: Array<{
    method: string;
    params?: any;
    notification?: boolean;
  }>): Promise<any[]> {
    const batchRequest: JSONRPC2BatchRequest = requests.map(req => ({
      jsonrpc: "2.0",
      method: req.method,
      params: req.params,
      id: req.notification ? undefined : this.generateRequestId(),
    }));

    try {
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: this.options.headers,
        body: JSON.stringify(batchRequest),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const jsonResponse: JSONRPC2BatchResponse = await response.json();

      return jsonResponse.map(res => {
        if ("error" in res) {
          throw new Error(`RPC Error ${res.error.code}: ${res.error.message}`);
        }
        return res.result;
      });
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(i18n.t("rpc2.batch_request_failed"));
    }
  }

  async call<TParams = any, TResult = any>(
    method: string,
    params?: TParams,
    options: RPC2CallOptions = {}
  ): Promise<TResult> {
    if (this.transportMode === "http") {
      return this.callViaHTTP(method, params, options);
    }

    if (this.options.autoConnect &&
        this.connectionState === RPC2ConnectionState.DISCONNECTED) {
      this.autoConnect();
    }

    if (this.connectionState === RPC2ConnectionState.CONNECTED) {
      try {
        return await this.callViaWebSocket(method, params, options);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("RPC Error ")) {
          throw error;
        }
        return this.callViaHTTP(method, params, options);
      }
    }

    return this.callViaHTTP(method, params, options);
  }

  private getWebSocketUrl(): string {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    return `${protocol}//${host}${this.baseUrl}`;
  }

  private setupWebSocketHandlers(): void {
    const ws = this.ws;
    if (!ws) return;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.setConnectionState(RPC2ConnectionState.CONNECTED);
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.eventListeners.onConnect?.();
    };

    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
        this.eventListeners.onMessage?.(data);
      } catch (error) {
        console.error(i18n.t("rpc2.parse_websocket_message_failed"), error);
      }
    };

    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.setConnectionState(RPC2ConnectionState.DISCONNECTED);
      this.stopHeartbeat();
      this.eventListeners.onDisconnect?.();

      if (!this.manuallyDisconnected &&
          this.transportMode !== "http" &&
          this.options.autoReconnect &&
          this.reconnectAttempts < this.options.maxReconnectAttempts) {
        this.attemptReconnect();
      }
    };

    ws.onerror = (error) => {
      if (this.ws !== ws) return;
      console.error(i18n.t("rpc2.websocket_error"), error);
      this.eventListeners.onError?.(
        new Error(i18n.t("rpc2.websocket_connection_error"))
      );
    };
  }

  private handleMessage(data: JSONRPC2Response): void {
    if (!data.id) return;

    const pending = this.pendingRequests.get(data.id);
    if (!pending) return;

    this.pendingRequests.delete(data.id);

    if (pending.timeout) {
      clearTimeout(pending.timeout);
    }

    if ("error" in data) {
      pending.reject(new Error(`RPC Error ${data.error.code}: ${data.error.message}`));
    } else {
      pending.resolve(data.result);
    }
  }

  private sendMessage(message: JSONRPC2Request): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(i18n.t("rpc2.websocket_not_connected"));
    }

    this.ws.send(JSON.stringify(message));
  }

  private setConnectionState(state: RPC2ConnectionStateType): void {
    this.connectionState = state;
  }

  private generateRequestId(): number {
    return ++this.requestId;
  }

  private clearPendingRequests(error: Error): void {
    for (const [, pending] of this.pendingRequests) {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  private startHeartbeat(): void {
    if (!this.options.enableHeartbeat) {
      return;
    }

    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          const heartbeatRequest: JSONRPC2Request = {
            jsonrpc: "2.0",
            method: "rpc.ping",
            params: { timestamp: Date.now() }
          };
          this.ws.send(JSON.stringify(heartbeatRequest));
        } catch (error) {
          console.warn(i18n.t("rpc2.send_heartbeat_failed"), error);
        }
      }
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  private attemptReconnect(): void {
    if (this.manuallyDisconnected || this.transportMode === "http") return;
    this.reconnectAttempts++;
    this.setConnectionState(RPC2ConnectionState.RECONNECTING);
    this.eventListeners.onReconnecting?.(this.reconnectAttempts);

    this.reconnectTimeout = setTimeout(() => {
      if (this.manuallyDisconnected || this.transportMode === "http") return;
      this.connect().catch(() => undefined);
    }, this.options.reconnectInterval);
  }
}
