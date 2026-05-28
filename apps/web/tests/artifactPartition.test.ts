import { partitionArtifacts } from "../src/lib/artifactPartition";

const make = (id: string, status: string) => ({
  id,
  capture_id: "c1",
  artifact_type: "generate_flashcard",
  content: {},
  created_at: new Date().toISOString(),
  source_text: "",
  tags: [],
  status,
});

const makeLegacy = (id: string) => ({
  id,
  capture_id: "c1",
  artifact_type: "generate_note",
  content: {},
  created_at: new Date().toISOString(),
  source_text: "",
  tags: ["biology"],
  status: undefined as unknown as string,
});

test("partitionArtifacts puts drafts first and tagged second", () => {
  const artifacts = [
    make("tagged-1", "tagged"),
    make("draft-1", "draft"),
    make("tagged-2", "tagged"),
  ];
  const { drafts, tagged } = partitionArtifacts(artifacts);
  expect(drafts.map((a) => a.id)).toEqual(["draft-1"]);
  expect(tagged.map((a) => a.id)).toEqual(["tagged-1", "tagged-2"]);
});

test("partitionArtifacts treats legacy artifacts (no status) as tagged", () => {
  const artifacts = [makeLegacy("legacy-1"), make("draft-1", "draft")];
  const { drafts, tagged } = partitionArtifacts(artifacts);
  expect(drafts.map((a) => a.id)).toEqual(["draft-1"]);
  expect(tagged.map((a) => a.id)).toEqual(["legacy-1"]);
});
