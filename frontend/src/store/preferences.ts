import { create } from "zustand";

interface PreferencesStore {
  refreshIntervalSeconds: number;
  setRefreshIntervalSeconds: (s: number) => void;
}

const STORAGE_KEY = "bm-preferences";

interface Persisted {
  refreshIntervalSeconds: number;
}

const DEFAULTS: Persisted = {
  refreshIntervalSeconds: 30,
};

function loadInitial(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Persisted>;
      return {
        refreshIntervalSeconds:
          typeof parsed.refreshIntervalSeconds === "number"
            ? clamp(parsed.refreshIntervalSeconds, 2, 60)
            : DEFAULTS.refreshIntervalSeconds,
      };
    }
  } catch {
    /* ignore */
  }
  return DEFAULTS;
}

function persist(p: Persisted): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export const usePreferences = create<PreferencesStore>((set) => {
  const initial = loadInitial();
  return {
    refreshIntervalSeconds: initial.refreshIntervalSeconds,
    setRefreshIntervalSeconds: (s) => {
      const value = clamp(Math.round(s), 2, 60);
      persist({ refreshIntervalSeconds: value });
      set({ refreshIntervalSeconds: value });
    },
  };
});

export function getRefreshIntervalMs(): number {
  return usePreferences.getState().refreshIntervalSeconds * 1000;
}
