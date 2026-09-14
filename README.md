# ServerStatus for Komari

面向 Komari 的 ServerStatus 风格主题。界面按照经典 Nezha ServerStatus 的紧凑表格、分组卡片、状态点、渐变用量条和响应式导航重新实现，数据层使用 Komari 原生 RPC2。

此仓库是为 `small.bismih520.com` 定制的流量、带宽与中国线路版本，基于 [tfhmc/serverstatus](https://github.com/tfhmc/serverstatus)。它保留原主题外观，并为每台节点增加按账单日计算的剩余流量额度进度条、服务商标称上下行上限、持有策略，以及按电信/联通/移动拆分的去程与回程采样；额度为 `0 B` 的节点显示带 `∞` 的满格绿色进度条。账户状态加载时预留固定空间，避免登录用户刷新页面时短暂出现设置齿轮。

## 功能

- 首页严格遵循后台节点顺序，并支持分组/单表切换、节点详情展开和暗色模式；桌面宽度不足时显示可拖动的横向滚动条，移动端继续使用紧凑列表。
- 有 `traffic-reset-day` 的限量节点通过 Komari 的 `traffic.up` / `traffic.down` 历史指标计算当前账期用量，并按照节点设置中的统计方式（上传、下载、总和、较大值或较小值）扣减；进度条从满格开始，使用后逐渐减少。
- 节点标签支持 `bw-down=100;bw-up=100;lifecycle=keep;role=...;traffic-reset-day=12;traffic-reset-source=inferred;traffic-history-since=2026-09-13`。桌面表格显示标称下载/上传上限、流量周期和到期倒计时，窄屏在展开详情中显示；`lifecycle` 可为 `keep` 或 `evaluate`。
- 节点名称旁的策略标签优先显示 `role`；当前长期节点分别用“主计算”“主存储”“抗投诉”表达保留原因，没有 `role` 时才回退到“长期持有”或“待评估”。
- 中国线路标签使用 `route-go-ct`、`route-go-cu`、`route-go-cm` 与对应的 `route-back-*` 分别保存三网去程和回程结论；`route-sampled-at`、`route-go-scope`、`route-back-scope` 保存采样日期和探针范围。宽屏显示紧凑的“去 / 回”矩阵，窄屏在展开详情中显示完整信息。线路是有时间和探针范围的观测值，不是服务器永久属性。
- `traffic-reset-source=inferred` 表示重置日按账单周年日推定，表格用 `*` 提醒待服务商面板确认；不限流量节点也可配置周期，满格绿色额度条显示 `∞ · 本期合计`，本期列保留下载/上传明细。没有周期配置的不限流量节点显示“无需重置”。
- `traffic-history-since` 表示可靠历史数据开始积累的日期。如果当前账期早于这个日期，详情仍注明本周期数据不完整，但额度条不再显示 `~`；跨过下一个账单日后自动转为完整统计。日期为 29–31 日时，短月份按该月最后一天处理。
- 新接入节点若能从供应商面板读到本账期既有用量，可用 `traffic-baseline-gib=214.06;traffic-baseline-until=2026-09-29` 补齐接入前基线。额度条只在 `until` 日期前加上该基线，到重置日自动失效，避免后续账期重复扣减。
- Komari 后台标为“隐藏”的节点在本主题首页始终不渲染，即使浏览器同时登录了管理员；后台监控数据与历史仍会保留。
- 首页表格直接保留中国三网线路快照；导航不再显示单独的中转页和网络页，旧地址会兼容跳回首页。
- 中转订阅、复制按钮、在线数和实时下载/上传总速率以透明紧凑控制条合并在首页表格下方；原表格中明确带有 `relay=sing-box` 标签的节点会按整机实时上下行显示蓝色传输高亮，不再创建重复卡片，也不以 CPU/RAM 触发动画。首页负载列隐藏，展开节点详情仍可查看。旧 `/relays` 地址会自动回到首页。网速沿用 Komari 整机口径，不会伪装成逐协议统计；隧道流量可能同时出现在物理和虚拟接口上。
- 左上角读取 Komari 后台上传的 `/favicon.ico`。
- 保留 Komari 原生 `/admin`、`/terminal`、登录和节点详情能力。

标准 4:3 国旗素材来自 [flag-icons](https://github.com/lipis/flag-icons)，按 MIT License 使用。

## 安装

在 Komari 后台把 `traffic.up` 和 `traffic.down` 的指标保留时间设为至少 35 天，再于主题管理页面上传仓库根目录的 `ServerStatusQuota4-v1.0.18-quota.17.zip` 并应用。要在首页中转控制条和流量高亮中包含节点，为节点标签增加 `relay=sing-box`。ZIP 根目录包含：

```text
komari-theme.json
preview.png
dist/
```

建议使用当前稳定版 Komari，以获得完整的公开指标 RPC。

## 本地开发

```bash
cp .env.example .env.development
npm install
npm run dev
```

将 `.env.development` 中的 `VITE_API_TARGET` 指向测试 Komari 实例。生产构建与检查：

```bash
npm run lint
npm run build
```

Linux 下可运行 `./build-theme.sh` 构建并按 `komari-theme.json` 的版本号生成主题包。

主题开发规范：[Komari 主题文档](https://www.komari.wiki/dev/theme) · [RPC2 文档](https://www.komari.wiki/dev/rpc)
