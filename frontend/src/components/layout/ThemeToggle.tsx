import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeStore } from "@/store/themeStore";

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const label = theme === "dark" ? "Modalità chiara" : "Modalità scura";
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      title={label}
      aria-label={label}
      className="h-8 w-8"
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
