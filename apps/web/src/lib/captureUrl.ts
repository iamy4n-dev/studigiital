import type { SkillName } from "./skills";

export function buildCaptureUrl(text: string, skill?: SkillName, sourceArtifactId?: string): string {
  const params = new URLSearchParams({ text });
  if (skill) params.set("skill", skill);
  if (sourceArtifactId) params.set("source_artifact_id", sourceArtifactId);
  return `/capture?${params.toString()}`;
}
