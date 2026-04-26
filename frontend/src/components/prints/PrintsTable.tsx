import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatDateIT, formatDuration } from "@/lib/format";
import { filamentColor } from "@/lib/filamentColors";
import type { Print } from "@/types/api";

export function PrintsTable({ items }: { items: Print[] }) {
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-2 rounded-[var(--card-r)] border border-line bg-bg-1 p-10 text-center">
        <span className="text-sm text-fg-2">Nessuna stampa trovata</span>
        <span className="text-xs text-fg-3">
          Prova a rilassare i filtri o avvia una nuova stampa.
        </span>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-[var(--card-r)] border border-line bg-bg-1 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[150px] uppercase tracking-wide text-[11px] text-fg-3">
                Inizio
              </TableHead>
              <TableHead className="uppercase tracking-wide text-[11px] text-fg-3">
                File
              </TableHead>
              <TableHead className="w-[110px] uppercase tracking-wide text-[11px] text-fg-3">
                Durata
              </TableHead>
              <TableHead className="w-[90px] uppercase tracking-wide text-[11px] text-fg-3">
                Layer
              </TableHead>
              <TableHead className="w-[200px] uppercase tracking-wide text-[11px] text-fg-3">
                Filamento
              </TableHead>
              <TableHead className="w-[80px] uppercase tracking-wide text-[11px] text-fg-3">
                Usato
              </TableHead>
              <TableHead className="w-[140px] uppercase tracking-wide text-[11px] text-fg-3">
                Stato
              </TableHead>
              <TableHead className="w-[40px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((p) => (
              <TableRow
                key={p.id}
                className="cursor-pointer hover:bg-bg-2"
                onClick={() => navigate(`/prints/${p.id}`)}
              >
                <TableCell className="mono text-xs text-fg-2">
                  {formatDateIT(p.started_at)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="text-[13px] font-medium">
                      {p.file_name}
                    </span>
                    <span className="mono text-xs text-fg-3">job #{p.id}</span>
                  </div>
                </TableCell>
                <TableCell className="mono text-sm">
                  {formatDuration(p.duration_seconds)}
                </TableCell>
                <TableCell className="mono text-sm">{p.total_layers}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        background: filamentColor(p.filament_color),
                        boxShadow: "0 0 0 1px var(--line)",
                      }}
                    />
                    <div className="flex flex-col gap-[1px]">
                      <span className="text-sm">{p.filament_type ?? "—"}</span>
                      <span className="text-xs text-fg-3">
                        {p.filament_color ?? ""}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="mono text-sm">
                  {p.filament_used_g != null ? `${p.filament_used_g}g` : "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge state={p.status} />
                </TableCell>
                <TableCell>
                  <ChevronRight size={14} stroke="var(--fg-3)" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2 md:hidden">
        {items.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => navigate(`/prints/${p.id}`)}
            className="card flex flex-col gap-2 rounded-[var(--card-r)] border border-line bg-bg-1 p-3 text-left"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{p.file_name}</span>
              <StatusBadge state={p.status} />
            </div>
            <div className="mono flex flex-wrap gap-3 text-xs text-fg-3">
              <span>{formatDateIT(p.started_at)}</span>
              <span>· {formatDuration(p.duration_seconds)}</span>
              <span>· {p.total_layers} layer</span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
