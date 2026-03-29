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
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}
