import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type SpeedLevel = 1 | 2 | 3 | 4;

interface CommandResult {
  ok: boolean;
  detail: string;
}

export function useSetSpeed() {
  return useMutation({
    mutationFn: (level: SpeedLevel) =>
      apiFetch<CommandResult>("/control/speed", {
        method: "POST",
        body: JSON.stringify({ level }),
      }),
  });
}

export function useSetChamberLight() {
  return useMutation({
    mutationFn: (on: boolean) =>
      apiFetch<CommandResult>("/control/chamber-light", {
        method: "POST",
        body: JSON.stringify({ on }),
      }),
  });
}
