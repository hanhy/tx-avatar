# tx-avatar

一个用于测试腾讯数字人接入流程的最小前端项目。

## 已初始化内容

- `Vite + TypeScript` 基础脚手架
- `.env.example` 腾讯侧配置占位
- 一个简单的测试页面
- `src/tencent-avatar.ts` 预留的接入边界

## 本地启动

```bash
npm install
npm run dev
```

## 建议接入方式

1. 复制 `.env.example` 为 `.env` 并填入腾讯侧参数。
2. 在 `src/tencent-avatar.ts` 中接入实际的鉴权、会话创建和播放逻辑。
3. 将 `src/main.ts` 中的按钮事件替换为真实调用链路。
