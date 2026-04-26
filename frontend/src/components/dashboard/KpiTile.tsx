import { cn } from "@/lib/cn";

interface Props {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
  swatch?: string;
}

export function KpiTile({ label, value, hint, mono, swatch }: Props) {
  return (
    <div
      className="flex min-w-[140px] flex-1 flex-col gap-1 rounded-[var(--card-r)] border border-line bg-bg-1 p-[var(--pad)]"
    >
      <div className="flex items-center gap-2">
        {swatch && (
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: swatch, boxShadow: "0 0 0 1px var(--line)" }}
          />
        )}
        <span className="label">{label}</span>
      </div>
      <div className={cn(mono ? "num-md" : "text-base font-semibold")}>{value}</div>
      {hint && <div className="text-xs text-fg-3">{hint}</div>}
    </div>
  );
}
