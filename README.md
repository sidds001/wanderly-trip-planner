# Wanderly — budget-aware trip planner (MVP)

Plan 3 days in **Goa, Bali, Phuket or Dubai** around a fixed budget. Change the budget and the planner rebuilds the trip, keeps what still fits, and explains exactly what changed and why.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine tests
npm run build && npm run preview   # production build on http://localhost:4173
```

Deep links for demos: `/#demo` (generated ₹25k Goa trip) and `/#replan` (replanned to ₹15k with "What changed" open).

## What's inside

- `src/engine/`: a pure TypeScript planner (no React, no clock, no randomness). It scores activities, groups one area per day, schedules around opening hours, meals and travel, works out costs, then applies cuts in a fixed order until the plan fits.
- `src/data/`: destination profiles (stay base, day areas, prices in ₹, transport) and activity lists per destination.
- `src/App.tsx`: the booking-site-style UI.
- `PRD.md`, `architecture.md`: product and technical design.

All prices, durations and travel times are **illustrative estimates, not live rates**. Flights are not included.

## Photo credits

Place photos in `public/photos/` come from Wikimedia Commons under their own licences (mostly CC BY / CC BY-SA). The file, author and licence for each photo are listed in `src/data/photos.json`.
