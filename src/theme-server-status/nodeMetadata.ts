export type Lifecycle = "keep" | "evaluate";

export type ChinaCarrier = "ct" | "cu" | "cm";

export type ChinaRouteMetadata = {
  go: Partial<Record<ChinaCarrier, string>>;
  back: Partial<Record<ChinaCarrier, string>>;
  sampledAt?: string;
  goScope?: string;
  backScope?: string;
};

export type NodeMetadata = {
  bandwidthDownMbps?: number;
  bandwidthUpMbps?: number;
  lifecycle?: Lifecycle;
  relay?: boolean;
  role?: string;
  trafficResetDay?: number;
  trafficResetSource?: "confirmed" | "inferred";
  trafficHistorySince?: string;
  trafficBaselineGiB?: number;
  trafficBaselineUntil?: string;
  chinaRoutes?: ChinaRouteMetadata;
};

const ROUTE_TAG_PATTERN = /^route-(go|back)-(ct|cu|cm)$/;
const ROUTE_VALUE_MAX_LENGTH = 40;
const ROUTE_SCOPE_MAX_LENGTH = 80;

const positiveNumber = (value: string): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

export function parseNodeMetadata(tags: string | undefined): NodeMetadata {
  const result: NodeMetadata = {};
  const chinaRoutes: ChinaRouteMetadata = { go: {}, back: {} };
  let hasChinaRoutes = false;

  for (const rawTag of (tags ?? "").split(";")) {
    const separator = rawTag.indexOf("=");
    if (separator < 1) continue;
    const key = rawTag.slice(0, separator).trim().toLowerCase();
    const value = rawTag.slice(separator + 1).trim();

    if (key === "bw-down") {
      const parsed = positiveNumber(value);
      if (parsed !== undefined) result.bandwidthDownMbps = parsed;
    }
    if (key === "bw-up") {
      const parsed = positiveNumber(value);
      if (parsed !== undefined) result.bandwidthUpMbps = parsed;
    }
    if (key === "lifecycle" && (value === "keep" || value === "evaluate")) {
      result.lifecycle = value;
    }
    if (
      key === "relay" &&
      ["1", "true", "yes", "sing-box", "singbox"].includes(value.toLowerCase())
    ) {
      result.relay = true;
    }
    if (key === "role" && value) result.role = value;
    if (key === "traffic-reset-day") {
      const parsed = Number(value);
      if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 31) {
        result.trafficResetDay = parsed;
      }
    }
    if (
      key === "traffic-reset-source" &&
      (value === "confirmed" || value === "inferred")
    ) {
      result.trafficResetSource = value;
    }
    if (
      key === "traffic-history-since" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
    ) {
      result.trafficHistorySince = value;
    }
    if (key === "traffic-baseline-gib") {
      const parsed = positiveNumber(value);
      if (parsed !== undefined) result.trafficBaselineGiB = parsed;
    }
    if (
      key === "traffic-baseline-until" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
    ) {
      result.trafficBaselineUntil = value;
    }

    const routeMatch = key.match(ROUTE_TAG_PATTERN);
    if (
      routeMatch &&
      value.length > 0 &&
      value.length <= ROUTE_VALUE_MAX_LENGTH
    ) {
      const direction = routeMatch[1] as "go" | "back";
      const carrier = routeMatch[2] as ChinaCarrier;
      chinaRoutes[direction][carrier] = value;
      hasChinaRoutes = true;
    }
    if (
      key === "route-sampled-at" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(new Date(`${value}T00:00:00`).getTime())
    ) {
      chinaRoutes.sampledAt = value;
      hasChinaRoutes = true;
    }
    if (
      key === "route-go-scope" &&
      value.length > 0 &&
      value.length <= ROUTE_SCOPE_MAX_LENGTH
    ) {
      chinaRoutes.goScope = value;
      hasChinaRoutes = true;
    }
    if (
      key === "route-back-scope" &&
      value.length > 0 &&
      value.length <= ROUTE_SCOPE_MAX_LENGTH
    ) {
      chinaRoutes.backScope = value;
      hasChinaRoutes = true;
    }
  }

  if (hasChinaRoutes) result.chinaRoutes = chinaRoutes;

  return result;
}

export function activeTrafficBaselineBytes(
  metadata: NodeMetadata,
  now: number = Date.now(),
): number {
  if (!metadata.trafficBaselineGiB || !metadata.trafficBaselineUntil) return 0;
  const expires = new Date(`${metadata.trafficBaselineUntil}T00:00:00`).getTime();
  if (!Number.isFinite(expires) || now >= expires) return 0;
  return metadata.trafficBaselineGiB * 1024 ** 3;
}

export function formatRouteValue(
  value: string | undefined,
  chinese: boolean,
): string {
  if (!value) return chinese ? "未测" : "untested";
  const labels: Record<string, readonly [string, string]> = {
    HIDDEN: ["部分隐藏", "partly hidden"],
    "CN2-163": ["CN2/163动态", "CN2/163 dynamic"],
    "CTG-CN2-163": ["CTG/CN2→163", "CTG/CN2→163"],
    "9929-163": ["9929→163", "9929→163"],
    "9929-CMNET": ["9929→CMNET", "9929→CMNET"],
  };
  const translated = labels[value.toUpperCase()];
  return translated ? translated[chinese ? 0 : 1] : value;
}

export function formatMbps(value: number | undefined): string {
  if (!value) return "-";
  if (value >= 1000 && value % 1000 === 0) return `${value / 1000}G`;
  return `${value}M`;
}

export function isFleetVisible(hidden: boolean | undefined): boolean {
  return hidden !== true;
}

export function daysUntil(
  value: string | number | undefined,
  now: number = Date.now(),
): number | undefined {
  if (value === undefined || value === "") return undefined;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return undefined;
  return Math.ceil((timestamp - now) / 86_400_000);
}

export function formatDateOnly(value: string | number | undefined): string {
  if (value === undefined || value === "") return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
