import { SKILL_NAMES, type SkillName } from "./skills";

interface ArtifactLike {
  artifact_type: string;
  created_at: string;
}

export function countByType(artifacts: ArtifactLike[]): Record<SkillName, number> {
  const counts = Object.fromEntries(SKILL_NAMES.map((s) => [s, 0])) as Record<SkillName, number>;
  for (const a of artifacts) {
    if (a.artifact_type in counts) counts[a.artifact_type as SkillName]++;
  }
  return counts;
}

export function thisWeekCount(artifacts: ArtifactLike[]): number {
  const cutoff = Date.now() - 7 * 86_400_000;
  return artifacts.filter((a) => new Date(a.created_at).getTime() > cutoff).length;
}
