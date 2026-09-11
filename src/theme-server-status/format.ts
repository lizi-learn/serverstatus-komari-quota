const SIZE_UNITS = ["B", "K", "M", "G", "T", "P"];

export function formatCompactBytes(input: number): string {
  let value = Number.isFinite(input) && input > 0 ? input : 0;
  let unit = 0;
  while (value >= 1024 && unit < SIZE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }

  const digits = unit === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits).replace(/\.0+$|(?<=\.[0-9])0$/, "")}${SIZE_UNITS[unit]}`;
}

export function percent(used: number, total: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(100, Math.max(0, (used / total) * 100));
}

export function formatPercent(value: number): string {
  const safeValue = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
  return safeValue.toFixed(2);
}

export function formatUptime(seconds: number, chinese: boolean): string {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const days = Math.floor(safeSeconds / 86400);
  if (days > 0) return chinese ? `${days} 天` : `${days} d`;

  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const rest = safeSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function formatDate(value: string | number | undefined, chinese: boolean): string {
  if (value === undefined || value === null || value === "") return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(chinese ? "zh-CN" : undefined, { hour12: false });
}

export function countryCode(region: string): string {
  const trimmed = (region || "").trim();
  if (/^[a-z]{2}$/i.test(trimmed)) return trimmed.toUpperCase();

  const indicators = Array.from(trimmed).filter((char) => {
    const point = char.codePointAt(0) ?? 0;
    return point >= 0x1f1e6 && point <= 0x1f1ff;
  });
  if (indicators.length >= 2) {
    return indicators
      .slice(0, 2)
      .map((char) => String.fromCharCode((char.codePointAt(0) ?? 0) - 0x1f1e6 + 65))
      .join("");
  }

  const code = trimmed.match(/(?:^|\s)([a-z]{2})(?:$|\s)/i)?.[1];
  return code?.toUpperCase() || "UN";
}

export function progressTone(value: number, online: boolean): string {
  if (!online) return "offline";
  if (value >= 90) return "danger";
  if (value >= 80) return "warning";
  return "success";
}
