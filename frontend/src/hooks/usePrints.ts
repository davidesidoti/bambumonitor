import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { PrintsPage, PrintStatus } from "@/types/api";

export interface PrintsQuery {
  status?: PrintStatus[];
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function usePrints(query: PrintsQuery) {
  const params = new URLSearchParams();
  if (query.status && query.status.length > 0) {
    params.set("status", query.status.join(","));
  }
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.pageSize ?? 25));
  const qs = params.toString();
  return useQuery({
    queryKey: ["prints", query],
    queryFn: () => apiFetch<PrintsPage>(`/prints?${qs}`),
  });
}
