# 🏠 HomeKeeper AI

**Never forget home maintenance again.** Homeowners forget furnace filters, gutter cleaning, and sump pump tests until something breaks expensively. HomeKeeper AI builds you a personalized 12-month maintenance calendar from a 60+ task rule bank matched to your exact home — then keeps you honest with check-offs and streaks.

## The problem

The average homeowner faces $1,000+ in surprise repairs every year, and most of them are preventable: clogged gutters ($1,000–$5,000 in water damage), dead sump pumps ($5,000–$20,000 floods), neglected furnaces ($300–$1,500 emergency calls). Nobody remembers 60 different tasks on 60 different schedules.

## The solution

1. **Describe your home** — type, heating, climate, and features (pool, yard, fireplace, basement, garage…)
2. **Get a 12-month plan** — every task scheduled in the right month, filtered to only what applies to *your* home
3. **Work the list** — check off tasks, see plain-language "cost of neglect" warnings (⚠ *skipping this risks a $250–$600 repair*), build a streak
4. **Skip a task** — mark a task as skipped for the month (it dims, drops out of progress and catch-up, and can be un-skipped)
5. **Year-at-a-glance progress** — month-by-month completion bars above the plan, with done/skipped counts
6. **Catch-up list** — incomplete tasks from earlier months surface automatically so nothing silently vanishes
7. **Search the year** — find any task across all 12 months instantly
8. **Print checklist** — a print-clean view of the current month's list

If `OPENAI_API_KEY` is ever set in a future hosted version, plans can be narrated and customized by an LLM — but the planner works 100% offline today with zero keys.

## Run it

No build step. No dependencies. Just open `index.html` in a browser — or serve it:

```bash
cd homekeeper-ai
python3 -m http.server 8080
# open http://localhost:8080
```

All data (profile, check-offs, streaks, custom tasks) lives in `localStorage`. Nothing leaves your device.

## How it works

- `js/rules.js` — the 60+ task rule bank (schedule, applicability, neglect-cost notes)
- `js/planner.js` — pure-logic plan generator + ISO week / streak math (shared by browser and tests)
- `js/app.js` — UI: profile form, this-month view, 12-month tabs, custom tasks

## Pricing vision

- **Free** — full planner, local only (this repo)
- **Plus $6/mo** — email/SMS reminders, household sharing, contractor booking links
- **Affiliate** — filters, salt, and detectors via affiliate links inside task cards

## Tests

```bash
bash test/smoke.sh   # 10 checks: files, syntax, rule bank sanity
bash test/e2e.sh     # 6 end-to-end flows via Node
```

## License

MIT — built free, no paid services.
