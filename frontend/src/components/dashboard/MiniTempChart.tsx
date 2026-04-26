import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo } from "react";
import { genTempSeries } from "@/lib/mockApi";

interface TooltipPoint {
  dataKey: string;
  value: number;
  color: string;
}
interface TooltipArgs {
  active?: boolean;
  payload?: TooltipPoint[];
}

interface Point {
  i: number;
  nozzle: number;
  bed: number;
}

interface Props {
  nozzleTarget: number;
  bedTarget: number;
  height?: number;
}

export function MiniTempChart({ nozzleTarget, bedTarget, height = 120 }: Props) {
  const data = useMemo<Point[]>(() => {
    const series = genTempSeries(60, {
      nozzleTarget: nozzleTarget || 220,
      bedTarget: bedTarget || 60,
    });
    return series.map((p, i) => ({ i, nozzle: p.nozzle, bed: p.bed }));
  }, [nozzleTarget, bedTarget]);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={data}
        margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
      >
        <defs>
          <linearGradient id="g-nozzle" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--nozzle)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--nozzle)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="g-bed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--bed)" stopOpacity={0.12} />
            <stop offset="100%" stopColor="var(--bed)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="i" hide />
        <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
        <Tooltip content={<TempTooltip />} />
        {nozzleTarget > 0 && (
          <ReferenceLine
            y={nozzleTarget}
            stroke="var(--nozzle)"
            strokeDasharray="3 3"
            strokeOpacity={0.4}
          />
        )}
        {bedTarget > 0 && (
          <ReferenceLine
            y={bedTarget}
            stroke="var(--bed)"
            strokeDasharray="3 3"
            strokeOpacity={0.4}
          />
        )}
        <Area
          type="monotone"
          dataKey="nozzle"
          stroke="var(--nozzle)"
          strokeWidth={1.6}
          fill="url(#g-nozzle)"
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="bed"
          stroke="var(--bed)"
          strokeWidth={1.6}
          fill="url(#g-bed)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function TempTooltip(props: TooltipArgs) {
  if (!props.active || !props.payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-bg-1 px-2 py-1 text-xs shadow">
      {props.payload.map((p) => (
        <div key={p.dataKey} className="mono flex justify-between gap-3">
          <span style={{ color: p.color }}>{p.dataKey}</span>
          <span>{p.value.toFixed(1)}°C</span>
        </div>
      ))}
    </div>
  );
}
