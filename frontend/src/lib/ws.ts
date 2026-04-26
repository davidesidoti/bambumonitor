import { MockWebSocket } from "@/lib/mockApi";
import type { WsMessage } from "@/types/api";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

export type WsListener = (msg: WsMessage) => void;

interface PrinterSocket {
  subscribe: (l: WsListener) => () => void;
  close: () => void;
}

interface SocketLike {
  addEventListener(
    event: "open" | "message" | "close",
    cb: (e: { data?: string }) => void,
  ): void;
  send(data: string): void;
  close(): void;
}

let singleton: PrinterSocket | null = null;

function buildUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws`;
}

function open(onMessage: (msg: WsMessage) => void): {
  ws: SocketLike;
  cleanup: () => void;
} {
  const ws: SocketLike = USE_MOCK
    ? (new MockWebSocket() as unknown as SocketLike)
    : (new WebSocket(buildUrl()) as unknown as SocketLike);

  const handleMessage = (e: { data?: string }) => {
    if (!e.data) return;
    try {
      const msg = JSON.parse(e.data) as WsMessage;
      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }
      onMessage(msg);
    } catch {
      /* swallow malformed frames */
    }
  };
  ws.addEventListener("message", handleMessage);

  return { ws, cleanup: () => ws.close() };
}

export function createPrinterSocket(): PrinterSocket {
  if (singleton) return singleton;

  const listeners = new Set<WsListener>();
  let attempt = 0;
  let current: { cleanup: () => void } | null = null;
  let stopped = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const dispatch = (msg: WsMessage) => {
    listeners.forEach((l) => l(msg));
  };

  const connect = () => {
    if (stopped) return;
    const { ws, cleanup } = open((msg) => {
      attempt = 0;
      dispatch(msg);
    });
    current = { cleanup };
    (ws as unknown as { addEventListener: SocketLike["addEventListener"] }).addEventListener(
      "close",
      () => {
        if (stopped) return;
        attempt = Math.min(attempt + 1, 6);
        const delay = Math.min(30_000, 1_000 * 2 ** attempt);
        reconnectTimer = setTimeout(connect, delay);
        dispatch({ type: "delta", patch: {} });
      },
    );
  };

  connect();

  singleton = {
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    close() {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      current?.cleanup();
      singleton = null;
    },
  };
  return singleton;
}
