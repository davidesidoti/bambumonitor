const FILAMENT_COLORS: Record<string, string> = {
  "Arancio Bambu": "oklch(72% 0.16 60)",
  "Nero opaco": "#1a1a1a",
  Nero: "#0a0a0a",
  "Verde menta": "oklch(82% 0.10 160)",
  Bianco: "#f4f4f0",
  "Bianco caldo": "#f0e9d8",
  "Grigio antracite": "#3a3d42",
  "Nero carbon": "#15161a",
  Rosso: "oklch(64% 0.20 25)",
  Blu: "oklch(60% 0.18 250)",
  Giallo: "oklch(86% 0.16 95)",
  Verde: "oklch(70% 0.16 145)",
};

// CSS hex color, possibly with alpha. Accepts "#RRGGBB" or "#RRGGBBAA".
const HEX_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

export function filamentColor(name: string | null | undefined): string {
  if (!name) return "var(--fg-4)";
  if (HEX_RE.test(name)) return name;
  return FILAMENT_COLORS[name] ?? "var(--fg-3)";
}
