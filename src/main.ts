import "./style.css";
import {
  closeSession,
  createSession,
  getConfig,
  getSessionStatus,
  sendText,
  startSession,
  type DemoConfig,
  type SessionCreateData,
  type SessionStatusData,
} from "./api";

type ViewState = {
  sessionId: string;
  playStreamAddr: string;
  sessionStatus: string;
  logs: string[];
  config?: DemoConfig;
};

const state: ViewState = {
  sessionId: "",
  playStreamAddr: "",
  sessionStatus: "idle",
  logs: ["等待加载配置"],
};

function addLog(message: string) {
  const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  state.logs.unshift(`[${time}] ${message}`);
  state.logs = state.logs.slice(0, 8);
  renderLogs();
  renderSummary();
}

function getSessionIdInput() {
  return document.querySelector<HTMLInputElement>("#session-id");
}

function getMessageInput() {
  return document.querySelector<HTMLTextAreaElement>("#message-input");
}

function getProtocolInput() {
  return document.querySelector<HTMLSelectElement>("#protocol");
}

function getDriverTypeInput() {
  return document.querySelector<HTMLSelectElement>("#driver-type");
}

function getUserIdInput() {
  return document.querySelector<HTMLInputElement>("#user-id");
}

function renderConfig() {
  const configRoot = document.querySelector<HTMLUListElement>("#config-list");
  if (!configRoot || !state.config) {
    return;
  }

  const rows = [
    ["API Base", state.config.apiBase],
    ["Region", state.config.region],
    ["Project ID", state.config.projectId || "未配置"],
    ["Protocol", state.config.defaultProtocol],
    ["DriverType", state.config.defaultDriverType],
    ["缺失项", state.config.missing.length ? state.config.missing.join(", ") : "无"],
  ];

  configRoot.innerHTML = rows
    .map(([label, value]) => `<li><span>${label}</span><strong>${value}</strong></li>`)
    .join("");
}

function renderSummary() {
  const summary = document.querySelector<HTMLDivElement>("#session-summary");
  if (!summary) {
    return;
  }

  const stream = state.playStreamAddr || "暂未返回";
  const status = state.sessionStatus || "unknown";

  summary.innerHTML = `
    <div class="summary-card">
      <span>Session ID</span>
      <strong>${state.sessionId || "未创建"}</strong>
    </div>
    <div class="summary-card">
      <span>状态</span>
      <strong>${status}</strong>
    </div>
    <div class="summary-card wide">
      <span>播放地址</span>
      <strong class="stream">${stream}</strong>
    </div>
  `;

  const preview = document.querySelector<HTMLDivElement>("#stream-preview");
  if (!preview) {
    return;
  }

  const canPreview = /^https?:\/\//.test(state.playStreamAddr);
  preview.innerHTML = canPreview
    ? `<video controls playsinline src="${state.playStreamAddr}"></video>`
    : `<p>腾讯接口返回的播放地址通常需要配合 WEbrtc/TRTC 或业务播放器使用。当前 demo 会展示地址，并在地址为 HTTP/HTTPS 时尝试直接预览。</p>`;
}

function renderLogs() {
  const root = document.querySelector<HTMLUListElement>("#log-list");
  if (!root) {
    return;
  }

  root.innerHTML = state.logs.map((item) => `<li>${item}</li>`).join("");
}

function updateSessionFromCreate(data: SessionCreateData) {
  state.sessionId = data.Payload?.SessionId || "";
  state.playStreamAddr = data.Payload?.PlayStreamAddr || "";
  state.sessionStatus = "created";
  getSessionIdInput()!.value = state.sessionId;
  renderSummary();
}

function updateSessionFromStatus(data: SessionStatusData) {
  state.sessionStatus = data.Payload?.SessionStatus || "unknown";
  state.playStreamAddr = data.Payload?.PlayStreamAddr || state.playStreamAddr;
  renderSummary();
}

async function bootstrap() {
  const config = await getConfig();
  state.config = config;
  renderConfig();
  addLog(
    config.missing.length
      ? `代理已启动，但还缺少配置：${config.missing.join(", ")}`
      : "代理配置完整，可以开始创建会话",
  );
}

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <main class="shell">
    <section class="hero">
      <p class="eyebrow">Tencent Digital Human Demo</p>
      <h1>TX Avatar Live Sandbox</h1>
      <p class="lede">
        这个 demo 通过本地代理对接腾讯云智能数智人接口，覆盖创建会话、启动会话、发送文本驱动、查询状态和关闭会话。
      </p>
      <div id="session-summary" class="summary-grid"></div>
    </section>

    <section class="workspace">
      <article class="card">
        <h2>创建会话</h2>
        <div class="field-grid">
          <label>
            <span>User ID</span>
            <input id="user-id" value="demo-user-001" />
          </label>
          <label>
            <span>Protocol</span>
            <select id="protocol">
              <option value="WEbrtc">WEbrtc</option>
              <option value="RTMP">RTMP</option>
              <option value="HLS">HLS</option>
            </select>
          </label>
          <label>
            <span>DriverType</span>
            <select id="driver-type">
              <option value="TEXT">TEXT</option>
              <option value="CHAT">CHAT</option>
            </select>
          </label>
          <label>
            <span>Session ID</span>
            <input id="session-id" placeholder="创建后自动填充" />
          </label>
        </div>
        <div class="actions">
          <button id="create-session" class="primary">1. 创建会话</button>
          <button id="start-session" class="secondary">2. 启动会话</button>
          <button id="refresh-session" class="secondary">查询状态</button>
          <button id="close-session" class="ghost">关闭会话</button>
        </div>
      </article>

      <article class="card">
        <h2>文本驱动</h2>
        <label class="stack">
          <span>要播报的文本</span>
          <textarea id="message-input" rows="5">你好，欢迎来到腾讯数字人测试页面。</textarea>
        </label>
        <label class="checkbox">
          <input id="interrupt" type="checkbox" />
          <span>发送时强制打断当前播报</span>
        </label>
        <div class="actions">
          <button id="send-text" class="primary">3. 发送文本</button>
        </div>
      </article>

      <article class="card">
        <h2>代理配置</h2>
        <ul id="config-list" class="kv-list"></ul>
      </article>

      <article class="card">
        <h2>播放预览</h2>
        <div id="stream-preview" class="preview-box"></div>
      </article>

      <article class="card wide-card">
        <h2>运行日志</h2>
        <ul id="log-list" class="log-list"></ul>
      </article>
    </section>
  </main>
`;

renderSummary();
renderLogs();
bootstrap().catch((error) => {
  addLog(error instanceof Error ? error.message : "配置加载失败");
});

document.querySelector<HTMLButtonElement>("#create-session")?.addEventListener("click", async () => {
  try {
    const data = await createSession({
      userId: getUserIdInput()?.value.trim(),
      protocol: getProtocolInput()?.value,
      driverType: getDriverTypeInput()?.value,
    });
    updateSessionFromCreate(data);
    addLog(`会话创建成功：${state.sessionId || "未返回 SessionId"}`);
  } catch (error) {
    addLog(error instanceof Error ? `创建失败：${error.message}` : "创建失败");
  }
});

document.querySelector<HTMLButtonElement>("#start-session")?.addEventListener("click", async () => {
  try {
    const sessionId = getSessionIdInput()?.value.trim() || state.sessionId;
    if (!sessionId) {
      throw new Error("请先创建会话");
    }
    await startSession(sessionId);
    state.sessionStatus = "started";
    renderSummary();
    addLog(`会话已启动：${sessionId}`);
  } catch (error) {
    addLog(error instanceof Error ? `启动失败：${error.message}` : "启动失败");
  }
});

document.querySelector<HTMLButtonElement>("#refresh-session")?.addEventListener("click", async () => {
  try {
    const sessionId = getSessionIdInput()?.value.trim() || state.sessionId;
    if (!sessionId) {
      throw new Error("缺少 SessionId");
    }
    const data = await getSessionStatus(sessionId);
    updateSessionFromStatus(data);
    addLog(`状态刷新成功：${state.sessionStatus}`);
  } catch (error) {
    addLog(error instanceof Error ? `查询失败：${error.message}` : "查询失败");
  }
});

document.querySelector<HTMLButtonElement>("#send-text")?.addEventListener("click", async () => {
  try {
    const sessionId = getSessionIdInput()?.value.trim() || state.sessionId;
    const text = getMessageInput()?.value.trim() || "";
    const interrupt = document.querySelector<HTMLInputElement>("#interrupt")?.checked || false;

    if (!sessionId) {
      throw new Error("请先创建并启动会话");
    }
    if (!text && !interrupt) {
      throw new Error("请输入播报文本，或至少启用打断");
    }

    await sendText(sessionId, text, interrupt);
    addLog(`文本指令已发送：${text || "Interrupt only"}`);
  } catch (error) {
    addLog(error instanceof Error ? `发送失败：${error.message}` : "发送失败");
  }
});

document.querySelector<HTMLButtonElement>("#close-session")?.addEventListener("click", async () => {
  try {
    const sessionId = getSessionIdInput()?.value.trim() || state.sessionId;
    if (!sessionId) {
      throw new Error("缺少 SessionId");
    }
    await closeSession(sessionId);
    state.sessionStatus = "closed";
    renderSummary();
    addLog(`会话已关闭：${sessionId}`);
  } catch (error) {
    addLog(error instanceof Error ? `关闭失败：${error.message}` : "关闭失败");
  }
});
