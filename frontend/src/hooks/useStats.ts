import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Stats } from "@/types/api";

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: () => apiFetch<Stats>("/stats"),
  });
}
