import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import Loading from "@/components/loading";
import { useLiveData } from "@/contexts/LiveDataContext";
import { useNodeList } from "@/contexts/NodeListContext";
import RelayStrip from "@/theme-server-status/RelayStrip";
import ServerTable from "@/theme-server-status/ServerTable";
import { useServerStatusSettings } from "@/theme-server-status/SettingsContext";

const EMPTY_LIVE_DATA = { online: [], data: {} };

export default function Index() {
  const { i18n } = useTranslation();
  const { live_data, connectionStatus } = useLiveData();
  const { nodeList, isLoading, error, refresh } = useNodeList();
  const { grouped } = useServerStatusSettings();
  const chinese = i18n.resolvedLanguage?.toLowerCase().startsWith("zh") ?? false;

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  if (isLoading) return <Loading />;

  const hasNodes = (nodeList?.length ?? 0) > 0;
  const nodeError = error
    ? /\b401\b/.test(error)
      ? chinese
        ? "请先登录后查看监控数据。"
        : "Please sign in to view monitoring data."
      : /\b403\b/.test(error)
        ? chinese
          ? "监控请求被 Komari 拒绝，请检查 Origin 或反向代理设置。"
          : "Komari rejected the monitoring request. Check the Origin or reverse proxy settings."
        : error
    : null;
  const liveError =
    connectionStatus === "error"
      ? chinese
        ? "实时状态暂时不可用，正在自动重试。"
        : "Live status is temporarily unavailable. Retrying automatically."
      : null;
  const pageError = nodeError || liveError;

  return (
    <div className="ss-home">
      {hasNodes && pageError && (
        <div className="ss-notice" role="alert">
          {pageError}
        </div>
      )}
      {hasNodes ? (
        <>
          <ServerTable
            nodes={nodeList ?? []}
            liveData={live_data?.data ?? EMPTY_LIVE_DATA}
            grouped={grouped}
            chinese={chinese}
          />
          <RelayStrip
            nodes={nodeList ?? []}
            liveData={live_data?.data ?? EMPTY_LIVE_DATA}
            chinese={chinese}
          />
        </>
      ) : pageError ? (
        <section className="ss-panel ss-empty" role="alert">
          <span>{pageError}</span>
          <button
            className="ss-button ss-button--retry"
            type="button"
            onClick={refresh}
          >
            {chinese ? "重试" : "Retry"}
          </button>
        </section>
      ) : (
        <section className="ss-panel ss-empty">
          {chinese ? "暂无服务器" : "No servers available"}
        </section>
      )}
    </div>
  );
}
