# ServerStatus for Komari

面向 Komari 的 ServerStatus 风格主题。界面按照经典 Nezha ServerStatus 的紧凑表格、分组卡片、状态点、渐变用量条和响应式导航重新实现，数据层使用 Komari 原生 RPC2。

此仓库是为 `small.bismih520.com` 定制的流量与带宽版本，基于 [tfhmc/serverstatus](https://github.com/tfhmc/serverstatus)。它保留原主题外观，并为每台节点增加按账单日计算的剩余流量额度进度条、服务商标称上下行上限和持有策略；额度为 `0 B` 的节点显示带 `∞` 的满格绿色进度条。账户状态加载时预留固定空间，避免登录用户刷新页面时短暂出现设置齿轮。

## 功能

- 首页严格遵循后台节点顺序，并支持分组/单表切换、节点详情展开、暗色模式和移动端横向表格。
- 有 `traffic-reset-day` 的限量节点通过 Komari 的 `traffic.up` / `traffic.down` 历史指标计算当前账期用量，并按照节点设置中的统计方式（上传、下载、总和、较大值或较小值）扣减；进度条从满格开始，使用后逐渐减少。
- 节点标签支持 `bw-down=100;bw-up=100;lifecycle=keep;role=...;traffic-reset-day=12;traffic-reset-source=inferred;traffic-history-since=2026-09-13`。桌面表格显示标称下载/上传上限、流量周期和到期倒计时，窄屏在展开详情中显示；`lifecycle` 可为 `keep` 或 `evaluate`。
- `traffic-reset-source=inferred` 表示重置日按账单周年日推定，表格用 `*` 提醒待服务商面板确认；不限流量节点也可配置周期并显示每期实际上下行，但额度条始终为带 `∞` 的满格绿色。没有周期配置的不限流量节点显示“无需重置”。
- `traffic-history-since` 表示可靠历史数据开始积累的日期。如果当前账期早于这个日期，额度显示 `~` 并注明本周期数据不完整；跨过下一个账单日后自动转为完整统计。日期为 29–31 日时，短月份按该月最后一天处理。
- Komari 后台标为“隐藏”的节点在本主题首页始终不渲染，即使浏览器同时登录了管理员；后台监控数据与历史仍会保留。
- `/network` 提供节点搜索、切换和 24 小时延迟图。
- 左上角读取 Komari 后台上传的 `/favicon.ico`。
- 保留 Komari 原生 `/admin`、`/terminal`、登录和节点详情能力。

标准 4:3 国旗素材来自 [flag-icons](https://github.com/lipis/flag-icons)，按 MIT License 使用。

## 安装

在 Komari 后台把 `traffic.up` 和 `traffic.down` 的指标保留时间设为至少 35 天，再于主题管理页面上传仓库根目录的 `ServerStatusQuota4-v1.0.18-quota.6.zip` 并应用。ZIP 根目录包含：

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
