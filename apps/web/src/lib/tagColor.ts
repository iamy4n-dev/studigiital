const PALETTE: Array<[string, string]> = [
  ["#dbeafe", "#1e40af"],
  ["#dcfce7", "#166534"],
  ["#fef9c3", "#854d0e"],
  ["#fce7f3", "#9d174d"],
  ["#ede9fe", "#5b21b6"],
  ["#ffedd5", "#9a3412"],
  ["#e0f2fe", "#0c4a6e"],
  ["#f0fdf4", "#14532d"],
];

export function tagColors(name: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const entry = PALETTE[Math.abs(hash) % PALETTE.length]!;
  return { bg: entry[0], text: entry[1] };
}
