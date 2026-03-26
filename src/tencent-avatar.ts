export type TencentAvatarSession = {
  sessionId: string;
  startedAt: number;
};

export async function bootTencentAvatar(): Promise<TencentAvatarSession> {
  // Replace this mock with the real Tencent avatar bootstrap flow.
  return {
    sessionId: crypto.randomUUID(),
    startedAt: Date.now(),
  };
}
