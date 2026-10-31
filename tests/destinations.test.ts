import { expect, it } from 'vitest';
import { generateItinerary, replanItinerary, getReplacementOptions } from '../src/engine';
import { DESTINATION_LIST } from '../src/data/destinations';
import { DEMO_PREFS } from './helpers';
import { toMin } from '../src/engine/time';

for (const d of DESTINATION_LIST) {
  it(`${d.name}: generates, replans and offers replacements`, () => {
    const p = generateItinerary({ ...DEMO_PREFS, destination: d.id, budget: d.typicalBudgetFor2 });
    for (const day of p.days) {
      let cursor = toMin('09:00');
      for (const it of day.items) { expect(toMin(it.start)).toBeGreaterThanOrEqual(cursor); cursor = toMin(it.end); }
      expect(day.items.filter((i) => i.activityId).length).toBeGreaterThan(0);
    }
    const r = replanItinerary(p, { budget: Math.round(d.typicalBudgetFor2 * 0.65) });
    const a = p.days[0].items.find((i) => i.activityId)!;
    const opts = getReplacementOptions(p, 1, a.activityId!);
    console.log('DEST', d.name, p.breakdown.total, p.feasible, '→', r.plan.breakdown.total, r.plan.feasible, '| day acts', p.days.map((x) => x.items.filter((i) => i.activityId).length).join('/'), '| opts', opts.length);
  });
}
