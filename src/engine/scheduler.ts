// Assigns a day's activities (plus lunch and dinner) to non-overlapping time
// slots, respecting opening hours, travel buffers and day bounds. Searches all
// orderings (≤ 5! = 120) and keeps the one with least travel, then least idle time.
import { getDestination } from '../data/destinations';
import { PLANNER_CONFIG } from './config';
import { toHHMM, toMin } from './time';
import { leg } from './travel';
import type { Activity, Coords, DestinationId, ScheduledItem, TransportMode, TravelStyle } from './types';

export interface DayContext {
  destination: DestinationId;
  travellers: number;
  transport: TransportMode;
  foodTier: TravelStyle;
  lockedIds?: Set<string>;
}

export type DayScheduleResult =
  | { ok: true; items: ScheduledItem[]; returnToHotel: { minutes: number; cost: number; mode: string }; transportCost: number; travelMin: number; idleMin: number }
  | { ok: false; reason: string };

const LUNCH = '__lunch__';

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs.slice()];
  const out: T[][] = [];
  xs.forEach((x, i) => {
    const rest = [...xs.slice(0, i), ...xs.slice(i + 1)];
    for (const p of permutations(rest)) out.push([x, ...p]);
  });
  return out;
}

function mealItem(kind: 'lunch' | 'dinner', start: number, wait: number, area: string, ctx: DayContext): ScheduledItem {
  const cfg = PLANNER_CONFIG[kind];
  const dest = getDestination(ctx.destination);
  const style = dest.mealStyle[ctx.foodTier];
  return {
    key: kind,
    kind: 'meal',
    title: kind === 'lunch' ? style.lunch : style.dinner,
    description: `${style.label} near ${area}. Covered by your Food budget.`,
    area,
    start: toHHMM(start),
    end: toHHMM(start + cfg.durationMin),
    durationMin: cfg.durationMin,
    cost: Math.round(dest.foodRate[ctx.foodTier] * cfg.foodShare * ctx.travellers),
    costNote: 'in Food budget',
    travelFromPrevMin: 0,
    travelCostFromPrev: 0,
    travelMode: 'Nearby',
    waitBeforeMin: wait,
  };
}

function trySequence(seq: (Activity | typeof LUNCH)[], ctx: DayContext) {
  const { dayStart, dayEnd, lunch, dinner } = PLANNER_CONFIG;
  const { hotel } = getDestination(ctx.destination);
  let cursor = toMin(dayStart);
  let loc: Coords = hotel.coords;
  let area: string = hotel.area;
  let travelMin = 0;
  let idleMin = 0;
  let transportCost = 0;
  const items: ScheduledItem[] = [];

  for (const tok of seq) {
    if (tok === LUNCH) {
      const start = Math.max(cursor, toMin(lunch.earliestStart));
      if (start > toMin(lunch.latestStart)) return { ok: false as const, why: 'lunch' };
      items.push(mealItem('lunch', start, start - cursor, area, ctx));
      idleMin += start - cursor;
      cursor = start + lunch.durationMin;
      continue;
    }
    const l = leg(loc, tok.coords, ctx.transport, ctx.travellers, ctx.destination);
    const arrive = cursor + l.minutes;
    const start = Math.max(arrive, toMin(tok.openingHours.open));
    const end = start + tok.durationMin;
    if (end > toMin(tok.openingHours.close)) return { ok: false as const, why: tok.id };
    items.push({
      key: tok.id,
      kind: 'activity',
      activityId: tok.id,
      title: tok.name,
      description: tok.description,
      area: tok.area,
      start: toHHMM(start),
      end: toHHMM(end),
      durationMin: tok.durationMin,
      cost: tok.costPerPerson * ctx.travellers,
      travelFromPrevMin: l.minutes,
      travelCostFromPrev: l.cost,
      travelMode: l.mode,
      waitBeforeMin: start - arrive,
      lockedByUser: ctx.lockedIds?.has(tok.id) || undefined,
      tags: tok.tags,
      priceLevel: tok.priceLevel,
    });
    travelMin += l.minutes;
    transportCost += l.cost;
    idleMin += start - arrive;
    cursor = end;
    loc = tok.coords;
    area = tok.area;
  }

  const dStart = Math.max(cursor, toMin(dinner.earliestStart));
  if (dStart > toMin(dinner.latestStart) || dStart + dinner.durationMin > toMin(dayEnd)) return { ok: false as const, why: 'dinner' };
  items.push(mealItem('dinner', dStart, dStart - cursor, area, ctx));
  const back = leg(loc, hotel.coords, ctx.transport, ctx.travellers, ctx.destination);
  transportCost += back.cost;
  travelMin += back.minutes;
  return {
    ok: true as const,
    items,
    returnToHotel: { minutes: back.minutes, cost: back.cost, mode: back.mode },
    transportCost,
    travelMin,
    idleMin,
  };
}

export function scheduleDay(activities: Activity[], ctx: DayContext): DayScheduleResult {
  const tokens: (Activity | typeof LUNCH)[] = [...activities, LUNCH];
  let best: Extract<DayScheduleResult, { ok: true }> | null = null;
  let bestKey = '';
  const failures = new Map<string, number>();

  for (const seq of permutations(tokens)) {
    const r = trySequence(seq, ctx);
    if (!r.ok) {
      failures.set(r.why, (failures.get(r.why) ?? 0) + 1);
      continue;
    }
    const key = seq.map((t) => (t === LUNCH ? LUNCH : t.id)).join('|');
    if (
      !best ||
      r.travelMin < best.travelMin ||
      (r.travelMin === best.travelMin && r.idleMin < best.idleMin) ||
      (r.travelMin === best.travelMin && r.idleMin === best.idleMin && key < bestKey)
    ) {
      best = r;
      bestKey = key;
    }
  }
  if (best) return best;

  // Explain the most frequent blocker.
  const [why] = [...failures.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['day'];
  const act = activities.find((a) => a.id === why);
  const reason = act
    ? `${act.name} is open ${act.openingHours.open}–${act.openingHours.close} and needs ${act.durationMin} min plus travel; with this day's other stops and meals there is no slot that fits.`
    : why === 'lunch'
      ? 'There is no way to fit a lunch break between 12:30 and 15:00 with these activities.'
      : 'These activities would run past dinner time (dinner must start by 20:30).';
  return { ok: false, reason };
}
