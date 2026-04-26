export interface SseEvent {
  event: string;
  data: string;
}

export type SseHandler = (e: SseEvent) => void;

/**
 * Open an EventSource and route both named and unnamed events to a single
 * handler. Returns a teardown function. The browser auto-reconnects on
 * connection drop; pass `oneShot: true` to close on the first `done` event.
 */
export function openSse(
  path: string,
  onEvent: SseHandler,
  options: { oneShot?: boolean; onError?: (e: Event) => void } = {},
): () => void {
  const es = new EventSource(path);

  const onMessage = (ev: MessageEvent) => {
    onEvent({ event: "message", data: String(ev.data ?? "") });
  };
  const onLog = (ev: MessageEvent) => {
    onEvent({ event: "log", data: String(ev.data ?? "") });
  };
  const onErrEvt = (ev: MessageEvent) => {
    onEvent({ event: "error", data: String(ev.data ?? "") });
  };
  const onDone = (ev: MessageEvent) => {
    onEvent({ event: "done", data: String(ev.data ?? "") });
    if (options.oneShot) es.close();
  };

  es.addEventListener("message", onMessage);
  es.addEventListener("log", onLog);
  es.addEventListener("error", onErrEvt);
  es.addEventListener("done", onDone);
  if (options.onError) es.onerror = options.onError;

  return () => es.close();
}
