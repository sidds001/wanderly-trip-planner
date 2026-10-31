# Personal Trip Planner — Architecture

| | |
|---|---|
| **Product** | Personal Trip Planner (MVP, Goa, three days) |
| **Companion document** | `PRD.md`. Requirements (FR-n), acceptance criteria (AC-n) and open questions (OPEN-n) are defined there. |
| **Audience** | Any engineer building the MVP from scratch with no other context. |

> **Conventions**
> - Anything not marked otherwise comes from the product brief.
> - **[Seed]**: an illustrative value, not from the brief and not real or live data. It may be changed freely.
> - **[Proposed]**: a technical structure (file layout, type names, helper function names) suggested to make the build concrete. It doesn't change product behaviour and may be renamed.
> - **OPEN-n**: an undecided product rule (see `PRD.md` §12). Code that depends on one should keep the rule in **one configurable place** so the decision can be dropped in later.

---

## 1. Technology stack (fixed by the brief)

| Concern | Choice |
|---|---|
| UI framework | **React + TypeScript** |
| Build tool / dev server | **Vite** |
| Styling | **Tailwind CSS** |
| Icons | **Lucide React** |
| Data | **Local JSON / TypeScript dataset**, bundled with the app |
| State | **React state** |
| Persistence | **LocalStorage** (optional) |

**Explicitly not used:** a backend, authentication, a database, external APIs or paid services. The app is a purely client-side single-page app.

---

## 2. System overview

```
┌──────────────────────────────── Browser (SPA) ────────────────────────────────┐
│                                                                               │
│   ┌──────────── UI layer (React components) ────────────┐                     │
│   │  Screen 1: TripForm      Screen 2: ItineraryView    │                     │
│   │                          ├─ Header                  │                     │
│   │                          ├─ DayTabs / Timeline      │                     │
│   │                          ├─ BudgetPanel + Slider    │                     │
│   │                          ├─ ChangeSummary           │                     │
│   │                          └─ ReplaceDialog           │                     │
│   └───────────────▲───────────────────┬─────────────────┘                     │
│                   │ plan, summary     │ preferences / new budget / replace    │
│   ┌───────────────┴───────────────────▼─────────────────┐   ┌──────────────┐  │
│   │  App state (React useState / useReducer)            │◄─►│ LocalStorage │  │
│   │  preferences · currentPlan · previousPlan · summary │   │  (optional)  │  │
│   └───────────────▲───────────────────┬─────────────────┘   └──────────────┘  │
│                   │ Plan              │ calls (pure functions)                │
│   ┌───────────────┴───────────────────▼─────────────────┐                     │
│   │  Planning engine (pure, deterministic TypeScript)   │                     │
│   │  generateItinerary · replanItinerary                │                     │
│   │  replacement helpers · validation · costing · diff  │                     │
│   └───────────────▲─────────────────────────────────────┘                     │
│                   │ read-only                                                 │
│   ┌───────────────┴─────────────────────────────────────┐                     │
│   │  Dataset: activities + pricing assumptions (TS/JSON)│                     │
│   └─────────────────────────────────────────────────────┘                     │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Key architectural rule:** the planning engine is **pure and deterministic**. It has no React, no DOM, no `Date.now()`, no randomness and no I/O. The same inputs always produce the same plan. This makes replanning and diffing reliable, and lets the engine be tested on its own.

---

## 3. Project structure [Proposed]

```
personal-trip-planner/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind config / css entry      (per the Tailwind + Vite setup in use)
└── src/
    ├── main.tsx
    ├── App.tsx                      # screen switch + top-level state
    ├── data/
    │   ├── activities.ts            # Goa activity dataset   (§8.2)
    │   └── assumptions.ts           # tiers, transport, misc (§8.3–8.5)
    ├── engine/
    │   ├── types.ts                 # all domain types        (§4)
    │   ├── config.ts                # ALL OPEN-n rule knobs in one place (§7)
    │   ├── costing.ts               # budget breakdown calculations
    │   ├── travel.ts                # travel time + transport cost between stops
    │   ├── scoring.ts               # activity scoring
    │   ├── scheduler.ts             # time-slot assignment + validation
    │   ├── generateItinerary.ts     # public API
    │   ├── replanItinerary.ts       # public API
    │   ├── replace.ts               # replacement options + apply
    │   └── diff.ts                  # plan diff → change summary + explanation
    ├── components/
    │   ├── TripForm.tsx
    │   ├── ItineraryView.tsx
    │   ├── TripHeader.tsx
    │   ├── DayTabs.tsx
    │   ├── ActivityCard.tsx
    │   ├── BudgetPanel.tsx
    │   ├── BudgetSlider.tsx
    │   ├── ChangeSummary.tsx
    │   ├── ReplaceDialog.tsx
    │   └── Warnings.tsx
    └── lib/
        ├── format.ts                # ₹ and time formatting (OPEN-28)
        └── storage.ts               # LocalStorage wrapper (optional)
```

---

## 4. Domain model (TypeScript) [Proposed shapes]

The field lists for activities come from the brief (ID, category, coordinates or area, duration, cost, opening hours, interest tags, description). The rest is structure proposed to support the required behaviour.

```ts
// ---------- Inputs ----------
export type Interest = 'Beaches' | 'Food' | 'Adventure' | 'Culture' | 'Relaxation';
export type TravelStyle = 'Budget' | 'Balanced' | 'Luxury';
export type Pace = 'Relaxed' | 'Moderate' | 'Packed';
export type TransportMode = 'Scooter' | 'Cab' | 'PublicTransport';

export interface TripPreferences {
  destination: 'Goa';            // fixed
  startDate: string;             // ISO yyyy-mm-dd; end date derived (+2 days)
  durationDays: 3;               // fixed
  budget: number;                // ₹, default 25000
  travellers: number;            // default 2
  interests: Interest[];
  travelStyle: TravelStyle;
  pace: Pace;
  transport: TransportMode;
}

// ---------- Dataset ----------
export type PriceLevel = 'free' | 'affordable' | 'premium';

export interface Activity {
  id: string;
  name: string;
  description: string;
  category: string;              // e.g. 'Beach', 'Fort', 'Church', 'Food', 'Water sports'
  area: string;                  // e.g. 'Calangute', 'Panaji'
  region: 'North Goa' | 'Panaji' | 'Old Goa';
  coords: { lat: number; lng: number };
  durationMin: number;
  costPerPerson: number;         // ₹, estimate
  priceLevel: PriceLevel;        // supports "replace premium with affordable"
  openingHours: { open: string; close: string }; // 'HH:MM', 24h
  tags: Interest[];              // interest tags
  popular?: boolean;             // supports "preserve popular free attractions"
  alternativeGroup?: string;     // activities that can stand in for each other
}

// ---------- Output ----------
export interface ScheduledItem {
  kind: 'activity' | 'meal';
  activityId?: string;           // when kind === 'activity'
  title: string;
  description: string;
  start: string;                 // 'HH:MM'
  end: string;                   // 'HH:MM'
  durationMin: number;
  cost: number;                  // ₹ total for the group (estimate)
  travelFromPrevMin: number;     // estimate
  travelCostFromPrev: number;    // ₹ estimate (feeds Transportation)
  lockedByUser?: boolean;        // set when chosen via Replace (OPEN-20)
}

export interface DayPlan {
  dayNumber: 1 | 2 | 3;
  date: string;                  // ISO
  region?: string;               // geographic grouping for the day
  items: ScheduledItem[];
}

export interface BudgetBreakdown {
  accommodation: number;
  food: number;
  transport: number;
  activities: number;
  misc: number;
  total: number;
  budget: number;
  remaining: number;             // budget − total (can be negative only with a warning)
  utilisation: number;           // total / budget
}

export interface AppliedAssumptions {
  accommodationTier: TravelStyle;
  foodTier: TravelStyle;
  transport: TransportMode;
  nights: number;                // OPEN-9
  rooms: number;                 // OPEN-10
}

export type WarningCode =
  | 'BUDGET_INFEASIBLE'
  | 'OVER_BUDGET'
  | 'CONSTRAINT_VIOLATION'
  | 'REPLACEMENT_REJECTED';

export interface PlanWarning { code: WarningCode; message: string; }

export interface Explanation {
  // machine-readable reason, used by diff.ts to compose text
  code: string;                  // e.g. 'TIER_DOWNGRADED', 'PREMIUM_ACTIVITY_SWAPPED'
  message: string;
  relatedActivityIds?: string[];
}

export interface Plan {
  preferences: TripPreferences;
  assumptions: AppliedAssumptions;
  days: DayPlan[];
  breakdown: BudgetBreakdown;
  warnings: PlanWarning[];
  explanations: Explanation[];   // why the engine made each decision
  feasible: boolean;
}

export interface ChangeSummary {
  previousTotal: number;
  newTotal: number;
  savings: number;               // previousTotal − newTotal
  budgetDelta: number;           // newBudget − oldBudget
  categoryRows: { category: string; before: number; after: number; delta: number }[];
  activityChanges: {
    removed: string[];           // activity ids
    added: string[];
    replaced: { from: string; to: string; day: number }[];
    kept: string[];
    moved: { id: string; fromDay: number; toDay: number }[];
  };
  assumptionChanges: { field: keyof AppliedAssumptions; before: string; after: string }[];
  narrative: string;             // generated text, never hard-coded
}
```

---

## 5. Planning engine

### 5.1 Public API (names from the brief)

```ts
generateItinerary(tripPreferences: TripPreferences, activityDataset: Activity[]): Plan
replanItinerary(existingPlan: Plan, updatedConstraints: Partial<TripPreferences>): {
  plan: Plan;
  summary: ChangeSummary;
}
```

Replacement helpers [Proposed names; the behaviour is required by FR-6]:

```ts
getReplacementOptions(plan: Plan, dayNumber: number, itemIndex: number,
                      activityDataset: Activity[]): ReplacementOption[]   // 2–3 options
applyReplacement(plan: Plan, dayNumber: number, itemIndex: number,
                 newActivityId: string, activityDataset: Activity[]):
  { ok: true; plan: Plan } | { ok: false; reason: string }

interface ReplacementOption {
  activity: Activity;
  durationMin: number;
  estimatedCost: number;         // group cost
  feasible: boolean;             // fits the day's hard constraints
  reason?: string;               // explanation when not feasible
}
```

### 5.2 `generateItinerary`: the pipeline (the eight steps come from the brief)

| Step | Brief requirement | Implementation outline |
|---|---|---|
| 1 | Calculate fixed and variable expenses | **Fixed:** accommodation (tier rate × nights × rooms), food (tier rate × days × travellers), misc (OPEN-12). **Variable:** activities and transport depend on what is scheduled. Use the tier from `travelStyle` at first. |
| 2 | Determine the available activity budget | `activityBudget = budget − fixed − estimatedTransport`. Transport is estimated first, then corrected in step 7. |
| 3 | Score activities by interests, cost and location | `score = w_interest·interestMatch + w_cost·costFit + w_location·proximity` (weights: OPEN-25). Interest match = overlap between the activity's tags and the user's interests. |
| 4 | Group nearby activities | Assign each day a geographic cluster (by `region` / `area` or coordinates; method: OPEN-11) so the activities on one day are near each other. |
| 5 | Assign activities to feasible time slots | Greedy, in order: for each day, walk from the day start (OPEN-7). Insert meal breaks (OPEN-8). Place the highest-scoring activities that fit the remaining activity budget, the opening hours and the pace limit (OPEN-6). Add travel time from the previous stop. |
| 6 | Validate operating hours, travel buffers and overlaps | Run `validateDay()` (§5.5) on every day. Drop or reschedule any item that fails. |
| 7 | Recalculate the total budget | Recompute all five categories from the final schedule (actual transport legs, actual activities). |
| 8 | Return the itinerary and explanations | Return a `Plan` with `explanations[]` (why things were included or excluded), `warnings[]` and `feasible`. |

**Determinism:** break every tie (equal scores, equal times) by a stable key, such as activity `id` in alphabetical order. Never use randomness.

**Budget fitting inside generate:** if the step 7 total is over budget, apply the same levers as replanning (§5.3) until the plan fits or no levers are left. If it still doesn't fit, set `feasible = false` and add a `BUDGET_INFEASIBLE` warning (FR-7). The plan must **never** be over budget silently.

### 5.3 `replanItinerary`: the hero feature

**Inputs:** the existing plan and the updated constraints (typically `{ budget }`; any preference may change: PRD FR-4 / OPEN-17).

**Outline:**

1. **Merge the constraints:** `newPrefs = { ...existingPlan.preferences, ...updatedConstraints }`.
2. **Start from the existing plan, not from scratch.** This is what keeps R4 ("preserve feasible activities") and R5 ("avoid unnecessary changes") true. Activities in the existing plan that still fit get a strong *keep* preference.
3. **If the existing plan already fits the new constraints,** keep it (recompute costs only). Whether to upgrade when the budget rises is OPEN-16.
4. **Otherwise apply the levers** from the brief, one at a time, recomputing the cost after each one, and **stop as soon as the plan fits**:

   | Lever (from brief) | Engine action | Explanation code [Proposed] |
   |---|---|---|
   | Replace expensive water sports with a beach experience | Swap a `premium` activity for an `affordable`/`free` one in the same `alternativeGroup` or with overlapping tags | `PREMIUM_ACTIVITY_SWAPPED` |
   | Switch to budget accommodation assumptions | Drop the accommodation tier one level | `ACCOMMODATION_TIER_DOWNGRADED` |
   | Replace premium dining with affordable local restaurants | Drop the food tier one level (and swap any premium food activity) | `FOOD_TIER_DOWNGRADED` |
   | Reduce unnecessary cab trips by grouping nearby activities | Re-cluster days to cut the number and length of legs, which lowers transport cost | `TRANSPORT_OPTIMISED` |
   | Preserve popular free attractions | Never remove `popular && costPerPerson === 0` activities for budget reasons | `FREE_ATTRACTION_KEPT` |

   The order of the levers is **OPEN-14**. Keep the order as one array in `config.ts`.
   Whether downgrading a tier also changes the user's visible `travelStyle` is **OPEN-15**. Keep tiers in `AppliedAssumptions`, separate from `preferences.travelStyle`, so either answer is easy to implement.
5. **Rebuild only the affected days** (any day whose items changed) with the scheduler, then validate (§5.5).
6. **Recalculate every category** (R2).
7. **Check feasibility.** If the plan still doesn't fit after all levers, set `feasible = false` and add a `BUDGET_INFEASIBLE` warning with the shortfall (R6, R7; display behaviour: OPEN-22).
8. **Diff** the old and new plans → `ChangeSummary` (§5.4) (R8).

**User-locked items:** items with `lockedByUser` (set by Replace) are kept or not according to OPEN-20. Respect the flag in one place.

### 5.4 Change summary generation (`diff.ts`)

The brief requires that the summary be **generated from actual differences**, never hard-coded. The algorithm:

1. **Category rows:** for each of accommodation, food, transport, activities, misc and total, record `before`, `after` and `delta`.
2. **Assumption changes:** compare the fields of `AppliedAssumptions`, and emit `{field, before, after}` for each one that differs.
3. **Activity changes**, matched by `activityId`:
   - in old and not new → `removed`
   - in new and not old → `added`
   - a removed item and an added item that share a day and slot, or an `alternativeGroup` → combine them into `replaced {from, to}`
   - in both, on a different day → `moved`
   - in both, on the same day → `kept`
4. **Narrative:** build the sentences from the parts above, plus the engine's `explanations[]`:
   - Budget sentence: from `budgetDelta` → "Your budget was reduced by ₹X." (or "increased")
   - One clause per assumption change / replacement → "switched to affordable accommodation", "replaced *Premium water sports* with *Beach kayaking*", "optimised local transportation"
   - Savings sentence: "Your updated trip saves ₹Y"
   - Preserved-interests clause: list the user interests still covered by the kept activities → "while keeping your preferred beach and food experiences"
   - If the plan is infeasible, append the warning text.

   Example of the target output (from the brief): *"Your budget was reduced by ₹10,000. We've switched to affordable accommodation, replaced premium water sports with a beach experience, and optimized local transportation. Your updated trip saves ₹10,000 while keeping your preferred beach and food experiences."*

### 5.5 Validation (`scheduler.ts → validateDay`)

The hard constraints, checked after every generate, replan and replace:

| Constraint | Check |
|---|---|
| No overlap | `item[i].end + travel(i→i+1) ≤ item[i+1].start` |
| Opening hours | `activity.open ≤ start` and `end ≤ activity.close` |
| Travel buffer | `travelFromPrevMin` is included between consecutive items |
| Day bounds | First start ≥ day start; last end ≤ day end (OPEN-7) |
| Meal breaks present | Meal items exist as configured (OPEN-8) |
| Budget | `breakdown.total ≤ budget`, or else `feasible = false` with a warning |

### 5.6 Activity replacement flow (`replace.ts`)

1. **Find candidates:** dataset activities not already in the plan, filtered and ranked by the OPEN-18 rule. Keep the rule in one function; good inputs to it are `alternativeGroup`, shared tags, area/region and cost.
2. **Feasibility check for each candidate:** tentatively put it in the slot, rebuild that day's times and travel, then run `validateDay`. Mark `feasible` and give a `reason` (for example, "Closes at 17:30; slot would end at 18:10").
3. **Return 2–3 options** with the duration and the estimated group cost.
4. **Apply:** if the choice is infeasible, return `{ ok: false, reason }` and show the reason in the UI (FR-6 step 6). Otherwise rebuild that day, recompute the full breakdown, set `lockedByUser = true`, and return the new plan. Over-budget handling is OPEN-19.

Replacement does **not** create a replan `ChangeSummary`. How the earlier summary is treated after a replace is OPEN-23.

### 5.7 Costing (`costing.ts`)

```
accommodation = accommodationRate[tier] × nights × rooms        // OPEN-9, OPEN-10
food          = foodRate[tier] × durationDays × travellers        // OPEN-26 for food activities
activities    = Σ (activity.costPerPerson × travellers)           // scheduled activities only
transport     = Σ leg costs (+ per-day rental if Scooter)         // OPEN-11
misc          = per OPEN-12
total         = accommodation + food + transport + activities + misc
remaining     = budget − total
utilisation   = total / budget
```

### 5.8 Travel time and transport (`travel.ts`)

The model choice is **OPEN-11**. The dataset supports both options:

- **Distance-based:** haversine distance between `coords` × a road-winding factor ÷ the mode speed → minutes. Distance × the mode rate → ₹.
- **Area-based:** a lookup table keyed by `(regionA, regionB)` → minutes and ₹.

Seed parameters for both are in §8.4. Expose one function, `leg(from, to, mode, travellers) → { minutes, cost }`, so the model can be swapped without touching the rest of the engine.

---

## 6. UI architecture

### 6.1 State (in `App.tsx`)

```ts
const [screen, setScreen] = useState<'form' | 'itinerary'>('form');
const [preferences, setPreferences] = useState<TripPreferences>(defaults);
const [plan, setPlan] = useState<Plan | null>(null);
const [previousPlan, setPreviousPlan] = useState<Plan | null>(null);
const [summary, setSummary] = useState<ChangeSummary | null>(null);
const [sliderBudget, setSliderBudget] = useState<number>(preferences.budget);
```

| User action | State transition |
|---|---|
| Generate My Trip | `plan = generateItinerary(preferences, activities)`; `screen = 'itinerary'`; clear the summary |
| Move slider | `sliderBudget` changes only. Nothing is replanned until the button is clicked (see OPEN-13) |
| Replan Trip | `{plan: p, summary: s} = replanItinerary(plan, { budget: sliderBudget })`; `previousPlan = plan`; `plan = p`; `summary = s` |
| Replace → choose | `res = applyReplacement(...)`; if `ok`, `plan = res.plan`; else show `res.reason` |
| (optional) any plan change | Persist `{preferences, plan}` to LocalStorage |

### 6.2 Component responsibilities

| Component | Responsibility | PRD reference |
|---|---|---|
| `TripForm` | All inputs and the Generate My Trip CTA | FR-1 |
| `TripHeader` | Goa, dates, travellers, estimated cost, remaining | §5.2 |
| `DayTabs` + `ActivityCard` | Day 1/2/3 tabs; vertical timeline; each card shows name, description, start–end, duration, cost, travel from previous, and Replace | FR-2 |
| `BudgetPanel` | Five categories, total, remaining, utilisation bar, "illustrative estimates" note | FR-3, FR-9 |
| `BudgetSlider` + Replan button | Budget input for replanning | FR-4 |
| `ChangeSummary` | Previous/new/savings, before-after table, activity and assumption changes, narrative | FR-5 |
| `ReplaceDialog` | 2–3 options with duration and cost; disabled or explained infeasible options | FR-6 |
| `Warnings` | Infeasible / over-budget / rejected-replacement messages | FR-7 |

### 6.3 Persistence (optional)

- Key [Proposed]: `personal-trip-planner:v1`. Value: `{ preferences, plan }` as JSON.
- Wrap every read and write in `try/catch`. If the stored data is missing or broken, fall back to the defaults.

---

## 7. Configuration: one home for the undecided rules

All OPEN-n product rules that affect the engine must live in `src/engine/config.ts`, so that a product decision is a one-line change. **No values are decided here.** The engineer fills them in once the product owner answers.

```ts
export const PLANNER_CONFIG = {
  dayStart: /* OPEN-7 */,
  dayEnd: /* OPEN-7 */,
  meals: /* OPEN-8: [{ name, windowStart, windowEnd, durationMin }] */,
  paceLimits: /* OPEN-6: { Relaxed, Moderate, Packed } */,
  nightsForThreeDays: /* OPEN-9 */,
  travellersPerRoom: /* OPEN-10 */,
  travelModel: /* OPEN-11: 'distance' | 'area' */,
  miscRule: /* OPEN-12 */,
  slider: /* OPEN-13: { min, max, step } */,
  leverOrder: /* OPEN-14 */,
  replanChangesVisibleStyle: /* OPEN-15 */,
  upgradeOnBudgetIncrease: /* OPEN-16 */,
  replacementRanking: /* OPEN-18 */,
  allowOverBudgetReplacement: /* OPEN-19 */,
  keepUserLockedOnReplan: /* OPEN-20 */,
  infeasibilityRule: /* OPEN-21 */,
  showPlanWhenInfeasible: /* OPEN-22 */,
  scoringWeights: /* OPEN-25: { interest, cost, location } */,
  foodActivityCategory: /* OPEN-26: 'Food' | 'Activities' */,
} as const;
```

---

## 8. Seed dataset

> **Every value in this section is [Seed]: illustrative, not from the brief, and not verified or live.** The brief only says which activities must exist and which fields they need. Prices, durations, hours and coordinates are rough placeholders, chosen so the ₹25,000 → ₹15,000 demo can show meaningful differences. The UI must label all of them as estimates.

### 8.1 Areas and regions

| Region | Areas included |
|---|---|
| North Goa | Candolim, Calangute, Baga, Anjuna, Vagator, Assagao |
| Panaji | Panaji (Fontainhas, municipal market), Dona Paula |
| Old Goa | Old Goa |

### 8.2 Activities (15)

| id | Name | Category | Area / region | Lat, Lng (approx.) | Duration (min) | Cost / person (₹) | Price level | Opening hours | Tags | Popular | Alternative group |
|---|---|---|---|---|---:|---:|---|---|---|---|---|
| `fort-aguada` | Fort Aguada | Fort | Candolim / North Goa | 15.492, 73.774 | 90 | 50 | affordable | 09:30–18:00 | Culture, Beaches | yes | heritage |
| `baga-beach` | Baga Beach | Beach | Baga / North Goa | 15.555, 73.752 | 120 | 0 | free | 06:00–19:00 | Beaches, Relaxation | yes | beach |
| `calangute-beach` | Calangute Beach | Beach | Calangute / North Goa | 15.544, 73.755 | 120 | 0 | free | 06:00–19:00 | Beaches, Relaxation | yes | beach |
| `anjuna-beach` | Anjuna Beach | Beach | Anjuna / North Goa | 15.573, 73.741 | 90 | 0 | free | 06:00–19:00 | Beaches, Relaxation | yes | beach |
| `vagator-beach` | Vagator Beach | Beach | Vagator / North Goa | 15.603, 73.734 | 90 | 0 | free | 06:00–19:00 | Beaches, Relaxation | no | beach |
| `chapora-fort` | Chapora Fort | Fort | Vagator / North Goa | 15.606, 73.736 | 60 | 0 | free | 09:00–17:30 | Culture, Adventure | yes | heritage |
| `bom-jesus` | Basilica of Bom Jesus | Church | Old Goa / Old Goa | 15.501, 73.912 | 60 | 0 | free | 09:00–18:30 | Culture | yes | heritage |
| `fontainhas` | Fontainhas Latin Quarter walk | Heritage walk | Panaji / Panaji | 15.496, 73.832 | 90 | 0 | free | 08:00–19:00 | Culture, Food | yes | heritage |
| `goan-food-trail` | Local Goan food experience | Food | Panaji / Panaji | 15.498, 73.828 | 120 | 600 | affordable | 11:00–21:00 | Food, Culture | no | food |
| `premium-water-sports` | Premium water sports package (parasailing, jet ski, banana ride) | Water sports | Calangute / North Goa | 15.546, 73.754 | 180 | 2,500 | premium | 09:00–17:00 | Adventure, Beaches | no | water |
| `beach-kayaking` | Affordable beach activity: kayaking / banana ride | Water sports | Baga / North Goa | 15.556, 73.751 | 60 | 500 | affordable | 09:00–17:00 | Adventure, Beaches | no | water |
| `dona-paula-sunset` | Sunset viewpoint (Dona Paula) | Viewpoint | Dona Paula / Panaji | 15.456, 73.804 | 60 | 0 | free | 16:30–19:00 | Relaxation, Beaches | yes | sunset |
| `panaji-market` | Local market (Panaji municipal market) | Market | Panaji / Panaji | 15.497, 73.826 | 60 | 0 | free | 08:00–20:00 | Food, Culture | no | market |
| `assagao-cafe` | Café experience (Assagao / Anjuna) | Café | Assagao / North Goa | 15.596, 73.774 | 90 | 400 | affordable | 09:00–22:00 | Food, Relaxation | no | food |
| `ayurvedic-spa` | Relaxation: Ayurvedic spa session | Spa | Candolim / North Goa | 15.513, 73.767 | 90 | 2,000 | premium | 10:00–20:00 | Relaxation | no | relax |

Short descriptions [Seed]:

- **Fort Aguada:** 17th-century Portuguese fort and lighthouse overlooking the Arabian Sea.
- **Baga Beach:** a lively beach with shacks and water-sports operators.
- **Calangute Beach:** Goa's largest and busiest beach, the "queen of beaches".
- **Anjuna Beach:** a rocky, laid-back beach known for its cafés and flea-market culture.
- **Vagator Beach:** red cliffs and a quieter shoreline below Chapora Fort.
- **Chapora Fort:** hilltop fort ruins with sweeping coastal views.
- **Basilica of Bom Jesus:** a UNESCO-listed baroque church in Old Goa.
- **Fontainhas:** a walk through Panaji's colourful Portuguese-era Latin Quarter.
- **Local Goan food experience:** tasting Goan staples such as fish curry rice, xacuti and bebinca.
- **Premium water sports package:** a bundled parasailing, jet-ski and banana-boat session.
- **Affordable beach activity:** a short kayaking or banana-boat ride.
- **Sunset viewpoint:** watching the sunset from the Dona Paula headland.
- **Local market:** a browse through Panaji's fresh produce, spices and local goods.
- **Café experience:** a relaxed meal at the café belt of Assagao and Anjuna.
- **Ayurvedic spa session:** a traditional massage and wellness treatment.

**Built-in replanning pairs (why this dataset can show meaningful replanning):**

| Premium / expensive | Affordable / free alternative(s) | Shared group |
|---|---|---|
| Premium water sports (₹2,500 pp) | Beach kayaking (₹500 pp), any beach (₹0) | `water` / `beach` |
| Ayurvedic spa (₹2,000 pp) | Beach relaxation (₹0), café (₹400 pp) | `relax` |
| Goan food trail (₹600 pp) | Local market (₹0), café (₹400 pp) | `food` / `market` |

### 8.3 Accommodation and food tiers

| Tier | Accommodation (₹ per room per night) | Food (₹ per person per day) |
|---|---:|---:|
| Budget | 2,500 | 600 |
| Balanced | 4,000 | 850 |
| Luxury | 9,000 | 1,800 |

*Whether accommodation is per room or per person, and how many nights a trip has, are OPEN-9 and OPEN-10.*

### 8.4 Transport parameters

| Mode | Cost basis | Avg speed (km/h) | Extra wait per leg (min) |
|---|---|---:|---:|
| Scooter | ₹500 per scooter per day (rental + fuel) | 25 | 0 |
| Cab | ₹25 per km per vehicle | 25 | 5 |
| Public Transport | ₹15 per person per leg | 15 | 15 |

Road-winding factor for the distance model: **1.3** (straight-line km × 1.3 ≈ road km).

Area-to-area lookup (alternative model), one way:

| From \ To | North Goa (same region) | Panaji | Old Goa |
|---|---|---|---|
| **North Goa** | 15 min · cab ₹200 | 40 min · cab ₹600 | 55 min · cab ₹900 |
| **Panaji** | 40 min · cab ₹600 | 10 min · cab ₹150 | 25 min · cab ₹400 |
| **Old Goa** | 55 min · cab ₹900 | 25 min · cab ₹400 | 10 min · cab ₹150 |

### 8.5 Miscellaneous

| Tier | ₹ per person per day |
|---|---:|
| Budget | 150 |
| Balanced | 250 |
| Luxury | 500 |

*The calculation basis is OPEN-12. These seed figures assume per person per day only so that there are numbers to plug in.*

### 8.6 Sanity check against the brief's example (illustrative only)

The arithmetic below **assumes, for illustration only,** 2 nights, 1 room for 2 travellers, and the per-person-per-day bases above. These are **not** decisions (see OPEN-9, OPEN-10, OPEN-12).

| Category | Balanced (seed) | Budget (seed) | Brief example (orig → replanned) |
|---|---:|---:|---|
| Accommodation | 4,000 × 2 = **8,000** | 2,500 × 2 = **5,000** | 8,000 → 5,000 |
| Food | 850 × 3 × 2 = **5,100** | 600 × 3 × 2 = **3,600** | 5,000 → 3,500 |
| Misc | 250 × 3 × 2 = **1,500** | 150 × 3 × 2 = **900** | 1,500 → 1,000 |
| Activities | e.g. water sports 5,000 + food trail 1,200 + café 800 + Fort Aguada 100 = **7,100** | e.g. kayaking 1,000 + café 800 + Fort Aguada 100 = **1,900** | 6,000 → 2,000 |
| Transport | depends on the itinerary and OPEN-11 | depends on the itinerary and OPEN-11 | 3,000 → 2,000 |

With seed values, a Balanced plan for ₹25,000 leaves about ₹3,300 for transport, and a Budget-tier plan for ₹15,000 leaves about ₹3,600. Both demo budgets are therefore feasible with these seed values.

---

## 9. Testing approach

The test framework is not specified by the brief. Choosing one (or none) is up to the engineer. At minimum, run the scenarios below by hand, and ideally as automated checks against the pure engine.

| Scenario | Steps | Expected | Covers |
|---|---|---|---|
| T1 Generate | Demo inputs (PRD §6), ₹25,000 | 3 days; premium water sports present; Balanced tiers; total ≤ ₹25,000 | AC-1, AC-3 |
| T2 Schedule validity | Inspect every day of T1 | No overlaps; all items within opening hours and day bounds; travel shown; meals present | AC-2 |
| T3 Hand-check cost | Recompute T1's breakdown from §8 values | Matches the UI exactly | AC-3 |
| T4 Replan down | Slider → ₹15,000, Replan | Total ≤ ₹15,000; at least one lever applied; free popular attractions still present; unaffected days unchanged | AC-4, AC-5 |
| T5 Comparison | After T4 | Before/after table of 5 categories + total; savings = old − new | AC-6 |
| T6 Explanation | After T4 | Listed changes and narrative match the actual diff (verify each claim against the plans) | AC-7 |
| T7 Narrative not hard-coded | Replan to a different budget (e.g. ₹18,000) | The narrative's numbers and clauses differ and still match the diff | FR-5 |
| T8 Replace | Replace any activity → choose an option | 2–3 options with duration and cost; the day's times, travel and totals update | AC-8 |
| T9 Invalid replace | Pick an option that breaks opening hours or the day end | Rejected with a reason; plan unchanged | AC-8, FR-6 |
| T10 Infeasible | Replan to a very low budget (e.g. ₹3,000) | Clear infeasibility warning; never a silently over-budget plan | AC-9 |
| T11 Determinism | Generate twice with the same inputs | Identical plans | §2 rule |
| T12 Full journey | §3.1 of the PRD, end to end | No blocking errors | AC-10 |

---

## 10. Run locally

Prerequisites: Node.js and npm (version: **OPEN**. Use a current LTS release).

```bash
# 1. Scaffold (React + TypeScript template)
npm create vite@latest personal-trip-planner -- --template react-ts
cd personal-trip-planner
npm install

# 2. Add dependencies
npm install lucide-react
#    Install and configure Tailwind CSS following the official Tailwind + Vite
#    setup for the Tailwind version you install.

# 3. Develop
npm run dev          # open the printed localhost URL

# 4. Production build (static files in dist/)
npm run build
npm run preview
```

No environment variables, API keys or backend are needed.

---

## 11. Known limitations

- Goa only; three days only.
- All prices, durations, opening hours, coordinates and travel times are **seed estimates**, not real or live data.
- Travel times are approximations (straight-line × factor, or an area table). There are no real routes or traffic.
- Weekday-specific closures are not modelled unless OPEN-27 decides otherwise.
- A greedy, rule-based planner. It finds a good feasible plan, not a guaranteed optimal one.
- No maps, bookings, accounts or sharing. Persistence is limited to one browser.

---

## 12. Traceability: brief → this design

| Brief requirement | Where it is addressed |
|---|---|
| `generateItinerary(tripPreferences, activityDataset)` | §5.1, §5.2 |
| `replanItinerary(existingPlan, updatedConstraints)` | §5.1, §5.3 |
| The planner's eight steps | §5.2 table |
| Replanning requirements (recalculate, rebuild, preserve, minimal change, never exceed silently, warn, explain) | §5.3, §5.4, §5.5 |
| Change summary from actual differences | §5.4 |
| Activity replacement (2–3 options, recalculate, reject or explain) | §5.6 |
| Dataset fields and the required activities | §4 `Activity`, §8.2 |
| Budget / Balanced / Luxury assumptions | §8.3 |
| Prices labelled as estimates | §6.2 `BudgetPanel`, §8 note |
| Stack and no-backend constraints | §1 |
| Acceptance tests | §9 |
