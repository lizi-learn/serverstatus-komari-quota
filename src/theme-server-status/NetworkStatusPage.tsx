import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import MiniPingChart from "@/components/MiniPingChart";
import { useNodeList } from "@/contexts/NodeListContext";

export default function NetworkStatusPage() {
  const { i18n } = useTranslation();
  const { nodeList, isLoading, error, refresh } = useNodeList();
  const [query, setQuery] = useState("");
  const [preferredUuid, setPreferredUuid] = useState("");
  const zh = (i18n.resolvedLanguage || i18n.language || "en")
    .toLowerCase()
    .startsWith("zh");
  const text = zh
    ? {
        title: "网络监控",
        nodes: "节点列表",
        search: "搜索节点…",
        loading: "正在加载节点…",
        empty: "暂无可用节点。",
        noMatches: "没有匹配的节点。",
        error: "节点列表加载失败",
        retry: "重试",
        chart: "延迟图表",
      }
    : {
        title: "Network monitor",
        nodes: "Node list",
        search: "Search nodes…",
        loading: "Loading nodes…",
        empty: "No nodes available.",
        noMatches: "No matching nodes.",
        error: "Failed to load the node list",
        retry: "Retry",
        chart: "Latency chart",
      };

  const nodes = useMemo(
    () => [...(nodeList ?? [])].sort(
      (left, right) => left.weight - right.weight,
    ),
    [nodeList],
  );
  const selectedUuid = nodes.some((node) => node.uuid === preferredUuid)
    ? preferredUuid
    : nodes[0]?.uuid ?? "";
  const selectedNode = nodes.find((node) => node.uuid === selectedUuid);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredNodes = useMemo(() => {
    if (!normalizedQuery) return nodes;
    return nodes.filter((node) =>
      [node.name, node.region, node.group, node.os, node.uuid]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }, [nodes, normalizedQuery]);

  if (isLoading && nodeList === null) {
    return (
      <div className="ss-page ss-network-page" aria-busy="true">
        <div className="ss-message ss-message--loading">{text.loading}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ss-page ss-network-page">
        <div className="ss-message ss-message--error" role="alert">
          <span className="ss-message__text">{text.error}: {error}</span>
          <button className="ss-button ss-button--retry" type="button" onClick={refresh}>
            {text.retry}
          </button>
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="ss-page ss-network-page">
        <div className="ss-message ss-message--empty">{text.empty}</div>
      </div>
    );
  }

  return (
    <div className="ss-page ss-network-page">
      <section className="ss-panel ss-network-panel">
        <h1 className="ss-panel__title ss-network-panel__title">{text.title}</h1>
        <div className="ss-network-layout">
          <aside className="ss-network-picker" aria-label={text.nodes}>
            <label className="ss-network-search">
              <span className="ss-network-search__label">{text.nodes}</span>
              <input
                className="ss-network-search__input"
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder={text.search}
                type="search"
                value={query}
              />
            </label>
            <div className="ss-network-node-list" role="listbox" aria-label={text.nodes}>
              {filteredNodes.length === 0 && (
                <div className="ss-network-node-list__empty">{text.noMatches}</div>
              )}
              {filteredNodes.map((node) => {
                const selected = node.uuid === selectedUuid;
                return (
                  <button
                    aria-selected={selected}
                    className={`ss-network-node${selected ? " ss-network-node--selected" : ""}`}
                    key={node.uuid}
                    onClick={() => setPreferredUuid(node.uuid)}
                    role="option"
                    type="button"
                  >
                    <span className="ss-network-node__name">{node.name || node.uuid}</span>
                    {(node.region || node.group) && (
                      <small className="ss-network-node__meta">
                        {[node.region, node.group].filter(Boolean).join(" · ")}
                      </small>
                    )}
                  </button>
                );
              })}
            </div>
          </aside>
          <div className="ss-network-chart">
            <h2 className="ss-network-chart__title">
              <span className="ss-network-chart__node">{selectedNode?.name || selectedUuid}</span>
              <small className="ss-network-chart__label">{text.chart}</small>
            </h2>
            <MiniPingChart uuid={selectedUuid} width="100%" height={460} hours={24} />
          </div>
        </div>
      </section>
    </div>
  );
}
