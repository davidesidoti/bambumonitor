import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { useThemeStore } from "@/store/themeStore";
import { usePreferences } from "@/store/preferences";
import { SectionCard } from "@/features/settings/SectionCard";

export function ClientSettingsPanel() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const refreshIntervalSeconds = usePreferences((s) => s.refreshIntervalSeconds);
  const setRefreshIntervalSeconds = usePreferences(
    (s) => s.setRefreshIntervalSeconds,
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SectionCard
        title="Tema"
        description="Aspetto dell'interfaccia."
      >
        <RadioGroup
          value={theme}
          onValueChange={(v) => setTheme(v as "light" | "dark")}
        >
          <Label className="cursor-pointer">
            <RadioGroupItem value="light" id="theme-light" />
            <span>Chiaro</span>
          </Label>
          <Label className="cursor-pointer">
            <RadioGroupItem value="dark" id="theme-dark" />
            <span>Scuro</span>
          </Label>
        </RadioGroup>
      </SectionCard>

      <SectionCard
        title="Intervallo di aggiornamento"
        description="Frequenza con cui le pagine ricaricano i dati dal backend."
      >
        <div className="flex items-center gap-3">
          <Slider
            value={[refreshIntervalSeconds]}
            min={2}
            max={60}
            step={1}
            onValueChange={([v]) => setRefreshIntervalSeconds(v)}
          />
          <span className="mono w-16 text-right text-sm tabular-nums">
            {refreshIntervalSeconds}s
          </span>
        </div>
        <p className="mt-2 text-xs text-fg-3">
          Modifiche applicate alle nuove richieste.
        </p>
      </SectionCard>
    </div>
  );
}
