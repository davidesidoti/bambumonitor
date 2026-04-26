import type {
  FilamentSetting,
  GcodeState,
  Print,
  PrintWithTelemetry,
  PrintsPage,
  PrinterState,
  Stats,
  TelemetryPoint,
} from "@/types/api";

/* ─────────────────────────────────────────────
   Mock prints history (ported from prototype shared.jsx).
   ───────────────────────────────────────────── */
export const MOCK_PRINTS: Print[] = [
  {
    id: 41,
    file_name: "Calibration_cube_v3.gcode.3mf",
    started_at: "2026-04-26T20:15:00Z",
    ended_at: null,
    status: "running",
    total_layers: 380,
    duration_seconds: null,
    filament_type: "PLA Basic",
    filament_color: "Arancio Bambu",
    filament_used_g: null,
    notes: null,
  },
  {
    id: 40,
    file_name: "Bracket_v2_left.3mf",
    started_at: "2026-04-25T14:02:00Z",
    ended_at: "2026-04-25T16:48:00Z",
    status: "finished",
    total_layers: 220,
    duration_seconds: 9960,
    filament_type: "PETG",
    filament_color: "Nero opaco",
    filament_used_g: 64,
    notes: "Adesione perfetta, nessun warping.",
  },
  {
    id: 39,
    file_name: "Vase_spiralized.3mf",
    started_at: "2026-04-24T09:30:00Z",
    ended_at: "2026-04-24T13:12:00Z",
    status: "finished",
    total_layers: 540,
    duration_seconds: 13320,
    filament_type: "PLA Silk",
    filament_color: "Verde menta",
    filament_used_g: 88,
    notes: null,
  },
  {
    id: 38,
    file_name: "Phone_stand_v4.3mf",
    started_at: "2026-04-23T18:45:00Z",
    ended_at: "2026-04-23T19:02:00Z",
    status: "failed",
    total_layers: 180,
    duration_seconds: 1020,
    filament_type: "PLA Basic",
    filament_color: "Bianco",
    filament_used_g: 4,
    notes: "Distaccamento dal piatto al layer 18.",
  },
  {
    id: 37,
    file_name: "Gear_module_set.3mf",
    started_at: "2026-04-22T11:10:00Z",
    ended_at: "2026-04-22T15:30:00Z",
    status: "finished",
    total_layers: 320,
    duration_seconds: 15600,
    filament_type: "PETG",
    filament_color: "Grigio antracite",
    filament_used_g: 142,
    notes: null,
  },
  {
    id: 36,
    file_name: "Lampshade_hex.3mf",
    started_at: "2026-04-21T08:00:00Z",
    ended_at: "2026-04-21T08:18:00Z",
    status: "cancelled",
    total_layers: 480,
    duration_seconds: 1080,
    filament_type: "PLA Basic",
    filament_color: "Bianco caldo",
    filament_used_g: 6,
    notes: "Annullato per cambio modello.",
  },
  {
    id: 35,
    file_name: "Drawer_handle.3mf",
    started_at: "2026-04-20T16:24:00Z",
    ended_at: "2026-04-20T17:01:00Z",
    status: "finished",
    total_layers: 95,
    duration_seconds: 2220,
    filament_type: "PLA Basic",
    filament_color: "Arancio Bambu",
    filament_used_g: 18,
    notes: null,
  },
  {
    id: 34,
    file_name: "Cable_clip_x6.3mf",
    started_at: "2026-04-19T19:50:00Z",
    ended_at: "2026-04-19T20:42:00Z",
    status: "finished",
    total_layers: 60,
    duration_seconds: 3120,
    filament_type: "PLA Basic",
    filament_color: "Nero",
    filament_used_g: 22,
    notes: null,
  },
  {
    id: 33,
    file_name: "Camera_mount_v2.3mf",
    started_at: "2026-04-18T13:15:00Z",
    ended_at: "2026-04-18T15:48:00Z",
    status: "finished",
    total_layers: 240,
    duration_seconds: 9180,
    filament_type: "PLA-CF",
    filament_color: "Nero carbon",
    filament_used_g: 76,
    notes: "Test con nuovo carbon, finitura ottima.",
  },
  {
    id: 32,
    file_name: "Hinge_v1.3mf",
    started_at: "2026-04-17T10:00:00Z",
    ended_at: "2026-04-17T10:09:00Z",
    status: "failed",
    total_layers: 80,
    duration_seconds: 540,
    filament_type: "PLA Basic",
    filament_color: "Bianco",
    filament_used_g: 2,
    notes: "Spaghetti detector triggered.",
  },
];

let mockFilament: FilamentSetting = {
  type: "PLA Basic",
  color: "Arancio Bambu",
};

const TOTAL_MINUTES = 130;
const TOTAL_LAYERS = 380;

interface MockTickState {
  percent: number;
  gcode: GcodeState;
}

function tempForState(gcode: GcodeState): { nozzle: number; bed: number } {
  switch (gcode) {
    case "IDLE":
    case "FINISH":
      return { nozzle: 28, bed: 24 };
    case "PREPARE":
      return { nozzle: 165, bed: 52 };
    case "FAILED":
      return { nozzle: 195, bed: 58 };
    default:
      return { nozzle: 218, bed: 60 };
  }
}

function targetForState(gcode: GcodeState): { nozzle: number; bed: number } {
  if (gcode === "IDLE" || gcode === "FINISH") return { nozzle: 0, bed: 0 };
  return { nozzle: 220, bed: 60 };
}

export function mockSnapshot(opts?: Partial<MockTickState>): PrinterState {
  const gcode = opts?.gcode ?? "RUNNING";
  const percent = opts?.percent ?? 54;
  const temps = tempForState(gcode);
  const targets = targetForState(gcode);
  const layerNum = Math.round(TOTAL_LAYERS * (percent / 100));
  const remaining = Math.max(
    0,
    Math.round(TOTAL_MINUTES * (1 - percent / 100)),
  );
  const elapsed = TOTAL_MINUTES - remaining;
  const startedAt =
    gcode === "IDLE" || gcode === "FINISH"
      ? null
      : new Date(Date.now() - elapsed * 60_000).toISOString();
  return {
    gcode_state: gcode,
    file_name:
      gcode === "IDLE" || gcode === "FINISH"
        ? null
        : "Calibration_cube_v3.gcode.3mf",
    percent,
    remaining_minutes: remaining,
    started_at: startedAt,
    layer_num: layerNum,
    total_layer_num: TOTAL_LAYERS,
    nozzle_temp: temps.nozzle + (Math.random() - 0.5) * 1.5,
    nozzle_target: targets.nozzle,
    bed_temp: temps.bed + (Math.random() - 0.5) * 0.5,
    bed_target: targets.bed,
    print_speed: 2,
    fan_speed: gcode === "RUNNING" ? 65 : 0,
    filament_type: mockFilament.type,
    filament_color: mockFilament.color,
    last_update: new Date().toISOString(),
  };
}

export function genTempSeries(
  points: number,
  opts: { nozzleTarget?: number; bedTarget?: number } = {},
): { nozzle: number; bed: number }[] {
  const nT = opts.nozzleTarget ?? 220;
  const bT = opts.bedTarget ?? 60;
  const arr: { nozzle: number; bed: number }[] = [];
  for (let i = 0; i < points; i++) {
    const t = i / Math.max(1, points - 1);
    const ramp = Math.min(1, t * 8);
    const noise = (Math.sin(i * 1.3) + Math.sin(i * 0.7)) * 0.6;
    const nozzle = Math.max(20, Math.min(nT + 2, nT * ramp + noise));
    const bed = Math.max(20, Math.min(bT + 1, bT * Math.min(1, t * 12) + noise * 0.4));
    arr.push({ nozzle, bed });
  }
  return arr;
}

export function genSpeedSeries(points: number): number[] {
  const arr: number[] = [];
  for (let i = 0; i < points; i++) {
    const base = 100 + Math.sin(i * 0.4) * 18 + Math.sin(i * 0.13) * 10;
    arr.push(Math.max(40, base));
  }
  return arr;
}

export function genHeatmapData(): { date: string; count: number }[] {
  const days: { date: string; count: number }[] = [];
  const today = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dow = d.getDay();
    const seed = ((i * 9301 + 49297) % 233280) / 233280;
    let count = 0;
    if (seed < 0.55) count = 0;
    else if (seed < 0.78) count = 1;
    else if (seed < 0.9) count = 2;
    else if (seed < 0.97) count = 3;
    else count = 4;
    if (dow === 6 || dow === 0) {
      count = Math.min(4, count + (seed > 0.6 ? 1 : 0));
    }
    days.push({ date: d.toISOString().slice(0, 10), count });
  }
  return days;
}

function genTelemetryForPrint(p: Print): TelemetryPoint[] {
  if (p.status === "running" || !p.duration_seconds) return [];
  const N = 90;
  const start = new Date(p.started_at).getTime();
  const dur = p.duration_seconds * 1000;
  const out: TelemetryPoint[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const ramp = Math.min(1, t * 5);
    const nozzle = 220 * ramp + Math.sin(i * 0.7) * 1.2;
    const bed = 60 * Math.min(1, t * 8) + Math.sin(i * 0.4) * 0.5;
    const inPause = i > 30 && i < 33;
    const speed = inPause ? 0 : 90 + Math.sin(i * 0.35) * 15;
    const layer = Math.min(p.total_layers, Math.round(p.total_layers * t));
    out.push({
      timestamp: new Date(start + dur * t).toISOString(),
      nozzle_temp: nozzle,
      nozzle_target: 220,
      bed_temp: bed,
      bed_target: 60,
      layer_num: layer,
      percent: Math.round(t * 100),
      speed,
      fan_speed: 65,
    });
  }
  return out;
}

export function mockStats(): Stats {
  const finished = MOCK_PRINTS.filter((p) => p.status === "finished");
  const failed = MOCK_PRINTS.filter((p) => p.status === "failed");
  const durations = finished
    .map((p) => p.duration_seconds ?? 0)
    .filter((d) => d > 0);
  const heat = genHeatmapData();
  const fileMap = new Map<string, { count: number; sum: number }>();
  for (const p of MOCK_PRINTS) {
    const e = fileMap.get(p.file_name) ?? { count: 0, sum: 0 };
    e.count += 1;
    e.sum += p.duration_seconds ?? 0;
    fileMap.set(p.file_name, e);
  }
  const topFiles = [...fileMap.entries()]
    .map(([file_name, e]) => ({
      file_name,
      count: e.count,
      avg_duration_seconds: e.sum / e.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  return {
    total_prints: MOCK_PRINTS.length,
    successful_prints: finished.length,
    failed_prints: failed.length,
    total_print_seconds: durations.reduce((a, b) => a + b, 0),
    total_filament_g: MOCK_PRINTS.reduce(
      (acc, p) => acc + (p.filament_used_g ?? 0),
      0,
    ),
    average_duration_seconds: durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null,
    longest_print_seconds: durations.length ? Math.max(...durations) : null,
    shortest_print_seconds: durations.length ? Math.min(...durations) : null,
    prints_by_day: heat,
    top_files: topFiles,
  };
}

interface PrintsQuery {
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}

function parseQuery(query: string): PrintsQuery {
  const params = new URLSearchParams(query);
  const out: PrintsQuery = {};
  const status = params.get("status");
  if (status) out.status = status;
  const from = params.get("from");
  if (from) out.from = from;
  const to = params.get("to");
  if (to) out.to = to;
  const page = params.get("page");
  if (page) out.page = Number(page);
  const ps = params.get("page_size");
  if (ps) out.page_size = Number(ps);
  return out;
}

function listPrints(query: string): PrintsPage {
  const q = parseQuery(query);
  const page = q.page ?? 1;
  const pageSize = q.page_size ?? 25;
  const statuses = q.status ? new Set(q.status.split(",")) : null;
  let filtered = MOCK_PRINTS;
  if (statuses) filtered = filtered.filter((p) => statuses.has(p.status));
  if (q.from) filtered = filtered.filter((p) => p.started_at >= q.from!);
  if (q.to) filtered = filtered.filter((p) => p.started_at <= q.to!);
  const start = (page - 1) * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    page_size: pageSize,
  };
}

function getPrint(id: number): PrintWithTelemetry | null {
  const p = MOCK_PRINTS.find((x) => x.id === id);
  if (!p) return null;
  return { ...p, telemetry: genTelemetryForPrint(p) };
}

export async function mockApiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  await new Promise((r) => setTimeout(r, 80));
  const [pathOnly, query = ""] = path.split("?");
  const method = (init?.method ?? "GET").toUpperCase();

  if (pathOnly === "/state" && method === "GET") {
    return mockSnapshot() as T;
  }
  if (pathOnly === "/health" && method === "GET") {
    return { ok: true, mqtt_connected: true } as T;
  }
  if (pathOnly === "/prints" && method === "GET") {
    return listPrints(query) as T;
  }
  const detailMatch = pathOnly.match(/^\/prints\/(\d+)$/);
  if (detailMatch) {
    const id = Number(detailMatch[1]);
    if (method === "GET") {
      const p = getPrint(id);
      if (!p) throw new Error(`Print ${id} not found`);
      return p as T;
    }
    if (method === "PATCH") {
      const body = JSON.parse((init?.body as string) ?? "{}");
      const idx = MOCK_PRINTS.findIndex((x) => x.id === id);
      if (idx === -1) throw new Error(`Print ${id} not found`);
      MOCK_PRINTS[idx] = { ...MOCK_PRINTS[idx]!, ...body };
      return getPrint(id) as T;
    }
  }
  if (pathOnly === "/stats" && method === "GET") {
    return mockStats() as T;
  }
  if (pathOnly === "/filament/current") {
    if (method === "GET") return mockFilament as T;
    if (method === "PUT") {
      mockFilament = JSON.parse((init?.body as string) ?? "{}");
      return mockFilament as T;
    }
  }
  throw new Error(`mockApiFetch: unhandled ${method} ${path}`);
}

/* ─────────────────────────────────────────────
   MockWebSocket: ticks percent + temps every second.
   ───────────────────────────────────────────── */
type WsListener = (data: string) => void;

export class MockWebSocket {
  private listeners: { open: WsListener[]; message: WsListener[]; close: WsListener[] } = {
    open: [],
    message: [],
    close: [],
  };
  private percent = 54;
  private gcode: GcodeState = "RUNNING";
  private timer: ReturnType<typeof setInterval> | null = null;
  readyState = 0;

  constructor() {
    setTimeout(() => this.start(), 50);
  }

  private start(): void {
    this.readyState = 1;
    this.listeners.open.forEach((l) => l(""));
    const snapshot = mockSnapshot({ percent: this.percent, gcode: this.gcode });
    this.emit({ type: "snapshot", state: snapshot });
    this.timer = setInterval(() => this.tick(), 1000);
  }

  private tick(): void {
    if (this.gcode === "RUNNING") {
      this.percent = Math.min(100, this.percent + 0.05);
      if (this.percent >= 100) {
        this.gcode = "FINISH";
        const next = mockSnapshot({ percent: 100, gcode: "FINISH" });
        this.emit({ type: "snapshot", state: next });
        return;
      }
    }
    const snap = mockSnapshot({ percent: this.percent, gcode: this.gcode });
    this.emit({
      type: "delta",
      patch: {
        percent: snap.percent,
        layer_num: snap.layer_num,
        nozzle_temp: snap.nozzle_temp,
        bed_temp: snap.bed_temp,
        remaining_minutes: snap.remaining_minutes,
        last_update: snap.last_update,
      },
    });
  }

  private emit(msg: unknown): void {
    const data = JSON.stringify(msg);
    this.listeners.message.forEach((l) => l(data));
  }

  addEventListener(
    event: "open" | "message" | "close",
    cb: (e: { data: string }) => void,
  ): void {
    this.listeners[event].push((d) => cb({ data: d }));
  }

  send(_data: string): void {
    /* ignore client pongs etc. in mock mode */
  }

  close(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.readyState = 3;
    this.listeners.close.forEach((l) => l(""));
  }
}
