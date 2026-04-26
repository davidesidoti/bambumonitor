import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { PrintWithTelemetry } from "@/types/api";

export function usePrintDetail(id: number | undefined) {
  return useQuery({
    queryKey: ["print", id],
    queryFn: () => apiFetch<PrintWithTelemetry>(`/prints/${id}`),
    enabled: id != null,
  });
}

export interface UpdatePrintBody {
  notes?: string;
  filament_color?: string;
}

export function useUpdatePrint(id: number | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdatePrintBody) =>
      apiFetch<PrintWithTelemetry>(`/prints/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      qc.setQueryData(["print", id], data);
      qc.invalidateQueries({ queryKey: ["prints"] });
    },
  });
}
