import "./style.css";
import {
  closeAllSessions,
  closeSession,
  createSession,
  getConfig,
  getSessionStatus,
  getStreamStatus,
  sendText,
  startSession,
  type DemoConfig,
  type SessionCreateData,
  type SessionStatusData,
  type StreamStatusData,
} from "./api";

type ViewState = {
  sessionId: string;
  playStreamAddr: string;
  sessionStatus: string;
  logs: string[];
  interviewLines: string[];
  interviewIndex: number;
  interviewHistory: string[];
  config?: DemoConfig;
};

const SESSION_STORAGE_KEY = "tx-avatar:known-session-ids";
const READY_SESSION_STATUS = "1";
const FAILED_STREAM_STATUS = "4";
const TIMED_OUT_STREAM_STATUS = "5";
const SESSION_READY_TIMEOUT_MS = 20_000;
const SESSION_READY_POLL_MS = 1_000;
let tcPlayerInstance: TcPlayerInstance | null = null;
let renderedStreamUrl = "";

const state: ViewState = {
  sessionId: "",
  playStreamAddr: "",
  sessionStatus: "idle",
  logs: ["等待加载配置"],
  interviewLines: [],
  interviewIndex: -1,
  interviewHistory: [],
};

function addLog(message: string) {
  const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  state.logs.unshift(`[${time}] ${message}`);
  state.logs = state.logs.slice(0, 8);
  renderLogs();
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

function getInterviewFileInput() {
  return document.querySelector<HTMLInputElement>("#interview-file");
}

function getCandidateAnswerInput() {
  return document.querySelector<HTMLTextAreaElement>("#candidate-answer");
}

function loadKnownSessionIds() {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === "string" && item.length > 0);
  } catch {
    return [];
  }
}

function saveKnownSessionIds(sessionIds: string[]) {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify([...new Set(sessionIds)]));
}

function rememberSessionId(sessionId: string) {
  if (!sessionId) {
    return;
  }

  const knownSessionIds = loadKnownSessionIds();
  saveKnownSessionIds([...knownSessionIds, sessionId]);
}

function forgetSessionId(sessionId: string) {
  if (!sessionId) {
    return;
  }

  const knownSessionIds = loadKnownSessionIds().filter((item) => item !== sessionId);
  saveKnownSessionIds(knownSessionIds);
}

function clearCurrentSession() {
  state.sessionId = "";
  state.playStreamAddr = "";
  state.sessionStatus = "idle";
  renderedStreamUrl = "";

  const sessionIdInput = getSessionIdInput();
  if (sessionIdInput) {
    sessionIdInput.value = "";
  }

  renderSummary();
}

function destroyTcPlayer() {
  tcPlayerInstance?.dispose?.();
  tcPlayerInstance = null;
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

  renderPlayer(preview, state.playStreamAddr);
}

function renderPlayer(preview: HTMLDivElement, streamUrl: string) {
  if (streamUrl === renderedStreamUrl && tcPlayerInstance) {
    return;
  }

  destroyTcPlayer();
  renderedStreamUrl = streamUrl;

  if (!streamUrl) {
    preview.innerHTML =
      "<p>创建并启动会话后，播放地址会显示在这里。拿到 webrtc:// 地址后，页面会优先尝试用腾讯播放器播放。</p>";
    return;
  }

  if (!window.TCPlayer) {
    preview.innerHTML = `<p>腾讯播放器脚本未成功加载。当前地址：${streamUrl}</p>`;
    return;
  }

  preview.innerHTML =
    '<video id="tc-player" class="video-js vjs-default-skin" playsinline controls muted></video>';

  try {
    tcPlayerInstance = window.TCPlayer("tc-player", {
      sources: [
        {
          src: streamUrl,
          type: streamUrl.startsWith("webrtc://") ? "video/webRTC" : "application/x-mpegURL",
        },
      ],
      autoplay: true,
      muted: true,
      controls: true,
      live: true,
      fluid: true,
      preload: "auto",
      webrtcConfig: {
        connectRetryLimit: 3,
        debugLog: true,
      },
    });

    const player = tcPlayerInstance;
    const playerEvents = [
      "play",
      "playing",
      "canplay",
      "loadedmetadata",
      "error",
      "webrtcwaitstart",
      "webrtcwaitend",
      "webrtcstop",
    ];

    for (const eventName of playerEvents) {
      player.on?.(eventName, (payload) => {
        addLog(
          `播放器事件：${eventName}${
            payload ? ` ${JSON.stringify(payload).slice(0, 180)}` : ""
          }`,
        );
      });
    }

    player.ready?.(() => {
      addLog("播放器初始化完成，开始尝试播放");
      try {
        const playResult = player.play?.();
        if (playResult && typeof (playResult as Promise<void>).catch === "function") {
          void (playResult as Promise<void>).catch((error) => {
            addLog(error instanceof Error ? `播放器 play() 失败：${error.message}` : "播放器 play() 失败");
          });
        }
      } catch (error) {
        addLog(error instanceof Error ? `播放器启动失败：${error.message}` : "播放器启动失败");
      }
    });
  } catch (error) {
    preview.innerHTML = `<p>${
      error instanceof Error ? error.message : "腾讯播放器初始化失败"
    }。当前地址：${streamUrl}</p>`;
  }
}

function renderLogs() {
  const root = document.querySelector<HTMLUListElement>("#log-list");
  if (!root) {
    return;
  }

  root.innerHTML = state.logs.map((item) => `<li>${item}</li>`).join("");
}

function renderInterviewState() {
  const scriptMeta = document.querySelector<HTMLParagraphElement>("#script-meta");
  if (scriptMeta) {
    scriptMeta.textContent = state.interviewLines.length
      ? `已加载 ${state.interviewLines.length} 条主考官话术，当前进度 ${Math.max(state.interviewIndex + 1, 0)}/${state.interviewLines.length}`
      : "尚未加载面试脚本";
  }

  const currentQuestion = document.querySelector<HTMLDivElement>("#current-question");
  if (currentQuestion) {
    currentQuestion.textContent =
      state.interviewIndex >= 0 && state.interviewIndex < state.interviewLines.length
        ? state.interviewLines[state.interviewIndex]
        : "点击“开始面试”后，这里会显示当前主考官题目。";
  }

  const history = document.querySelector<HTMLUListElement>("#interview-history");
  if (history) {
    history.innerHTML = state.interviewHistory.length
      ? state.interviewHistory.map((item) => `<li>${item}</li>`).join("")
      : "<li>尚无面试对话记录</li>";
  }
}

function normalizeInterviewLine(line: string) {
  return line.replace(/^主考官[:：]\s*/, "").trim();
}

function parseInterviewScript(content: string) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("主考官：") || line.startsWith("主考官:"))
    .map(normalizeInterviewLine)
    .filter((line) => line.length > 0);
}

async function speakAsExaminer(text: string) {
  const sessionId = getSessionIdInput()?.value.trim() || state.sessionId;
  if (!sessionId) {
    throw new Error("请先创建并启动会话");
  }

  await waitForSessionReady(sessionId);
  await waitForStreamReady(sessionId);
  await sendText(sessionId, text, false);
  addLog(`主考官播报：${text}`);
}

async function advanceInterview(afterAnswer: boolean) {
  if (state.interviewLines.length === 0) {
    throw new Error("请先加载面试脚本");
  }

  if (afterAnswer) {
    const answerInput = getCandidateAnswerInput();
    const answer = answerInput?.value.trim() || "";
    if (!answer) {
      throw new Error("请先填写考生回答");
    }

    const nextIndex = state.interviewIndex + 1;
    state.interviewHistory.push(`考生：${answer}`);
    answerInput!.value = "";

    if (nextIndex >= state.interviewLines.length) {
      await speakAsExaminer("好的，本轮面试到这里结束。");
      state.interviewHistory.push("主考官：好的，本轮面试到这里结束。");
      state.interviewIndex = state.interviewLines.length;
      renderInterviewState();
      return;
    }

    const nextQuestion = state.interviewLines[nextIndex];
    await speakAsExaminer(`好的。${nextQuestion}`);
    state.interviewHistory.push(`主考官：好的。${nextQuestion}`);
    state.interviewIndex = nextIndex;
    renderInterviewState();
    return;
  }

  const firstIndex = 0;
  const firstQuestion = state.interviewLines[firstIndex];
  await speakAsExaminer(firstQuestion);
  state.interviewHistory.push(`主考官：${firstQuestion}`);
  state.interviewIndex = firstIndex;
  renderInterviewState();
}

function updateSessionFromCreate(data: SessionCreateData) {
  const sessionId = data.Payload?.SessionId || "";
  if (!sessionId) {
    throw new Error("创建会话成功响应里没有 SessionId");
  }

  state.sessionId = sessionId;
  state.playStreamAddr = data.Payload?.PlayStreamAddr || "";
  state.sessionStatus = `${data.Payload?.SessionStatus ?? "created"}`;
  getSessionIdInput()!.value = state.sessionId;
  rememberSessionId(sessionId);
  renderSummary();
}

function updateSessionFromStatus(data: SessionStatusData) {
  state.sessionStatus = `${data.Payload?.SessionStatus ?? "unknown"}`;
  state.playStreamAddr = data.Payload?.PlayStreamAddr || state.playStreamAddr;
  renderSummary();
}

function updateStreamFromStatus(data: StreamStatusData) {
  state.sessionStatus = `${data.Payload?.SessionStatus ?? state.sessionStatus ?? "unknown"}`;
  state.playStreamAddr = data.Payload?.PlayStreamAddr || state.playStreamAddr;
  renderSummary();
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function waitForSessionReady(sessionId: string) {
  const startedAt = Date.now();
  let lastKnownStatus = state.sessionStatus;

  while (Date.now() - startedAt < SESSION_READY_TIMEOUT_MS) {
    const data = await getSessionStatus(sessionId);
    updateSessionFromStatus(data);
    lastKnownStatus = `${data.Payload?.SessionStatus ?? "unknown"}`;

    if (lastKnownStatus === READY_SESSION_STATUS) {
      return data;
    }

    await sleep(SESSION_READY_POLL_MS);
  }

  throw new Error(`会话在 ${SESSION_READY_TIMEOUT_MS / 1000} 秒内未就绪，当前状态：${lastKnownStatus}`);
}

async function waitForStreamReady(sessionId: string) {
  const startedAt = Date.now();
  let lastKnownStatus = state.sessionStatus;

  while (Date.now() - startedAt < SESSION_READY_TIMEOUT_MS) {
    const data = await getStreamStatus(sessionId);
    updateStreamFromStatus(data);
    lastKnownStatus = `${data.Payload?.SessionStatus ?? "unknown"}`;

    if (lastKnownStatus === READY_SESSION_STATUS) {
      return data;
    }

    if (lastKnownStatus === FAILED_STREAM_STATUS || lastKnownStatus === TIMED_OUT_STREAM_STATUS) {
      throw new Error(
        data.Payload?.ErrorMessage ||
          `流状态异常：${lastKnownStatus}，错误码：${data.Payload?.ErrorCode ?? "unknown"}`,
      );
    }

    await sleep(SESSION_READY_POLL_MS);
  }

  throw new Error(`流在 ${SESSION_READY_TIMEOUT_MS / 1000} 秒内未就绪，当前状态：${lastKnownStatus}`);
}

async function bootstrap() {
  const config = await getConfig();
  state.config = config;
  renderConfig();
  await cleanupSessionsOnServer();
  await cleanupKnownSessions();
  addLog(
    config.missing.length
      ? `代理已启动，但还缺少配置：${config.missing.join(", ")}`
      : "代理配置完整，可以开始创建会话",
  );
}

async function cleanupSessionsOnServer() {
  const result = await closeAllSessions();
  const closedCount = result.closed?.length ?? 0;
  const failedCount = result.failed?.length ?? 0;

  if (closedCount === 0 && failedCount === 0) {
    addLog("服务端未发现需要关闭的进行中会话");
    return;
  }

  if (closedCount > 0) {
    addLog(`服务端启动清理完成，已关闭 ${closedCount} 个会话`);
  }

  if (failedCount > 0) {
    addLog(`服务端启动清理有 ${failedCount} 个会话关闭失败`);
  }
}

async function cleanupKnownSessions() {
  const knownSessionIds = loadKnownSessionIds();
  if (knownSessionIds.length === 0) {
    addLog("启动时未发现需要清理的旧会话");
    return;
  }

  addLog(`启动时尝试清理 ${knownSessionIds.length} 个旧会话`);

  const closedSessionIds: string[] = [];
  const failedSessionIds: string[] = [];
  for (const sessionId of knownSessionIds) {
    try {
      await closeSession(sessionId);
      closedSessionIds.push(sessionId);
    } catch (error) {
      failedSessionIds.push(sessionId);
      addLog(
        error instanceof Error
          ? `旧会话关闭失败：${sessionId} - ${error.message}`
          : `旧会话关闭失败：${sessionId}`,
      );
    }
  }

  if (closedSessionIds.length > 0) {
    addLog(`启动时已关闭旧会话：${closedSessionIds.join(", ")}`);
  }

  saveKnownSessionIds(failedSessionIds);
  clearCurrentSession();
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

    <section class="stage">
      <div class="stage-main">
        <article class="card preview-stage">
          <h2>播放预览</h2>
          <div id="stream-preview" class="preview-box preview-box-stage"></div>
        </article>

        <article class="card dock-card answer-card">
          <h2>考生回答</h2>
          <label class="stack">
            <span>回答内容</span>
            <textarea
              id="candidate-answer"
              rows="6"
              placeholder="主考官提问后，在这里填写考生回答。"
            ></textarea>
          </label>
          <div class="actions">
            <button id="submit-answer" class="secondary">提交回答并下一题</button>
          </div>
          <ul id="interview-history" class="history-list">
            <li>尚无面试对话记录</li>
          </ul>
        </article>
      </div>

      <article class="card script-bar">
        <h2>面试脚本</h2>
        <div class="script-bar-content">
          <div class="script-bar-main">
            <p id="script-meta" class="helper-text">尚未加载面试脚本</p>
            <label class="stack">
              <span>导入话术脚本 TXT</span>
              <input id="interview-file" type="file" accept=".txt,text/plain" />
            </label>
          </div>
          <div class="question-box script-question-box">
            <span>当前题目</span>
            <div id="current-question">点击“开始面试”后，这里会显示当前主考官题目。</div>
          </div>
          <div class="actions script-actions">
            <button id="start-interview" class="primary">开始面试</button>
          </div>
        </div>
      </article>
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
              <option value="webrtc">webrtc</option>
              <option value="trtc">trtc</option>
              <option value="rtmp">rtmp</option>
            </select>
          </label>
          <label>
            <span>DriverType</span>
            <select id="driver-type">
              <option value="1">1 - 文本驱动</option>
              <option value="3">3 - 语音驱动</option>
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

      <article class="card wide-card">
        <h2>运行日志</h2>
        <ul id="log-list" class="log-list"></ul>
      </article>
    </section>
  </main>
`;

renderSummary();
renderLogs();
renderInterviewState();
bootstrap().catch((error) => {
  addLog(error instanceof Error ? error.message : "配置加载失败");
});

getInterviewFileInput()?.addEventListener("change", async (event) => {
  try {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }

    const content = await file.text();
    const interviewLines = parseInterviewScript(content);
    if (interviewLines.length === 0) {
      throw new Error("脚本里没有识别到“主考官：xxx”格式的话术");
    }

    state.interviewLines = interviewLines;
    state.interviewIndex = -1;
    state.interviewHistory = [];
    renderInterviewState();
    addLog(`面试脚本加载成功，共 ${interviewLines.length} 条话术`);
  } catch (error) {
    addLog(error instanceof Error ? `脚本加载失败：${error.message}` : "脚本加载失败");
  }
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

    addLog(`等待会话就绪：${sessionId}`);
    await waitForSessionReady(sessionId);
    await startSession(sessionId);
    addLog(`等待流就绪：${sessionId}`);
    await waitForStreamReady(sessionId);
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

    await waitForSessionReady(sessionId);
    await waitForStreamReady(sessionId);
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
    forgetSessionId(sessionId);
    destroyTcPlayer();
    clearCurrentSession();
    state.sessionStatus = "closed";
    renderSummary();
    addLog(`会话已关闭：${sessionId}`);
  } catch (error) {
    addLog(error instanceof Error ? `关闭失败：${error.message}` : "关闭失败");
  }
});

document.querySelector<HTMLButtonElement>("#start-interview")?.addEventListener("click", async () => {
  try {
    if (state.interviewLines.length === 0) {
      throw new Error("请先加载面试脚本");
    }

    state.interviewIndex = -1;
    state.interviewHistory = [];
    renderInterviewState();
    await advanceInterview(false);
  } catch (error) {
    addLog(error instanceof Error ? `开始面试失败：${error.message}` : "开始面试失败");
  }
});

document.querySelector<HTMLButtonElement>("#submit-answer")?.addEventListener("click", async () => {
  try {
    if (state.interviewIndex < 0) {
      throw new Error("请先点击“开始面试”");
    }

    await advanceInterview(true);
  } catch (error) {
    addLog(error instanceof Error ? `提交回答失败：${error.message}` : "提交回答失败");
  }
});
