interface TcPlayerInstance {
  dispose?: () => void;
  play?: () => void | Promise<void>;
  on?: (event: string, handler: (payload?: unknown) => void) => void;
  ready?: (handler: () => void) => void;
}

interface TcPlayerFactory {
  (
    id: string,
    options: {
      sources: Array<{
        src: string;
        type: string;
      }>;
      autoplay?: boolean;
      muted?: boolean;
      controls?: boolean;
      live?: boolean;
      fluid?: boolean;
      preload?: string;
      webrtcConfig?: {
        connectRetryLimit?: number;
        debugLog?: boolean;
      };
    },
  ): TcPlayerInstance;
}

interface Window {
  TCPlayer?: TcPlayerFactory;
}
