import { format, formatDistanceToNowStrict } from "date-fns";
import { it } from "date-fns/locale";
import type { GcodeState, PrintStatus } from "@/types/api";

export const IT_GCODE_LABEL: Record<GcodeState, string> = {
  IDLE: "In attesa",
  PREPARE: "Preparazione",
  RUNNING: "In stampa",
  PAUSE: "In pausa",
  FINISH: "Completata",
  FAILED: "Fallita",
};

export const IT_PRINT_STATUS_LABEL: Record<PrintStatus, string> = {
  running: "In stampa",
  finished: "Completata",
  failed: "Fallita",
  cancelled: "Annullata",
};

export const SPEED_LABEL: Record<number, string> = {
  1: "Silenzioso",
  2: "Standard",
  3: "Sport",
  4: "Ludicrous",
};

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

export function formatMinutes(min: number | null | undefined): string {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = Math.floor(min % 60);
  if (h) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m`;
}

export function formatETA(remainingMin: number): string {
  const t = new Date(Date.now() + remainingMin * 60_000);
  return format(t, "HH:mm");
}

export function formatDateIT(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return format(d, "dd MMM yy, HH:mm", { locale: it });
}

export function formatRelative(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return formatDistanceToNowStrict(d, { addSuffix: true, locale: it });
}

export function tempColor(temp: number, target: number): string {
  if (target === 0) return "var(--info)";
  const heating = Math.abs(temp - target) > 2;
  return heating ? "var(--warn)" : "var(--ok)";
}

export function badgeClass(state: GcodeState | PrintStatus | string): string {
  const map: Record<string, string> = {
    RUNNING: "badge-running",
    PAUSE: "badge-paused",
    FAILED: "badge-failed",
    FINISH: "badge-finished",
    IDLE: "badge-idle",
    PREPARE: "badge-prepare",
    running: "badge-running",
    finished: "badge-finished",
    failed: "badge-failed",
    cancelled: "badge-idle",
  };
  return map[state] ?? "badge-idle";
}

export function stateLabel(state: GcodeState | PrintStatus | string): string {
  if (state in IT_GCODE_LABEL) {
    return IT_GCODE_LABEL[state as GcodeState];
  }
  if (state in IT_PRINT_STATUS_LABEL) {
    return IT_PRINT_STATUS_LABEL[state as PrintStatus];
  }
  return state;
}
