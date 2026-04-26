import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import type { PrintStatus } from "@/types/api";

const STATUS_OPTIONS: { id: PrintStatus; label: string }[] = [
  { id: "running", label: "In corso" },
  { id: "finished", label: "Completate" },
  { id: "failed", label: "Fallite" },
  { id: "cancelled", label: "Annullate" },
];

interface Props {
  selected: Set<PrintStatus>;
  onToggle: (s: PrintStatus) => void;
  search: string;
  onSearchChange: (v: string) => void;
}

export function PrintFilters({
  selected,
  onToggle,
  search,
  onSearchChange,
}: Props) {
  return (
    <div className="card flex flex-wrap items-center gap-3 rounded-[var(--card-r)] border border-line bg-bg-1 p-[var(--pad)]">
      <span className="label">Stato</span>
      <div className="flex flex-wrap gap-1">
        {STATUS_OPTIONS.map((o) => {
          const active = selected.has(o.id);
          return (
            <Button
              key={o.id}
              size="sm"
              variant={active ? "default" : "outline"}
              onClick={() => onToggle(o.id)}
              className={cn(
                "h-7 rounded-md px-2 text-xs",
                active &&
                  "bg-brand-soft text-brand border-brand/30 hover:bg-brand-soft",
              )}
            >
              {o.label}
            </Button>
          );
        })}
      </div>
      <div className="hidden h-5 w-px bg-line sm:block" />
      <Input
        placeholder="Cerca file..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-8 max-w-xs flex-1 text-sm"
      />
    </div>
  );
}
