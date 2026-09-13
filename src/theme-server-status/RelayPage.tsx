import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Gauge,
  LayoutGrid,
  RadioTower,
  Rows3,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Loading from "@/components/loading";
import { useLiveData } from "@/contexts/LiveDataContext";
import {
  useNodeList,
  type NodeBasicInfo,
} from "@/contexts/NodeListContext";
import type { Record as LiveRecord } from "@/types/LiveData";
import { formatCompactBytes, formatPercent, percent } from "./format";
import { useMonthlyTraffic, type MonthlyTrafficUsage } from "./monthlyTraffic";
import { formatDateOnly, formatMbps, parseNodeMetadata } from "./nodeMetadata";
import { billingCycleRange, trafficValue } from "./trafficCycle";

const SUBSCRIPTION_URL = "https://sub.bismih520.com/ynfjsjY9Y";
const MANAGER_URL = "https://sub.bismih520.com/";
const ACTIVE_RATE = 128 * 1024;
const FAST_RATE = 1024 * 1024;
const RESOURCE_HIGH = 75;

type ViewMode = "cards" | "list";
type PulseState =
  | "calm"
  | "active"
  | "network"
  | "resource"
  | "combined"
  | "offline";

function initialView(): ViewMode {
  try {
    return window.localStorage.getItem("komari-relay-view") === "list"
      ? "list"
      : "cards";
  } catch {
    return "cards";
  }
}

function setStoredView(view: ViewMode) {
  try {
    window.localStorage.setItem("komari-relay-view", view);
  } catch {
    // A blocked storage API should not affect monitoring.
  }
}

function speed(value: number) {
  return `${formatCompactBytes(Math.max(0, value))}/s`;
}

function relayState(
  node: NodeBasicInfo,
  record: LiveRecord | undefined,
  online: boolean,
): PulseState {
  if (!online) return "offline";
  const cpu = record?.cpu.usage ?? 0;
  const memory = percent(record?.ram.used ?? 0, node.mem_total);
  const resourceHigh = Math.max(cpu, memory) >= RESOURCE_HIGH;
  const rate = (record?.network.down ?? 0) + (record?.network.up ?? 0);
  const networkHigh = rate >= FAST_RATE;
  if (resourceHigh && networkHigh) return "combined";
  if (resourceHigh) return "resource";
  if (networkHigh) return "network";
  if (rate >= ACTIVE_RATE) return "active";
  return "calm";
}

function stateText(state: PulseState, chinese: boolean) {
  const labels = chinese
    ? {
        calm: "在线",
        active: "传输中",
        network: "高速传输",
        resource: "资源繁忙",
        combined: "双高负载",
        offline: "离线",
      }
    : {
        calm: "Online",
        active: "Transferring",
        network: "High throughput",
        resource: "Resource busy",
        combined: "Dual pressure",
        offline: "Offline",
      };
  return labels[state];
}

function quotaSnapshot(
  node: NodeBasicInfo,
  monthly: MonthlyTrafficUsage | undefined,
) {
  const limit = Number(node.traffic_limit) || 0;
  const metadata = parseNodeMetadata(node.tags);
  const hasMonthly = Boolean(metadata.trafficResetDay && monthly?.hasData);
  const down = hasMonthly ? monthly?.down ?? 0 : 0;
  const up = hasMonthly ? monthly?.up ?? 0 : 0;
  if (limit <= 0) {
    return {
      down,
      up,
      remaining: 100,
      label: "∞",
      unlimited: true,
      complete: monthly?.complete ?? false,
    };
  }
  const used = trafficValue(node.traffic_limit_type, down, up);
  const remaining = Math.max(0, 100 - percent(used, limit));
  return {
    down,
    up,
    remaining,
    label: `${formatPercent(remaining)}%`,
    unlimited: false,
    complete: monthly?.complete ?? false,
  };
}

function Wave() {
  return (
    <span className="ss-relay-wave" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}

function RelayCard({
  node,
  record,
  online,
  chinese,
  monthly,
  compact,
}: {
  node: NodeBasicInfo;
  record?: LiveRecord;
  online: boolean;
  chinese: boolean;
  monthly?: MonthlyTrafficUsage;
  compact: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const metadata = parseNodeMetadata(node.tags);
  const state = relayState(node, record, online);
  const cpu = record?.cpu.usage ?? 0;
  const memory = percent(record?.ram.used ?? 0, node.mem_total);
  const totalRate = (record?.network.down ?? 0) + (record?.network.up ?? 0);
  const quota = quotaSnapshot(node, monthly);
  const reset = metadata.trafficResetDay
    ? billingCycleRange(metadata.trafficResetDay).nextReset.toISOString()
    : undefined;
  const showDetails = !compact || expanded;

  return (
    <article className={`ss-relay-card is-${state} ${compact ? "is-compact" : ""}`}>
      <span className="ss-relay-scan" aria-hidden="true" />
      <header className="ss-relay-card__head">
        <div className="ss-relay-title">
          <span className="ss-relay-status-dot" aria-hidden="true" />
          <div>
            <h2>{node.name}</h2>
            <p>
              {formatMbps(metadata.bandwidthDownMbps)}bps ↓ · {formatMbps(metadata.bandwidthUpMbps)}bps ↑ · 5 {chinese ? "协议" : "protocols"}
            </p>
          </div>
        </div>
        <span className="ss-relay-state" data-state={state}>
          <Wave />
          {stateText(state, chinese)}
        </span>
      </header>

      <div
        className="ss-relay-live"
        aria-label={chinese ? "实时网速" : "Live throughput"}
      >
        <span>
          <small>{chinese ? "实时下载" : "Download"}</small>
          <strong className="is-down">↓ {speed(record?.network.down ?? 0)}</strong>
        </span>
        <span>
          <small>{chinese ? "实时上传" : "Upload"}</small>
          <strong className="is-up">↑ {speed(record?.network.up ?? 0)}</strong>
        </span>
        <span className="ss-relay-total-rate">
          <small>{chinese ? "合计" : "Total"}</small>
          <strong>{speed(totalRate)}</strong>
        </span>
      </div>

      <div className="ss-relay-health">
        <span>
          <small>CPU</small>
          <b>{formatPercent(cpu)}%</b>
          <i><em style={{ transform: `scaleX(${Math.min(100, cpu) / 100})` }} /></i>
        </span>
        <span>
          <small>RAM</small>
          <b>{formatPercent(memory)}%</b>
          <i><em style={{ transform: `scaleX(${Math.min(100, memory) / 100})` }} /></i>
        </span>
      </div>

      {showDetails && (
        <div className="ss-relay-details">
          <div className="ss-relay-traffic">
            <span>
              <small>{chinese ? "本期下载" : "Cycle download"}</small>
              <b>{quota.complete ? "" : "~"}{formatCompactBytes(quota.down)}</b>
            </span>
            <span>
              <small>{chinese ? "本期上传" : "Cycle upload"}</small>
              <b>{quota.complete ? "" : "~"}{formatCompactBytes(quota.up)}</b>
            </span>
            <span>
              <small>{chinese ? "额度剩余" : "Quota remaining"}</small>
              <b>{quota.label}</b>
            </span>
          </div>
          <div className={`ss-relay-quota ${quota.unlimited ? "is-unlimited" : ""}`}>
            <i style={{ transform: `scaleX(${quota.remaining / 100})` }} />
          </div>
          <div className="ss-relay-meta">
            <span>
              {quota.unlimited
                ? chinese ? "无限流量" : "Unmetered"
                : `${formatCompactBytes(Number(node.traffic_limit) || 0)} ${chinese ? "月额度" : "monthly"}`}
            </span>
            <span>
              {reset
                ? `${chinese ? "下次重置" : "Next reset"} ${formatDateOnly(reset)}`
                : chinese ? "未设置流量周期" : "No traffic cycle"}
            </span>
          </div>
        </div>
      )}

      {compact && (
        <button
          className="ss-relay-expand"
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded
            ? chinese ? "收起" : "Collapse"
            : chinese ? "展开详情" : "Expand"}
        </button>
      )}
    </article>
  );
}

export default function RelayPage() {
  const { i18n } = useTranslation();
  const chinese = i18n.resolvedLanguage?.toLowerCase().startsWith("zh") ?? false;
  const { nodeList, isLoading, error } = useNodeList();
  const { live_data, connectionStatus } = useLiveData();
  const [view, setView] = useState<ViewMode>(initialView);
  const [copied, setCopied] = useState(false);
  const nodes = useMemo(
    () =>
      (nodeList ?? [])
        .filter((node) => parseNodeMetadata(node.tags).relay)
        .sort((left, right) => (left.weight || 0) - (right.weight || 0)),
    [nodeList],
  );
  const monthly = useMonthlyTraffic(nodes);
  const online = useMemo(
    () => new Set(live_data?.data.online ?? []),
    [live_data],
  );
  const stats = useMemo(() => {
    let totalRate = 0;
    let active = 0;
    let busy = 0;
    let onlineCount = 0;
    for (const node of nodes) {
      const record = live_data?.data.data[node.uuid];
      const isOnline = online.has(node.uuid);
      const state = relayState(node, record, isOnline);
      if (isOnline) onlineCount += 1;
      totalRate += (record?.network.down ?? 0) + (record?.network.up ?? 0);
      if (state === "active" || state === "network" || state === "combined") {
        active += 1;
      }
      if (state === "resource" || state === "combined") busy += 1;
    }
    return { totalRate, active, busy, onlineCount };
  }, [live_data, nodes, online]);

  const chooseView = (next: ViewMode) => {
    setView(next);
    setStoredView(next);
  };
  const copySubscription = async () => {
    await navigator.clipboard.writeText(SUBSCRIPTION_URL);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  if (isLoading) return <Loading />;

  return (
    <div className="ss-page ss-relay-page">
      <section className="ss-relay-hero">
        <div>
          <span className="ss-relay-eyebrow">
            <RadioTower /> SING-BOX RELAY FABRIC
          </span>
          <h1>{chinese ? "中转订阅中心" : "Relay subscription center"}</h1>
          <p>
            {chinese
              ? "秒级读取 Komari 实时数据；节点地址不会显示在页面中。"
              : "Second-level Komari telemetry without exposing node addresses."}
          </p>
        </div>
        <div className="ss-relay-actions">
          <button
            type="button"
            className="ss-relay-copy"
            onClick={() => void copySubscription()}
          >
            {copied ? <Check /> : <Copy />}
            {copied
              ? chinese ? "已复制" : "Copied"
              : chinese ? "复制订阅" : "Copy subscription"}
          </button>
          <a
            className="ss-relay-manage"
            href={MANAGER_URL}
            target="_blank"
            rel="noreferrer"
          >
            <ShieldCheck /> {chinese ? "管理订阅" : "Manage"}
          </a>
        </div>
      </section>

      <section
        className="ss-relay-summary"
        aria-label={chinese ? "中转概况" : "Relay summary"}
      >
        <span><small>{chinese ? "在线节点" : "Online"}</small><b>{stats.onlineCount}/{nodes.length}</b></span>
        <span><small>{chinese ? "正在传输" : "Active"}</small><b>{stats.active}</b></span>
        <span><small>{chinese ? "实时总速率" : "Live total"}</small><b>{speed(stats.totalRate)}</b></span>
        <span><small>{chinese ? "资源繁忙" : "Resource busy"}</small><b>{stats.busy}</b></span>
        <span><small>{chinese ? "订阅线路" : "Subscription lines"}</small><b>{nodes.length * 5}</b></span>
      </section>

      <section className="ss-relay-toolbar">
        <div className="ss-relay-legend">
          <span className="is-red" />{chinese ? "资源高" : "Resource"}
          <span className="is-blue" />{chinese ? "网速快" : "Throughput"}
          <span className="is-purple" />{chinese ? "两者都高" : "Both"}
        </div>
        <div
          className="ss-relay-view"
          role="group"
          aria-label={chinese ? "显示方式" : "View mode"}
        >
          <button
            type="button"
            className={view === "cards" ? "is-active" : ""}
            aria-pressed={view === "cards"}
            onClick={() => chooseView("cards")}
          >
            <LayoutGrid />{chinese ? "卡片" : "Cards"}
          </button>
          <button
            type="button"
            className={view === "list" ? "is-active" : ""}
            aria-pressed={view === "list"}
            onClick={() => chooseView("list")}
          >
            <Rows3 />{chinese ? "列表" : "List"}
          </button>
        </div>
      </section>

      {(error || connectionStatus === "error") && (
        <div className="ss-notice" role="alert">
          {chinese
            ? "部分实时数据暂不可用，系统正在自动重连。"
            : "Some live data is unavailable. Reconnecting automatically."}
        </div>
      )}

      {nodes.length ? (
        <div className={`ss-relay-grid is-${view}`}>
          {nodes.map((node) => (
            <RelayCard
              key={node.uuid}
              node={node}
              record={live_data?.data.data[node.uuid]}
              online={online.has(node.uuid)}
              chinese={chinese}
              monthly={monthly.usage[node.uuid]}
              compact={view === "list"}
            />
          ))}
        </div>
      ) : (
        <section className="ss-panel ss-empty">
          <Gauge /> {chinese ? "暂无标记为中转的节点" : "No relay nodes are tagged"}
        </section>
      )}

      <p className="ss-relay-footnote">
        {chinese
          ? `状态阈值：CPU 或 RAM ≥ ${RESOURCE_HIGH}% 显示红色；实时上下行合计 ≥ 1 MiB/s 显示蓝色；两者同时满足显示紫色。页面自动更新，没有刷新按钮。`
          : `Thresholds: CPU or RAM ≥ ${RESOURCE_HIGH}% is red; combined live throughput ≥ 1 MiB/s is blue; both is purple. Updates are automatic.`}
        {" "}<Link to="/">{chinese ? "返回全部节点" : "All nodes"}</Link>
      </p>
    </div>
  );
}
