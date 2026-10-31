// Core planning engine: generateItinerary + replanItinerary.
//
// Pipeline (architecture.md §5.2):
//  1–2. fixed vs variable expenses → computed by costing.ts on every evaluation
//  3.   score activities by interest, price level vs style, popularity
//  4.   group geographically: one cluster per day
//  5–6. greedy selection per day, each candidate validated by the scheduler
//  7.   recompute the budget; if over, apply cost levers in a fixed order
//  8.   return the plan with explanations and warnings
import { ACCOMMODATION_LABEL } from '../data/assumptions';
import { ALL_ACTIVITIES, getDestination } from '../data/destinations';
import { PLANNER_CONFIG, TIER_ORDER, type LeverId } from './config';
import { buildAssumptions, computeBreakdown } from './costing';
import { diffPlans } from './diff';
import { scheduleDay, type DayContext } from './scheduler';
import { addDays } from './time';
import type {
  Activity,
  ChangeSummary,
  DayPlan,
  Explanation,
  Plan,
  PlanWarning,
  Tiers,
  TripPreferences,
  UserEdits,
} from './types';

export const EMPTY_EDITS: UserEdits = { locked: [], excluded: [] };
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

// ---------- scoring ----------

export function interestMatches(a: Activity, prefs: TripPreferences): number {
  return a.tags.filter((t) => prefs.interests.includes(t)).length;
}

export function scoreActivity(a: Activity, prefs: TripPreferences): number {
  const s = PLANNER_CONFIG.scoring;
  return (
    interestMatches(a, prefs) * s.perInterestMatch +
    s.styleBonus[prefs.travelStyle][a.priceLevel] +
    (a.popular ? s.popularBonus : 0)
  );
}

/** An activity is a candidate if it matches an interest or is a popular highlight. */
export function isEligible(a: Activity, prefs: TripPreferences): boolean {
  return interestMatches(a, prefs) > 0 || a.popular;
}

const byScore = (prefs: TripPreferences) => (x: Activity, y: Activity) =>
  scoreActivity(y, prefs) - scoreActivity(x, prefs) || x.id.localeCompare(y.id);

// ---------- state + evaluation ----------

export interface PlanState {
  days: string[][]; // activity ids per day, index 0..2
  tiers: Tiers;
}

function dayContext(prefs: TripPreferences, tiers: Tiers, edits: UserEdits): DayContext {
  return {
    destination: prefs.destination,
    travellers: prefs.travellers,
    transport: prefs.transport,
    foodTier: tiers.food,
    lockedIds: new Set(edits.locked.map((l) => l.activityId)),
  };
}

function lookup(dataset: Activity[]) {
  const m = new Map(dataset.map((a) => [a.id, a]));
  return (id: string) => {
    const a = m.get(id);
    if (!a) throw new Error(`Unknown activity ${id}`);
    return a;
  };
}

/** Builds a full Plan from a state. Assumes each day list is schedulable. */
export function evaluate(
  prefs: TripPreferences,
  dataset: Activity[],
  state: PlanState,
  edits: UserEdits,
  explanations: Explanation[] = [],
): Plan {
  const get = lookup(dataset);
  const ctx = dayContext(prefs, state.tiers, edits);
  const days: DayPlan[] = state.days.map((ids, i) => {
    const r = scheduleDay(ids.map(get), ctx);
    if (!r.ok) throw new Error(`Day ${i + 1} is not schedulable: ${r.reason}`);
    return {
      dayNumber: i + 1,
      date: addDays(prefs.startDate, i),
      cluster: getDestination(prefs.destination).clusters[i].id,
      clusterLabel: getDestination(prefs.destination).clusters[i].label,
      items: r.items,
      returnToHotel: r.returnToHotel,
      transportCost: r.transportCost,
    };
  });
  const assumptions = buildAssumptions(prefs, state.tiers);
  const breakdown = computeBreakdown(prefs, assumptions, days);
  const feasible = breakdown.total <= prefs.budget;
  return { preferences: prefs, assumptions, days, breakdown, warnings: [], explanations, feasible, userEdits: edits };
}

const canSchedule = (ids: string[], dataset: Activity[], prefs: TripPreferences, tiers: Tiers, edits: UserEdits) =>
  scheduleDay(ids.map(lookup(dataset)), dayContext(prefs, tiers, edits)).ok;

// ---------- ideal selection (before budget fitting) ----------

export function selectIdealDays(prefs: TripPreferences, dataset: Activity[], edits: UserEdits): string[][] {
  const tiers: Tiers = { accommodation: prefs.travelStyle, food: prefs.travelStyle };
  const limit = PLANNER_CONFIG.paceLimits[prefs.pace];
  const excluded = new Set(edits.excluded);
  const used = new Set(edits.locked.map((l) => l.activityId));
  const get = lookup(dataset);

  return getDestination(prefs.destination).clusters.map((cluster, i) => {
    const chosen = edits.locked.filter((l) => l.day === i + 1).map((l) => l.activityId);
    const groups = new Set(chosen.map((id) => get(id).alternativeGroup));
    const candidates = dataset
      .filter((a) => a.cluster === cluster.id && !used.has(a.id) && !excluded.has(a.id) && isEligible(a, prefs))
      .sort(byScore(prefs));
    for (const c of candidates) {
      if (chosen.length >= limit) break;
      if (groups.has(c.alternativeGroup)) continue;
      const tentative = [...chosen, c.id];
      if (canSchedule(tentative, dataset, prefs, tiers, edits)) {
        chosen.push(c.id);
        groups.add(c.alternativeGroup);
      }
    }
    chosen.forEach((id) => used.add(id));
    return chosen;
  });
}

// ---------- budget levers ----------

interface Move {
  state: PlanState;
  explain: (saving: number) => Explanation;
}

function cloneState(s: PlanState): PlanState {
  return { days: s.days.map((d) => [...d]), tiers: { ...s.tiers } };
}

/** Best cheaper alternative for `a` on day `di`: same group first, then score, then price. */
function cheaperAlternative(
  a: Activity,
  di: number,
  state: PlanState,
  prefs: TripPreferences,
  dataset: Activity[],
  edits: UserEdits,
  mustBeFree: boolean,
): Activity | null {
  const inPlan = new Set(state.days.flat());
  const excluded = new Set(edits.excluded);
  const get = lookup(dataset);
  const otherGroups = new Set(state.days[di].filter((id) => id !== a.id).map((id) => get(id).alternativeGroup));
  const userTagsOfA = a.tags.filter((t) => prefs.interests.includes(t));
  const options = dataset
    .filter(
      (b) =>
        !inPlan.has(b.id) &&
        !excluded.has(b.id) &&
        b.cluster === a.cluster &&
        b.costPerPerson < a.costPerPerson &&
        (mustBeFree ? b.costPerPerson === 0 : b.priceLevel !== 'premium') &&
        !otherGroups.has(b.alternativeGroup) &&
        (b.alternativeGroup === a.alternativeGroup || b.tags.some((t) => userTagsOfA.includes(t))),
    )
    .sort(
      (x, y) =>
        Number(y.alternativeGroup === a.alternativeGroup) - Number(x.alternativeGroup === a.alternativeGroup) ||
        scoreActivity(y, prefs) - scoreActivity(x, prefs) ||
        x.costPerPerson - y.costPerPerson ||
        x.id.localeCompare(y.id),
    );
  for (const b of options) {
    const ids = state.days[di].map((id) => (id === a.id ? b.id : id));
    if (canSchedule(ids, dataset, prefs, state.tiers, edits)) return b;
  }
  return null;
}

function movesFor(lever: LeverId, state: PlanState, prefs: TripPreferences, dataset: Activity[], edits: UserEdits): Move[] {
  const get = lookup(dataset);
  const locked = new Set(edits.locked.map((l) => l.activityId));
  const moves: Move[] = [];
  const each = (fn: (a: Activity, di: number) => void) =>
    state.days.forEach((ids, di) => ids.forEach((id) => !locked.has(id) && fn(get(id), di)));

  switch (lever) {
    case 'SWAP_PREMIUM_ACTIVITY':
    case 'SWAP_PAID_FOR_FREE': {
      const free = lever === 'SWAP_PAID_FOR_FREE';
      each((a, di) => {
        if (free ? a.costPerPerson === 0 : a.priceLevel !== 'premium') return;
        const b = cheaperAlternative(a, di, state, prefs, dataset, edits, free);
        if (!b) return;
        const s = cloneState(state);
        s.days[di] = s.days[di].map((id) => (id === a.id ? b.id : id));
        moves.push({
          state: s,
          explain: (saving) => ({
            code: free ? 'PAID_ACTIVITY_SWAPPED_FOR_FREE' : 'PREMIUM_ACTIVITY_SWAPPED',
            message: `Replaced ${a.name} with ${b.name} on Day ${di + 1} (saves ${inr(saving)}).`,
            saving,
            relatedActivityIds: [a.id, b.id],
          }),
        });
      });
      break;
    }
    case 'DOWNGRADE_ACCOMMODATION':
    case 'DOWNGRADE_FOOD': {
      const key = lever === 'DOWNGRADE_ACCOMMODATION' ? 'accommodation' : 'food';
      const idx = TIER_ORDER.indexOf(state.tiers[key]);
      if (idx <= 0) break;
      const s = cloneState(state);
      const from = state.tiers[key];
      const to = TIER_ORDER[idx - 1];
      s.tiers[key] = to;
      moves.push({
        state: s,
        explain: (saving) =>
          key === 'accommodation'
            ? {
                code: 'ACCOMMODATION_TIER_DOWNGRADED',
                message: `Switched accommodation from ${ACCOMMODATION_LABEL[from]} to ${ACCOMMODATION_LABEL[to]} (saves ${inr(saving)}).`,
                saving,
              }
            : {
                code: 'FOOD_TIER_DOWNGRADED',
                message: `Switched dining from ${getDestination(prefs.destination).mealStyle[from].label.toLowerCase()} to ${getDestination(prefs.destination).mealStyle[to].label.toLowerCase()} (saves ${inr(saving)}).`,
                saving,
              },
      });
      break;
    }
    case 'DROP_PAID_ACTIVITY':
    case 'DROP_FAR_ACTIVITY': {
      const paidOnly = lever === 'DROP_PAID_ACTIVITY';
      each((a, di) => {
        if (state.days[di].length <= PLANNER_CONFIG.minActivitiesPerDay) return;
        if (paidOnly && a.costPerPerson === 0) return;
        if (a.popular && a.costPerPerson === 0) return; // preserve popular free attractions
        const s = cloneState(state);
        s.days[di] = s.days[di].filter((id) => id !== a.id);
        if (!canSchedule(s.days[di], dataset, prefs, s.tiers, edits)) return;
        moves.push({
          state: s,
          explain: (saving) => ({
            code: paidOnly ? 'PAID_ACTIVITY_DROPPED' : 'FAR_ACTIVITY_DROPPED',
            message: paidOnly
              ? `Dropped ${a.name} from Day ${di + 1} (saves ${inr(saving)}).`
              : `Dropped ${a.name} from Day ${di + 1} to cut travel (saves ${inr(saving)}).`,
            saving,
            relatedActivityIds: [a.id],
          }),
        });
      });
      break;
    }
  }
  return moves;
}

function fitToBudget(prefs: TripPreferences, dataset: Activity[], initial: PlanState, edits: UserEdits): Plan {
  let state = initial;
  let plan = evaluate(prefs, dataset, state, edits);
  const explanations: Explanation[] = [];

  for (const lever of PLANNER_CONFIG.leverOrder) {
    while (plan.breakdown.total > prefs.budget) {
      let best: { move: Move; plan: Plan } | null = null;
      for (const move of movesFor(lever, state, prefs, dataset, edits)) {
        const p = evaluate(prefs, dataset, move.state, edits);
        if (p.breakdown.total < plan.breakdown.total && (!best || p.breakdown.total < best.plan.breakdown.total)) {
          best = { move, plan: p };
        }
      }
      if (!best) break;
      explanations.push(best.move.explain(plan.breakdown.total - best.plan.breakdown.total));
      state = best.move.state;
      plan = best.plan;
    }
  }

  if (explanations.length) {
    const get = lookup(dataset);
    const keptFree = state.days.flat().map(get).filter((a) => a.popular && a.costPerPerson === 0);
    if (keptFree.length) {
      explanations.push({
        code: 'FREE_ATTRACTION_KEPT',
        message: `Kept popular free highlights: ${keptFree.map((a) => a.name).join(', ')}.`,
        relatedActivityIds: keptFree.map((a) => a.id),
      });
    }
  }

  const warnings: PlanWarning[] = [];
  if (plan.breakdown.total > prefs.budget) {
    const short = plan.breakdown.total - prefs.budget;
    warnings.push({
      code: 'BUDGET_INFEASIBLE',
      message:
        `A ${prefs.travellers}-traveller, 3-day ${getDestination(prefs.destination).name} trip can't be done for ${inr(prefs.budget)} with these assumptions. ` +
        `The cheapest workable plan below costs ${inr(plan.breakdown.total)} — ${inr(short)} over budget. ` +
        `Raise the budget to at least ${inr(plan.breakdown.total)}, reduce travellers, or switch to cheaper transport.` +
        (edits.locked.length ? ' Activities you picked yourself were kept and may be adding cost.' : ''),
    });
  }
  return { ...plan, explanations, warnings, feasible: warnings.length === 0 };
}

// ---------- public API ----------

/** Deterministic: the same preferences, dataset and edits always produce the same plan. */
export function generateItinerary(
  tripPreferences: TripPreferences,
  activityDataset: Activity[] = getDestination(tripPreferences.destination).activities,
  edits: UserEdits = EMPTY_EDITS,
): Plan {
  const days = selectIdealDays(tripPreferences, activityDataset, edits);
  const tiers: Tiers = { accommodation: tripPreferences.travelStyle, food: tripPreferences.travelStyle };
  return fitToBudget(tripPreferences, activityDataset, { days, tiers }, edits);
}

/**
 * Replans against updated constraints (budget and/or preferences). Starts from the
 * user's chosen style and the existing plan's edits, so activities that remain
 * feasible are preserved and only the levers needed to fit are applied. Raising
 * the budget restores tiers/activities up to (never above) the chosen style.
 */
export function replanItinerary(
  existingPlan: Plan,
  updatedConstraints: Partial<TripPreferences>,
  activityDataset?: Activity[],
): { plan: Plan; summary: ChangeSummary } {
  const prefs: TripPreferences = { ...existingPlan.preferences, ...updatedConstraints };
  const sameDest = prefs.destination === existingPlan.preferences.destination;
  const edits = PLANNER_CONFIG.keepUserLockedOnReplan && sameDest ? existingPlan.userEdits : EMPTY_EDITS;
  const plan = generateItinerary(prefs, activityDataset ?? getDestination(prefs.destination).activities, edits);
  return { plan, summary: diffPlans(existingPlan, plan, activityDataset ?? ALL_ACTIVITIES) };
}
