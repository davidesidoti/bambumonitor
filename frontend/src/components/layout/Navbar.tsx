import { NavLink } from "react-router-dom";
import { ConnectionIndicator } from "@/components/layout/ConnectionIndicator";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/cn";

const LINKS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/prints", label: "Storico", end: false },
  { to: "/stats", label: "Statistiche", end: false },
  { to: "/settings", label: "Impostazioni", end: false },
];

export function Navbar() {
  return (
    <header className="bm-navbar">
      <div className="flex items-center gap-3">
        <div
          className="grid h-[22px] w-[22px] place-items-center rounded-md"
          style={{
            background:
              "linear-gradient(135deg, var(--accent), var(--accent-2))",
            boxShadow:
              "0 4px 10px color-mix(in oklch, var(--accent) 30%, transparent)",
          }}
        >
          <div
            className="h-2 w-2 rounded-[1px]"
            style={{ background: "var(--bg-1)" }}
          />
        </div>
        <div className="text-sm font-semibold tracking-tight">
          Bambu Monitor
        </div>
        <span className="mono text-xs text-fg-3 hidden sm:inline">
          A1 · sala studio
        </span>
      </div>
      <nav className="flex items-center gap-1">
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              cn(
                "h-8 rounded-md px-3 text-xs font-medium border border-transparent transition-colors",
                "text-fg-2 hover:text-fg hover:bg-bg-2",
                isActive && "bg-bg-2 text-fg border-line",
                "inline-flex items-center",
              )
            }
          >
            {l.label}
          </NavLink>
        ))}
        <span className="mx-2 hidden h-4 w-px bg-line sm:inline-block" />
        <ConnectionIndicator />
        <ThemeToggle />
      </nav>
    </header>
  );
}
