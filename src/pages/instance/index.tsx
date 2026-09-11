import { useCallback, useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useLiveData } from "../../contexts/LiveDataContext";
import type { Record } from "../../types/LiveData";
import Flag from "../../components/Flag";
import { Text } from "@radix-ui/themes";
import { useNodeList } from "@/contexts/NodeListContext";
import { liveDataToRecords } from "@/utils/RecordHelper";
import LoadChart from "./LoadChart";
import { DetailsGrid } from "@/components/DetailsGrid";

const RECENT_RECORD_LIMIT = 150;

export default function InstancePage() {
  const { onRefresh, live_data } = useLiveData();
  const { uuid } = useParams<{ uuid: string }>();
  const [recent, setRecent] = useState<Record[]>([]);
  const [chartRealtimeActive, setChartRealtimeActive] = useState(true);
  const { nodeList } = useNodeList();
  const node = nodeList?.find((n) => n.uuid === uuid);
  const chartRecords = useMemo(
    () => liveDataToRecords(uuid ?? "", recent),
    [uuid, recent],
  );
  const handleChartRealtimeChange = useCallback((active: boolean) => {
    setChartRealtimeActive(active);
  }, []);

  useEffect(() => {
    if (!uuid) {
      setRecent([]);
      return;
    }

    const controller = new AbortController();
    setRecent([]);

    fetch(`/api/recent/${uuid}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (!controller.signal.aborted) {
          setRecent((data?.data ?? []).slice(-RECENT_RECORD_LIMIT));
        }
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          console.error("Failed to fetch recent data:", err);
        }
      });

    return () => controller.abort();
  }, [uuid]);

  useEffect(() => {
    const unsubscribe = onRefresh((resp) => {
      if (!uuid || !chartRealtimeActive) return;
      const data = resp.data.data[uuid];
      if (!data) return;

      setRecent((prev) => {
        const newRecord: Record = data;
        const exists = prev.some(
          (item) => item.updated_at === newRecord.updated_at,
        );
        if (exists) {
          return prev;
        }

        return [...prev, newRecord].slice(-RECENT_RECORD_LIMIT);
      });
    });

    return unsubscribe;
  }, [chartRealtimeActive, onRefresh, uuid]);

  return (
    <div className="km-page-instance flex justify-center p-4">
      <div className="km-instance-main flex flex-col h-full items-center gap-2">
        <div className="km-instance-header flex flex-col gap-1 md:p-4 p-3 border-0 rounded-md">
          <h1 className="km-instance-title flex items-center flex-wrap">
            <Flag flag={node?.region ?? ""} />
            <Text size="3" weight="bold" wrap="nowrap">
              {node?.name ?? uuid}
            </Text>
            <Text
              size="1"
              style={{
                marginLeft: "8px",
              }}
              className="text-accent-6"
              wrap="nowrap"
            >
              {node?.uuid}
            </Text>
          </h1>
          <DetailsGrid
            box
            align="center"
            showBilling
            uuid={uuid ?? ""}
            node={node}
            liveRecord={uuid ? live_data?.data.data[uuid] : undefined}
          />
        </div>
        <LoadChart
          data={chartRecords}
          onRealtimeActiveChange={handleChartRealtimeChange}
        />
      </div>
    </div>
  );
}
