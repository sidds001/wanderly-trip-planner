// Single-activity replacement, independent of budget replanning (PRD FR-6).
import { getDestination } from '../data/destinations';
import { PLANNER_CONFIG } from './config';
import { evaluate, interestMatches, scoreActivity, type PlanState } from './planner';
import { scheduleDay } from './scheduler';
import type { Activity, Plan, ReplacementOption, UserEdits } from './types';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function stateOf(plan: Plan): PlanState {
  return {
    days: plan.days.map((d) => d.items.filter((i) => i.activityId).map((i) => i.activityId!)),
    tiers: { accommodation: plan.assumptions.accommodationTier, food: plan.assumptions.foodTier },
  };
}

function withSwap(plan: Plan, dayNumber: number, fromId: string, toId: string): PlanState {
  const s = stateOf(plan);
  s.days[dayNumber - 1] = s.days[dayNumber - 1].map((id) => (id === fromId ? toId : id));
  return s;
}

function editsAfterSwap(plan: Plan, dayNumber: number, fromId: string, toId: string): UserEdits {
  return {
    locked: [...plan.userEdits.locked.filter((l) => l.activityId !== fromId), { activityId: toId, day: dayNumber }],
    excluded: [...new Set([...plan.userEdits.excluded.filter((id) => id !== toId), fromId])],
  };
}

/** Up to 3 alternatives: same group first, then same area cluster, then interest fit. */
export function getReplacementOptions(
  plan: Plan,
  dayNumber: number,
  activityId: string,
  dataset: Activity[] = getDestination(plan.preferences.destination).activities,
  max = 3,
): ReplacementOption[] {
  const prefs = plan.preferences;
  const current = dataset.find((a) => a.id === activityId);
  if (!current) return [];
  const inPlan = new Set(plan.days.flatMap((d) => d.items.map((i) => i.activityId).filter(Boolean)));
  const dayIds = stateOf(plan).days[dayNumber - 1];

  const ranked = dataset
    .filter((b) => !inPlan.has(b.id))
    .sort(
      (x, y) =>
        Number(y.alternativeGroup === current.alternativeGroup) - Number(x.alternativeGroup === current.alternativeGroup) ||
        Number(y.cluster === current.cluster) - Number(x.cluster === current.cluster) ||
        interestMatches(y, prefs) - interestMatches(x, prefs) ||
        scoreActivity(y, prefs) - scoreActivity(x, prefs) ||
        x.id.localeCompare(y.id),
    )
    .slice(0, max);

  return ranked.map((b) => {
    const ids = dayIds.map((id) => (id === activityId ? b.id : id));
    const sched = scheduleDay(
      ids.map((id) => dataset.find((a) => a.id === id)!),
      { destination: prefs.destination, travellers: prefs.travellers, transport: prefs.transport, foodTier: plan.assumptions.foodTier },
    );
    if (!sched.ok) {
      return {
        activity: b,
        durationMin: b.durationMin,
        estimatedCost: b.costPerPerson * prefs.travellers,
        costDelta: 0,
        feasible: false,
        reason: sched.reason,
        overBudget: false,
      };
    }
    const next = evaluate(prefs, dataset, withSwap(plan, dayNumber, activityId, b.id), plan.userEdits);
    return {
      activity: b,
      durationMin: b.durationMin,
      estimatedCost: b.costPerPerson * prefs.travellers,
      costDelta: next.breakdown.total - plan.breakdown.total,
      feasible: true,
      overBudget: next.breakdown.total > prefs.budget,
    };
  });
}

export type ReplaceResult = { ok: true; plan: Plan; message: string } | { ok: false; reason: string };

export function applyReplacement(
  plan: Plan,
  dayNumber: number,
  activityId: string,
  newActivityId: string,
  dataset: Activity[] = getDestination(plan.preferences.destination).activities,
): ReplaceResult {
  const from = dataset.find((a) => a.id === activityId);
  const to = dataset.find((a) => a.id === newActivityId);
  if (!from || !to) return { ok: false, reason: 'Unknown activity.' };
  if (plan.days.some((d) => d.items.some((i) => i.activityId === newActivityId)))
    return { ok: false, reason: `${to.name} is already in your itinerary.` };

  const state = withSwap(plan, dayNumber, activityId, newActivityId);
  const sched = scheduleDay(
    state.days[dayNumber - 1].map((id) => dataset.find((a) => a.id === id)!),
    { destination: plan.preferences.destination, travellers: plan.preferences.travellers, transport: plan.preferences.transport, foodTier: state.tiers.food },
  );
  if (!sched.ok) return { ok: false, reason: `Can't add ${to.name} to Day ${dayNumber}: ${sched.reason}` };

  const edits = editsAfterSwap(plan, dayNumber, activityId, newActivityId);
  const next = evaluate(plan.preferences, dataset, state, edits, [
    {
      code: 'USER_REPLACEMENT',
      message: `You replaced ${from.name} with ${to.name} on Day ${dayNumber}.`,
      relatedActivityIds: [from.id, to.id],
    },
  ]);
  const over = next.breakdown.total - plan.preferences.budget;
  if (over > 0 && !PLANNER_CONFIG.allowOverBudgetReplacement)
    return { ok: false, reason: `${to.name} would put the trip ${inr(over)} over budget.` };
  if (over > 0) {
    next.warnings = [
      {
        code: 'OVER_BUDGET',
        message: `Your trip is now ${inr(over)} over your ${inr(plan.preferences.budget)} budget because of this change. Click Replan Trip to fit it back in (your pick of ${to.name} will be kept), or raise the budget.`,
      },
    ];
    next.feasible = false;
  }
  return { ok: true, plan: next, message: `Replaced ${from.name} with ${to.name}.` };
}
