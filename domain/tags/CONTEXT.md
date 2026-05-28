# Tags

User-confirmed labels that organize Artifacts into learning topics and drive Review prioritization.

## Language

**Suggested tags**:
Candidate tag names surfaced to the user after a Transform or Derivation — either LLM-generated (for new Captures) or inherited from the Source artifact (for Derivations). Not persisted until confirmed.
_Avoid_: recommended tags, auto-tags, proposed tags

**Committed tags**:
Tags explicitly confirmed by the user and persisted on an Artifact. At least one committed tag is required per Artifact.
_Avoid_: saved tags, selected tags, final tags

**Tag palette**:
The fixed set of background/text color pairs assigned deterministically from a tag name. Same name always maps to the same color.
_Avoid_: tag colors, color scheme

## Relationships

- An **Artifact** must have at least one **Committed tag** to leave Draft status
- Committing at least one tag to a **Draft Artifact** automatically transitions it to `tagged` status
- **Suggested tags** for a **Derivation** come from the Source artifact's **Committed tags**
- **Suggested tags** for a new Capture come from the LLM (`SuggestTagsSkill`)

## Example dialogue

> **Dev:** "Can a user save an Artifact without choosing any tags?"
> **Domain expert:** "No — at least one committed tag is required. The Save action is blocked until the user has confirmed at least one."
> **Dev:** "What if the user removes all the suggested tags before saving?"
> **Domain expert:** "They have to add at least one before saving. The UI disables Save and the backend rejects an empty list."
