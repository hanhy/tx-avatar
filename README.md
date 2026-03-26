# tx-avatar

一个可直接联调腾讯云智能数智人的本地 demo。

它包含两部分：

- 前端页面：发起创建会话、启动会话、发送文本驱动、查询状态、关闭会话
- 本地代理：在服务端完成腾讯接口签名，避免把 `AccessToken` 暴露给浏览器

## 1. 环境准备

复制环境变量模板：

```bash
cp .env.example .env
```

然后填写以下参数：

```bash
TENCENT_APP_KEY=
TENCENT_ACCESS_TOKEN=
TENCENT_VIRTUALMAN_PROJECT_ID=
TENCENT_API_BASE=https://ivh.tencentcloudapi.com
TENCENT_REGION=ap-guangzhou
TENCENT_DEFAULT_PROTOCOL=WEbrtc
TENCENT_DEFAULT_DRIVER_TYPE=TEXT
PORT=8787
```

其中：

- `TENCENT_APP_KEY` 和 `TENCENT_ACCESS_TOKEN` 用于接口签名
- `TENCENT_VIRTUALMAN_PROJECT_ID` 是你在腾讯云数智人平台里的项目 ID
- `TENCENT_DEFAULT_PROTOCOL` 常见可选值是 `WEbrtc`、`RTMP`、`HLS`

## 2. 启动项目

安装依赖：

```bash
npm install
```

本地开发：

```bash
npm run dev
```

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
- 如果你要在页面里直接播放 `WEbrtc/TRTC` 画面，还需要接入腾讯返回协议对应的播放 SDK
- 如果你有腾讯官方前端播放器 SDK 名称或示例链接，我可以继续把这一层也补上
