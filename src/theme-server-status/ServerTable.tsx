import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { NodeBasicInfo } from "@/contexts/NodeListContext";
import type { LiveData, Record as LiveRecord } from "@/types/LiveData";
import { getOSInfo, setOSImageFallback } from "@/utils/osImageHelper";
import {
  countryCode,
  formatCompactBytes,
  formatDate,
  formatPercent,
  formatUptime,
  percent,
  progressTone,
} from "./format";

type ServerTableProps = {
  nodes: NodeBasicInfo[];
  liveData: LiveData;
  grouped: boolean;
  chinese: boolean;
};

const TEXT = {
  zh: {
    status: "状态",
    name: "名称",
    platform: "系统",
    location: "位置",
    uptime: "在线",
    load: "负载",
    speed: "网速↓|↑",
    traffic: "流量↓|↑",
    quota: "额度",
    unlimited: "不限流量",
    cpu: "核心",
    memory: "内存",
    disk: "硬盘",
    defaultGroup: "默认",
    system: "系统",
    swap: "交换",
    processes: "进程数",
    connections: "连接数",
    boot: "启动",
    active: "活动",
    version: "版本",
    charts: "查看监控图表",
  },
  en: {
    status: "Status",
    name: "Name",
    platform: "Platform",
    location: "Location",
    uptime: "Uptime",
    load: "Load",
    speed: "NetSpeed ↓|↑",
    traffic: "NetTransfer ↓|↑",
    quota: "Quota",
    unlimited: "Unlimited",
    cpu: "CPU",
    memory: "Memory",
    disk: "Disk",
    defaultGroup: "Default",
    system: "System",
    swap: "Swap",
    processes: "Processes",
    connections: "Connections",
    boot: "Boot",
    active: "Last active",
    version: "Version",
    charts: "View monitoring charts",
  },
} as const;

const FLAG_CODE_ALIASES: Record<string, string> = {
  AC: "sh-ac",
  EA: "es",
  TA: "sh-ta",
};

function sortNodes(nodes: NodeBasicInfo[]) {
  return nodes
    .map((node, index) => ({ node, index }))
    .sort(
      (left, right) =>
        (left.node.weight || 0) - (right.node.weight || 0) ||
        left.index - right.index,
    )
    .map(({ node }) => node);
}

function ProgressBar({ value, online }: { value: number; online: boolean }) {
  const safeValue = Math.min(100, Math.max(0, Number(value) || 0));
  return (
    <div
      className={`ss-progress ${online ? "" : "is-offline"}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={online ? safeValue : undefined}
    >
      <span
        className={`ss-progress-bar is-${progressTone(safeValue, online)}`}
        style={{ transform: `scaleX(${safeValue / 100})` }}
        aria-hidden="true"
      />
      <small className="ss-progress-label">{formatPercent(safeValue)}%</small>
    </div>
  );
}

function trafficUsed(node: NodeBasicInfo, record?: LiveRecord): number {
  const up = record?.network.totalUp ?? 0;
  const down = record?.network.totalDown ?? 0;

  switch (node.traffic_limit_type) {
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

function TrafficQuota({
  node,
  record,
  online,
  chinese,
}: {
  node: NodeBasicInfo;
  record?: LiveRecord;
  online: boolean;
  chinese: boolean;
}) {
  const limit = Number(node.traffic_limit) || 0;
  if (limit <= 0) {
    return (
      <span className="ss-quota-unlimited" title={chinese ? "不限流量" : "Unlimited traffic"}>
        ∞
      </span>
    );
  }

  const used = trafficUsed(node, record);
  const value = percent(used, limit);
  const detail = `${formatCompactBytes(used)} / ${formatCompactBytes(limit)} (${formatPercent(value)}%)`;

  return (
    <span className="ss-quota-progress" title={detail} aria-label={detail}>
      <ProgressBar value={value} online={online} />
    </span>
  );
}

function Region({ value, online }: { value: string; online: boolean }) {
  const code = countryCode(value);
  const flagCode = FLAG_CODE_ALIASES[code] ?? code.toLowerCase();
  return (
    <span className={`ss-region ${online ? "" : "is-offline"}`}>
      <img
        src={`/assets/flags-4x3/${flagCode}.svg`}
        alt=""
        onError={(event) => {
          event.currentTarget.onerror = null;
          event.currentTarget.src = "/assets/flags-4x3/xx.svg";
        }}
      />
      <span>{online ? code : ""}</span>
    </span>
  );
}

function DetailLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="ss-detail-line">
      <strong>{label}:</strong> {children}
    </span>
  );
}

function NodeDetails({
  node,
  record,
  online,
  chinese,
}: {
  node: NodeBasicInfo;
  record?: LiveRecord;
  online: boolean;
  chinese: boolean;
}) {
  const labels = chinese ? TEXT.zh : TEXT.en;
  const cpu = record?.cpu.usage ?? 0;
  const memory = percent(record?.ram.used ?? 0, node.mem_total);
  const swap = percent(record?.swap.used ?? 0, node.swap_total);
  const disk = percent(record?.disk.used ?? 0, node.disk_total);
  const uptime = record?.uptime ?? 0;
  const bootTime = uptime > 0 ? Date.now() - uptime * 1000 : undefined;
  const trafficLimit = Number(node.traffic_limit) || 0;
  const trafficUsedBytes = trafficUsed(node, record);
  const trafficPercent = percent(trafficUsedBytes, trafficLimit);

  return (
    <div className="ss-node-details">
      <DetailLine label={labels.system}>
        {node.os || "-"} [{node.virtualization ? `${node.virtualization}:` : ""}
        {node.arch || "-"}]
      </DetailLine>
      <DetailLine label="CPU">
        {node.cpu_name || "-"} ({formatPercent(cpu)}%)
      </DetailLine>
      <DetailLine label={labels.disk}>
        {formatCompactBytes(record?.disk.used ?? 0)} / {formatCompactBytes(node.disk_total)} ({formatPercent(disk)}%)
      </DetailLine>
      <DetailLine label={labels.memory}>
        {formatCompactBytes(record?.ram.used ?? 0)} / {formatCompactBytes(node.mem_total)} ({formatPercent(memory)}%)
      </DetailLine>
      <DetailLine label={labels.swap}>
        {node.swap_total > 0
          ? `${formatCompactBytes(record?.swap.used ?? 0)} / ${formatCompactBytes(node.swap_total)} (${formatPercent(swap)}%)`
          : "OFF"}
      </DetailLine>
      <DetailLine label={labels.traffic}>
        IN {formatCompactBytes(record?.network.totalDown ?? 0)} / OUT {formatCompactBytes(record?.network.totalUp ?? 0)}
      </DetailLine>
      <DetailLine label={labels.quota}>
        {trafficLimit > 0
          ? `${formatCompactBytes(trafficUsedBytes)} / ${formatCompactBytes(trafficLimit)} (${formatPercent(trafficPercent)}%)`
          : labels.unlimited}
      </DetailLine>
      <DetailLine label={labels.load}>
        {(record?.load.load1 ?? 0).toFixed(2)} / {(record?.load.load5 ?? 0).toFixed(2)} / {(record?.load.load15 ?? 0).toFixed(2)}
      </DetailLine>
      <DetailLine label={labels.processes}>{record?.process ?? 0}</DetailLine>
      <DetailLine label={labels.connections}>
        TCP {record?.connections.tcp ?? 0} / UDP {record?.connections.udp ?? 0}
      </DetailLine>
      <DetailLine label={labels.boot}>{formatDate(bootTime, chinese)}</DetailLine>
      <DetailLine label={labels.active}>{formatDate(record?.updated_at, chinese)}</DetailLine>
      <DetailLine label={labels.uptime}>
        {online ? formatUptime(uptime, chinese) : "-"}
      </DetailLine>
      {node.version && <DetailLine label={labels.version}>{node.version}</DetailLine>}
      {node.public_remark && <span className="ss-public-remark">{node.public_remark}</span>}
      <Link className="ss-detail-link" to={`/instance/${node.uuid}`}>
        {labels.charts}
      </Link>
    </div>
  );
}

function GroupTable({
  title,
  nodes,
  liveData,
  chinese,
}: {
  title?: string;
  nodes: NodeBasicInfo[];
  liveData: LiveData;
  chinese: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const labels = chinese ? TEXT.zh : TEXT.en;
  const onlineSet = useMemo(() => new Set(liveData.online), [liveData.online]);
  const columns = 12;

  const toggle = (uuid: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  return (
    <section className="ss-panel km-server-status-panel">
      {title !== undefined && (
        <h2 className="ss-panel__title">{title || labels.defaultGroup}</h2>
      )}
      <div className="ss-table-scroll">
        <table className="ss-table">
          <thead>
            <tr>
              <th className="ss-col-status">{labels.status}</th>
              <th className="ss-col-name">{labels.name}</th>
              <th className="ss-col-os">{labels.platform}</th>
              <th className="ss-col-location">{labels.location}</th>
              <th className="ss-col-uptime">{labels.uptime}</th>
              <th className="ss-col-load">{labels.load}</th>
              <th className="ss-col-network">{labels.speed}</th>
              <th className="ss-col-traffic">{labels.traffic}</th>
              <th className="ss-col-usage ss-col-quota">{labels.quota}</th>
              <th className="ss-col-usage">{labels.cpu}</th>
              <th className="ss-col-usage">{labels.memory}</th>
              <th className="ss-col-usage">{labels.disk}</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((node, index) => {
              const record = liveData.data[node.uuid];
              const online = onlineSet.has(node.uuid);
              const cpu = record?.cpu.usage ?? 0;
              const memory = percent(record?.ram.used ?? 0, node.mem_total);
              const disk = percent(record?.disk.used ?? 0, node.disk_total);
              const isExpanded = expanded.has(node.uuid);

              return (
                <FragmentRow
                  key={node.uuid}
                  node={node}
                  record={record}
                  online={online}
                  chinese={chinese}
                  index={index}
                  cpu={cpu}
                  memory={memory}
                  disk={disk}
                  columns={columns}
                  isExpanded={isExpanded}
                  onToggle={() => toggle(node.uuid)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FragmentRow({
  node,
  record,
  online,
  chinese,
  index,
  cpu,
  memory,
  disk,
  columns,
  isExpanded,
  onToggle,
}: {
  node: NodeBasicInfo;
  record?: LiveRecord;
  online: boolean;
  chinese: boolean;
  index: number;
  cpu: number;
  memory: number;
  disk: number;
  columns: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const load = record?.load.load1 ?? 0;
  const osInfo = useMemo(() => getOSInfo(node.os), [node.os]);
  const labels = chinese ? TEXT.zh : TEXT.en;

  return (
    <>
      <tr
        className={`ss-node-row ${index % 2 ? "is-even" : "is-odd"}`}
        aria-expanded={isExpanded}
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggle();
          }
        }}
      >
        <td className="ss-col-status">
          <span className={`ss-status-dot ${online ? "is-online" : "is-offline"}`} />
        </td>
        <td className="ss-col-name">{node.name}</td>
        <td className="ss-col-os">
          <span className="ss-os">
            <img
              src={osInfo.image}
              alt=""
              data-os-icon={osInfo.id}
              data-dark-mode={osInfo.darkMode}
              onError={(event) => setOSImageFallback(event.currentTarget)}
            />
            {osInfo.name}
          </span>
        </td>
        <td className="ss-col-location"><Region value={node.region} online={online} /></td>
        <td className="ss-col-uptime">
          {online ? formatUptime(record?.uptime ?? 0, chinese) : "-"}
        </td>
        <td className="ss-col-load ss-load-value" data-mobile-label={labels.load}>
          {online ? load.toFixed(2) : "-"}
        </td>
        <td className="ss-col-network" data-mobile-label={labels.speed}>
          {online
            ? `${formatCompactBytes(record?.network.down ?? 0)} | ${formatCompactBytes(record?.network.up ?? 0)}`
            : "- | -"}
        </td>
        <td className="ss-col-traffic">
          {record
            ? `${formatCompactBytes(record.network.totalDown)} | ${formatCompactBytes(record.network.totalUp)}`
            : "- | -"}
        </td>
        <td className="ss-col-usage ss-col-quota" data-mobile-label={labels.quota}>
          <TrafficQuota node={node} record={record} online={online} chinese={chinese} />
        </td>
        <td className="ss-col-usage ss-col-cpu" data-mobile-label={labels.cpu}>
          <ProgressBar value={cpu} online={online} />
        </td>
        <td className="ss-col-usage ss-col-memory" data-mobile-label={labels.memory}>
          <ProgressBar value={memory} online={online} />
        </td>
        <td className="ss-col-usage ss-col-disk" data-mobile-label={labels.disk}>
          <ProgressBar value={disk} online={online} />
        </td>
      </tr>
      {isExpanded && (
        <tr className={`ss-expand-row ${index % 2 ? "is-even" : "is-odd"}`}>
          <td colSpan={columns}>
            <NodeDetails node={node} record={record} online={online} chinese={chinese} />
          </td>
        </tr>
      )}
    </>
  );
}

export default function ServerTable({ nodes, liveData, grouped, chinese }: ServerTableProps) {
  const sortedNodes = useMemo(() => sortNodes(nodes), [nodes]);
  const groups = useMemo(() => {
    if (!grouped) return [{ name: undefined, nodes: sortedNodes }];
    const result = new Map<string, NodeBasicInfo[]>();
    for (const node of sortedNodes) {
      const name = node.group?.trim() || "";
      const list = result.get(name) ?? [];
      list.push(node);
      result.set(name, list);
    }
    return Array.from(result, ([name, groupNodes]) => ({ name, nodes: groupNodes }));
  }, [grouped, sortedNodes]);

  return (
    <div className="ss-server-groups km-page-index">
      {groups.map((group) => (
        <GroupTable
          key={group.name ?? "all"}
          title={group.name}
          nodes={group.nodes}
          liveData={liveData}
          chinese={chinese}
        />
      ))}
    </div>
  );
}
