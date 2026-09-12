export type Lifecycle = "keep" | "evaluate";

export type NodeMetadata = {
  bandwidthDownMbps?: number;
  bandwidthUpMbps?: number;
  lifecycle?: Lifecycle;
  role?: string;
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
