import { createHmac, randomUUID } from "node:crypto";
import { createServer } from "node:http";

const env = {
  apiBase: process.env.TENCENT_API_BASE || "https://gw.tvs.qq.com",
  appKey: process.env.TENCENT_APP_KEY || "",
  accessToken: process.env.TENCENT_ACCESS_TOKEN || "",
  projectId: process.env.TENCENT_VIRTUALMAN_PROJECT_ID || "",
  region: process.env.TENCENT_REGION || "ap-guangzhou",
  defaultProtocol: process.env.TENCENT_DEFAULT_PROTOCOL || "webrtc",
  defaultDriverType: process.env.TENCENT_DEFAULT_DRIVER_TYPE || "1",
  port: Number(process.env.PORT || 8787),
};

const jsonHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, jsonHeaders);
  response.end(JSON.stringify(data, null, 2));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
    });
    request.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function getSignature(parameters) {
  const signingContent = Object.entries(parameters)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const hmac = createHmac("sha256", env.accessToken);
  hmac.update(signingContent);
  const signature = encodeURIComponent(hmac.digest("base64"));

  return `${signingContent}&signature=${signature}`;
}

function getSignedUrl(pathname) {
  const timestamp = `${Math.floor(Date.now() / 1000)}`;
  const query = getSignature({
    appkey: env.appKey,
    timestamp,
  });

  return `${env.apiBase}${pathname}?${query}`;
}

function requireConfig() {
  const missing = [];

  if (!env.appKey) {
    missing.push("TENCENT_APP_KEY");
  }
  if (!env.accessToken) {
    missing.push("TENCENT_ACCESS_TOKEN");
  }
  if (!env.projectId) {
    missing.push("TENCENT_VIRTUALMAN_PROJECT_ID");
  }

  return missing;
}

async function postTencent(pathname, payload) {
  const response = await fetch(getSignedUrl(pathname), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      Header: {},
      Payload: payload,
    }),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message =
      typeof data?.message === "string"
        ? data.message
        : `Tencent API returned ${response.status}`;
    throw new Error(message);
  }

  return data;
}

function extractTencentError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

async function handleCreateSession(body) {
  return postTencent("/v2/ivh/sessionmanager/sessionmanagerservice/createsession", {
    ReqId: body.reqId || randomUUID().replaceAll("-", ""),
    VirtualmanProjectId: body.projectId || env.projectId,
    UserId: body.userId || `demo-${Date.now()}`,
    Protocol: body.protocol || env.defaultProtocol,
    DriverType: Number(body.driverType || env.defaultDriverType),
  });
}

async function handleStartSession(body) {
  return postTencent("/v2/ivh/sessionmanager/sessionmanagerservice/startsession", {
    ReqId: body.reqId || randomUUID().replaceAll("-", ""),
    SessionId: body.sessionId,
  });
}

async function handleSessionStatus(body) {
  return postTencent("/v2/ivh/sessionmanager/sessionmanagerservice/statsession", {
    ReqId: body.reqId || randomUUID().replaceAll("-", ""),
    SessionId: body.sessionId,
  });
}

async function handleSendText(body) {
  return postTencent("/v2/ivh/interactdriver/interactdriverservice/command", {
    ReqId: body.reqId || randomUUID().replaceAll("-", ""),
    SessionId: body.sessionId,
    Command: "SEND_TEXT",
    Data: {
      Text: body.text || "",
      Interrupt: Boolean(body.interrupt),
      ...(body.chatCommand ? { ChatCommand: body.chatCommand } : {}),
    },
  });
}

async function handleCloseSession(body) {
  return postTencent("/v2/ivh/sessionmanager/sessionmanagerservice/closesession", {
    ReqId: body.reqId || randomUUID().replaceAll("-", ""),
    SessionId: body.sessionId,
  });
}

async function handleListProjectSessions(body) {
  return postTencent(
    "/v2/ivh/sessionmanager/sessionmanagerservice/listsessionofprojectid",
    {
      ReqId: body.reqId || randomUUID().replaceAll("-", ""),
      VirtualmanProjectId: body.projectId || env.projectId,
    },
  );
}

async function handleCloseAllSessions(body) {
  const listResponse = await handleListProjectSessions(body);
  const payload = listResponse?.Payload;
  const candidates = [
    ...(Array.isArray(payload?.SessionInfoList) ? payload.SessionInfoList : []),
    ...(Array.isArray(payload?.SessionList) ? payload.SessionList : []),
    ...(Array.isArray(payload?.Sessions) ? payload.Sessions : []),
  ];

  const sessionIds = candidates
    .map((item) => {
      if (!item || typeof item !== "object") {
        return "";
      }

      return item.SessionId || item.sessionId || "";
    })
    .filter((sessionId) => typeof sessionId === "string" && sessionId.length > 0);

  const closed = [];
  const failed = [];

  for (const sessionId of sessionIds) {
    try {
      await handleCloseSession({ sessionId });
      closed.push(sessionId);
    } catch (error) {
      failed.push({
        sessionId,
        error: extractTencentError(error),
      });
    }
  }

  return {
    list: listResponse,
    closed,
    failed,
  };
}

const routes = {
  "GET /api/config": async () => ({
    apiBase: env.apiBase,
    region: env.region,
    projectId: env.projectId,
    defaultProtocol: env.defaultProtocol,
    defaultDriverType: env.defaultDriverType,
    missing: requireConfig(),
  }),
  "POST /api/session/create": handleCreateSession,
  "POST /api/session/start": handleStartSession,
  "POST /api/session/status": handleSessionStatus,
  "POST /api/session/command": handleSendText,
  "POST /api/session/close": handleCloseSession,
  "POST /api/session/close-all": handleCloseAllSessions,
};

const server = createServer(async (request, response) => {
  if (!request.url || !request.method) {
    sendJson(response, 400, { ok: false, error: "Invalid request" });
    return;
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204, jsonHeaders);
    response.end();
    return;
  }

  const routeKey = `${request.method} ${request.url}`;
  const route = routes[routeKey];

  if (!route) {
    sendJson(response, 404, { ok: false, error: "Route not found" });
    return;
  }

  const missing = requireConfig();
  if (request.url !== "/api/config" && missing.length > 0) {
    sendJson(response, 400, {
      ok: false,
      error: `Missing config: ${missing.join(", ")}`,
    });
    return;
  }

  try {
    const body = request.method === "GET" ? {} : await readJson(request);
    const data = await route(body);
    sendJson(response, 200, { ok: true, data });
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      error: extractTencentError(error),
    });
  }
});

server.listen(env.port, () => {
  console.log(`Tencent avatar proxy listening on http://127.0.0.1:${env.port}`);
});
