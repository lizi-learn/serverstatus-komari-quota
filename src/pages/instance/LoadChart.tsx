import { memo, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Card,
  Flex,
  SegmentedControl,
  Select,
  TextField,
} from "@radix-ui/themes";
import {
  CalendarDays,
  ChartLine,
  Search,
} from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import Loading from "@/components/loading";
import MetricBoundaryAxisTick from "@/components/MetricBoundaryAxisTick";
import PingMetricStatContent from "@/components/PingMetricStatContent";
import Tips from "@/components/ui/tips";
import { usePublicInfo } from "@/contexts/PublicInfoContext";
import { useRPC2Call } from "@/contexts/RPC2Context";
import type {
  MetricSeries,
  PingMetricStat,
  PingMetricStatsResponse,
  PublicPingTask,
  QueryMetricsResponse,
} from "@/types/metrics";
import {
  PING_LATENCY_METRIC,
  comparePingTaskOrder,
  formatRemainingTags,
  isPingMetric,
  metricChartBoundaryTicks,
  trimMetricChartBoundaryRows,
  metricSeriesColor,
  metricSeriesDataKey,
  metricSeriesKey,
  metricTags,
  normalizeMetricSeriesList,
  pingMetricStatKey,
  pingTaskId,
  pingTaskName,
  type MetricChartRow,
} from "@/utils/metricSeries";
import { formatBytes } from "@/utils/unitHelper";
import type { RecordFormat } from "@/utils/RecordHelper";

type LoadChartProps = {
  data: RecordFormat[];
  onRealtimeActiveChange?: (active: boolean) => void;
};

type ChartSize = "small" | "medium" | "large";
type MetricKind =
  | "percent"
  | "bytes"
  | "bytesPerSecond"
  | "milliseconds"
  | "raw";

type DashboardChart = {
  id: string;
  title: string;
  metrics: string[];
  size: ChartSize;
};

type MetricCatalogItem = {
  key: string;
  label: string;
  kind: MetricKind;
  unit?: string;
  realtimeValue?: (record: RecordFormat) => number | null | undefined;
};

type MetricDefinition = {
  name: string;
  description?: string;
  type?: string;
  unit?: string;
  retention_days?: number;
};

type RenderSeries = {
  dataKey: string;
  stableKey: string;
  metricKey: string;
  label: string;
  color: string;
  kind: MetricKind;
  pointCount?: number;
  unit?: string;
  yAxisId?: "left" | "right";
  tags?: Record<string, string>;
};

type BuiltChartData = {
  rows: MetricChartRow[];
  series: RenderSeries[];
};

type ChartAxis = {
  id: "left" | "right";
  kind: MetricKind;
  orientation: "left" | "right";
};

type PreparedChartData = BuiltChartData & {
  axes: ChartAxis[];
};

type TimeView = {
  key: string;
  label: string;
  hours?: number;
};

type CustomTimeRange = {
  start: string;
  end: string;
};

type MetricRangeParams =
  | { hours: number }
  | { start: string; end: string };

const MAX_REALTIME_POINTS = 30 * 5;
const HISTORY_MAX_POINTS = 700;
const CUSTOM_RANGE_DEFAULT_DAYS = 24;

const DEFAULT_DASHBOARD: DashboardChart[] = [
  {
    id: "cpu",
    title: "CPU",
    metrics: ["cpu.usage"],
    size: "small",
  },
  {
    id: "memory",
    title: "Memory",
    metrics: ["memory.used", "swap.used"],
    size: "small",
  },
  {
    id: "disk",
    title: "Disk",
    metrics: ["disk.used"],
    size: "small",
  },
  {
    id: "network",
    title: "Network",
    metrics: ["net.in.rate", "net.out.rate"],
    size: "large",
  },
  {
    id: "ping",
    title: "Latency",
    metrics: [PING_LATENCY_METRIC],
    size: "large",
  },
];

const fallbackCatalog: MetricCatalogItem[] = [
  {
    key: "cpu.usage",
    label: "CPU",
    kind: "percent",
    unit: "%",
    realtimeValue: (record) => record.cpu,
  },
  {
    key: "memory.used",
    label: "RAM",
    kind: "bytes",
    unit: "bytes",
    realtimeValue: (record) => record.ram,
  },
  {
    key: "swap.used",
    label: "Swap",
    kind: "bytes",
    unit: "bytes",
    realtimeValue: (record) => record.swap,
  },
  {
    key: "disk.used",
    label: "Disk",
    kind: "bytes",
    unit: "bytes",
    realtimeValue: (record) => record.disk,
  },
  {
    key: "net.in.rate",
    label: "Download",
    kind: "bytesPerSecond",
    unit: "bytes/s",
    realtimeValue: (record) => record.net_in,
  },
  {
    key: "net.out.rate",
    label: "Upload",
    kind: "bytesPerSecond",
    unit: "bytes/s",
    realtimeValue: (record) => record.net_out,
  },
  {
    key: PING_LATENCY_METRIC,
    label: "Ping",
    kind: "milliseconds",
    unit: "ms",
  },
];

const fallbackCatalogMap = new Map(fallbackCatalog.map((item) => [item.key, item]));

const formatTags = (
  metricKey: string,
  tags: Record<string, string> | undefined,
  pingTaskMap: ReadonlyMap<string, PublicPingTask>,
  t: ReturnType<typeof useTranslation>["t"],
) => {
  if (!tags || Object.keys(tags).length === 0) return "";

  const taskId = pingTaskId(tags);
  if (isPingMetric(metricKey) && taskId) {
    const taskLabel = pingTaskName(
      taskId,
      pingTaskMap,
      (id) => `${t("ping.task")} ${id}`,
    );
    const remaining = formatRemainingTags(tags, ["task_id"]);
    return remaining ? `${taskLabel} ${remaining}` : taskLabel;
  }

  if (taskId) {
    const taskLabel = `${t("ping.task")} ${taskId}`;
    const remaining = formatRemainingTags(tags, ["task_id"]);
    return remaining ? `${taskLabel} ${remaining}` : taskLabel;
  }
  return formatRemainingTags(tags);
};

const formatSeriesLabel = (
  metricKey: string,
  tags: Record<string, string> | undefined,
  definitions: Map<string, MetricDefinition>,
  pingTaskMap: ReadonlyMap<string, PublicPingTask>,
  t: ReturnType<typeof useTranslation>["t"],
) => {
  const tagLabel = formatTags(metricKey, tags, pingTaskMap, t);
  if (metricKey === PING_LATENCY_METRIC && tagLabel) return tagLabel;
  const metricLabel = getMetricLabel(metricKey, definitions);
  return tagLabel ? `${metricLabel} ${tagLabel}` : metricLabel;
};

const asMetricValue = (value: number | null | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
};

const formatValue = (value: unknown, kind: MetricKind) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  switch (kind) {
    case "percent":
      return `${value.toFixed(2)}%`;
    case "bytes":
      return formatBytes(value);
    case "bytesPerSecond":
      return `${formatBytes(value)}/s`;
    case "milliseconds":
      return `${Math.round(value)} ms`;
    default:
      return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
};

const getMetricKind = (metricKey: string, unit?: string): MetricKind => {
  const fallback = fallbackCatalogMap.get(metricKey);
  if (fallback) return fallback.kind;
  const normalizedUnit = (unit ?? "").toLowerCase();
  if (normalizedUnit === "%" || normalizedUnit === "percent") return "percent";
  if (normalizedUnit === "bytes") return "bytes";
  if (normalizedUnit === "bytes/s") return "bytesPerSecond";
  if (normalizedUnit === "ms") return "milliseconds";
  return "raw";
};

const getMetricLabel = (
  metricKey: string,
  definitions: Map<string, MetricDefinition>,
) => {
  const fallback = fallbackCatalogMap.get(metricKey);
  if (fallback) return fallback.label;
  const def = definitions.get(metricKey);
  return def?.description || def?.name || metricKey;
};

const chartSizeClass: Record<ChartSize, string> = {
  small: "lg:col-span-1",
  medium: "lg:col-span-2",
  large: "lg:col-span-3",
};

type Translate = ReturnType<typeof useTranslation>["t"];

const fixedChartTitle = (chart: DashboardChart, t: Translate) => {
  switch (chart.id) {
    case "memory":
      return t("nodeCard.ram");
    case "disk":
      return t("nodeCard.disk");
    case "network":
      return t("nodeCard.networkTraffic");
    case "ping":
      return t("nodeCard.ping");
    default:
      return chart.title;
  }
};

const fixedMetricLabel = (
  metricKey: string,
  fallback: string,
  t: Translate,
) => {
  switch (metricKey) {
    case "cpu.usage":
      return "CPU";
    case "memory.used":
      return t("chart.mem_used");
    case "swap.used":
      return t("chart.swap_used");
    case "disk.used":
      return t("nodeCard.disk");
    case "net.in.rate":
      return t("chart.downloadRate");
    case "net.out.rate":
      return t("chart.uploadRate");
    default:
      return fallback;
  }
};

const buildTimeViews = (
  t: ReturnType<typeof useTranslation>["t"],
  maxMetricRetentionDays: number,
): TimeView[] => {
  const views: TimeView[] = [
    { key: "real-time", label: t("common.real_time") },
    { key: "10m", label: t("chart.minutes", { count: 10 }), hours: 10 / 60 },
    { key: "1h", label: t("chart.hours", { count: 1 }), hours: 1 },
  ];
  const validRetentionDays =
    Number.isFinite(maxMetricRetentionDays) && maxMetricRetentionDays > 0
      ? maxMetricRetentionDays
      : 0;

  if (validRetentionDays >= 1) {
    views.push({ key: "1d", label: t("chart.days", { count: 1 }), hours: 24 });
  }
  if (validRetentionDays >= 7) {
    views.push({ key: "7d", label: t("chart.days", { count: 7 }), hours: 7 * 24 });
  }
  if (validRetentionDays > 0 && validRetentionDays !== 1 && validRetentionDays !== 7) {
    const retentionHours = validRetentionDays * 24;
    views.push({
      key: `retention-${retentionHours}`,
      label: Number.isInteger(validRetentionDays)
        ? t("chart.days", { count: validRetentionDays })
        : t("chart.hours", { count: retentionHours }),
      hours: retentionHours,
    });
  }

  views.push({ key: "custom", label: t("chart.customRange") });
  return views;
};

const toChartConfig = (series: RenderSeries[], t: Translate) => {
  const config: ChartConfig = {};
  for (const item of series) {
    config[item.dataKey] = {
      label: fixedMetricLabel(item.metricKey, item.label, t),
      color: item.color,
    };
  }
  return config;
};

const buildRowsFromMetricSeries = (
  metricSeries: MetricSeries[],
  chart: DashboardChart,
  definitions: Map<string, MetricDefinition>,
  pingTaskMap: ReadonlyMap<string, PublicPingTask>,
  t: ReturnType<typeof useTranslation>["t"],
) => {
  const rows = new Map<string, Record<string, string | number | null>>();
  const renderSeries: RenderSeries[] = [];

  metricSeries
    .filter((series) => chart.metrics.includes(series.metric_key))
    .forEach((series, index) => {
      const tags = metricTags(series);
      const stableKey = metricSeriesKey(series.metric_key, tags);
      const dataKey = metricSeriesDataKey(series.metric_key, tags);
      const label = formatSeriesLabel(series.metric_key, tags, definitions, pingTaskMap, t);
      const kind = getMetricKind(series.metric_key, series.unit);
      renderSeries.push({
        dataKey,
        stableKey,
        metricKey: series.metric_key,
        label,
        color: metricSeriesColor(index),
        kind,
        pointCount: (series.points ?? []).reduce(
          (count, point) => count + (typeof point.value === "number" ? 1 : 0),
          0,
        ),
        unit: series.unit,
        tags,
      });

      for (const point of series.points ?? []) {
        const timestamp = new Date(point.time).toISOString();
        const row = rows.get(timestamp) ?? { time: timestamp };
        row[dataKey] = asMetricValue(point.value);
        rows.set(timestamp, row);
      }
    });

  return {
    rows: Array.from(rows.values()).sort(
      (a, b) => new Date(String(a.time)).getTime() - new Date(String(b.time)).getTime(),
    ),
    series: renderSeries,
  };
};

const buildRowsFromRealtime = (
  records: RecordFormat[],
  chart: DashboardChart,
) => {
  const rows = new Map<string, Record<string, string | number | null>>();
  const renderSeries: RenderSeries[] = [];
  const seriesIndex = new Map<string, RenderSeries>();
  const recent = Array.isArray(records) ? records.slice(-MAX_REALTIME_POINTS) : [];

  for (const record of recent) {
    const time = record.time;
    if (!time) continue;
    const row = rows.get(time) ?? { time };

    for (const metricKey of chart.metrics) {
      const metric = fallbackCatalogMap.get(metricKey);
      if (!metric) continue;

      const key = `${metricKey}:`;
      let item = seriesIndex.get(key);
      if (!item) {
        const stableKey = metricSeriesKey(metricKey);
        item = {
          dataKey: metricSeriesDataKey(metricKey),
          stableKey,
          metricKey,
          label: metric.label,
          color: metricSeriesColor(renderSeries.length),
          kind: metric.kind,
          unit: metric.unit,
        };
        seriesIndex.set(key, item);
        renderSeries.push(item);
      }
      row[item.dataKey] = asMetricValue(metric.realtimeValue?.(record));
    }

    rows.set(time, row);
  }

  return {
    rows: Array.from(rows.values()).sort(
      (a, b) => new Date(String(a.time)).getTime() - new Date(String(b.time)).getTime(),
    ),
    series: renderSeries,
  };
};

const mergeBuiltChartData = (
  primary: BuiltChartData,
  supplemental: BuiltChartData,
): BuiltChartData => {
  const existingSeries = new Set(primary.series.map((series) => series.stableKey));
  const addedSeries = supplemental.series.filter(
    (series) => !existingSeries.has(series.stableKey),
  );
  if (addedSeries.length === 0) return primary;

  const addedDataKeys = new Set(addedSeries.map((series) => series.dataKey));
  const rows = new Map(primary.rows.map((row) => [String(row.time), { ...row }]));
  for (const row of supplemental.rows) {
    const time = String(row.time);
    const merged = rows.get(time) ?? { time };
    for (const dataKey of addedDataKeys) {
      if (dataKey in row) merged[dataKey] = row[dataKey];
    }
    rows.set(time, merged);
  }

  return {
    rows: Array.from(rows.values()).sort(
      (left, right) =>
        new Date(String(left.time)).getTime() - new Date(String(right.time)).getTime(),
    ),
    series: [...primary.series, ...addedSeries].map((series, index) => ({
      ...series,
      color: metricSeriesColor(index),
    })),
  };
};

const metricUnitKey = (series: RenderSeries) => {
  const unit = series.unit?.trim().toLowerCase();
  return unit ? `unit:${unit}` : `kind:${series.kind}`;
};

const prepareChartData = (
  built: BuiltChartData,
  metricOrder: string[],
  pingTaskMap: ReadonlyMap<string, PublicPingTask>,
): PreparedChartData => {
  const metricPositions = new Map(
    metricOrder.map((metricKey, index) => [metricKey, index]),
  );
  const orderedSeries = [...built.series].sort((left, right) => {
    const positionDelta =
      (metricPositions.get(left.metricKey) ?? Number.MAX_SAFE_INTEGER) -
      (metricPositions.get(right.metricKey) ?? Number.MAX_SAFE_INTEGER);
    if (positionDelta !== 0) return positionDelta;
    if (
      left.metricKey === right.metricKey &&
      isPingMetric(left.metricKey)
    ) {
      const taskOrder = comparePingTaskOrder(left.tags, right.tags, pingTaskMap);
      if (taskOrder !== 0) return taskOrder;
    }
    if (left.stableKey === right.stableKey) return 0;
    return left.stableKey < right.stableKey ? -1 : 1;
  });

  const unitAxes = new Map<string, "left" | "right">();
  const axes: ChartAxis[] = [];
  const series: RenderSeries[] = [];
  for (const item of orderedSeries) {
    const unitKey = metricUnitKey(item);
    let yAxisId = unitAxes.get(unitKey);
    if (!yAxisId) {
      if (unitAxes.size >= 2) continue;
      yAxisId = unitAxes.size === 0 ? "left" : "right";
      unitAxes.set(unitKey, yAxisId);
      axes.push({ id: yAxisId, kind: item.kind, orientation: yAxisId });
    }
    series.push({
      ...item,
      yAxisId,
      color: metricSeriesColor(series.length),
    });
  }

  const plottedDataKeys = new Set(series.map((item) => item.dataKey));
  const rows = built.rows.map((row) => {
    const plottedRow: MetricChartRow = { time: row.time };
    for (const dataKey of plottedDataKeys) {
      if (dataKey in row) plottedRow[dataKey] = row[dataKey];
    }
    return plottedRow;
  });

  return { rows, series, axes };
};

const labelFormatter = (hours: number | undefined) => {
  return (value: any) => {
    const date = new Date(value);
    if (!hours || hours < 24) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    }
    return date.toLocaleString([], {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
};

const getLatestText = (
  rows: Array<Record<string, string | number | null>>,
  series: RenderSeries[],
  t: Translate,
) => {
  for (let rowIndex = rows.length - 1; rowIndex >= 0; rowIndex--) {
    const row = rows[rowIndex];
    for (let seriesIndex = 0; seriesIndex < series.length; seriesIndex++) {
      const item = series[seriesIndex];
      const value = row[item.dataKey];
      if (typeof value === "number" && Number.isFinite(value)) {
        return `${fixedMetricLabel(item.metricKey, item.label, t)}: ${formatValue(value, item.kind)}`;
      }
    }
  }
  return "-";
};

const toDateTimeLocalValue = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const buildRecentRange = (days: number): CustomTimeRange => {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    start: toDateTimeLocalValue(start),
    end: toDateTimeLocalValue(end),
  };
};

const toQueryRange = (range: CustomTimeRange) => {
  const start = new Date(range.start);
  const end = new Date(range.end);
  if (
    !range.start ||
    !range.end ||
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    end <= start
  ) {
    return null;
  }
  return { start: start.toISOString(), end: end.toISOString() };
};

const LoadChart = ({ data = [], onRealtimeActiveChange }: LoadChartProps) => {
  const { t } = useTranslation();
  const { uuid } = useParams<{ uuid: string }>();
  const { call } = useRPC2Call();
  const { publicInfo } = usePublicInfo();
  const [definitions, setDefinitions] = useState<MetricDefinition[]>([]);
  const [definitionsLoaded, setDefinitionsLoaded] = useState(false);
  const maxMetricRetentionDays = useMemo(() => {
    if (!definitionsLoaded) return 0;
    const retentionDays = definitions
      .map((definition) => Number(definition.retention_days))
      .filter((days) => Number.isFinite(days) && days > 0);
    if (retentionDays.length > 0) return Math.max(...retentionDays);

    const fallback = Number(publicInfo?.metric_retention_days);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
  }, [definitions, definitionsLoaded, publicInfo?.metric_retention_days]);
  const timeViews = useMemo(
    () => buildTimeViews(t, maxMetricRetentionDays),
    [t, maxMetricRetentionDays],
  );
  const [viewKey, setViewKey] = useState("real-time");
  const selectedView = timeViews.find((view) => view.key === viewKey) ?? timeViews[0];
  const isRealtime = selectedView.key === "real-time";
  const isCustomRange = selectedView.key === "custom";
  const [customDraftRange, setCustomDraftRange] = useState<CustomTimeRange>(() =>
    buildRecentRange(CUSTOM_RANGE_DEFAULT_DAYS),
  );
  const [customQueryRange, setCustomQueryRange] = useState<CustomTimeRange>(() =>
    buildRecentRange(CUSTOM_RANGE_DEFAULT_DAYS),
  );
  const [customQueryRevision, setCustomQueryRevision] = useState(0);
  const [customRangeError, setCustomRangeError] = useState<string | null>(null);
  const [pingTasks, setPingTasks] = useState<PublicPingTask[]>([]);
  const [pingStats, setPingStats] = useState<PingMetricStat[]>([]);
  const [metricSeries, setMetricSeries] = useState<MetricSeries[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onRealtimeActiveChange?.(isRealtime);
  }, [isRealtime, onRealtimeActiveChange]);

  useEffect(() => {
    if (!timeViews.some((view) => view.key === viewKey)) {
      setViewKey(timeViews[0]?.key ?? "real-time");
    }
  }, [timeViews, viewKey]);

  useEffect(() => {
    let active = true;
    call<unknown, MetricDefinition[]>("public:listMetricDefinitions")
      .then((items) => {
        if (active) {
          setDefinitions(Array.isArray(items) ? items : []);
          setDefinitionsLoaded(true);
        }
      })
      .catch(() => {
        if (active) {
          setDefinitions([]);
          setDefinitionsLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, [call]);

  useEffect(() => {
    let active = true;
    call<unknown, PublicPingTask[]>("public:getPublicPingTasks")
      .then((items) => {
        if (active) setPingTasks(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (active) setPingTasks([]);
      });
    return () => {
      active = false;
    };
  }, [call]);

  const definitionMap = useMemo(
    () => new Map(definitions.map((item) => [item.name, item])),
    [definitions],
  );
  const pingTaskMap = useMemo(
    () => new Map(pingTasks.map((item) => [String(item.id), item])),
    [pingTasks],
  );

  const customQuery = useMemo(
    () => toQueryRange(customQueryRange),
    [customQueryRange],
  );
  const queryHours = isRealtime ? 1 : selectedView.hours;
  const queryRange = isCustomRange ? customQuery : null;
  const queryStart = queryRange?.start;
  const queryEnd = queryRange?.end;
  const queryRangeSignature =
    queryStart && queryEnd
      ? `${queryStart}|${queryEnd}|${customQueryRevision}`
      : "";
  const displayRangeHours =
    queryStart && queryEnd
      ? (new Date(queryEnd).getTime() - new Date(queryStart).getTime()) / 3_600_000
      : selectedView.hours;
  const metricRangeParams = useMemo<MetricRangeParams>(
    () =>
      queryRangeSignature
        ? { start: queryStart!, end: queryEnd! }
        : { hours: queryHours ?? 1 },
    [queryEnd, queryHours, queryRangeSignature, queryStart],
  );
  const metricKeys = useMemo(() => {
    const keys = DEFAULT_DASHBOARD.flatMap((chart) =>
      chart.metrics.filter((metricKey) => {
        if (!isRealtime) return true;
        const metric = fallbackCatalogMap.get(metricKey);
        return !metric?.realtimeValue;
      }),
    );
    return Array.from(new Set(keys)).sort();
  }, [isRealtime]);

  useEffect(() => {
    if (!uuid || metricKeys.length === 0) {
      setMetricSeries([]);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setMetricSeries([]);
    setLoading(true);
    setError(null);

    call<any, QueryMetricsResponse>(
      "public:queryMetrics",
      {
        metric_keys: metricKeys,
        entity_id: uuid,
        ...metricRangeParams,
        max_points: HISTORY_MAX_POINTS,
        aggregation: "avg",
        fill_empty: true,
      },
      { timeout: 30000 },
    )
      .then((result) => {
        if (!active) return;
        setMetricSeries(normalizeMetricSeriesList(result?.series));
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message || "Error");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [call, metricKeys, metricRangeParams, uuid]);

  useEffect(() => {
    if (!uuid || !metricKeys.some(isPingMetric)) {
      setPingStats([]);
      return;
    }

    let active = true;
    setPingStats([]);
    call<any, PingMetricStatsResponse>(
      "public:getPingMetricStats",
      {
        entity_id: uuid,
        ...metricRangeParams,
        max_points: HISTORY_MAX_POINTS,
      },
      { timeout: 30000 },
    )
      .then((result) => {
        if (!active) return;
        setPingStats(Array.isArray(result?.stats) ? result.stats : []);
      })
      .catch(() => {
        if (active) setPingStats([]);
      });

    return () => {
      active = false;
    };
  }, [
    call,
    metricKeys,
    metricRangeParams,
    uuid,
  ]);

  const pingStatsMap = useMemo(
    () => new Map(pingStats.map((stat) => [pingMetricStatKey(stat.entity_id, stat.task_id), stat])),
    [pingStats],
  );

  const selectRecentRange = (days: number) => {
    setCustomDraftRange(buildRecentRange(days));
    setCustomRangeError(null);
  };

  const applyCustomRange = () => {
    if (!toQueryRange(customDraftRange)) {
      setCustomRangeError(t("chart.invalidTimeRange"));
      return;
    }
    setCustomQueryRange(customDraftRange);
    setCustomQueryRevision((current) => current + 1);
    setCustomRangeError(null);
  };
  const customInputMax = toDateTimeLocalValue(new Date());

  return (
    <Flex direction="column" align="center" gap="4" className="km-load-chart w-full max-w-screen">
      <div className="w-full overflow-x-auto px-2">
        <div className="w-max mx-auto">
          <SegmentedControl.Root value={selectedView.key} onValueChange={setViewKey}>
            {timeViews.map((view) => (
              <SegmentedControl.Item key={view.key} value={view.key} className="capitalize">
                {view.label}
              </SegmentedControl.Item>
            ))}
          </SegmentedControl.Root>
        </div>
      </div>

      {isCustomRange && (
        <div className="w-full max-w-[1100px] px-2">
          <div className="flex flex-col gap-3 border-y border-accent-5 py-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex items-center gap-2 text-sm font-medium sm:self-center">
              <CalendarDays className="size-4 text-muted-foreground" />
              <span>{t("chart.customRange")}</span>
            </div>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground sm:min-w-56">
              <span>{t("chart.startTime")}</span>
              <TextField.Root
                type="datetime-local"
                value={customDraftRange.start}
                max={customInputMax}
                onChange={(event) => {
                  setCustomDraftRange((current) => ({
                    ...current,
                    start: event.target.value,
                  }));
                  setCustomRangeError(null);
                }}
                aria-label={t("chart.startTime")}
              />
            </label>
            <span className="hidden pb-2 text-muted-foreground sm:block">-</span>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground sm:min-w-56">
              <span>{t("chart.endTime")}</span>
              <TextField.Root
                type="datetime-local"
                value={customDraftRange.end}
                max={customInputMax}
                onChange={(event) => {
                  setCustomDraftRange((current) => ({
                    ...current,
                    end: event.target.value,
                  }));
                  setCustomRangeError(null);
                }}
                aria-label={t("chart.endTime")}
              />
            </label>
            <Select.Root
              value=""
              onValueChange={(value) => selectRecentRange(Number(value))}
            >
              <Select.Trigger
                placeholder={t("chart.quickRange")}
                aria-label={t("chart.quickRange")}
              />
              <Select.Content>
                <Select.Item value="1">{t("chart.recentDay")}</Select.Item>
                <Select.Item value="7">{t("chart.recentWeek")}</Select.Item>
                <Select.Item value="15">
                  {t("chart.recentDays", { count: 15 })}
                </Select.Item>
                <Select.Item value="30">
                  {t("chart.recentDays", { count: 30 })}
                </Select.Item>
              </Select.Content>
            </Select.Root>
            <Button type="button" size="sm" onClick={applyCustomRange}>
              <Search className="size-4" />
              {t("chart.query")}
            </Button>
          </div>
          {customRangeError && (
            <div className="pt-2 text-sm text-red-500">{customRangeError}</div>
          )}
        </div>
      )}

      {loading && (
        <div className="w-full text-center">
          <Loading />
        </div>
      )}
      {error && <div className="w-full text-center text-red-500">{error}</div>}

      <div className="km-load-chart-canvas grid w-full max-w-[1100px] grid-cols-1 gap-3 lg:grid-cols-3">
        {DEFAULT_DASHBOARD.map((chart) => {
          const metricBuilt = buildRowsFromMetricSeries(
            metricSeries,
            chart,
            definitionMap,
            pingTaskMap,
            t,
          );
          const rawBuilt = isRealtime
            ? mergeBuiltChartData(
                buildRowsFromRealtime(data, chart),
                metricBuilt,
              )
            : metricBuilt;
          const built = prepareChartData(rawBuilt, chart.metrics, pingTaskMap);
          const chartRows = trimMetricChartBoundaryRows(
            built.rows,
            built.series.map((item) => item.dataKey),
          );
          const chartTicks = metricChartBoundaryTicks(chartRows);
          const chartConfig = toChartConfig(built.series, t);
          const latestText = getLatestText(chartRows, built.series, t);

          return (
            <div key={chart.id} className={`min-w-0 ${chartSizeClass[chart.size]}`}>
              <Card className="flex h-full min-w-0 flex-col gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <ChartLine className="size-4 shrink-0 text-muted-foreground" />
                    <h2 className="truncate text-lg font-bold">
                      {fixedChartTitle(chart, t)}
                    </h2>
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {latestText}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {built.series.length > 0
                    ? built.series.map((item) => {
                        const label = fixedMetricLabel(item.metricKey, item.label, t);
                        const taskId = pingTaskId(item.tags);
                        const stat =
                          isPingMetric(item.metricKey) && uuid && taskId
                            ? pingStatsMap.get(pingMetricStatKey(uuid, taskId))
                            : undefined;
                        return (
                          <div
                            key={item.stableKey}
                            className="inline-flex max-w-full items-center gap-1 rounded-md bg-accent-3 px-2 py-1 text-xs text-accent-12"
                          >
                            <span
                              className="size-2 shrink-0 rounded-[2px]"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="truncate">{label}</span>
                            {stat && (
                              <Tips
                                mode="auto"
                                side="top"
                                className="shrink-0"
                                ariaLabel={`${label} ${t("common.details")}`}
                              >
                                <PingMetricStatContent stat={stat} t={t} />
                              </Tips>
                            )}
                          </div>
                        );
                      })
                    : chart.metrics.map((metricKey, index) => (
                        <span
                          key={metricKey}
                          className="inline-flex max-w-full items-center gap-1 rounded-md bg-accent-3 px-2 py-1 text-xs"
                        >
                          <span
                            className="size-2 shrink-0 rounded-[2px]"
                            style={{ backgroundColor: metricSeriesColor(index) }}
                          />
                          <span className="truncate">
                            {fixedMetricLabel(
                              metricKey,
                              getMetricLabel(metricKey, definitionMap),
                              t,
                            )}
                          </span>
                        </span>
                      ))}
                </div>

                {chartRows.length === 0 || built.series.length === 0 ? (
                  <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">
                    {t("common.none")}
                  </div>
                ) : (
                  <ChartContainer config={chartConfig} className="min-h-[220px] w-full">
                    <LineChart
                      data={chartRows}
                      accessibilityLayer
                      margin={{ top: 16, right: 8, bottom: 4, left: 8 }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="time"
                        tickLine={false}
                        axisLine={false}
                        ticks={chartTicks}
                        tick={<MetricBoundaryAxisTick boundaries={chartTicks} />}
                        interval={0}
                        height={32}
                        allowDuplicatedCategory={false}
                      />
                      {built.axes.map((axis) => (
                        <YAxis
                          key={axis.id}
                          yAxisId={axis.id}
                          tickLine={false}
                          axisLine={false}
                          domain={axis.kind === "percent" ? [0, 100] : undefined}
                          tickFormatter={(value) =>
                            formatValue(Number(value), axis.kind).replace(/ /g, "\u00a0")
                          }
                          orientation={axis.orientation}
                          type="number"
                          width={1}
                          mirror
                          tick={{ dx: axis.orientation === "left" ? 8 : -8 }}
                        />
                      ))}
                      <ChartTooltip
                        cursor={false}
                        formatter={(value, name) => {
                          const item = built.series.find(
                            (series) => series.dataKey === name,
                          );
                          return formatValue(value, item?.kind ?? "raw");
                        }}
                        content={
                          <ChartTooltipContent
                            labelFormatter={labelFormatter(displayRangeHours)}
                            indicator="dot"
                          />
                        }
                      />
                      {built.series.map((item) => (
                        <Line
                          key={item.dataKey}
                          dataKey={item.dataKey}
                          name={item.dataKey}
                          yAxisId={item.yAxisId}
                          stroke={item.color}
                          dot={item.pointCount !== undefined && item.pointCount <= 30}
                          isAnimationActive={false}
                          strokeWidth={2}
                          connectNulls={false}
                          type="linear"
                        />
                      ))}
                    </LineChart>
                  </ChartContainer>
                )}
              </Card>
            </div>
          );
        })}
      </div>
    </Flex>
  );
};

export default memo(LoadChart);
