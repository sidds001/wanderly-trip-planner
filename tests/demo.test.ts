// The exact live-demo journey from PRD §3.1, printed step by step.
import { expect, it } from 'vitest';
import { applyReplacement, generateItinerary, getReplacementOptions, replanItinerary, type Plan } from '../src/engine';
import { DEMO_PREFS, assertScheduleValid } from './helpers';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const log = (title: string, p: Plan) => {
  const b = p.breakdown;
  console.log(`\n=== ${title} ===\nAccommodation ${inr(b.accommodation)} | Food ${inr(b.food)} | Transport ${inr(b.transport)} | Activities ${inr(b.activities)} | Misc ${inr(b.misc)} | TOTAL ${inr(b.total)} of ${inr(b.budget)}`);
  p.days.forEach((d) => console.log(`Day ${d.dayNumber}: ${d.items.map((i) => `${i.start} ${i.title}`).join(' → ')}`));
};

it('Generate ₹25k → replan ₹15k → replace an activity', () => {
  const p1 = generateItinerary(DEMO_PREFS);
  log('Step 1 · ₹25,000 Balanced trip', p1);
  assertScheduleValid(p1);

  const { plan: p2, summary } = replanItinerary(p1, { budget: 15000 });
  log('Step 2 · Replanned for ₹15,000', p2);
  console.table(summary.categoryRows);
  console.log('Explanation:', summary.narrative);
  expect(p2.breakdown.total).toBeLessThanOrEqual(15000);

  const target = p2.days[2].items.find((i) => i.activityId)!;
  const opts = getReplacementOptions(p2, 3, target.activityId!);
  console.log(`\nReplace "${target.title}" →`, opts.map((o) => `${o.activity.name} (${o.durationMin} min, ${inr(o.estimatedCost)}, Δ ${inr(o.costDelta)}${o.feasible ? '' : ', not feasible'})`));
  const res = applyReplacement(p2, 3, target.activityId!, opts.find((o) => o.feasible)!.activity.id);
  expect(res.ok).toBe(true);
  if (res.ok) {
    log('Step 3 · After replacement', res.plan);
    assertScheduleValid(res.plan);
  }
});
