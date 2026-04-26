import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createPrinterSocket } from "@/lib/ws";
import { usePrinterStore } from "@/store/printerStore";
import { apiFetch } from "@/lib/api";
import type { PrinterState } from "@/types/api";

let refCount = 0;
let unsubscribe: (() => void) | null = null;
let snapshotFallbackTimer: ReturnType<typeof setTimeout> | null = null;

export function useLivePrinterState(): void {
  const applySnapshot = usePrinterStore((s) => s.applySnapshot);
  const applyDelta = usePrinterStore((s) => s.applyDelta);
  const setConnection = usePrinterStore((s) => s.setConnection);
  const queryClient = useQueryClient();

  useEffect(() => {
    refCount += 1;
    if (refCount === 1) {
      const socket = createPrinterSocket();
      unsubscribe = socket.subscribe((msg) => {
        if (msg.type === "snapshot") {
          applySnapshot(msg.state);
        } else if (msg.type === "delta") {
          if (Object.keys(msg.patch).length === 0) {
            setConnection({ connected: false });
          } else {
            applyDelta(msg.patch);
          }
        } else if (
          msg.type === "print_started" ||
          msg.type === "print_finished" ||
          msg.type === "print_failed"
        ) {
          queryClient.invalidateQueries({ queryKey: ["prints"] });
          queryClient.invalidateQueries({ queryKey: ["stats"] });
        }
      });

      // REST fallback: if WS hasn't delivered a snapshot within 2s, fetch /api/state.
      snapshotFallbackTimer = setTimeout(() => {
        if (!usePrinterStore.getState().hasSnapshot) {
          apiFetch<PrinterState>("/state")
            .then((s) => applySnapshot(s))
            .catch(() => {
              /* WS may still come through; ignore */
            });
        }
      }, 2_000);
    }

    return () => {
      refCount -= 1;
      if (refCount === 0) {
        if (snapshotFallbackTimer) clearTimeout(snapshotFallbackTimer);
        unsubscribe?.();
        unsubscribe = null;
      }
    };
  }, [applySnapshot, applyDelta, setConnection, queryClient]);
}
