# Personal Trip Planner — Product Requirements Document (PRD)

| | |
|---|---|
| **Product** | Personal Trip Planner |
| **Release** | MVP (v1) |
| **Destination scope** | Goa only, fixed three-day trip |
| **Companion document** | `architecture.md` (technical design, data model, seed dataset) |
| **Status** | Ready to build. Items marked **OPEN** in §12 need a decision before or during the build. |

> **How to read this document**
> Everything here comes from the original product brief unless it is marked otherwise.
> - **[Seed]**: an illustrative value added so the product can be built (prices, durations and so on). These are not facts and are not live data.
> - **OPEN-n**: a decision the brief does not make. It is listed in §12 and has deliberately not been decided here.

---

## 1. Overview

### 1.1 The question the product answers

> **"How can I plan an enjoyable three-day Goa trip within my budget, and what changes when my budget or preferences change?"**

### 1.2 What makes it different

The defining feature is **not** generating a list of attractions. It is **adapting the itinerary intelligently when constraints change**, especially budget. When the budget changes, the user must see:

1. A genuinely recalculated and re-optimised itinerary.
2. A before-and-after cost comparison.
3. A plain-language explanation of exactly what changed and why, **generated from the actual differences between the two plans** (never hard-coded).

### 1.3 Product principles

- **Working, interactive product, not a static mockup.**
- **Consistent data and calculations.** Every number on screen comes from the underlying assumptions.
- **Transparency.** All prices and travel times are labelled as illustrative estimates. The product never implies prices are live.
- **Never silently exceed the budget.** If a trip cannot fit, say so clearly.
- **Minimal change.** When replanning, keep what still works and change only what has to change.

---

## 2. Goals and non-goals

### 2.1 Goals (MVP)

| # | Goal |
|---|---|
| G1 | Generate a realistic, non-overlapping three-day Goa itinerary from user preferences. |
| G2 | Show a transparent budget breakdown calculated from configured assumptions. |
| G3 | **(Hero)** Replan the trip when the budget changes, and explain the changes from real plan differences. |
| G4 | Let the user replace any single activity and recalculate the schedule and cost. |
| G5 | Handle budgets that cannot support a feasible trip, with a clear warning. |

### 2.2 Priority order

If scope must be cut, cut in this order (first to go at the top):

1. Visual enhancements and polish *(cut first)*
2. LocalStorage persistence (optional per the brief)
3. Activity replacement
4. **Never cut:** itinerary generation, budget recalculation, budget replanning with explanation.

### 2.3 Out of scope (explicitly excluded)

- Destinations other than Goa
- Trip lengths other than three days
- Live maps or map rendering
- Flight or hotel booking
- AI chatbots
- Authentication or user accounts
- Payment integrations
- Collaborative planning
- External databases, backends, external APIs or paid services
- Live or real-time pricing

---

## 3. Target user and core journey

**User:** a traveller (or a group of travellers) planning a three-day Goa trip under a fixed total budget, who wants to see how the plan changes as the budget or their preferences change.

### 3.1 Definition of success (the demo journey)

The MVP succeeds when this journey works end to end with **consistent data and calculations**:

```
Generate ₹25,000 Goa trip
  → View three-day itinerary
  → Reduce budget to ₹15,000
  → Replan
  → See real changes and savings
  → Replace an activity
  → View updated schedule and costs
```

---

## 4. Functional requirements

### FR-1 Trip inputs (Screen 1)

| Field | Type | Options | Default | Notes |
|---|---|---|---|---|
| Destination | Fixed (display only) | Goa | Goa | Not editable. |
| Duration | Fixed (display only) | 3 days | 3 days | Not editable. |
| Travel start date | Date picker | Any date | **OPEN-1** | End date is calculated automatically (start + 2 days, a three-day trip). |
| Total budget | Number (₹) | — | **₹25,000** | Validation limits: **OPEN-2**. |
| Number of travellers | Integer | — | **2** | Min/max: **OPEN-3**. |
| Interests | Multi-select | Beaches, Food, Adventure, Culture, Relaxation | **OPEN-4** | The demo selects Beaches, Food and Adventure. Whether zero selections is allowed: **OPEN-4**. |
| Travel style | Single-select | Budget, Balanced, Luxury | **OPEN-5** | The demo uses Balanced. |
| Pace | Single-select | Relaxed, Moderate, Packed | **OPEN-5** | |
| Transportation | Single-select | Scooter, Cab, Public Transport | **OPEN-5** | |

**Primary call to action:** **Generate My Trip**. It runs the planner and opens Screen 2.

### FR-2 Day-wise itinerary (Screen 2, main panel)

- Three days shown as **Day 1 / Day 2 / Day 3 tabs**, each with a **vertical activity timeline**.
- Each activity card **must** show:
  - Activity name and short description
  - Start time and end time
  - Duration
  - Estimated cost (labelled as an estimate)
  - Travel time from the previous activity (labelled as an estimate)
  - A **Replace** action
- Scheduling **must**:
  - Group attractions geographically (nearby activities on the same day)
  - Avoid overlapping schedules
  - Include meal breaks
  - Respect each activity's opening hours
  - Leave travel buffers between activities
- The number of activities per day must reflect the selected **Pace** (exact mapping: **OPEN-6**).
- Day start and end times: **OPEN-7**. Meal-break timing and duration: **OPEN-8**.

### FR-3 Budget breakdown (Screen 2, side panel)

Show these five categories, each calculated from configured assumptions:

| Category | Driven by |
|---|---|
| Accommodation | Travel-style tier × number of nights × travellers/rooms (**OPEN-9**, **OPEN-10**) |
| Food | Travel-style tier × days × travellers |
| Transportation | Selected transport mode × the trips the itinerary actually makes (cost model: **OPEN-11**) |
| Activities | Sum of the costs of the scheduled activities × travellers (where the cost is per person) |
| Miscellaneous | Calculation basis: **OPEN-12** |

Also show:

- **Total estimated cost**
- **Budget remaining** (budget − total; shown clearly as negative or as a warning if over)
- **Budget utilisation indicator** (total ÷ budget, as a bar)

All prices are **illustrative estimates**, and the UI must say so. Calculations must account for the **number of travellers** and **accommodation nights**.

### FR-4 Intelligent budget replanning **(HERO feature, highest priority)**

**Controls (Screen 2, side panel):**

- An interactive **budget slider** (range and step: **OPEN-13**)
- A prominent **Replan Trip** button

**Behaviour when Replan Trip is clicked:**

| # | Requirement |
|---|---|
| R1 | Genuinely recalculate and re-optimise the itinerary against the new budget. Do not just rescale the numbers. |
| R2 | Recalculate **every affected expense** category. |
| R3 | Rebuild **affected** daily schedules (times, travel times, meal breaks). |
| R4 | **Preserve activities that remain feasible.** |
| R5 | **Avoid unnecessary changes.** |
| R6 | **Never silently exceed** the new budget. |
| R7 | Show a **clear warning when the budget is infeasible** (see FR-7). |
| R8 | **Explain exactly what changed and why** (see FR-5). |

**Allowed adjustment levers** (from the brief; the engine may use any of them):

- Replace expensive water sports with a beach experience.
- Switch to budget accommodation assumptions.
- Replace premium dining with affordable local restaurants.
- Reduce unnecessary cab trips by grouping nearby activities.
- Preserve popular free attractions.

The order in which the levers are applied: **OPEN-14**. Whether a replan may change the user's selected Travel style shown in the UI: **OPEN-15**. Behaviour when the budget is **increased**: **OPEN-16**.

The brief says the product adapts when "budget **or preferences**" change. The replanning function accepts updated constraints in general. How a user edits preferences after generation (on Screen 2, or by going back to Screen 1) is **OPEN-17**.

### FR-5 Change summary (after a replan)

Show:

- **Previous total cost**, **new total cost** and **savings** (difference)
- A **before-and-after table by category** (Accommodation, Food, Transport, Activities, Miscellaneous, Total)
- **Specific activity changes**: removed, added, replaced (old → new) and kept
- **Specific assumption changes** (for example, accommodation tier, food tier, transport usage)
- A **plain-language explanation paragraph**

**Hard rule:** the summary and the explanation **must be generated from the actual differences between the two plans**, never hard-coded for the demo.

Example of the expected tone (the wording must be built dynamically from the diff):

> "Your budget was reduced by ₹10,000. We've switched to affordable accommodation, replaced premium water sports with a beach experience, and optimized local transportation. Your updated trip saves ₹10,000 while keeping your preferred beach and food experiences."

### FR-6 Activity replacement

Available on **every** itinerary activity, independently of budget replanning.

| Step | Behaviour |
|---|---|
| 1 | The user clicks **Replace** on an activity. |
| 2 | Show **2–3 alternatives** from the Goa dataset. |
| 3 | Show each alternative's **duration** and **estimated cost**. |
| 4 | The user selects one. |
| 5 | Recalculate **that day's schedule**, **travel times** and the **trip cost** (breakdown, total, remaining, utilisation). |
| 6 | **Reject, or explain**, any replacement that violates hard scheduling constraints (opening hours, overlap, end of day). |

How alternatives are chosen and ranked: **OPEN-18**. Whether a replacement that pushes the trip over budget is blocked or allowed with a warning: **OPEN-19**. Whether user-made replacements are kept on a later replan: **OPEN-20**.

### FR-7 Infeasible budgets

- If no feasible trip fits within the budget, even after all adjustment levers, show a **clear warning**.
- The product **must not** present an over-budget plan as if it fits.
- What counts as infeasible: **OPEN-21**. Whether to show the cheapest possible plan with the shortfall, or no plan: **OPEN-22**.

### FR-8 Persistence (optional)

- Optionally save the current trip (preferences and plan) to **browser LocalStorage**, so a page refresh does not lose it.
- No server-side storage.

### FR-9 Pricing transparency

- Every price and travel time is labelled as an **estimate**.
- A visible disclaimer says prices are **illustrative and not live**.

---

## 5. Screens and UX

### 5.1 Screen 1 — "Plan Your Goa Trip"

- A clean, minimal form with all FR-1 inputs.
- Destination (Goa) and duration (3 days) shown as fixed context.
- A prominent **Generate My Trip** button.

### 5.2 Screen 2 — "Your Personalized Itinerary"

```
┌──────────────────────────────────────────────────────────────────────┐
│ HEADER: Goa · <start date> – <end date> · <n> travellers ·           │
│         Est. cost ₹X · Remaining ₹Y                                  │
├───────────────────────────────────────────┬──────────────────────────┤
│ MAIN PANEL                                │ SIDE PANEL               │
│ [ Day 1 ] [ Day 2 ] [ Day 3 ]             │ Budget breakdown         │
│                                           │  Accommodation   ₹       │
│  09:00 ● Activity name          [Replace] │  Food            ₹       │
│        │ description                      │  Transport       ₹       │
│        │ 09:00–10:30 · 1h 30m · ₹ est.    │  Activities      ₹       │
│        │ travel from prev: 20 min est.    │  Misc            ₹       │
│  12:30 ● Lunch break                      │  Total           ₹       │
│        │ ...                              │  [■■■■■■■□□□] 82% used   │
│                                           │                          │
│                                           │  Budget slider ──●────   │
│                                           │  [   Replan Trip   ]     │
├───────────────────────────────────────────┴──────────────────────────┤
│ CHANGE SUMMARY (after replan): previous ₹ · new ₹ · saved ₹          │
│ Before/after table · activity changes · assumption changes · text    │
└──────────────────────────────────────────────────────────────────────┘
```

The position of the change summary on the page is **OPEN-23**. The layout above is a suggestion, not a requirement.

### 5.3 Visual direction

- A clean, modern travel-app look: readable type, muted colours, **no unnecessary animations**.
- Responsive layout (desktop and mobile).
- **The interactive budget comparison matters more than maps or decorative features.**
- Icons: the Lucide icon set.

---

## 6. Demo scenario (must work end to end)

**Step 1 — Generate**

| Input | Value |
|---|---|
| Destination | Goa |
| Duration | 3 days |
| Travellers | 2 |
| Budget | ₹25,000 |
| Interests | Beaches, Food, Adventure |
| Travel style | Balanced |
| Pace / Transport / Start date | *Not specified in the brief*: **OPEN-24** |

Expected: a complete itinerary that includes a **premium water-sports activity**, **good dining options** and **comfortable accommodation assumptions**.

**Step 2 — Reduce the budget** from ₹25,000 to ₹15,000 with the slider, then click **Replan Trip**. Expected: a genuine recalculation using the levers in FR-4.

**Step 3 — Explain.** Expected: a before-and-after comparison and an explanation.

Example from the brief. **These are illustrative targets. The app must calculate its actual totals from its configured assumptions.**

| Category | Original | Replanned |
|---|---:|---:|
| Accommodation | ₹8,000 | ₹5,000 |
| Food | ₹5,000 | ₹3,500 |
| Transport | ₹3,000 | ₹2,000 |
| Activities | ₹6,000 | ₹2,000 |
| Miscellaneous | ₹1,500 | ₹1,000 |
| **Total** | **₹23,500** | **₹13,500** |

**Step 4 — Replace** any activity, choose an alternative, and confirm that the day's schedule and the trip totals update.

---

## 7. Dataset requirements (product view)

- About **12–15 Goa activities**. They must include: Fort Aguada, Baga Beach, Calangute Beach, Anjuna Beach, Vagator Beach, Chapora Fort, Basilica of Bom Jesus, Fontainhas, a local Goan food experience, premium water sports, affordable beach activities, a sunset viewpoint, a local market, a café experience and a relaxation activity.
- Each activity has: **ID, category, coordinates or area, duration, cost, opening hours, interest tags, description**.
- **Budget / Balanced / Luxury** assumptions for **accommodation and food**.
- Enough **affordable and premium alternatives** to show meaningful replanning.
- All prices and travel times are labelled as **estimates**.

The full seed dataset is in `architecture.md` §8. Every value in it is **[Seed]** (illustrative).

---

## 8. Acceptance criteria

| # | Test | Pass condition |
|---|---|---|
| AC-1 | Generate a three-day Goa itinerary | Three day tabs, each with a timeline of activities and meal breaks. |
| AC-2 | Realistic, non-overlapping schedules | No two items overlap. Each activity falls within its opening hours. Travel time is shown between items. |
| AC-3 | Total trip cost calculated from underlying assumptions | Category totals and the grand total match the configured assumptions and the scheduled activities (checkable by hand). |
| AC-4 | Change budget from ₹25,000 to ₹15,000 | The slider moves to ₹15,000 and Replan Trip runs. |
| AC-5 | Updated itinerary with meaningful cost reductions | The new total is ≤ ₹15,000 (or a clear infeasibility warning appears), with real changes to activities and/or assumptions. |
| AC-6 | Before-and-after expense comparison | A table with all five categories plus the total, before and after. |
| AC-7 | Explain which activities or assumptions changed | The listed changes and the explanation text match the actual differences between the plans. |
| AC-8 | Replace an individual activity | 2–3 alternatives with duration and cost. Selecting one updates the day's schedule, travel times and the budget. Invalid replacements are rejected or explained. |
| AC-9 | Budgets that cannot support a feasible trip | A very low budget produces a clear warning. No plan is silently over budget. |
| AC-10 | No blocking errors | The full demo journey (§3.1) completes without crashes or console errors that block use. |

---

## 9. Deliverables

1. A running application (local).
2. A short architecture summary (see `architecture.md`).
3. The dataset and its assumptions (see `architecture.md` §8).
4. The demo scenarios that were tested, with results.
5. Known limitations.
6. Instructions to run locally.

---

## 10. Known limitations (by design)

- Goa only, three days only.
- Prices, durations, opening hours, coordinates and travel times are **illustrative estimates**, not live or verified data.
- No maps, bookings, accounts, payments or multi-user features.
- A deterministic, rule-based planner. No AI or ML.
- Data is stored only in the user's browser (if persistence is built).

---

## 11. Glossary

| Term | Meaning |
|---|---|
| Plan / itinerary | The full output: three day schedules, a budget breakdown, warnings and explanations. |
| Replan | Re-running the planner against updated constraints (for example, a new budget), starting from an existing plan. |
| Tier | The Budget / Balanced / Luxury level of the accommodation and food assumptions. |
| Lever | One of the cost-reduction moves the replanner may make (FR-4). |
| Feasible | A plan that meets every hard constraint (no overlaps, within opening hours and day bounds) and fits the budget. |

---

## 12. Open questions (decisions not made by the brief)

These are **deliberately not decided** in this document. The product owner should decide each one; record the decision here before or during the build.

| ID | Area | Question |
|---|---|---|
| OPEN-1 | Inputs | What is the default travel start date (for example, today, tomorrow or blank)? Can past dates be chosen? |
| OPEN-2 | Inputs | What are the minimum and maximum allowed budgets? |
| OPEN-3 | Inputs | What are the minimum and maximum number of travellers? |
| OPEN-4 | Inputs | What are the default interest selections? Can zero interests be selected? |
| OPEN-5 | Inputs | What are the defaults for Travel style, Pace and Transportation? |
| OPEN-6 | Scheduling | How does Pace (Relaxed / Moderate / Packed) map to activities per day or hours scheduled per day? |
| OPEN-7 | Scheduling | What are each day's start and end times? Are Day 1 and Day 3 shortened for arrival and departure? |
| OPEN-8 | Scheduling | How many meal breaks per day, at what times and for how long? Are meals fixed slots or flexible windows? |
| OPEN-9 | Budget | How many accommodation nights does a three-day trip have (2 or 3)? |
| OPEN-10 | Budget | Is accommodation priced per room or per person? If per room, how many travellers share a room? |
| OPEN-11 | Budget / travel | How are travel time and transport cost calculated: from coordinates (distance × speed and rate) or from an area-to-area lookup table? Are scooter costs per day or per trip, and how many scooters per group? |
| OPEN-12 | Budget | How is Miscellaneous calculated: a flat amount per tier, per person per day, or a percentage of the subtotal? |
| OPEN-13 | Replan UI | What are the budget slider's minimum, maximum and step? Does moving the slider alone change anything, or only clicking Replan? |
| OPEN-14 | Replan logic | In what order are the adjustment levers applied? Are activities dropped before tiers are downgraded, or the reverse? |
| OPEN-15 | Replan logic | When a replan switches to budget accommodation, does the visible Travel style input change to "Budget", or does only the assumption change? Can food and accommodation tiers change independently? |
| OPEN-16 | Replan logic | When the budget goes **up**, should the replan upgrade (tier, premium activities), or keep the plan and just show more remaining? |
| OPEN-17 | Replan UI | How does the user change preferences (interests, pace, transport, travellers) after generating: on Screen 2 or back on Screen 1? Does a preference change produce a change summary too? |
| OPEN-18 | Replace | How are the 2–3 alternatives chosen: same category, same interest tags, same area, similar duration, cheaper? In what order are they shown? |
| OPEN-19 | Replace | If a replacement makes the trip exceed the budget, is it blocked or allowed with a warning? |
| OPEN-20 | Replace / replan | Are user-chosen replacements locked (kept) on a later replan? |
| OPEN-21 | Feasibility | What exactly makes a budget infeasible: below the cheapest possible fixed costs (accommodation + food + transport + misc at the lowest tier), or a minimum number of activities per day that can't be met? |
| OPEN-22 | Feasibility | When the budget is infeasible, show the cheapest possible plan with the shortfall, or show no plan? |
| OPEN-23 | UI | Where does the change summary appear (below the itinerary, in the side panel, or in a modal), and does it stay after a later Replace? |
| OPEN-24 | Demo | What Pace, Transportation and start date does the reference demo use? |
| OPEN-25 | Scoring | How much weight do interest match, cost and location each get when scoring activities? |
| OPEN-26 | Categories | Is a paid food activity (for example, the Goan food experience or the café) counted under **Food** or **Activities**? Do meal-break costs come from the food tier? |
| OPEN-27 | Dates | Do weekday-specific opening days matter (for example, markets closed on certain days), given that start dates are real? |
| OPEN-28 | Currency display | What number format should be used: Indian grouping (₹1,00,000) or Western (₹100,000)? |
