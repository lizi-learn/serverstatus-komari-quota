import { useTranslation } from "react-i18next";
import { UpDownStack } from "./UpDownStack";
import {
  useNodeList,
  type NodeBasicInfo,
} from "@/contexts/NodeListContext";
import { useLiveData } from "@/contexts/LiveDataContext";
import { formatUptime } from "./Node";
import { formatBytes } from "@/utils/unitHelper";
import { Flex, Text, Card } from "@radix-ui/themes";
import type { Record as LiveRecord } from "@/types/LiveData";

type DetailsGridProps = {
  uuid: string;
  gap?: string;
  box?: boolean;
  showBilling?: boolean;
  align?: "start" | "center" | "end";
  node?: NodeBasicInfo;
  liveRecord?: LiveRecord;
};

type Translate = ReturnType<typeof useTranslation>["t"];

const billingCycleText = (days: number, t: Translate) => {
  if (days >= 27 && days <= 32) return t("common.monthly");
  if (days >= 87 && days <= 95) return t("common.quarterly");
  if (days >= 175 && days <= 185) return t("common.semi_annual");
  if (days >= 360 && days <= 370) return t("common.annual");
  if (days >= 720 && days <= 750) return t("common.biennial");
  if (days >= 1080 && days <= 1150) return t("common.triennial");
  if (days >= 1800 && days <= 1850) return t("common.quinquennial");
  if (days === -1) return t("common.once");
  return days > 0 ? `${days} ${t("nodeCard.time_day")}` : "";
};

const priceText = (node: NodeBasicInfo | undefined, t: Translate) => {
  if (!node || node.price === 0) return "-";
  if (node.price === -1) return t("common.free");
  const cycle = billingCycleText(node.billing_cycle, t);
  return `${node.currency || ""}${node.price}${cycle ? ` / ${cycle}` : ""}`;
};

const remainingTimeText = (node: NodeBasicInfo | undefined, t: Translate) => {
  if (!node) return "-";
  const expiresAt = new Date(node.expired_at).getTime();
  if (!Number.isFinite(expiresAt)) {
    return node.billing_cycle === -1 ? t("common.long_term") : "-";
  }

  const days = Math.ceil((expiresAt - Date.now()) / 86_400_000);
  if (days <= 0) return t("common.expired");
  if (days > 36_500) return t("common.long_term");
  return t("common.expired_in", { days });
};

export const DetailsGrid = ({
  uuid,
  gap,
  box,
  showBilling = false,
  align,
  node: nodeProp,
  liveRecord,
}: DetailsGridProps) => {
  const { t } = useTranslation();

  const nodeListContext = useNodeList(false);
  const { live_data } = useLiveData();
  const node =
    nodeProp ?? nodeListContext?.nodeList?.find((n) => n.uuid === uuid);
  const currentRecord = liveRecord ?? live_data?.data.data[uuid ?? ""];

  const Container: any = box ? Card : 'div';

  return (
    <Container
      className={`km-details-grid DetailsGrid max-w-[900px]`}
    >
      <div className={`flex flex-wrap gap-${gap ?? "4"} basis-full justify-center ${align === "center" ? "justify-between" : ""}`}>
        {showBilling && (
          <div className="km-details-billing grid w-full basis-full grid-cols-1 gap-3 border-b border-accent-4 pb-3 sm:grid-cols-2">
            <UpDownStack
              up={t("admin.nodeTable.price")}
              down={priceText(node, t)}
            />
            <UpDownStack
              up={t("nodeCard.remainingTime")}
              down={remainingTimeText(node, t)}
              className="sm:items-end sm:text-right"
            />
          </div>
        )}
        <UpDownStack
          className="km-details-item md:w-128 flex-[0_0_calc(50%-0.5rem)]"
          up="CPU"
          down={`${node?.cpu_name} (x${node?.cpu_cores})`}
        />
        <label className={`km-details-item flex flex-wrap gap-2 gap-x-8 flex-[0_0_calc(50%-0.5rem)] ${align === "center" ? "justify-end" : ""}`}>
          <UpDownStack up={t("admin.nodeDetail.arch")} down={node?.arch ?? "Unknown"} />

          <UpDownStack
            up={t("nodeCard.virtualization")}
            align={align === "center" ? "end" : "start"}
            down={node?.virtualization ?? "Unknown"}
          />
        </label>
        <UpDownStack up="GPU" down={node?.gpu_name ?? "Unknown"} className="km-details-item flex-[0_0_calc(50%-0.5rem)]" />
        <div className={`km-details-item flex flex-col gap-0 flex-[0_0_calc(50%-0.5rem)] ${align === "center" ? "items-end text-right" : "items-start"}`}>
          <label className="text-base font-bold">{t("nodeCard.os")}</label>
          <label className="text-sm text-muted-foreground -mt-1">{node?.os ?? "Unknown"}</label>
          <label className="text-xs text-muted-foreground opacity-75">
            {t("nodeCard.kernelVersion")}: {node?.kernel_version ?? "Unknown"}
          </label>
        </div>

        <UpDownStack
          className="km-details-item md:w-64 w-full flex-[0_0_calc(50%-0.5rem)]"
          up={t("nodeCard.networkSpeed")}
          down={` ↑ ${formatBytes(
            currentRecord?.network.up || 0
          )}/s
          ↓
          ${formatBytes(
            currentRecord?.network.down || 0
          )}/s`}
        />
        <UpDownStack
          up={t("nodeCard.totalTraffic")}
          align={align === "center" ? "end" : "start"}
          className="km-details-item flex-[0_0_calc(50%-0.5rem)]"
            down={`↑
          ${formatBytes(
              currentRecord?.network.totalUp || 0
            )}
          ↓
          ${formatBytes(
              currentRecord?.network.totalDown || 0
            )}`}
        />
        <UpDownStack
          className="km-details-item md:w-70 w-full flex-[0_0_calc(50%-0.5rem)]"
          up={t("nodeCard.ram")}
          down={formatBytes(node?.mem_total || 0)}
        />
        <UpDownStack
          up={t("nodeCard.swap")}
          className="km-details-item flex-[0_0_calc(50%-0.5rem)]"
          align={align === "center" ? "end" : "start"}
          down={formatBytes(node?.swap_total || 0)}
        />
        <UpDownStack
          className="km-details-item md:w-64 w-full flex-[0_0_calc(50%-0.5rem)]"
          up={t("nodeCard.disk")}
          down={formatBytes(node?.disk_total || 0)}
        />
        <div className="flex-[0_0_calc(50%-0.5rem)]" />
        <UpDownStack
          up={t("nodeCard.uptime")}
          className="km-details-item flex-[0_0_calc(50%-0.5rem)]"
          down={
            currentRecord?.uptime
              ? formatUptime(currentRecord.uptime, t)
              : "-"
          }
        />
        <label className={`km-details-item flex flex-wrap gap-2 flex-[0_0_calc(50%-0.5rem)] ${align === "center" ? "justify-end" : ""}`}>
          <Flex align={"center"} gap="2">
            <Text size="2" weight="bold" wrap="nowrap">
              {t("nodeCard.last_updated")}
            </Text>
            <Text size="2">
              {node?.updated_at
                ? new Date(
                  currentRecord?.updated_at ||
                  node.updated_at
                ).toLocaleString()
                : "-"}
            </Text>
          </Flex>
        </label>
      </div>
    </Container>
  );
};
