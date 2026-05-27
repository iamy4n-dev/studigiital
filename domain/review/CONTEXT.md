# Review Context

## Glossary

### Drill
An open-ended practice run scoped to one or more user-selected tags. The user works through Artifacts one at a time, rating each one, and exits whenever they choose. There is no completion state — a Drill is just a window into ongoing practice. Distinct from a bounded "session" (which implies a defined end).

### Drill Queue
The server-built ordered list of Artifacts served during a Drill. Two modes:
- **Structured** (default) — unreviewed Artifacts first, then oldest-reviewed. When exhausted, loops back to the beginning.
- **Random** — shuffled. User-selectable on the Review entry screen.

### Drill Configuration
The user's tag selection + queue mode choice that defines a Drill. Cached in localStorage so the last configuration is pre-filled on next visit. Named, persisted configurations are a future feature (see Named Topic).

### Named Topic
A saved, named Drill Configuration (e.g. "Biology exam prep"). Long-term target (#54); not in beta.

### Review Event
A single rating action on one Artifact during a Drill. Schema: `{ artifact_id, outcome: "passed"|"failed", reviewed_at }`. Persisted to the backend immediately on rating. The raw material for mastery tracking.

### Outcome
The binary result of a Review Event:
- **passed** — flashcard "Got it", quiz correct answer, note "Got it"
- **failed** — flashcard "Not yet", quiz wrong answer

### Progress Indicator
Shown during a Drill: `"X reviewed · Y new"` where X is the count of artifacts rated this run and Y is the count of artifacts under the selected tags never previously reviewed by the user.
