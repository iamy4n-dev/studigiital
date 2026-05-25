const PALETTE = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899",
  "#f43f5e", "#06b6d4", "#84cc16", "#a855f7",
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getTagColor(name: string, existing: Record<string, string>): string {
  if (existing[name]) return existing[name];

  const usedColors = new Set(Object.values(existing));
  const preferred = PALETTE[hashName(name) % PALETTE.length]!;
  if (!usedColors.has(preferred)) return preferred;

  // Fall back to first unused palette color
  for (const color of PALETTE) {
    if (!usedColors.has(color)) return color!;
  }

  // Palette exhausted — deterministic fallback
  return preferred;
}
