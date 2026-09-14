import { useMemo, useState } from "react";
import { Check, Copy, RadioTower, ShieldCheck } from "lucide-react";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import type { LiveData } from "@/types/LiveData";
import { formatCompactBytes } from "./format";
import { parseNodeMetadata } from "./nodeMetadata";
import { relayTrafficState } from "./relayTraffic";

const SUBSCRIPTION_URL = "https://sub.bismih520.com/ynfjsjY9Y";
const MANAGER_URL = "https://sub.bismih520.com/";

type RelayStripProps = {
  nodes: NodeBasicInfo[];
  liveData: LiveData;
  chinese: boolean;
};

function speed(value: number) {
  return `${formatCompactBytes(Math.max(0, value))}/s`;
}

export default function RelayStrip({ nodes, liveData, chinese }: RelayStripProps) {
  const [copied, setCopied] = useState(false);
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
      aria-label={chinese ? "中转订阅与实时状态" : "Relay subscription and live status"}
    >
      <div className="ss-relay-strip__identity">
        <span className="ss-relay-strip__icon" aria-hidden="true"><RadioTower /></span>
        <span>
          <strong>{chinese ? "中转订阅" : "Relay subscription"}</strong>
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
            : chinese ? "复制订阅" : "Copy"}
        </button>
        <a href={MANAGER_URL} target="_blank" rel="noreferrer">
          <ShieldCheck /> {chinese ? "管理" : "Manage"}
        </a>
      </div>
    </section>
  );
}
