import { spawn } from "node:child_process";

const children = [
  spawn("node", ["--env-file=.env", "server.mjs"], {
    stdio: "inherit",
    shell: false,
  }),
  spawn("vite", [], {
    stdio: "inherit",
    shell: true,
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
