import { useEffect, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import { PrinterScene } from "@/components/dashboard/PrinterScene";
import type { GcodeState, PrinterState } from "@/types/api";
import { stateLabel } from "@/lib/format";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";
const STREAM_URL = "/stream";

interface Props {
  state: PrinterState;
}

export function WebcamPanel({ state }: Props) {
  const [streamFailed, setStreamFailed] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const goFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen();
    }
  };

  const overlayLabel = bottomLabel(state.gcode_state, state.layer_num, state.total_layer_num);

  return (
    <div
      ref={containerRef}
      className="card relative overflow-hidden p-0"
      style={{
        background: "var(--bg-1)",
        border: "1px solid var(--line)",
        borderRadius: "var(--card-r)",
      }}
    >
      {USE_MOCK || streamFailed ? (
        <PrinterScene state={state.gcode_state} percent={state.percent} />
      ) : (
        <img
          src={STREAM_URL}
          alt="Webcam stampante"
          className="block aspect-video w-full object-cover"
          onError={() => setStreamFailed(true)}
        />
      )}
      <div className="webcam-overlay">
        <div className="top">
          <span className="chip live">
            <span className="pulse-dot" />
            LIVE
          </span>
          <div className="flex gap-1">
            <span className="chip mono">1080p · 30fps</span>
            <button
              type="button"
              className="chip"
              style={{ cursor: "pointer" }}
              title="Schermo intero"
              onClick={goFullscreen}
            >
              <Maximize2 size={12} />
            </button>
          </div>
        </div>
        <div className="bottom">
          <span className="chip mono">{overlayLabel}</span>
          <span className="chip mono">
            {now.toLocaleTimeString("it-IT", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      </div>
      {streamFailed && !USE_MOCK && (
        <div className="absolute inset-0 grid place-items-center bg-black/60">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="text-sm text-fg-2">Webcam non raggiungibile</span>
            <button
              type="button"
              className="rounded-md border border-line bg-bg-2 px-3 py-1 text-xs hover:bg-bg-3"
              onClick={() => setStreamFailed(false)}
            >
              Riprova
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function bottomLabel(state: GcodeState, layer: number, total: number): string {
  if (state === "RUNNING") return `Layer ${layer}/${total}`;
  if (state === "PAUSE") return "In pausa";
  if (state === "FAILED") return "Errore di stampa";
  if (state === "FINISH") return "Stampa completata";
  if (state === "PREPARE") return "Preparazione";
  return stateLabel(state);
}
