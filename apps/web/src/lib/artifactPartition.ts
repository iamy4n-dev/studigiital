export interface ArtifactOut {
  id: string;
  capture_id: string;
  artifact_type: string;
  content: Record<string, unknown>;
  created_at: string;
  source_text: string;
  tags: string[];
  status: string;
}

export function partitionArtifacts(artifacts: ArtifactOut[]): {
  drafts: ArtifactOut[];
  tagged: ArtifactOut[];
} {
  return {
    drafts: artifacts.filter((a) => a.status === "draft"),
    tagged: artifacts.filter((a) => a.status !== "draft"),
  };
}
