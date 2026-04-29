# Bookingcal

Bookingcal 是一个“可预约时间展示 + 预约话术一键复制”的轻量 Web 应用，适合个人工作室/个人服务者使用：它会拉取并聚合多个日历源（例如个人工作室的工作日历 + 节假日日历），将用户可预约的时间段直观呈现出来，用户点选后即可快速生成并复制预约文案。

## 核心功能

- 聚合多个 iCal（.ics）日历源：工作日历、节假日日历等
- 计算并展示可预约时间段（可预约 / 不可预约）
- 点击时间段生成预约文案，并一键复制到剪贴板
- 自动刷新日程（前端定时拉取更新）

## 项目结构（简要）

- `src/`：前端（React + Vite + Tailwind）
- `api/calendar.js`：后端代理接口（用于从日历源拉取 .ics，并解决浏览器侧的跨域限制）
- `public/assets/`：静态资源（顶部图、favicon 等）

## 本地开发

```bash
npm install
npm run dev
```

## 配置日历源

项目通过 `/api/calendar?type=work|holiday` 拉取日历数据，你可以在 [calendar.js](file:///Users/jojo/Documents/%E7%BC%96%E7%A8%8B/Bookingcal-web/api/calendar.js) 中替换对应的日历地址：

- `type=work`：你的个人/工作室日历（.ics）
- `type=holiday`：节假日日历（.ics）

改完后重新部署即可生效。

## 日历来源建议

- iOS 用户：可直接使用 Apple 日历里的共享链接（.ics）作为工作日历来源。
- 安卓用户：推荐使用 Outlook 账户维护日历，然后在电脑网页端生成并分享 .ics 链接接入系统。
- 公共节假日：可使用公开节假日 .ics 链接作为 `type=holiday`。

## 备注

- 资源路径示例：顶部图为 `/assets/topimg.webp`，favicon 为 `/assets/favcon.webp`。
- 时区：内部按照 UTC+8（上海/北京）进行日期计算与展示。
