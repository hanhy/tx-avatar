# tx-avatar

一个可直接联调腾讯云智能数智人的本地 demo。

它包含两部分：

- 前端页面：发起创建会话、启动会话、发送文本驱动、查询状态、关闭会话
- 本地代理：在服务端完成腾讯接口签名，避免把 `AccessToken` 暴露给浏览器

## 1. 运行参数

执行 `npm run dev` 时，命令行会提示你输入以下参数：

- `TENCENT_APP_KEY`
- `TENCENT_ACCESS_TOKEN`
- `TENCENT_VIRTUALMAN_PROJECT_ID`
- `TENCENT_API_BASE`，默认 `https://gw.tvs.qq.com`
- `TENCENT_REGION`，默认 `ap-guangzhou`
- `TENCENT_DEFAULT_PROTOCOL`，默认 `webrtc`
- `TENCENT_DEFAULT_DRIVER_TYPE`，默认 `1`
- `PORT`，默认 `8787`

其中：

- `TENCENT_APP_KEY` 和 `TENCENT_ACCESS_TOKEN` 用于接口签名
- `TENCENT_VIRTUALMAN_PROJECT_ID` 是你在腾讯云数智人平台里的项目 ID
- `TENCENT_DEFAULT_PROTOCOL` 常见可选值是 `webrtc`、`trtc`、`rtmp`
- `TENCENT_DEFAULT_DRIVER_TYPE` 常见值是 `1`（文本驱动）和 `3`（语音驱动）

这些值只会注入到当前启动进程，不会写入仓库文件，也不会提交到 GitHub。

如果你确实想走环境变量方式，也可以手动导出后再运行：

```bash
TENCENT_APP_KEY=xxx \
TENCENT_ACCESS_TOKEN=xxx \
TENCENT_VIRTUALMAN_PROJECT_ID=xxx \
npm run dev
```

## 2. 启动项目

安装依赖：

```bash
npm install
```

本地开发：

```bash
npm run dev
```

运行 `npm run dev` 后，终端会先要求你输入腾讯侧参数，再同时启动本地代理和前端页面。

启动后：

- 前端页面默认在 `http://127.0.0.1:5173`
- 本地代理默认在 `http://127.0.0.1:8787`

## 3. 使用流程

1. 点击“创建会话”
2. 点击“启动会话”
3. 输入文本并点击“发送文本”
4. 如果腾讯接口返回了播放地址，页面会展示出来
5. 某些协议返回的地址需要你接入腾讯对应播放器或业务播放器，浏览器不一定能直接播放

## 4. 当前覆盖的接口

- `createsession`
- `startsession`
- `statsession`
- `command` (`SEND_TEXT`)
- `closesession`

## 5. 官方文档

这个 demo 参考的是腾讯云智能数智人的官方接口文档：

- API 概述：<https://cloud.tencent.com/document/product/1240/90942>
- 接口签名方式：<https://cloud.tencent.com/document/product/1240/107197>
- 创建会话：<https://cloud.tencent.com/document/product/1240/100388>
- 文本驱动：<https://cloud.tencent.com/document/product/1240/100404>

## 6. 限制说明

- 这里实现的是“真实接口调用 demo”，不是官方播放器 SDK 的完整封装
- 页面已经集成 `TCPlayer`，会对 `webrtc://...` 地址自动尝试播放
- 如果播放器初始化失败，通常需要确认浏览器环境，以及 `TCPlayer` 所需 License / 播放域名配置
- 如果你有腾讯官方前端播放器 SDK 名称或示例链接，我可以继续把这一层也补上
