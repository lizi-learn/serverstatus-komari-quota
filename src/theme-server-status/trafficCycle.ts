export type TrafficLimitType =
  | "sum"
  | "max"
  | "min"
  | "up"
  | "down"
  | undefined;

export type BillingCycleRange = {
  start: Date;
  nextReset: Date;
};

function clampedLocalDate(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay), 0, 0, 0, 0);
}

export function billingCycleRange(
  resetDay: number,
  now: Date = new Date(),
): BillingCycleRange {
  const current = clampedLocalDate(now.getFullYear(), now.getMonth(), resetDay);
  if (now.getTime() >= current.getTime()) {
    return {
      start: current,
      nextReset: clampedLocalDate(now.getFullYear(), now.getMonth() + 1, resetDay),
    };
  }
  return {
    start: clampedLocalDate(now.getFullYear(), now.getMonth() - 1, resetDay),
    nextReset: current,
  };
}

export function trafficValue(
  type: TrafficLimitType,
  up: number,
  down: number,
): number {
  switch (type) {
    case "sum":
      return up + down;
    case "min":
      return Math.min(up, down);
    case "up":
      return up;
    case "down":
      return down;
    case "max":
    default:
      return Math.max(up, down);
  }
}
