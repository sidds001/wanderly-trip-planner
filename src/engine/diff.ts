// Builds the before/after change summary purely from differences between two plans.
// Nothing here is hard-coded to the demo scenario.
import { ACCOMMODATION_LABEL } from '../data/assumptions';
import { getDestination } from '../data/destinations';
import { INTEREST_NOUN, TIER_ORDER } from './config';
import type { Activity, ChangeSummary, Plan, TravelStyle } from './types';

const inr = (n: number) => `₹${Math.round(Math.abs(n)).toLocaleString('en-IN')}`;

function listJoin(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

function activityDays(plan: Plan): Map<string, number> {
  const m = new Map<string, number>();
  plan.days.forEach((d) => d.items.forEach((i) => i.activityId && m.set(i.activityId, d.dayNumber)));
  return m;
}

const tierMove = (a: TravelStyle, b: TravelStyle) => TIER_ORDER.indexOf(b) - TIER_ORDER.indexOf(a);

export function diffPlans(prev: Plan, next: Plan, dataset: Activity[]): ChangeSummary {
  const name = (id: string) => dataset.find((a) => a.id === id)?.name ?? id;
  const group = (id: string) => dataset.find((a) => a.id === id)?.alternativeGroup;
  const pb = prev.breakdown;
  const nb = next.breakdown;

  const rows: ChangeSummary['categoryRows'] = [
    { category: 'Accommodation', before: pb.accommodation, after: nb.accommodation, delta: nb.accommodation - pb.accommodation },
    { category: 'Food', before: pb.food, after: nb.food, delta: nb.food - pb.food },
    { category: 'Transport', before: pb.transport, after: nb.transport, delta: nb.transport - pb.transport },
    { category: 'Activities', before: pb.activities, after: nb.activities, delta: nb.activities - pb.activities },
    { category: 'Miscellaneous', before: pb.misc, after: nb.misc, delta: nb.misc - pb.misc },
    { category: 'Total', before: pb.total, after: nb.total, delta: nb.total - pb.total },
  ];

  // --- activity changes ---
  const before = activityDays(prev);
  const after = activityDays(next);
  const removed = [...before].filter(([id]) => !after.has(id)).map(([id, day]) => ({ id, day }));
  const added = [...after].filter(([id]) => !before.has(id)).map(([id, day]) => ({ id, day }));
  const replaced: ChangeSummary['activityChanges']['replaced'] = [];
  for (const r of [...removed]) {
    const match =
      added.find((a) => a.day === r.day && group(a.id) === group(r.id)) ?? added.find((a) => a.day === r.day);
    if (match) {
      replaced.push({ fromId: r.id, from: name(r.id), toId: match.id, to: name(match.id), day: r.day });
      removed.splice(removed.indexOf(r), 1);
      added.splice(added.indexOf(match), 1);
    }
  }
  const kept = [...after].filter(([id]) => before.has(id)).map(([id, day]) => ({ id, name: name(id), day }));

  // --- assumption + preference changes ---
  const pa = prev.assumptions;
  const na = next.assumptions;
  const assumptionChanges: ChangeSummary['assumptionChanges'] = [];
  if (pa.accommodationTier !== na.accommodationTier)
    assumptionChanges.push({ label: 'Accommodation', before: ACCOMMODATION_LABEL[pa.accommodationTier], after: ACCOMMODATION_LABEL[na.accommodationTier] });
  if (pa.foodTier !== na.foodTier)
    assumptionChanges.push({ label: 'Dining', before: getDestination(prev.preferences.destination).mealStyle[pa.foodTier].label, after: getDestination(next.preferences.destination).mealStyle[na.foodTier].label });
  if (pa.rooms !== na.rooms) assumptionChanges.push({ label: 'Rooms', before: String(pa.rooms), after: String(na.rooms) });

  const pp = prev.preferences;
  const np = next.preferences;
  const preferenceChanges: ChangeSummary['preferenceChanges'] = [];
  if (pp.budget !== np.budget) preferenceChanges.push({ label: 'Budget', before: inr(pp.budget), after: inr(np.budget) });
  if (pp.travellers !== np.travellers) preferenceChanges.push({ label: 'Travellers', before: String(pp.travellers), after: String(np.travellers) });
  if (pp.pace !== np.pace) preferenceChanges.push({ label: 'Pace', before: pp.pace, after: np.pace });
  if (pp.transport !== np.transport)
    preferenceChanges.push({ label: 'Transport', before: getDestination(pp.destination).transport[pp.transport].label, after: getDestination(np.destination).transport[np.transport].label });
  if (pp.travelStyle !== np.travelStyle) preferenceChanges.push({ label: 'Travel style', before: pp.travelStyle, after: np.travelStyle });
  if (pp.interests.join() !== np.interests.join())
    preferenceChanges.push({ label: 'Interests', before: pp.interests.join(', '), after: np.interests.join(', ') });
  if (pp.startDate !== np.startDate) preferenceChanges.push({ label: 'Start date', before: pp.startDate, after: np.startDate });

  // --- narrative ---
  const sentences: string[] = [];
  const budgetDelta = np.budget - pp.budget;
  if (budgetDelta < 0) sentences.push(`Your budget was reduced by ${inr(budgetDelta)}.`);
  if (budgetDelta > 0) sentences.push(`Your budget was increased by ${inr(budgetDelta)}.`);
  const otherPrefs = preferenceChanges.filter((c) => c.label !== 'Budget');
  if (otherPrefs.length)
    sentences.push(`You changed ${listJoin(otherPrefs.map((c) => `${c.label.toLowerCase()} from ${c.before} to ${c.after}`))}.`);

  const clauses: string[] = [];
  const accMove = tierMove(pa.accommodationTier, na.accommodationTier);
  if (accMove < 0) clauses.push(na.accommodationTier === 'Budget' ? 'switched to affordable accommodation' : `switched to a ${ACCOMMODATION_LABEL[na.accommodationTier].toLowerCase()}`);
  if (accMove > 0) clauses.push(`upgraded to a ${ACCOMMODATION_LABEL[na.accommodationTier].toLowerCase()}`);
  for (const r of replaced) clauses.push(`replaced ${r.from} with ${r.to} on Day ${r.day}`);
  const foodMove = tierMove(pa.foodTier, na.foodTier);
  if (foodMove < 0) clauses.push(`replaced ${getDestination(prev.preferences.destination).mealStyle[pa.foodTier].label.toLowerCase()} with ${getDestination(next.preferences.destination).mealStyle[na.foodTier].label.toLowerCase()}`);
  if (foodMove > 0) clauses.push(`upgraded dining to ${getDestination(next.preferences.destination).mealStyle[na.foodTier].label.toLowerCase()}`);
  if (removed.length) clauses.push(`dropped ${listJoin(removed.map((r) => name(r.id)))}`);
  if (added.length) clauses.push(`added ${listJoin(added.map((a) => name(a.id)))}`);
  const tDelta = nb.transport - pb.transport;
  if (tDelta < 0) clauses.push(`optimised local transportation (${inr(pb.transport)} → ${inr(nb.transport)})`);
  if (tDelta > 0) clauses.push(`transport now costs ${inr(tDelta)} more`);

  if (clauses.length) {
    sentences.push(`We've ${listJoin(clauses)}.`);
  } else {
    sentences.push('Your current plan still works, so nothing in the itinerary needed to change.');
  }

  const savings = pb.total - nb.total;
  const keptInterests = np.interests.filter((i) =>
    kept.some((k) => dataset.find((a) => a.id === k.id)?.tags.includes(i)),
  );
  const keepClause = keptInterests.length
    ? ` while keeping your preferred ${listJoin(keptInterests.map((i) => INTEREST_NOUN[i]))} experiences`
    : '';
  if (savings > 0) sentences.push(`Your updated trip saves ${inr(savings)}${keepClause}.`);
  else if (savings < 0) sentences.push(`Your updated trip costs ${inr(savings)} more${keepClause}.`);

  if (!next.feasible) {
    sentences.push(`Even with every saving applied, the trip is ${inr(nb.total - np.budget)} over your budget.`);
  } else {
    sentences.push(`You have ${inr(nb.remaining)} left in your budget.`);
  }

  return {
    previousTotal: pb.total,
    newTotal: nb.total,
    savings,
    previousBudget: pp.budget,
    newBudget: np.budget,
    budgetDelta,
    categoryRows: rows,
    activityChanges: {
      removed: removed.map((r) => ({ ...r, name: name(r.id) })),
      added: added.map((a) => ({ ...a, name: name(a.id) })),
      replaced,
      kept,
    },
    assumptionChanges,
    preferenceChanges,
    narrative: sentences.join(' '),
    feasible: next.feasible,
  };
}
