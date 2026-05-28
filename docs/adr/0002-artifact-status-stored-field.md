# Artifact status is a stored field, not derived from tags

Every Artifact carries an explicit `status` column (`draft` | `tagged`) rather than deriving status from whether `tags` is empty. The initial states are `draft` (produced by Transform, no committed tags) and `tagged` (at least one tag committed). Two future states — `archived` and `deleted` (soft-delete for cleanup jobs) — are reserved but not yet active.

The alternative — deriving status from `len(tags) > 0` — was rejected because (a) a tagged Artifact may later be explicitly reverted to `draft` by the user to add more context, making the derivation wrong, and (b) future states (`archived`, `deleted`) cannot be derived from tags at all, so a stored field would be needed anyway.
