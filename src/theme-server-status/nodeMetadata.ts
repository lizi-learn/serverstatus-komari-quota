export type Lifecycle = "keep" | "evaluate";

export type NodeMetadata = {
  bandwidthDownMbps?: number;
  bandwidthUpMbps?: number;
  lifecycle?: Lifecycle;
  role?: string;
  trafficResetDay?: number;
  trafficResetSource?: "confirmed" | "inferred";
  trafficHistorySince?: string;
};

const positiveNumber = (value: string): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

export function parseNodeMetadata(tags: string | undefined): NodeMetadata {
  const result: NodeMetadata = {};

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
  }

  return result;
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
