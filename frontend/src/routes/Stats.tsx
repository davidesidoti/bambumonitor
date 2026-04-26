import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/stats/KpiCard";
import { CalendarHeatmap } from "@/components/stats/CalendarHeatmap";
import { useStats } from "@/hooks/useStats";
import { formatDuration } from "@/lib/format";

export default function Stats() {
  const { data, isLoading } = useStats();

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const successRate =
    data.total_prints > 0
      ? ((data.successful_prints / data.total_prints) * 100).toFixed(1)
      : "—";
  const totalHours = (data.total_print_seconds / 3600).toFixed(0);
  const filamentKg =
    data.total_filament_g != null
      ? (data.total_filament_g / 1000).toFixed(1)
      : "—";

  const statusBars = [
    {
      label: "Completate",
      value: data.successful_prints,
      color: "var(--ok)",
    },
    {
      label: "Fallite",
      value: data.failed_prints,
      color: "var(--err)",
    },
    {
      label: "Annullate",
      value:
        data.total_prints - data.successful_prints - data.failed_prints,
      color: "var(--fg-3)",
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-tight">Statistiche</h1>
        <span className="text-sm text-fg-3">
          {data.total_prints} lavori registrati
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Totale stampe" value={String(data.total_prints)} />
        <KpiCard label="Successo" value={`${successRate}%`} />
        <KpiCard label="Ore totali" value={totalHours} sub="h di stampa" />
        <KpiCard label="Filamento" value={filamentKg} sub="kg usati" />
      </div>

      <div className="card rounded-[var(--card-r)] border border-line bg-bg-1 p-[var(--pad-lg)]">
        <CalendarHeatmap data={data.prints_by_day} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="card flex flex-col gap-3 rounded-[var(--card-r)] border border-line bg-bg-1 p-[var(--pad-lg)]">
          <span className="label">Stampe per stato</span>
          <div className="flex flex-col gap-2">
            {statusBars.map((r) => (
              <div key={r.label} className="flex items-center gap-3">
                <span className="w-24 text-sm">{r.label}</span>
                <div
                  className="h-[18px] flex-1 overflow-hidden rounded"
                  style={{ background: "var(--bg-3)" }}
                >
                  <div
                    style={{
                      width: `${data.total_prints > 0 ? (r.value / data.total_prints) * 100 : 0}%`,
                      height: "100%",
                      background: r.color,
                    }}
                  />
                </div>
                <span className="mono w-10 text-right text-sm">{r.value}</span>
              </div>
            ))}
          </div>
          <div
            className="my-1 h-px w-full"
            style={{ background: "var(--line)" }}
          />
          <div className="flex flex-wrap gap-4">
            <Meta
              label="Più lunga"
              value={formatDuration(data.longest_print_seconds)}
            />
            <Meta
              label="Più breve"
              value={formatDuration(data.shortest_print_seconds)}
            />
            <Meta
              label="Media"
              value={formatDuration(data.average_duration_seconds)}
            />
          </div>
        </div>

        <div className="card flex flex-col gap-3 rounded-[var(--card-r)] border border-line bg-bg-1 p-[var(--pad-lg)]">
          <span className="label">Top file</span>
          <div className="flex flex-col gap-2">
            {data.top_files.length === 0 ? (
              <span className="text-sm text-fg-3">
                Nessun file ancora stampato.
              </span>
            ) : (
              data.top_files.slice(0, 8).map((r, i) => (
                <div key={r.file_name} className="flex items-center gap-3">
                  <span className="mono w-5 text-xs text-fg-3">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 truncate text-sm">{r.file_name}</span>
                  <span className="mono w-20 text-right text-xs text-fg-3">
                    {formatDuration(r.avg_duration_seconds)}
                  </span>
                  <span className="mono w-10 text-right text-sm font-semibold">
                    ×{r.count}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="label">{label}</div>
      <span className="mono text-base font-semibold">{value}</span>
    </div>
  );
}
