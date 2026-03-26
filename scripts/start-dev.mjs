import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const defaults = {
  TENCENT_API_BASE: "https://ivh.tencentcloudapi.com",
  TENCENT_REGION: "ap-guangzhou",
  TENCENT_DEFAULT_PROTOCOL: "WEbrtc",
  TENCENT_DEFAULT_DRIVER_TYPE: "TEXT",
  PORT: "8787",
};

async function promptValue(readline, label, fallback, hidden = false) {
  const suffix = fallback ? ` [${fallback}]` : "";

  if (!hidden) {
    const value = await readline.question(`${label}${suffix}: `);
    return value.trim() || fallback;
  }

  const originalWrite = stdout.write.bind(stdout);
  stdout.write = (chunk, encoding, callback) => {
    if (typeof chunk === "string" && chunk !== "\n") {
      return originalWrite("*", encoding, callback);
    }
    return originalWrite(chunk, encoding, callback);
  };

  try {
    const value = await readline.question(`${label}${suffix}: `);
    stdout.write("\n");
    return value.trim() || fallback;
  } finally {
    stdout.write = originalWrite;
  }
}

async function collectRuntimeEnv() {
  const readline = createInterface({
    input: stdin,
    output: stdout,
  });

  try {
    console.log("请输入腾讯数字人运行参数。除注明默认值外，其余为必填。");

    const runtimeEnv = {
      TENCENT_APP_KEY: await promptValue(readline, "TENCENT_APP_KEY", ""),
      TENCENT_ACCESS_TOKEN: await promptValue(
        readline,
        "TENCENT_ACCESS_TOKEN",
        "",
        true,
      ),
      TENCENT_VIRTUALMAN_PROJECT_ID: await promptValue(
        readline,
        "TENCENT_VIRTUALMAN_PROJECT_ID",
        "",
      ),
      TENCENT_API_BASE: await promptValue(
        readline,
        "TENCENT_API_BASE",
        defaults.TENCENT_API_BASE,
      ),
      TENCENT_REGION: await promptValue(
        readline,
        "TENCENT_REGION",
        defaults.TENCENT_REGION,
      ),
      TENCENT_DEFAULT_PROTOCOL: await promptValue(
        readline,
        "TENCENT_DEFAULT_PROTOCOL",
        defaults.TENCENT_DEFAULT_PROTOCOL,
      ),
      TENCENT_DEFAULT_DRIVER_TYPE: await promptValue(
        readline,
        "TENCENT_DEFAULT_DRIVER_TYPE",
        defaults.TENCENT_DEFAULT_DRIVER_TYPE,
      ),
      PORT: await promptValue(readline, "PORT", defaults.PORT),
    };

    const missing = [
      "TENCENT_APP_KEY",
      "TENCENT_ACCESS_TOKEN",
      "TENCENT_VIRTUALMAN_PROJECT_ID",
    ].filter((key) => !runtimeEnv[key]);

    if (missing.length > 0) {
      throw new Error(`缺少必填参数：${missing.join(", ")}`);
    }

    return runtimeEnv;
  } finally {
    readline.close();
  }
}

const runtimeEnv = await collectRuntimeEnv();
const sharedEnv = {
  ...process.env,
  ...runtimeEnv,
};

const children = [
  spawn("node", ["server.mjs"], {
    stdio: "inherit",
    shell: false,
    env: sharedEnv,
  }),
  spawn("vite", [], {
    stdio: "inherit",
    shell: true,
    env: sharedEnv,
  }),
];

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
  process.exit(code);
}

for (const child of children) {
  child.on("exit", (code) => {
    if (code && code !== 0) {
      shutdown(code);
    }
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
