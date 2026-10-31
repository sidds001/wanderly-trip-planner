import { toMin } from '../src/engine/time';
import { ACTIVITIES } from '../src/data/activities';
import { ACCOMMODATION_RATE, FOOD_RATE, MISC_RATE } from '../src/data/assumptions';
import type { Plan, TripPreferences } from '../src/engine';

export const DEMO_PREFS: TripPreferences = {
  destination: 'Goa', startDate: '2026-11-14', durationDays: 3, budget: 25000, travellers: 2,
  interests: ['Beaches', 'Food', 'Adventure'], travelStyle: 'Balanced', pace: 'Moderate', transport: 'Cab',
};

export const activityIds = (p: Plan) => p.days.flatMap((d) => d.items.filter((i) => i.activityId).map((i) => i.activityId!));

/** Throws if any day violates overlap, opening-hours, travel-buffer or day-bound rules. */
export function assertScheduleValid(p: Plan) {
  for (const d of p.days) {
    let cursor = toMin('09:00');
    for (const it of d.items) {
      const s = toMin(it.start), e = toMin(it.end);
      if (e - s !== it.durationMin) throw new Error(`${it.title}: duration mismatch`);
      if (s < cursor + it.travelFromPrevMin) throw new Error(`Day ${d.dayNumber}: ${it.title} overlaps or ignores travel`);
      if (it.activityId) {
        const a = ACTIVITIES.find((x) => x.id === it.activityId)!;
        if (s < toMin(a.openingHours.open) || e > toMin(a.openingHours.close)) throw new Error(`${a.name} outside opening hours`);
      }
      cursor = e;
    }
    if (cursor > toMin('21:30')) throw new Error(`Day ${d.dayNumber} ends after 21:30`);
    const meals = d.items.filter((i) => i.kind === 'meal').map((i) => i.key);
    if (meals.join() !== 'lunch,dinner') throw new Error(`Day ${d.dayNumber} missing meals: ${meals}`);
  }
}

/** Recomputes the breakdown independently from the raw assumptions. */
export function handTotal(p: Plan) {
  const { preferences: pr, assumptions: a } = p;
  const acc = ACCOMMODATION_RATE[a.accommodationTier] * a.nights * a.rooms;
  const food = FOOD_RATE[a.foodTier] * 3 * pr.travellers;
  const misc = MISC_RATE[a.miscTier] * 3 * pr.travellers;
  const acts = activityIds(p).reduce((s, id) => s + ACTIVITIES.find((x) => x.id === id)!.costPerPerson * pr.travellers, 0);
  const legs = p.days.reduce((s, d) => s + d.items.reduce((t, i) => t + i.travelCostFromPrev, 0) + d.returnToHotel.cost, 0);
  const rental = pr.transport === 'Scooter' ? 500 * a.vehicles * 3 : 0;
  return acc + food + misc + acts + legs + rental;
}
