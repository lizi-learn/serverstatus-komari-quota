import { useCallback, useMemo, useState } from "react";
import { Check, Copy, RadioTower, ShieldCheck } from "lucide-react";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import type { LiveData } from "@/types/LiveData";
import { formatCompactBytes } from "./format";
import { parseNodeMetadata } from "./nodeMetadata";
import { useMonthlyTraffic } from "./monthlyTraffic";
import {
  RELAY_ACTIVE_RATE,
  RELAY_FAST_RATE,
  relayTrafficState,
  type RelayTrafficState,
} from "./relayTraffic";

const SUBSCRIPTION_URL =
  "https://small.bismih520.com/v2rayn-23c0560dbaebf6e13340f95c821ba83942b16c0cd42dd4a2";
const MANAGER_URL = "https://sub.bismih520.com/";

type RelayStripProps = {
  nodes: NodeBasicInfo[];
  liveData: LiveData;
  chinese: boolean;
};

function speed(value: number) {
  return `${formatCompactBytes(Math.max(0, value))}/s`;
}

type TrafficSummary = {
  down: number;
  downRate: number;
  estimated: boolean;
  online: number;
  up: number;
  upRate: number;
};

function nodeMatches(node: NodeBasicInfo, patterns: RegExp[]) {
  const metadata = parseNodeMetadata(node.tags);
  const value = `${node.name} ${node.group} ${metadata.role ?? ""}`;
  return patterns.some((pattern) => pattern.test(value));
}

function summaryState(summary: TrafficSummary): RelayTrafficState {
  if (!summary.online) return "offline";
  const rate = summary.downRate + summary.upRate;
  if (rate >= RELAY_FAST_RATE) return "fast";
  if (rate >= RELAY_ACTIVE_RATE) return "active";
  return "idle";
}

export default function RelayStrip({ nodes, liveData, chinese }: RelayStripProps) {
  const [copied, setCopied] = useState(false);
  const monthlyTraffic = useMonthlyTraffic(nodes);
  const relayNodes = useMemo(
    () => nodes.filter((node) => parseNodeMetadata(node.tags).relay),
    [nodes],
  );
  const online = useMemo(() => new Set(liveData.online), [liveData.online]);
  const stats = useMemo(() => {
    let onlineCount = 0;
    let activeCount = 0;
    let totalDownRate = 0;
    let totalUpRate = 0;
    let fastestState: "idle" | "active" | "fast" = "idle";

    for (const node of relayNodes) {
      const isOnline = online.has(node.uuid);
      const record = liveData.data[node.uuid];
      const state = relayTrafficState(record, isOnline);
      if (isOnline) onlineCount += 1;
      if (state === "active" || state === "fast") activeCount += 1;
      if (state === "fast") fastestState = "fast";
      else if (state === "active" && fastestState === "idle") fastestState = "active";
      totalDownRate += record?.network.down ?? 0;
      totalUpRate += record?.network.up ?? 0;
    }

    return { activeCount, fastestState, onlineCount, totalDownRate, totalUpRate };
  }, [liveData.data, online, relayNodes]);

  const trafficSummary = useCallback((groupNodes: NodeBasicInfo[]): TrafficSummary => {
    let down = 0;
    let downRate = 0;
    let estimated = false;
    let onlineCount = 0;
    let up = 0;
    let upRate = 0;

    for (const node of groupNodes) {
      const record = liveData.data[node.uuid];
      const monthly = monthlyTraffic.usage[node.uuid];
      if (online.has(node.uuid)) onlineCount += 1;
      downRate += record?.network.down ?? 0;
      upRate += record?.network.up ?? 0;
      if (monthly?.hasData) {
        down += monthly.down;
        up += monthly.up;
        if (!monthly.complete) estimated = true;
      } else {
        down += record?.network.totalDown ?? 0;
        up += record?.network.totalUp ?? 0;
        estimated = true;
      }
    }

    return { down, downRate, estimated, online: onlineCount, up, upRate };
  }, [liveData.data, monthlyTraffic.usage, online]);

  const trafficGroups = useMemo(() => {
    const definitions = [
      { key: "all", labelZh: "全部机器", labelEn: "All nodes", nodes },
      { key: "relay", labelZh: "中转节点", labelEn: "Relays", nodes: relayNodes },
      {
        key: "ava",
        labelZh: "AVA 抗投诉",
        labelEn: "AVA DMCA",
        nodes: nodes.filter((node) => nodeMatches(node, [/ava/i, /dmca[- ]?resistant/i, /抗投诉/])),
      },
      {
        key: "dog",
        labelZh: "狗云入口",
        labelEn: "DogCloud edge",
        nodes: nodes.filter((node) => nodeMatches(node, [/dogcloud/i, /狗云/])),
      },
      {
        key: "breeze",
        labelZh: "Breeze 计算",
        labelEn: "Breeze compute",
        nodes: nodes.filter((node) => nodeMatches(node, [/breeze/i, /主计算/])),
      },
      {
        key: "hostdizire",
        labelZh: "HostDizire 存储",
        labelEn: "HostDizire storage",
        nodes: nodes.filter((node) => nodeMatches(node, [/hostdizire/i, /主存储/])),
      },
    ];

    return definitions
      .filter((group) => group.nodes.length > 0)
      .map((group) => ({ ...group, summary: trafficSummary(group.nodes) }));
  }, [nodes, relayNodes, trafficSummary]);

  if (!relayNodes.length) return null;

  const copySubscription = async () => {
    try {
      await navigator.clipboard.writeText(SUBSCRIPTION_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section
      id="relays"
      className={`ss-relay-strip is-${stats.fastestState}`}
      aria-label={chinese ? "v2rayN 订阅与实时状态" : "v2rayN subscription and live status"}
    >
      <div className="ss-relay-strip__identity">
        <span className="ss-relay-strip__icon" aria-hidden="true"><RadioTower /></span>
        <span>
          <strong>{chinese ? "v2rayN 订阅" : "v2rayN subscription"}</strong>
          <small>
            {chinese
              ? "状态自动更新；蓝色表示整机正在传输"
              : "Updates automatically; blue means host traffic is active"}
          </small>
        </span>
      </div>

      <div className="ss-relay-strip__stats">
        <span>
          <small>{chinese ? "在线" : "Online"}</small>
          <b>{stats.onlineCount}/{relayNodes.length}</b>
        </span>
        <span>
          <small>{chinese ? "传输中" : "Active"}</small>
          <b>{stats.activeCount}</b>
        </span>
        <span>
          <small>{chinese ? "实时下载" : "Live down"}</small>
          <b>↓ {speed(stats.totalDownRate)}</b>
        </span>
        <span>
          <small>{chinese ? "实时上传" : "Live up"}</small>
          <b>↑ {speed(stats.totalUpRate)}</b>
        </span>
      </div>

      <div className="ss-relay-strip__actions">
        <button type="button" onClick={() => void copySubscription()}>
          {copied ? <Check /> : <Copy />}
          {copied
            ? chinese ? "已复制" : "Copied"
            : chinese ? "复制 v2rayN 订阅" : "Copy for v2rayN"}
        </button>
        <a href={MANAGER_URL} target="_blank" rel="noreferrer">
          <ShieldCheck /> {chinese ? "管理" : "Manage"}
        </a>
      </div>

      <div className="ss-relay-strip__totals" aria-label={chinese ? "资源池流量汇总" : "Fleet traffic totals"}>
        {trafficGroups.map((group) => {
          const state = summaryState(group.summary);
          return (
            <span className={`ss-relay-total is-${state}`} key={group.key}>
              <small>
                {chinese ? group.labelZh : group.labelEn}
                {group.summary.estimated ? " ~" : ""}
              </small>
              <b>
                ↓ {formatCompactBytes(group.summary.down)} · ↑ {formatCompactBytes(group.summary.up)}
              </b>
              <em>
                {chinese ? "实时" : "Live"} ↓ {speed(group.summary.downRate)} · ↑ {speed(group.summary.upRate)}
              </em>
            </span>
          );
        })}
      </div>
      <small className="ss-relay-strip__footnote">
        {chinese
          ? "累计优先取本账期；~ 表示含本次开机计数或监控接入后的部分账期。"
          : "Totals prefer the current billing cycle; ~ includes boot counters or a partial monitored cycle."}
      </small>
    </section>
  );
}
