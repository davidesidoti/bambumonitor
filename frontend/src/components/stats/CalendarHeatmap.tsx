import { useMemo } from "react";
import type { StatsByDay } from "@/types/api";

interface Cell {
  date: string;
  count: number;
}

function bucketize(count: number, max: number): number {
  if (max === 0 || count === 0) return 0;
  const ratio = count / max;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  return 4;
}

export function CalendarHeatmap({ data }: { data: StatsByDay[] }) {
  const { weeks, max } = useMemo(() => {
    const max = data.reduce((acc, d) => Math.max(acc, d.count), 0);
    if (data.length === 0) return { weeks: [], max };
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    const weeks: (Cell | null)[][] = [];
    const firstDate = new Date(sorted[0]!.date);
    let curWeek: (Cell | null)[] = new Array(firstDate.getUTCDay()).fill(null);
    sorted.forEach((d) => {
      curWeek.push(d);
      if (curWeek.length === 7) {
        weeks.push(curWeek);
        curWeek = [];
      }
    });
    if (curWeek.length > 0) {
      while (curWeek.length < 7) curWeek.push(null);
      weeks.push(curWeek);
    }
    return { weeks, max };
  }, [data]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="label">Attività · ultimi 12 mesi</span>
          <span className="text-xs text-fg-3">ogni quadrato è un giorno</span>
        </div>
        <div className="mono flex items-center gap-2 text-xs text-fg-3">
          <span>meno</span>
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`heat-cell heat-${i}`}
              style={{ width: 11, height: 11 }}
            />
          ))}
          <span>più</span>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((d, di) => (
              <span
                key={di}
                className={d ? `heat-cell heat-${bucketize(d.count, max)}` : ""}
                style={{
                  width: 11,
                  height: 11,
                  opacity: d ? 1 : 0,
                }}
                title={d ? `${d.date}: ${d.count} stampe` : ""}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
