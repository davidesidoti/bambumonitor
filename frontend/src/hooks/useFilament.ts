import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { FilamentSetting } from "@/types/api";

export function useFilament() {
  return useQuery({
    queryKey: ["filament"],
    queryFn: () => apiFetch<FilamentSetting>("/filament/current"),
  });
}

export function useUpdateFilament() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: FilamentSetting) =>
      apiFetch<FilamentSetting>("/filament/current", {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => qc.setQueryData(["filament"], data),
  });
}
