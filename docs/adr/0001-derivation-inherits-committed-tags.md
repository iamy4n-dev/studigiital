# Derivation inherits committed tags instead of calling SuggestTagsSkill

When a user creates a new Artifact from an existing Artifact's source text (a Derivation), the new Artifact's suggested tags are the Source artifact's committed tags — not a fresh LLM call to `SuggestTagsSkill`. The backend skips `SuggestTagsSkill` when `source_artifact_id` is present in the transform request and returns the source's committed tags as `suggested_tags` instead.

We chose this because LLM tag generation is non-deterministic: the same content might yield "plants" on one run and "botany" on another. Users expect Derivations to share the same tag vocabulary as their source — it is how they navigate their library. Re-generating tags breaks that expectation silently.

## Considered options

**Re-run SuggestTagsSkill:** Each Derivation generates its own tag suggestions independently. Rejected because it introduces tag name drift — the user ends up with near-synonym tags for the same topic across derived Artifacts.

**Frontend-only inheritance:** The frontend fetches the source artifact after transform and discards the backend's `suggested_tags`. Rejected because it wastes a real LLM call on every Derivation with no benefit.
