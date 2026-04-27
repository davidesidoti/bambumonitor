import { create } from "zustand";
import type { PrinterState } from "@/types/api";

const INITIAL_STATE: PrinterState = {
  gcode_state: "IDLE",
  file_name: null,
  percent: 0,
  remaining_minutes: 0,
  started_at: null,
  layer_num: 0,
  total_layer_num: 0,
  nozzle_temp: 0,
  nozzle_target: 0,
  bed_temp: 0,
  bed_target: 0,
  print_speed: 2,
  fan_speed: 0,
  filament_type: null,
  filament_color: null,
  chamber_light: false,
  last_update: new Date(0).toISOString(),
};

interface ConnectionStatus {
  connected: boolean;
  lastUpdate: string | null;
}

interface PrinterStore {
  state: PrinterState;
  hasSnapshot: boolean;
  connection: ConnectionStatus;
  applySnapshot: (state: PrinterState) => void;
  applyDelta: (patch: Partial<PrinterState>) => void;
  setConnection: (c: Partial<ConnectionStatus>) => void;
  reset: () => void;
}

export const usePrinterStore = create<PrinterStore>((set) => ({
  state: INITIAL_STATE,
  hasSnapshot: false,
  connection: { connected: false, lastUpdate: null },
  applySnapshot: (state) =>
    set({
      state,
      hasSnapshot: true,
      connection: { connected: true, lastUpdate: new Date().toISOString() },
    }),
  applyDelta: (patch) =>
    set((s) => ({
      state: { ...s.state, ...patch },
      connection: { connected: true, lastUpdate: new Date().toISOString() },
    })),
  setConnection: (c) =>
    set((s) => ({ connection: { ...s.connection, ...c } })),
  reset: () =>
    set({
      state: INITIAL_STATE,
      hasSnapshot: false,
      connection: { connected: false, lastUpdate: null },
    }),
}));
