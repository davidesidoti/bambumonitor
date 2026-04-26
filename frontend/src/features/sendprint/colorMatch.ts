/**
 * Auto-match project filaments to AMS slots by minimum RGB distance.
 *
 * `amsSlots` is an array of { color: hex } indexed by AMS slot. Pass `null`
 * for empty slots (they won't be matched). Returns an array same length as
 * `projectFilaments`, each entry the chosen slot index or -1 (external) if no
 * AMS slot is suitable.
 */

export interface AmsSlot {
  index: number;
  color: string | null;
  type: string | null;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(hex);
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

function distance(a: string, b: string): number {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return Number.POSITIVE_INFINITY;
  const dr = ra[0] - rb[0];
  const dg = ra[1] - rb[1];
  const db = ra[2] - rb[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export function autoMapAms(
  projectColors: string[],
  amsSlots: AmsSlot[],
): number[] {
  const taken = new Set<number>();
  return projectColors.map((color) => {
    let best = -1;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const slot of amsSlots) {
      if (!slot.color) continue;
      if (taken.has(slot.index)) continue;
      const d = distance(color, slot.color);
      if (d < bestDist) {
        bestDist = d;
        best = slot.index;
      }
    }
    if (best >= 0) taken.add(best);
    return best;
  });
}
