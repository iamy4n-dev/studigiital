# Review Context

## Glossary

### Artifact Item
The atomic unit of review. One Flashcard, one Quiz Question, or one Note extracted from an Artifact. Multiple Items can belong to a single Artifact. The unit served in the Drill Queue, rated by the user, and tracked in Review Events. Tags are not stored on Items — they are inherited from the parent Artifact at query time.

### Drill
A closed practice run scoped to one or more user-selected tags. The user works through a fixed set of Artifact Items until every one is passed. Failed Items cycle back to the end of the active queue and are retried until passed. The Drill ends when all Items are learned. The user may exit at any time before completion.

### Drill Queue
The server-built ordered list of Artifact Items for a Drill. Only Items belonging to `tagged` Artifacts are eligible — Draft Artifacts are excluded. Two modes:
- **Structured** (default) — unreviewed Items first, then oldest-reviewed.
- **Random** — shuffled. User-selectable on the Review entry screen.
Failed Items re-enter the queue at the end, not at a random position.

### Drill Configuration
The user's tag selection + queue mode choice that defines a Drill. Cached in localStorage so the last configuration is pre-filled on next visit. Named, persisted configurations are a future feature (see Named Topic).

### Named Topic
A saved, named Drill Configuration (e.g. "Biology exam prep"). Long-term target (#54); not in beta.

### Review Event
A single rating action on one Artifact Item during a Drill. Schema: `{ item_id, outcome: "passed"|"failed", reviewed_at }`. Persisted to the backend immediately on rating. The raw material for mastery tracking.

### Outcome
The binary result of a Review Event:
- **passed** — flashcard "Got it", quiz correct answer, note "Got it"
- **failed** — flashcard "Not yet", quiz wrong answer, note "Not yet"

### Learned
An Artifact Item is learned within a Drill when it receives a "passed" outcome in that run. Learned Items are removed from the active queue. All Items must be learned for the Drill to complete.

### Weak Spot
An Artifact Item that was failed at least once before being learned in a Drill. Surfaced on the Drill completion screen and used as the seed for a Retry.

### Retry
A new Drill started from the completion screen, seeded with only the Weak Spots from the just-completed Drill. Targets the user's gaps without repeating already-mastered Items.

### Progress Indicator
Shown during a Drill: `"X / Y learned"` where X is the count of Items passed so far in this run and Y is the total Items in the Drill.
