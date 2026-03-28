interface TcPlayerInstance {
  destroy?: () => void;
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
      };
    },
  ): TcPlayerInstance;
}

interface Window {
  TCPlayer?: TcPlayerFactory;
}
