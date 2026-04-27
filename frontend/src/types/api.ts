export type GcodeState =
  | "IDLE"
  | "PREPARE"
  | "RUNNING"
  | "PAUSE"
  | "FINISH"
  | "FAILED";

export type PrintStatus = "running" | "finished" | "failed" | "cancelled";

export interface PrinterState {
  gcode_state: GcodeState;
  file_name: string | null;
  percent: number;
  remaining_minutes: number;
  started_at: string | null;
  layer_num: number;
  total_layer_num: number;
  nozzle_temp: number;
  nozzle_target: number;
  bed_temp: number;
  bed_target: number;
  print_speed: number;
  fan_speed: number;
  filament_type: string | null;
  filament_color: string | null;
  chamber_light: boolean;
  last_update: string;
}

export interface Print {
  id: number;
  file_name: string;
  started_at: string;
  ended_at: string | null;
  status: PrintStatus;
  total_layers: number;
  duration_seconds: number | null;
  filament_type: string | null;
  filament_color: string | null;
  filament_used_g: number | null;
  notes: string | null;
}

export interface TelemetryPoint {
  timestamp: string;
  nozzle_temp: number;
  nozzle_target: number;
  bed_temp: number;
  bed_target: number;
  layer_num: number;
  percent: number;
  speed: number;
  fan_speed: number;
}

export interface PrintWithTelemetry extends Print {
  telemetry: TelemetryPoint[];
}

export interface PrintsPage {
  items: Print[];
  total: number;
  page: number;
  page_size: number;
}

export interface FilamentSetting {
  type: string;
  color: string;
}

export interface StatsByDay {
  date: string;
  count: number;
}

export interface TopFile {
  file_name: string;
  count: number;
  avg_duration_seconds: number;
}

export interface Stats {
  total_prints: number;
  successful_prints: number;
  failed_prints: number;
  total_print_seconds: number;
  total_filament_g: number | null;
  average_duration_seconds: number | null;
  longest_print_seconds: number | null;
  shortest_print_seconds: number | null;
  prints_by_day: StatsByDay[];
  top_files: TopFile[];
}

export interface Health {
  ok: boolean;
  mqtt_connected: boolean;
}

export type WsMessage =
  | { type: "snapshot"; state: PrinterState }
  | { type: "delta"; patch: Partial<PrinterState> }
  | { type: "print_started" | "print_finished" | "print_failed"; print: Print }
  | { type: "ping" }
  | { type: "pong" };
