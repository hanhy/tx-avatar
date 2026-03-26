import "./style.css";

type AvatarConfig = {
  appId: string;
  avatarId: string;
  region: string;
  apiBase: string;
};

const config: AvatarConfig = {
  appId: import.meta.env.VITE_TENCENT_APP_ID ?? "",
  avatarId: import.meta.env.VITE_TENCENT_AVATAR_ID ?? "",
  region: import.meta.env.VITE_TENCENT_REGION ?? "ap-guangzhou",
  apiBase: import.meta.env.VITE_TENCENT_API_BASE ?? "",
};

const configRows = [
  ["App ID", config.appId || "未配置"],
  ["Avatar ID", config.avatarId || "未配置"],
  ["Region", config.region],
  ["API Base", config.apiBase || "未配置"],
];

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <main class="shell">
    <section class="hero">
      <p class="eyebrow">Tencent Digital Human</p>
      <h1>TX Avatar Sandbox</h1>
      <p class="lede">
        这个项目用于快速验证腾讯数字人接入链路。当前脚手架提供本地调试入口、环境变量占位和一个最小测试面板。
      </p>
      <div class="actions">
        <button id="boot-button" class="primary">模拟初始化</button>
        <button id="check-button" class="secondary">检查配置</button>
      </div>
      <p id="status" class="status">状态：等待初始化</p>
    </section>

    <section class="panel-grid">
      <article class="card">
        <h2>环境配置</h2>
        <ul class="kv-list">
          ${configRows
            .map(
              ([label, value]) =>
                `<li><span>${label}</span><strong>${value}</strong></li>`,
            )
            .join("")}
        </ul>
      </article>

      <article class="card">
        <h2>下一步建议</h2>
        <ol class="todo-list">
          <li>补齐 `.env` 中的腾讯侧业务参数。</li>
          <li>在 `src/tencent-avatar.ts` 中接入真实 SDK 或后端签名接口。</li>
          <li>将“模拟初始化”替换成真实拉起、播放与事件监听逻辑。</li>
        </ol>
      </article>
    </section>
  </main>
`;

const status = document.querySelector<HTMLParagraphElement>("#status");

document.querySelector<HTMLButtonElement>("#boot-button")?.addEventListener("click", () => {
  if (!status) {
    return;
  }

  status.textContent = "状态：已完成模拟初始化，可继续接入腾讯 SDK";
});

document.querySelector<HTMLButtonElement>("#check-button")?.addEventListener("click", () => {
  if (!status) {
    return;
  }

  const missingKeys = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  status.textContent = missingKeys.length
    ? `状态：缺少配置 ${missingKeys.join(", ")}`
    : "状态：基础配置完整，可以开始接腾讯接口";
});
