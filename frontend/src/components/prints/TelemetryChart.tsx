import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import type { TelemetryPoint } from "@/types/api";

interface SeriesDef {
  dataKey: keyof TelemetryPoint;
  color: string;
  label: string;
  strokeDasharray?: string;
}

interface Props {
  points: TelemetryPoint[];
  series: SeriesDef[];
  targets?: { value: number; color: string }[];
  height?: number;
  showLegend?: boolean;
  variant?: "area" | "line";
}

const tickFormatter = (iso: string) => format(new Date(iso), "HH:mm");

export function TelemetryChart({
  points,
  series,
  targets,
  height = 220,
  showLegend = true,
  variant = "area",
}: Props) {
  const Chart = variant === "area" ? AreaChart : LineChart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart
        data={points}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
      >
        <defs>
          {series.map((s) => (
            <linearGradient
              id={`grad-${s.dataKey}`}
              key={s.dataKey}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={s.color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="var(--grid-line)" vertical={false} />
        <XAxis
          dataKey="timestamp"
          tickFormatter={tickFormatter}
          tick={{ fontSize: 10, fill: "var(--fg-3)" }}
          axisLine={{ stroke: "var(--line)" }}
          tickLine={false}
          minTickGap={32}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "var(--fg-3)" }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip
          contentStyle={{
            background: "var(--bg-1)",
            border: "1px solid var(--line)",
            borderRadius: 6,
            fontSize: 12,
          }}
          labelFormatter={(v) => format(new Date(v as string), "HH:mm:ss")}
        />
        {showLegend && (
          <Legend
            iconType="line"
            wrapperStyle={{ fontSize: 11, color: "var(--fg-3)" }}
          />
        )}
        {targets?.map((t, i) => (
          <ReferenceLine
            key={i}
            y={t.value}
            stroke={t.color}
            strokeDasharray="3 3"
            strokeOpacity={0.4}
          />
        ))}
        {series.map((s) =>
          variant === "area" ? (
            <Area
              key={String(s.dataKey)}
              type="monotone"
              dataKey={String(s.dataKey)}
              name={s.label}
              stroke={s.color}
              strokeWidth={1.6}
              fill={`url(#grad-${s.dataKey})`}
              isAnimationActive={false}
            />
          ) : (
            <Line
              key={String(s.dataKey)}
              type="monotone"
              dataKey={String(s.dataKey)}
              name={s.label}
              stroke={s.color}
              strokeWidth={1.6}
              strokeDasharray={s.strokeDasharray}
              dot={false}
              isAnimationActive={false}
            />
          ),
        )}
      </Chart>
    </ResponsiveContainer>
  );
}
