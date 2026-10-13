# Redesign Audit — homekeeper-ai (2026-10-13)

**Competitors studied:** Homestead (home maintenance app: due/upcoming/overdue task views, recurring schedules, completion history), Upkeep Log (log book entries, repair history with costs), Househappy (home upkeep guidance).

## Visual gaps
1. **Year overview is thin bars.** Homestead-grade planners show the year as a calendar surface. → seasonal heat cells: month tint by season + completion bar + done/total.
2. **Month tabs are plain.** → open-task count badges per month tab; active tab in accent.
3. **Neglect warnings read as body text.** They're the product's signature (cost-of-neglect) — → warning-stamp styling ("if skipped: …").
4. **Seasonal tints exist in CSS vars but underused.** → apply to month tabs + year cells.

## Functional / flow gaps
1. **Month tab badges** (open counts — data exists: months[].tasks + checks).
2. **Seasonal year cells** (UI, existing data).
3. **Neglect stamp** (CSS only).

## Decisions
- Keep: profile → 12-month rule engine, this-month tasks + savings/risk, quick wins, catch-up, streaks, custom tasks, vendors, search, print.
- Identity: "the seasonal house book" (already in place) — deep emerald, EB Garamond, cream paper, seasonal ribbon. Refine toward premium, not replace.
