# Context Map

## Contexts

- [Capture](./domain/capture/CONTEXT.md) — receives raw user input (photo, text, backlog item) and stores it for transformation
- [Transform](./domain/transform/CONTEXT.md) — converts a Capture into a structured learning Artifact using LLM skills
- [Tags](./domain/tags/CONTEXT.md) — user-confirmed labels that organize Artifacts into learning topics
- [Review](./domain/review/CONTEXT.md) — surfaces Artifacts for spaced-repetition practice
- [Gamification](./domain/gamification/CONTEXT.md) — tracks progress metrics derived from Review activity

## Relationships

- **Capture → Transform**: a Capture is the input to a Transform; a Transform produces an Artifact
- **Transform → Tags**: Transform suggests candidate tags; the user confirms them onto the Artifact
- **Tags → Review**: Review sessions are scoped and prioritized by Tag
- **Review → Gamification**: completed Reviews feed the tag mastery score and mistake resolution rate
