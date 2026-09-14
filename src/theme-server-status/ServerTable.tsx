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
import {
  activeTrafficBaselineBytes,
  daysUntil,
  formatDateOnly,
  formatMbps,
  formatRouteValue,
  parseNodeMetadata,
} from "./nodeMetadata";
import {
  useMonthlyTraffic,
  type MonthlyTrafficUsage,
} from "./monthlyTraffic";
import { billingCycleRange, trafficValue } from "./trafficCycle";
import { relayTrafficState } from "./relayTraffic";

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
    bandwidth: "上限↓|↑",
    routes: "线路 去|回",
    cycle: "流量周期",
    expiry: "到期",
    traffic: "本期↓|↑",
    quota: "额度",
    unlimited: "不限流量",
    used: "已用",
    remaining: "剩余",
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
    advertisedBandwidth: "标称带宽",
    lifecycle: "持有策略",
    keep: "长期持有",
    evaluate: "待评估",
    role: "用途",
    noReset: "无需重置",
    unknownReset: "未确认",
    inferred: "推定",
    nextReset: "下次重置",
    partialCycle: "本周期数据不完整",
    monthlyUnavailable: "月度用量暂不可用",
    recordedSince: "记录始于",
    routeEvidence: "中国线路",
    routeSample: "线路采样",
    bootTraffic: "自开机流量",
    daysLeft: "天",
    expired: "已到期",
  },
  en: {
    status: "Status",
    name: "Name",
    platform: "Platform",
    location: "Location",
    uptime: "Uptime",
    load: "Load",
    speed: "NetSpeed ↓|↑",
    bandwidth: "Cap ↓|↑",
    routes: "Routes go|back",
    cycle: "Traffic cycle",
    expiry: "Expires",
    traffic: "Cycle ↓|↑",
    quota: "Quota",
    unlimited: "Unlimited",
    used: "Used",
    remaining: "Remaining",
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
    advertisedBandwidth: "Advertised bandwidth",
    lifecycle: "Lifecycle",
    keep: "Long-term",
    evaluate: "Evaluate",
    role: "Role",
    noReset: "No reset",
    unknownReset: "Unknown",
    inferred: "inferred",
    nextReset: "Next reset",
    partialCycle: "Partial current cycle",
    monthlyUnavailable: "Monthly usage unavailable",
    recordedSince: "Recorded since",
    routeEvidence: "China routes",
    routeSample: "Route sample",
    bootTraffic: "Since boot",
    daysLeft: "d",
    expired: "Expired",
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

function ProgressBar({
  value,
  online,
  toneValue = value,
  label,
}: {
  value: number;
  online: boolean;
  toneValue?: number;
  label?: ReactNode;
}) {
  const safeValue = Math.min(100, Math.max(0, Number(value) || 0));
  const safeToneValue = Math.min(100, Math.max(0, Number(toneValue) || 0));
  return (
    <div
      className={`ss-progress ${online ? "" : "is-offline"}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={online ? safeValue : undefined}
    >
      <span
        className={`ss-progress-bar is-${progressTone(safeToneValue, online)}`}
        style={{ transform: `scaleX(${safeValue / 100})` }}
        aria-hidden="true"
      />
      <small className="ss-progress-label">{label ?? `${formatPercent(safeValue)}%`}</small>
    </div>
  );
}

function trafficUsed(
  node: NodeBasicInfo,
  record?: LiveRecord,
  monthly?: MonthlyTrafficUsage,
): number | undefined {
  const metadata = parseNodeMetadata(node.tags);
  const baseline = activeTrafficBaselineBytes(metadata);
  if (metadata.trafficResetDay) {
    if (!monthly?.hasData && baseline <= 0) return undefined;
    return baseline + (monthly?.hasData
      ? trafficValue(node.traffic_limit_type, monthly.up, monthly.down)
      : 0);
  }
  return trafficValue(
    node.traffic_limit_type,
    record?.network.totalUp ?? 0,
    record?.network.totalDown ?? 0,
  );
}

function TrafficQuota({
  node,
  record,
  online,
  chinese,
  monthly,
  monthlyLoading,
  monthlyError,
}: {
  node: NodeBasicInfo;
  record?: LiveRecord;
  online: boolean;
  chinese: boolean;
  monthly?: MonthlyTrafficUsage;
  monthlyLoading: boolean;
  monthlyError: string | null;
}) {
  const labels = chinese ? TEXT.zh : TEXT.en;
  const metadata = parseNodeMetadata(node.tags);
  const baseline = activeTrafficBaselineBytes(metadata);
  const limit = Number(node.traffic_limit) || 0;
  if (limit <= 0) {
    const partial = monthly && !monthly.complete;
    const cycleTotal = monthly?.hasData
      ? trafficValue("sum", monthly.up, monthly.down)
      : undefined;
    const detail = monthly?.hasData
      ? (chinese
          ? `本期下载 ${formatCompactBytes(monthly.down)} / 上传 ${formatCompactBytes(monthly.up)} · 合计 ${formatCompactBytes(cycleTotal ?? 0)} · ${labels.nextReset} ${formatDateOnly(monthly.nextReset)}${partial ? ` · ${labels.partialCycle}${monthly.historySince ? `，${labels.recordedSince} ${monthly.historySince}` : ""}` : ""}`
          : `Cycle download ${formatCompactBytes(monthly.down)} / upload ${formatCompactBytes(monthly.up)} · total ${formatCompactBytes(cycleTotal ?? 0)} · ${labels.nextReset} ${formatDateOnly(monthly.nextReset)}${partial ? ` · ${labels.partialCycle}${monthly.historySince ? `, ${labels.recordedSince} ${monthly.historySince}` : ""}` : ""}`)
      : labels.unlimited;
    const label = cycleTotal === undefined
      ? `∞${monthlyLoading ? " · …" : ""}`
      : `∞ · ${partial ? "~" : ""}${formatCompactBytes(cycleTotal)}`;
    return (
      <span className="ss-quota-progress" title={detail} aria-label={detail}>
        <ProgressBar value={100} toneValue={0} online={online} label={label} />
      </span>
    );
  }

  const used = trafficUsed(node, record, monthly);
  if (used === undefined) {
    const title = monthlyLoading
      ? (chinese ? "正在读取本账期流量" : "Loading current billing-cycle traffic")
      : `${labels.monthlyUnavailable}${monthlyError ? `: ${monthlyError}` : ""}`;
    return (
      <span className="ss-quota-progress" title={title} aria-label={title}>
        <ProgressBar value={100} toneValue={0} online={online} label="…" />
      </span>
    );
  }
  const usedPercent = percent(used, limit);
  const remainingPercent = Math.max(0, 100 - usedPercent);
  const partial = monthly && !monthly.complete && baseline <= 0;
  const baselineNote = baseline > 0
    ? (chinese
        ? ` · 含接入前基线 ${formatCompactBytes(baseline)}`
        : ` · includes ${formatCompactBytes(baseline)} pre-monitoring baseline`)
    : "";
  const detailBase = chinese
    ? `已用 ${formatCompactBytes(used)} / ${formatCompactBytes(limit)} · 剩余 ${formatPercent(remainingPercent)}%`
    : `Used ${formatCompactBytes(used)} / ${formatCompactBytes(limit)} · ${formatPercent(remainingPercent)}% remaining`;
  const detail = partial
    ? `${detailBase} · ${labels.partialCycle}${monthly.historySince ? `，${labels.recordedSince} ${monthly.historySince}` : ""}`
    : `${detailBase}${baselineNote}`;

  return (
    <span className="ss-quota-progress" title={detail} aria-label={detail}>
      <ProgressBar
        value={remainingPercent}
        toneValue={usedPercent}
        online={online}
        label={`${partial ? "~" : ""}${formatPercent(remainingPercent)}%`}
      />
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

function AdvertisedBandwidth({
  node,
  chinese,
}: {
  node: NodeBasicInfo;
  chinese: boolean;
}) {
  const metadata = parseNodeMetadata(node.tags);
  const down = formatMbps(metadata.bandwidthDownMbps);
  const up = formatMbps(metadata.bandwidthUpMbps);
  const title = chinese
    ? `服务商标称：下载 ${down}bps / 上传 ${up}bps；不是实时测速`
    : `Provider-advertised: download ${down}bps / upload ${up}bps; not a live test`;

  return (
    <span className="ss-bandwidth-cap" title={title} aria-label={title}>
      {down} | {up}
    </span>
  );
}

function TrafficCycle({ node, chinese }: { node: NodeBasicInfo; chinese: boolean }) {
  const labels = chinese ? TEXT.zh : TEXT.en;
  const metadata = parseNodeMetadata(node.tags);
  if (!metadata.trafficResetDay) {
    return <span>{(Number(node.traffic_limit) || 0) <= 0 ? labels.noReset : labels.unknownReset}</span>;
  }
  const inferred = metadata.trafficResetSource === "inferred";
  const range = billingCycleRange(metadata.trafficResetDay);
  const text = chinese
    ? `每月${metadata.trafficResetDay}日${inferred ? "*" : ""}`
    : `Day ${metadata.trafficResetDay}${inferred ? "*" : ""}`;
  const sourceTitle = inferred
    ? (chinese ? "按账单周年日推定，待服务商面板确认" : "Inferred from billing anniversary; provider confirmation pending")
    : (chinese ? "服务商已确认的月度重置日" : "Provider-confirmed monthly reset day");
  const title = `${sourceTitle}；${labels.nextReset}: ${formatDateOnly(range.nextReset.toISOString())}`;
  return <span title={title}>{text}</span>;
}

const ROUTE_CARRIERS = [
  { key: "ct", zh: "电", en: "CT" },
  { key: "cu", zh: "联", en: "CU" },
  { key: "cm", zh: "移", en: "CM" },
] as const;

function ChinaRoutes({
  node,
  chinese,
  detailed = false,
}: {
  node: NodeBasicInfo;
  chinese: boolean;
  detailed?: boolean;
}) {
  const routes = parseNodeMetadata(node.tags).chinaRoutes;
  if (!routes) return <span>-</span>;

  const sample = [
    routes.sampledAt,
    routes.goScope && `${chinese ? "去程" : "go"}: ${routes.goScope}`,
    routes.backScope && `${chinese ? "回程" : "back"}: ${routes.backScope}`,
  ].filter(Boolean).join(" · ");

  if (detailed) {
    return (
      <span className="ss-route-details" title={sample || undefined}>
        {ROUTE_CARRIERS.map((carrier) => (
          <span key={carrier.key}>
            <b>{chinese ? carrier.zh : carrier.en}</b>{" "}
            {chinese ? "去" : "go"}{" "}
            {formatRouteValue(routes.go[carrier.key], chinese)} ·{" "}
            {chinese ? "回" : "back"}{" "}
            {formatRouteValue(routes.back[carrier.key], chinese)}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span className="ss-route-compact" title={sample || undefined} aria-label={sample || undefined}>
      {ROUTE_CARRIERS.map((carrier) => (
        <span key={carrier.key}>
          <b>{chinese ? carrier.zh : carrier.en}</b>{" "}
          {formatRouteValue(routes.go[carrier.key], chinese)} / {formatRouteValue(routes.back[carrier.key], chinese)}
        </span>
      ))}
    </span>
  );
}

function Expiry({ node, chinese }: { node: NodeBasicInfo; chinese: boolean }) {
  const labels = chinese ? TEXT.zh : TEXT.en;
  const remaining = daysUntil(node.expired_at);
  if (remaining === undefined) return <span>-</span>;
  return (
    <span title={formatDateOnly(node.expired_at)}>
      {remaining <= 0 ? labels.expired : `${remaining}${labels.daysLeft}`}
    </span>
  );
}

function NodeDetails({
  node,
  record,
  online,
  chinese,
  monthly,
  monthlyLoading,
  monthlyError,
}: {
  node: NodeBasicInfo;
  record?: LiveRecord;
  online: boolean;
  chinese: boolean;
  monthly?: MonthlyTrafficUsage;
  monthlyLoading: boolean;
  monthlyError: string | null;
}) {
  const labels = chinese ? TEXT.zh : TEXT.en;
  const cpu = record?.cpu.usage ?? 0;
  const memory = percent(record?.ram.used ?? 0, node.mem_total);
  const swap = percent(record?.swap.used ?? 0, node.swap_total);
  const disk = percent(record?.disk.used ?? 0, node.disk_total);
  const uptime = record?.uptime ?? 0;
  const bootTime = uptime > 0 ? Date.now() - uptime * 1000 : undefined;
  const trafficLimit = Number(node.traffic_limit) || 0;
  const trafficUsedBytes = trafficUsed(node, record, monthly);
  const trafficPercent = percent(trafficUsedBytes ?? 0, trafficLimit);
  const trafficRemainingPercent = Math.max(0, 100 - trafficPercent);
  const metadata = parseNodeMetadata(node.tags);
  const trafficBaseline = activeTrafficBaselineBytes(metadata);
  const trafficIsPartial = Boolean(
    monthly && !monthly.complete && trafficBaseline <= 0,
  );
  const trafficBaselineNote = trafficBaseline > 0
    ? (chinese
        ? ` · 含接入前基线 ${formatCompactBytes(trafficBaseline)}`
        : ` · includes ${formatCompactBytes(trafficBaseline)} pre-monitoring baseline`)
    : "";

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
      <DetailLine label={labels.bootTraffic}>
        IN {formatCompactBytes(record?.network.totalDown ?? 0)} / OUT {formatCompactBytes(record?.network.totalUp ?? 0)}
      </DetailLine>
      <DetailLine label={labels.traffic}>
        {monthly?.hasData
          ? `${monthly.complete ? "" : "~"}${formatCompactBytes(monthly.down)} / ${formatCompactBytes(monthly.up)}`
          : parseNodeMetadata(node.tags).trafficResetDay
            ? (monthlyLoading ? "…" : labels.monthlyUnavailable)
            : "-"}
      </DetailLine>
      <DetailLine label={labels.advertisedBandwidth}>
        {chinese ? "下载 " : "Download "}{formatMbps(metadata.bandwidthDownMbps)}bps / {chinese ? "上传 " : "Upload "}{formatMbps(metadata.bandwidthUpMbps)}bps
      </DetailLine>
      <DetailLine label={labels.cycle}>
        <TrafficCycle node={node} chinese={chinese} />
        {metadata.trafficResetSource === "inferred" && ` (${labels.inferred})`}
      </DetailLine>
      <DetailLine label={labels.expiry}>
        {formatDateOnly(node.expired_at)}
        {daysUntil(node.expired_at) !== undefined &&
          ` (${(daysUntil(node.expired_at) ?? 0) <= 0 ? labels.expired : `${daysUntil(node.expired_at)}${labels.daysLeft}`})`}
      </DetailLine>
      {metadata.lifecycle && (
        <DetailLine label={labels.lifecycle}>
          {metadata.lifecycle === "keep" ? labels.keep : labels.evaluate}
        </DetailLine>
      )}
      {metadata.role && <DetailLine label={labels.role}>{metadata.role}</DetailLine>}
      {metadata.chinaRoutes && (
        <>
          <DetailLine label={labels.routeEvidence}>
            <ChinaRoutes node={node} chinese={chinese} detailed />
          </DetailLine>
          <DetailLine label={labels.routeSample}>
            {metadata.chinaRoutes.sampledAt || "-"}
            {metadata.chinaRoutes.goScope &&
              ` · ${chinese ? "去程" : "go"}: ${metadata.chinaRoutes.goScope}`}
            {metadata.chinaRoutes.backScope &&
              ` · ${chinese ? "回程" : "back"}: ${metadata.chinaRoutes.backScope}`}
          </DetailLine>
        </>
      )}
      <DetailLine label={labels.quota}>
        {trafficLimit > 0 && trafficUsedBytes !== undefined
          ? `${trafficIsPartial ? "~" : ""}${labels.used} ${formatCompactBytes(trafficUsedBytes)} / ${formatCompactBytes(trafficLimit)} · ${labels.remaining} ${formatPercent(trafficRemainingPercent)}%${trafficIsPartial ? ` · ${labels.partialCycle}${monthly?.historySince ? `，${labels.recordedSince} ${monthly.historySince}` : ""}` : trafficBaselineNote}`
          : trafficLimit > 0
            ? (monthlyLoading ? "…" : `${labels.monthlyUnavailable}${monthlyError ? `: ${monthlyError}` : ""}`)
          : monthly?.hasData
            ? `${labels.unlimited} · ${monthly.complete ? "" : "~"}${labels.used} ${formatCompactBytes(trafficValue("sum", monthly.up, monthly.down))} · ${labels.nextReset} ${formatDateOnly(monthly.nextReset)}`
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
  monthlyTraffic,
  monthlyLoading,
  monthlyError,
}: {
  title?: string;
  nodes: NodeBasicInfo[];
  liveData: LiveData;
  chinese: boolean;
  monthlyTraffic: Record<string, MonthlyTrafficUsage>;
  monthlyLoading: boolean;
  monthlyError: string | null;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const labels = chinese ? TEXT.zh : TEXT.en;
  const onlineSet = useMemo(() => new Set(liveData.online), [liveData.online]);
  const columns = 16;

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
              <th className="ss-col-route">{labels.routes}</th>
              <th className="ss-col-uptime">{labels.uptime}</th>
              <th className="ss-col-load">{labels.load}</th>
              <th className="ss-col-network">{labels.speed}</th>
              <th className="ss-col-cap">{labels.bandwidth}</th>
              <th className="ss-col-cycle">{labels.cycle}</th>
              <th className="ss-col-expiry">{labels.expiry}</th>
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
                  monthly={monthlyTraffic[node.uuid]}
                  monthlyLoading={monthlyLoading}
                  monthlyError={monthlyError}
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
  monthly,
  monthlyLoading,
  monthlyError,
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
  monthly?: MonthlyTrafficUsage;
  monthlyLoading: boolean;
  monthlyError: string | null;
}) {
  const load = record?.load.load1 ?? 0;
  const osInfo = useMemo(() => getOSInfo(node.os), [node.os]);
  const labels = chinese ? TEXT.zh : TEXT.en;
  const metadata = parseNodeMetadata(node.tags);
  const relayState = metadata.relay ? relayTrafficState(record, online) : null;
  const relayClass = relayState === "fast"
    ? "is-relay-fast"
    : relayState === "active"
      ? "is-relay-active"
      : "";

  return (
    <>
      <tr
        className={`ss-node-row ${index % 2 ? "is-even" : "is-odd"} ${relayClass}`.trim()}
        data-relay-traffic={relayState ?? undefined}
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
        <td className="ss-col-name">
          <span className="ss-node-name-wrap">
            <span className="ss-node-name-text">{node.name}</span>
            {metadata.lifecycle && (
              <small className={`ss-lifecycle is-${metadata.lifecycle}`}>
                {metadata.role || (metadata.lifecycle === "keep" ? labels.keep : labels.evaluate)}
              </small>
            )}
          </span>
        </td>
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
        <td className="ss-col-route" data-mobile-label={labels.routes}>
          <ChinaRoutes node={node} chinese={chinese} />
        </td>
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
        <td className="ss-col-cap" data-mobile-label={labels.bandwidth}>
          <AdvertisedBandwidth node={node} chinese={chinese} />
        </td>
        <td className="ss-col-cycle" data-mobile-label={labels.cycle}>
          <TrafficCycle node={node} chinese={chinese} />
        </td>
        <td className="ss-col-expiry" data-mobile-label={labels.expiry}>
          <Expiry node={node} chinese={chinese} />
        </td>
        <td className="ss-col-traffic">
          {monthly?.hasData
            ? `${monthly.complete ? "" : "~"}${formatCompactBytes(monthly.down)} | ${formatCompactBytes(monthly.up)}`
            : metadata.trafficResetDay
              ? (monthlyLoading ? "… | …" : "- | -")
              : record
                ? `${formatCompactBytes(record.network.totalDown)} | ${formatCompactBytes(record.network.totalUp)}`
                : "- | -"}
        </td>
        <td className="ss-col-usage ss-col-quota" data-mobile-label={labels.quota}>
          <TrafficQuota
            node={node}
            record={record}
            online={online}
            chinese={chinese}
            monthly={monthly}
            monthlyLoading={monthlyLoading}
            monthlyError={monthlyError}
          />
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
            <NodeDetails
              node={node}
              record={record}
              online={online}
              chinese={chinese}
              monthly={monthly}
              monthlyLoading={monthlyLoading}
              monthlyError={monthlyError}
            />
          </td>
        </tr>
      )}
    </>
  );
}

export default function ServerTable({ nodes, liveData, grouped, chinese }: ServerTableProps) {
  const sortedNodes = useMemo(() => sortNodes(nodes), [nodes]);
  const monthlyTraffic = useMonthlyTraffic(sortedNodes);
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
          monthlyTraffic={monthlyTraffic.usage}
          monthlyLoading={monthlyTraffic.loading}
          monthlyError={monthlyTraffic.error}
        />
      ))}
    </div>
  );
}
