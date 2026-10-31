import { describe, expect, it } from 'vitest';
import { ACTIVITIES } from '../src/data/activities';
import { applyReplacement, generateItinerary, getReplacementOptions, replanItinerary, type Activity, type TripPreferences } from '../src/engine';
import { DEMO_PREFS, activityIds, assertScheduleValid, handTotal } from './helpers';

describe('generateItinerary', () => {
  const plan = generateItinerary(DEMO_PREFS);

  it('AC-1: builds three days, each with activities and meal breaks', () => {
    expect(plan.days).toHaveLength(3);
    expect(plan.days.map((d) => d.date)).toEqual(['2026-11-14', '2026-11-15', '2026-11-16']);
    plan.days.forEach((d) => expect(d.items.some((i) => i.kind === 'activity')).toBe(true));
  });

  it('AC-2: schedules are non-overlapping, within opening hours, with travel buffers', () => {
    assertScheduleValid(plan);
  });

  it('AC-3: total equals an independent recomputation from the assumptions', () => {
    expect(plan.breakdown.total).toBe(handTotal(plan));
    const b = plan.breakdown;
    expect(b.total).toBe(b.accommodation + b.food + b.transport + b.activities + b.misc);
    expect(b.remaining).toBe(b.budget - b.total);
  });

  it('demo step 1: Balanced ₹25k plan has premium water sports and comfortable stay, within budget', () => {
    expect(activityIds(plan)).toContain('premium-water-sports');
    expect(plan.assumptions.accommodationTier).toBe('Balanced');
    expect(plan.assumptions.foodTier).toBe('Balanced');
    expect(plan.feasible).toBe(true);
    expect(plan.breakdown.total).toBeLessThanOrEqual(25000);
  });

  it('respects pace limits', () => {
    for (const [pace, max] of [['Relaxed', 2], ['Moderate', 3], ['Packed', 4]] as const) {
      const p = generateItinerary({ ...DEMO_PREFS, pace, budget: 100000 });
      p.days.forEach((d) => expect(d.items.filter((i) => i.kind === 'activity').length).toBeLessThanOrEqual(max));
      assertScheduleValid(p);
    }
  });

  it('groups each day geographically (one area cluster per day)', () => {
    plan.days.forEach((d) => {
      const clusters = new Set(d.items.filter((i) => i.activityId).map((i) => ACTIVITIES.find((a) => a.id === i.activityId)!.cluster));
      expect([...clusters]).toEqual([d.cluster]);
    });
  });

  it('T11: is deterministic', () => {
    expect(JSON.stringify(generateItinerary(DEMO_PREFS))).toBe(JSON.stringify(plan));
  });

  it('works for every transport mode, style and traveller count, with consistent totals', () => {
    for (const transport of ['Scooter', 'Cab', 'PublicTransport'] as const)
      for (const travelStyle of ['Budget', 'Balanced', 'Luxury'] as const)
        for (const travellers of [1, 3, 6]) {
          const p = generateItinerary({ ...DEMO_PREFS, transport, travelStyle, travellers, budget: 100000 });
          assertScheduleValid(p);
          expect(p.breakdown.total).toBe(handTotal(p));
        }
  });
});

describe('replanItinerary (hero)', () => {
  const original = generateItinerary(DEMO_PREFS);
  const { plan, summary } = replanItinerary(original, { budget: 15000 });

  it('AC-5: new plan fits ₹15,000 with real changes', () => {
    expect(plan.feasible).toBe(true);
    expect(plan.breakdown.total).toBeLessThanOrEqual(15000);
    expect(activityIds(plan)).not.toContain('premium-water-sports');
    expect(plan.assumptions.accommodationTier).toBe('Budget');
    assertScheduleValid(plan);
    expect(plan.breakdown.total).toBe(handTotal(plan));
  });

  it('preserves popular free attractions and feasible activities', () => {
    const kept = activityIds(original).filter((id) => ACTIVITIES.find((a) => a.id === id)!.popular && ACTIVITIES.find((a) => a.id === id)!.costPerPerson === 0);
    kept.forEach((id) => expect(activityIds(plan)).toContain(id));
    expect(summary.activityChanges.kept.length).toBeGreaterThanOrEqual(activityIds(original).length - 2);
  });

  it('AC-6: before/after table covers all five categories plus total and is arithmetically right', () => {
    expect(summary.categoryRows.map((r) => r.category)).toEqual(['Accommodation', 'Food', 'Transport', 'Activities', 'Miscellaneous', 'Total']);
    summary.categoryRows.forEach((r) => expect(r.delta).toBe(r.after - r.before));
    expect(summary.savings).toBe(original.breakdown.total - plan.breakdown.total);
  });

  it('AC-7: explanation matches the actual diff', () => {
    expect(summary.narrative).toContain('Your budget was reduced by ₹10,000');
    expect(summary.narrative).toContain('switched to affordable accommodation');
    expect(summary.narrative).toContain('replaced Premium water sports package with Beach kayaking & banana ride');
    expect(summary.narrative).toContain(`saves ₹${summary.savings.toLocaleString('en-IN')}`);
    expect(summary.activityChanges.replaced).toEqual([expect.objectContaining({ fromId: 'premium-water-sports', toId: 'beach-kayaking', day: 1 })]);
  });

  it('T7: narrative is generated, not hard-coded (different budget → different text)', () => {
    const other = replanItinerary(original, { budget: 20000 });
    expect(other.summary.narrative).toContain('reduced by ₹5,000');
    expect(other.summary.narrative).not.toBe(summary.narrative);
    expect(other.plan.breakdown.total).toBeLessThanOrEqual(20000);
  });

  it('keeps the plan unchanged when it already fits', () => {
    const same = replanItinerary(original, { budget: 24500 });
    expect(activityIds(same.plan)).toEqual(activityIds(original));
    expect(same.summary.narrative).toContain('nothing in the itinerary needed to change');
  });

  it('restores the original plan when the budget goes back up', () => {
    const back = replanItinerary(plan, { budget: 25000 });
    expect(activityIds(back.plan)).toEqual(activityIds(original));
    expect(back.plan.breakdown.total).toBe(original.breakdown.total);
  });

  it('AC-9: infeasible budget → clear warning, never silently over budget', () => {
    const low = replanItinerary(plan, { budget: 5000 });
    expect(low.plan.feasible).toBe(false);
    expect(low.plan.warnings[0].code).toBe('BUDGET_INFEASIBLE');
    expect(low.plan.breakdown.total).toBeGreaterThan(5000);
    expect(low.summary.narrative).toContain('over your budget');
  });

  it('replans on preference changes too', () => {
    const r = replanItinerary(original, { pace: 'Relaxed', interests: ['Culture'] });
    expect(r.summary.preferenceChanges.map((c) => c.label)).toEqual(['Pace', 'Interests']);
    r.plan.days.forEach((d) => expect(d.items.filter((i) => i.kind === 'activity').length).toBeLessThanOrEqual(2));
  });
});

describe('activity replacement', () => {
  const plan = generateItinerary(DEMO_PREFS);
  const target = plan.days[1].items.find((i) => i.activityId)!.activityId!;

  it('AC-8: offers 2–3 alternatives with duration and cost', () => {
    const opts = getReplacementOptions(plan, 2, target);
    expect(opts.length).toBeGreaterThanOrEqual(2);
    expect(opts.length).toBeLessThanOrEqual(3);
    opts.forEach((o) => {
      expect(o.durationMin).toBeGreaterThan(0);
      expect(o.estimatedCost).toBeGreaterThanOrEqual(0);
    });
  });

  it('AC-8: applying a replacement updates the schedule and the budget', () => {
    const opt = getReplacementOptions(plan, 2, target).find((o) => o.feasible)!;
    const res = applyReplacement(plan, 2, target, opt.activity.id);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(activityIds(res.plan)).toContain(opt.activity.id);
    expect(activityIds(res.plan)).not.toContain(target);
    expect(res.plan.breakdown.total).toBe(plan.breakdown.total + opt.costDelta);
    expect(res.plan.breakdown.total).toBe(handTotal(res.plan));
    assertScheduleValid(res.plan);
    // user pick survives a later replan
    const r = replanItinerary(res.plan, { budget: 15000 });
    expect(activityIds(r.plan)).toContain(opt.activity.id);
    expect(activityIds(r.plan)).not.toContain(target);
  });

  it('flags replacements that push the trip over budget', () => {
    const lean = replanItinerary(plan, { budget: 15000 }).plan;
    const kayak = 'beach-kayaking';
    const res = applyReplacement(lean, 1, kayak, 'premium-water-sports');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.plan.feasible).toBe(false);
      expect(res.plan.warnings[0].code).toBe('OVER_BUDGET');
    }
  });

  it('T9: rejects a replacement that breaks hard scheduling constraints, with a reason', () => {
    const impossible: Activity = { ...ACTIVITIES.find((a) => a.id === 'baga-beach')!, id: 'night-only', name: 'Impossible tour', openingHours: { open: '09:00', close: '09:30' }, durationMin: 120 };
    const dataset = [...ACTIVITIES, impossible];
    const res = applyReplacement(plan, 1, plan.days[0].items.find((i) => i.activityId)!.activityId!, 'night-only', dataset);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/Impossible tour is open 09:00–09:30/);
  });
});

describe('input edge cases', () => {
  it('handles a single traveller and 6 travellers (rooms and vehicles scale)', () => {
    const one = generateItinerary({ ...DEMO_PREFS, travellers: 1 });
    const six = generateItinerary({ ...DEMO_PREFS, travellers: 6, budget: 100000 });
    expect(one.assumptions.rooms).toBe(1);
    expect(six.assumptions.rooms).toBe(3);
    expect(six.assumptions.vehicles).toBe(2);
  });

  it('works with a single niche interest', () => {
    const p = generateItinerary({ ...DEMO_PREFS, interests: ['Relaxation'] as TripPreferences['interests'] });
    expect(p.days.every((d) => d.items.some((i) => i.activityId))).toBe(true);
    assertScheduleValid(p);
  });
});
