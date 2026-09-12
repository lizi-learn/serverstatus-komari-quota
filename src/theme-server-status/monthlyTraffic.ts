import { useEffect, useMemo, useState } from "react";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import { useRPC2Call } from "@/contexts/RPC2Context";
import type { QueryMetricsResponse } from "@/types/metrics";
import { parseNodeMetadata } from "./nodeMetadata";
import { billingCycleRange, effectiveTrafficQueryStart } from "./trafficCycle";

const TRAFFIC_METRICS = ["traffic.up", "traffic.down"] as const;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export type MonthlyTrafficUsage = {
  up: number;
  down: number;
  hasData: boolean;
  complete: boolean;
  start: string;
  nextReset: string;
  historySince?: string;
};

type QueryGroup = {
  start: Date;
  queryStart: Date;
  nextReset: Date;
  nodes: NodeBasicInfo[];
};

function historyIsComplete(historySince: string | undefined, cycleStart: Date) {
  if (!historySince) return false;
  const timestamp = new Date(`${historySince}T00:00:00`).getTime();
  return Number.isFinite(timestamp) && timestamp <= cycleStart.getTime();
}

function buildQueryGroups(nodes: NodeBasicInfo[], now: Date): QueryGroup[] {
  const groups = new Map<string, QueryGroup>();
  for (const node of nodes) {
    const metadata = parseNodeMetadata(node.tags);
    const resetDay = metadata.trafficResetDay;
    if (!resetDay) continue;
    const range = billingCycleRange(resetDay, now);
    const queryStart = effectiveTrafficQueryStart(
      range.start,
      metadata.trafficHistorySince,
    );
    const key = `${range.start.toISOString()}|${queryStart.toISOString()}|${range.nextReset.toISOString()}`;
    const group = groups.get(key) ?? { ...range, queryStart, nodes: [] };
    group.nodes.push(node);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function useMonthlyTraffic(nodes: NodeBasicInfo[]) {
  const { call } = useRPC2Call();
  const [usage, setUsage] = useState<Record<string, MonthlyTrafficUsage>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signature = useMemo(
    () =>
      nodes
        .map((node) =>
          [node.uuid, node.traffic_limit, node.traffic_limit_type, node.tags].join("|"),
        )
        .join("\n"),
    [nodes],
  );

  useEffect(() => {
    let stopped = false;
    let running = false;
    let timer: number | undefined;

    const schedule = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      if (!stopped) timer = window.setTimeout(refresh, REFRESH_INTERVAL_MS);
    };

    const refresh = async () => {
      if (timer !== undefined) {
        window.clearTimeout(timer);
        timer = undefined;
      }
      if (stopped || running || document.hidden) {
        schedule();
        return;
      }
      running = true;
      setLoading(true);
      const now = new Date();
      const groups = buildQueryGroups(nodes, now);
      try {
        const responses = await Promise.all(
          groups.map(async (group) => ({
            group,
            response: await call<unknown, QueryMetricsResponse>(
              "public:queryMetrics",
              {
                metric_keys: [...TRAFFIC_METRICS],
                entity_ids: group.nodes.map((node) => node.uuid),
                start: group.queryStart.toISOString(),
                end: now.toISOString(),
                aggregation_by_metric: {
                  "traffic.up": "sum",
                  "traffic.down": "sum",
                },
                max_points: 10_000,
              },
            ),
          })),
        );
        if (stopped) return;

        const next: Record<string, MonthlyTrafficUsage> = {};
        for (const { group, response } of responses) {
          for (const node of group.nodes) {
            const metadata = parseNodeMetadata(node.tags);
            next[node.uuid] = {
              up: 0,
              down: 0,
              hasData: false,
              complete: historyIsComplete(metadata.trafficHistorySince, group.start),
              start: group.start.toISOString(),
              nextReset: group.nextReset.toISOString(),
              historySince: metadata.trafficHistorySince,
            };
          }
          for (const series of response?.series ?? []) {
            const current = next[series.entity_id];
            if (!current || !TRAFFIC_METRICS.includes(series.metric_key as typeof TRAFFIC_METRICS[number])) {
              continue;
            }
            let total = 0;
            for (const point of series.points ?? []) {
              if (typeof point.value === "number" && Number.isFinite(point.value)) {
                total += point.value;
              }
            }
            if ((series.count ?? 0) > 0 || (series.points?.length ?? 0) > 0) {
              current.hasData = true;
            }
            if (series.metric_key === "traffic.up") current.up += total;
            if (series.metric_key === "traffic.down") current.down += total;
          }
        }
        setUsage(next);
        setError(null);
      } catch (reason) {
        if (!stopped) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      } finally {
        running = false;
        if (!stopped) {
          setLoading(false);
          schedule();
        }
      }
    };

    const onVisibilityChange = () => {
      if (!document.hidden && !running) void refresh();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    void refresh();
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [call, nodes, signature]);

  return { usage, loading, error };
}
