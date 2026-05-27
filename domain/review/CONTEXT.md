# Review Context

## Glossary

### Drill
A closed practice run scoped to one or more user-selected tags. The user works through a fixed set of Artifacts until every one is passed. Failed artifacts cycle back to the end of the active queue and are retried until passed. The Drill ends when all artifacts are learned. The user may exit at any time before completion.

### Drill Queue
The server-built ordered list of Artifacts for a Drill. Two modes:
- **Structured** (default) — unreviewed Artifacts first, then oldest-reviewed.
- **Random** — shuffled. User-selectable on the Review entry screen.
Failed artifacts re-enter the queue at the end, not at a random position.

### Drill Configuration
The user's tag selection + queue mode choice that defines a Drill. Cached in localStorage so the last configuration is pre-filled on next visit. Named, persisted configurations are a future feature (see Named Topic).

### Named Topic
A saved, named Drill Configuration (e.g. "Biology exam prep"). Long-term target (#54); not in beta.

### Review Event
A single rating action on one Artifact during a Drill. Schema: `{ artifact_id, outcome: "passed"|"failed", reviewed_at }`. Persisted to the backend immediately on rating. The raw material for mastery tracking.

### Outcome
The binary result of a Review Event:
- **passed** — flashcard "Got it", quiz correct answer, note "Got it"
- **failed** — flashcard "Not yet", quiz wrong answer, note "Not yet"

### Learned
An Artifact is learned within a Drill when it receives a "passed" outcome in that run. Learned artifacts are removed from the active queue. All artifacts must be learned for the Drill to complete.

### Weak Spot
An Artifact that was failed at least once before being learned in a Drill. Surfaced on the Drill completion screen and used as the seed for a Retry.

### Retry
A new Drill started from the completion screen, seeded with only the Weak Spots from the just-completed Drill. Targets the user's gaps without repeating already-mastered artifacts.

### Progress Indicator
Shown during a Drill: `"X / Y learned"` where X is the count of artifacts passed so far in this run and Y is the total artifacts in the Drill.
