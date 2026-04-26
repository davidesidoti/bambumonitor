import { useMemo, useState } from "react";
import { RefreshCw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PrintFilters } from "@/components/prints/PrintFilters";
import { PrintsTable } from "@/components/prints/PrintsTable";
import { usePrints } from "@/hooks/usePrints";
import type { PrintStatus } from "@/types/api";

const ALL_STATUSES: PrintStatus[] = [
  "running",
  "finished",
  "failed",
  "cancelled",
];

export default function PrintHistory() {
  const [statuses, setStatuses] = useState<Set<PrintStatus>>(
    new Set(ALL_STATUSES),
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const query = useMemo(
    () => ({
      status: [...statuses],
      page,
      pageSize,
    }),
    [statuses, page],
  );
  const { data, isLoading, refetch, isFetching } = usePrints(query);

  const items = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data.items;
    const needle = search.trim().toLowerCase();
    return data.items.filter((p) =>
      p.file_name.toLowerCase().includes(needle),
    );
  }, [data, search]);

  const toggle = (s: PrintStatus) => {
    setStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
    setPage(1);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[22px] font-semibold tracking-tight">
            Storico stampe
          </h1>
          <span className="text-sm text-fg-3">
            {data ? `${data.total} risultati` : "Caricamento..."}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
            Aggiorna
          </Button>
          <Button size="sm" variant="outline" disabled>
            <Download size={12} />
            Esporta CSV
          </Button>
        </div>
      </div>

      <PrintFilters
        selected={statuses}
        onToggle={toggle}
        search={search}
        onSearchChange={setSearch}
      />

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <PrintsTable items={items} />
      )}

      <div className="flex items-center justify-between">
        <span className="mono text-xs text-fg-3">
          Pagina {page} / {totalPages} · {pageSize} per pagina
        </span>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ‹ Prec
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Succ ›
          </Button>
        </div>
      </div>
    </div>
  );
}
