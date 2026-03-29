export type DemoConfig = {
  apiBase: string;
  region: string;
  projectId: string;
  defaultProtocol: string;
  defaultDriverType: string;
  missing: string[];
};

export type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

export type SessionCreateData = {
  Header?: {
    Code?: number;
    Message?: string;
    RequestID?: string;
  };
  Payload?: {
    SessionId?: string;
    PlayStreamAddr?: string;
    Protocol?: string;
    DriverType?: string | number;
    SessionStatus?: string | number;
  };
};

export type SessionStatusData = {
  Header?: {
    Code?: number;
    Message?: string;
    RequestID?: string;
  };
  Payload?: {
    SessionId?: string;
    SessionStatus?: string | number;
    PlayStreamAddr?: string;
    IsSessionStarted?: boolean;
    SpeakStatus?: string;
  };
};

export type StreamStatusData = {
  Header?: {
    Code?: number;
    Message?: string;
    RequestID?: string;
  };
  Payload?: {
    SessionStatus?: string | number;
    PlayStreamAddr?: string;
    ReqId?: string;
    ErrorCode?: number;
    ErrorMessage?: string;
  };
};

export type CloseAllSessionsData = {
  list?: unknown;
  closed?: string[];
  failed?: Array<{
    sessionId: string;
    error: string;
  }>;
};

type JsonObject = Record<string, unknown>;

type TencentHeader = {
  Code?: number;
  Message?: string;
};

type TencentEnvelope = {
  Header?: TencentHeader;
};

function assertTencentSuccess(data: unknown) {
  const candidate = data as TencentEnvelope | undefined;
  const header = candidate?.Header;

  if (!header) {
    return;
  }

  if ((header.Code ?? 0) !== 0) {
    throw new Error(header.Message || `Tencent API failed with code ${header.Code}`);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
    },
    ...init,
  });

  const json = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || !json.ok || !json.data) {
    throw new Error(json.error || "Request failed");
  }

  assertTencentSuccess(json.data);

  return json.data;
}

export function getConfig() {
  return request<DemoConfig>("/api/config");
}

export function createSession(payload: JsonObject) {
  return request<SessionCreateData>("/api/session/create", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function startSession(sessionId: string) {
  return request<JsonObject>("/api/session/start", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export function getSessionStatus(sessionId: string) {
  return request<SessionStatusData>("/api/session/status", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export function getStreamStatus(sessionId: string) {
  return request<StreamStatusData>("/api/stream/status", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export function sendText(sessionId: string, text: string, interrupt: boolean) {
  return request<JsonObject>("/api/session/command", {
    method: "POST",
    body: JSON.stringify({ sessionId, text, interrupt }),
  });
}

export function closeSession(sessionId: string) {
  return request<JsonObject>("/api/session/close", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export function closeAllSessions() {
  return request<CloseAllSessionsData>("/api/session/close-all", {
    method: "POST",
    body: JSON.stringify({}),
  });
}
