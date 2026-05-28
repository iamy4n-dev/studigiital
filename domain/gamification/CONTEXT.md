# Gamification Context

## Glossary

### Tag Mastery Score
The percentage of Artifact Items in a tag whose most recent ReviewEvent has `outcome = "passed"`. Only Items belonging to `tagged` Artifacts are counted. Formula: `passed_count / total_item_count * 100`, where "passed" means the last ReviewEvent for that Item is `passed` (last outcome wins — a prior pass followed by a recent failure does not count).

### Mastery Threshold
The Tag Mastery Score at which a tag is considered **Mastered**: 80%. A tag with fewer than 80% of its Items currently passing is not Mastered, regardless of past performance. User-configurable threshold is a future feature.

### Mastered
A tag whose Tag Mastery Score is at or above the Mastery Threshold (≥ 80%). Displayed with a "Mastered" badge on the Profile page.

### XP
A cumulative difficulty-weighted score across all currently-learned Items. For each Item whose last ReviewEvent is `passed`: XP contribution = `1 + total lifetime failed ReviewEvents for that Item`. Items whose last ReviewEvent is `failed` contribute 0 XP (no punishment — the contribution is simply withheld until the Item is re-passed). XP rewards both breadth (learning new items) and struggle (harder items are worth more).

### Streak
The number of consecutive calendar days ending today on which the user completed at least one ReviewEvent of any outcome. Showing up and drilling — even without passing — counts. A gap of one day with no activity breaks the streak.

### Mistakes Resolved (This Week)
The count of distinct Artifact Items that: (1) have at least one `failed` ReviewEvent in their lifetime, and (2) received a `passed` ReviewEvent within the last 7 days. Items the user aced on first attempt are excluded. Displayed on the Profile page with a hover tooltip explaining the definition.

### Tags Improved (This Week)
The count of distinct tags that had at least one Mistake Resolved within the last 7 days. A tag is "improved" this week if the user passed at least one previously-failed Item in that tag this week.
