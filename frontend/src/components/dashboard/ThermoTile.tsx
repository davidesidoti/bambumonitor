import { Thermometer } from "lucide-react";
import { tempColor } from "@/lib/format";

interface Props {
  label: string;
  temp: number;
  target: number;
}

export function ThermoTile({ label, temp, target }: Props) {
  const color = tempColor(temp, target);
  return (
    <div className="flex flex-1 flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        <Thermometer size={12} stroke="var(--fg-3)" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="num-lg" style={{ color }}>
          {temp.toFixed(0)}
          <span
            style={{
              fontSize: "0.45em",
              color: "var(--fg-3)",
              fontWeight: 400,
            }}
          >
            °C
          </span>
        </span>
      </div>
      <div className="mono text-xs text-fg-3">
        → {target > 0 ? `${target.toFixed(0)}°C` : "spento"}
      </div>
    </div>
  );
}
