# ServerStatus for Komari

面向 Komari 的 ServerStatus 风格主题。界面按照经典 Nezha ServerStatus 的紧凑表格、分组卡片、状态点、渐变用量条和响应式导航重新实现，数据层使用 Komari 原生 RPC2。

此仓库是为 `small.bismih520.com` 定制的流量额度版本，基于 [tfhmc/serverstatus](https://github.com/tfhmc/serverstatus)。它保留原主题外观，并为每台节点增加剩余流量额度进度条；额度为 `0 B` 的节点显示带 `∞` 的满格绿色进度条。账户状态加载时预留固定空间，避免登录用户刷新页面时短暂出现设置齿轮。

## 功能

- 首页严格遵循后台节点顺序，并支持分组/单表切换、节点详情展开、暗色模式和移动端横向表格。
- 流量额度按照 Komari 节点设置中的统计方式（上传、下载、总和、较大值或较小值）计算；进度条从满格开始，使用后逐渐减少。
- `/network` 提供节点搜索、切换和 24 小时延迟图。
- 左上角读取 Komari 后台上传的 `/favicon.ico`。
- 保留 Komari 原生 `/admin`、`/terminal`、登录和节点详情能力。

标准 4:3 国旗素材来自 [flag-icons](https://github.com/lipis/flag-icons)，按 MIT License 使用。

## 安装

在 Komari 后台的主题管理页面上传仓库根目录的 `ServerStatusQuota3-v1.0.18-quota.3.zip`，随后应用主题。ZIP 根目录包含：

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
