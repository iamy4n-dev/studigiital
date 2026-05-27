import type { SkillName } from "./skills";

export function buildCaptureUrl(text: string, skill?: SkillName): string {
  const params = new URLSearchParams({ text });
  if (skill) params.set("skill", skill);
  return `/capture?${params.toString()}`;
}
