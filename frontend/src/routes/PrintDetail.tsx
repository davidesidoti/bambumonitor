import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { TelemetryChart } from "@/components/prints/TelemetryChart";
import { usePrintDetail, useUpdatePrint } from "@/hooks/usePrintDetail";
import { formatDateIT, formatDuration } from "@/lib/format";
import { filamentColor } from "@/lib/filamentColors";

export default function PrintDetail() {
  const { id } = useParams<{ id: string }>();
  const numId = id ? Number(id) : undefined;
  const { data: print, isLoading } = usePrintDetail(numId);
  const update = useUpdatePrint(numId);
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (print?.notes != null) setNotes(print.notes);
  }, [print?.notes]);

  if (isLoading || !print) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const saveNotes = async () => {
    try {
      await update.mutateAsync({ notes });
      toast.success("Note salvate");
      setEditing(false);
    } catch (e) {
      toast.error("Errore salvataggio note");
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-fg-3">
        <Link to="/prints" className="cursor-pointer hover:text-fg-2">
          Storico
        </Link>
        <ChevronRight size={10} stroke="var(--fg-3)" />
        <span className="font-medium" style={{ color: "var(--fg-2)" }}>
          job #{print.id}
        </span>
      </div>

      {/* Header card */}
      <div className="card flex flex-col gap-3 rounded-[var(--card-r)] border border-line bg-bg-1 p-[var(--pad-lg)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <h1 className="text-[22px] font-semibold tracking-tight">
                {print.file_name}
              </h1>
              <StatusBadge state={print.status} size="lg" />
            </div>
            <div className="mono flex flex-wrap gap-3 text-sm text-fg-3">
              <span>
                iniziata{" "}
                <span style={{ color: "var(--fg-2)" }}>
                  {formatDateIT(print.started_at)}
                </span>
              </span>
              {print.ended_at && (
                <>
                  <span>·</span>
                  <span>
                    finita{" "}
                    <span style={{ color: "var(--fg-2)" }}>
                      {formatDateIT(print.ended_at)}
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div
          className="flex flex-wrap gap-4 pt-3"
          style={{ borderTop: "1px solid var(--line)" }}
        >
          <Meta label="Durata totale" value={formatDuration(print.duration_seconds)} />
          <Meta label="Layer" value={String(print.total_layers)} />
          <Meta
            label="Filamento"
            value={print.filament_type ?? "—"}
            sub={print.filament_color ?? undefined}
            swatch={filamentColor(print.filament_color)}
          />
          <Meta
            label="Usato"
            value={
              print.filament_used_g != null ? `${print.filament_used_g}g` : "—"
            }
          />
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard
          title="Temperature"
          legend={
            <span className="mono flex gap-3 text-xs">
              <Swatch color="var(--nozzle)" label="nozzle" />
              <Swatch color="var(--bed)" label="bed" />
            </span>
          }
        >
          <TelemetryChart
            points={print.telemetry}
            series={[
              { dataKey: "nozzle_temp", color: "var(--nozzle)", label: "Nozzle" },
              { dataKey: "bed_temp", color: "var(--bed)", label: "Bed" },
            ]}
            targets={[
              { value: 220, color: "var(--nozzle)" },
              { value: 60, color: "var(--bed)" },
            ]}
            height={200}
          />
        </ChartCard>

        <ChartCard title="Velocità di stampa" legend={<span className="mono text-xs text-fg-3">mm/s</span>}>
          <TelemetryChart
            points={print.telemetry}
            series={[{ dataKey: "speed", color: "var(--accent)", label: "Speed" }]}
            height={200}
          />
        </ChartCard>

        <div className="lg:col-span-2">
          <ChartCard title="Avanzamento per layer" legend={<span className="mono text-xs text-fg-3">{print.total_layers} layer</span>}>
            <TelemetryChart
              points={print.telemetry}
              variant="line"
              series={[
                { dataKey: "layer_num", color: "var(--accent)", label: "Layer" },
              ]}
              height={160}
            />
          </ChartCard>
        </div>
      </div>

      {/* Notes */}
      <div className="card flex flex-col gap-2 rounded-[var(--card-r)] border border-line bg-bg-1 p-[var(--pad-lg)]">
        <div className="flex items-center justify-between">
          <span className="label">Note post-stampa</span>
          {!editing && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing(true)}
              className="h-7 gap-1 text-xs"
            >
              <Edit2 size={12} /> Modifica
            </Button>
          )}
        </div>
        {editing ? (
          <div className="flex flex-col gap-2">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Aggiungi note sulla stampa..."
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setNotes(print.notes ?? "");
                  setEditing(false);
                }}
              >
                Annulla
              </Button>
              <Button size="sm" onClick={saveNotes} disabled={update.isPending}>
                {update.isPending ? "Salvataggio..." : "Salva"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-2 text-sm leading-relaxed text-fg-2">
            {print.notes ?? (
              <span className="text-fg-3 italic">
                Nessuna nota. Clicca Modifica per aggiungerne.
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Meta({
  label,
  value,
  sub,
  swatch,
}: {
  label: string;
  value: string;
  sub?: string;
  swatch?: string;
}) {
  return (
    <div className="flex min-w-[110px] flex-col gap-1">
      <div className="label">{label}</div>
      <div className="flex items-center gap-2">
        {swatch && (
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: swatch, boxShadow: "0 0 0 1px var(--line)" }}
          />
        )}
        <span className="mono text-base font-semibold">{value}</span>
      </div>
      {sub && <div className="text-xs text-fg-3">{sub}</div>}
    </div>
  );
}

function ChartCard({
  title,
  legend,
  children,
}: {
  title: string;
  legend?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card overflow-hidden rounded-[var(--card-r)] border border-line bg-bg-1">
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <span className="label">{title}</span>
        {legend}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span style={{ width: 8, height: 2, background: color }} />
      {label}
    </span>
  );
}
