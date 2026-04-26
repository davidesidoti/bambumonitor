import { cn } from "@/lib/cn";
import { badgeClass, stateLabel } from "@/lib/format";
import type { GcodeState, PrintStatus } from "@/types/api";

type Size = "md" | "lg";

export function StatusBadge({
  state,
  size = "md",
}: {
  state: GcodeState | PrintStatus | string;
  size?: Size;
}) {
  return (
    <span
      className={cn("badge", badgeClass(state))}
      style={{
        fontSize: size === "lg" ? 13 : 11,
        padding: size === "lg" ? "5px 10px" : undefined,
      }}
    >
      <span className="dot" />
      {stateLabel(state)}
    </span>
  );
}
