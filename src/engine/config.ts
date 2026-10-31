// Every product rule that the PRD left open (OPEN-n) lives here, as decided in PRD.md §12.
import type { ClusterId, Coords, Pace, PriceLevel, TravelStyle } from './types';

export const TIER_ORDER: TravelStyle[] = ['Budget', 'Balanced', 'Luxury'];

export type LeverId =
  | 'SWAP_PREMIUM_ACTIVITY'
  | 'DOWNGRADE_ACCOMMODATION'
  | 'DOWNGRADE_FOOD'
  | 'SWAP_PAID_FOR_FREE'
  | 'DROP_PAID_ACTIVITY'
  | 'DROP_FAR_ACTIVITY';

export const PLANNER_CONFIG = {
  // OPEN-7: every day runs 09:00–21:30 (arrival/departure not modelled)
  dayStart: '09:00',
  dayEnd: '21:30',
  // OPEN-8: breakfast is at the hotel (not scheduled); lunch and dinner are flexible windows
  lunch: { earliestStart: '12:30', latestStart: '14:00', durationMin: 60, foodShare: 0.4 },
  dinner: { earliestStart: '19:00', latestStart: '20:30', durationMin: 60, foodShare: 0.45 },
  // OPEN-6: activities per day by pace (meals excluded)
  paceLimits: { Relaxed: 2, Moderate: 3, Packed: 4 } as Record<Pace, number>,
  minActivitiesPerDay: 1,
  // OPEN-9 / OPEN-10: 2 nights for a 3-day trip; priced per room, 2 travellers per room
  nights: 2,
  travellersPerRoom: 2,
  // OPEN-11: distance-based travel model, all days start/end at the hotel
  hotel: { area: 'Calangute', coords: { lat: 15.544, lng: 73.762 } as Coords },
  travellersPerCab: 4,
  travellersPerScooter: 2,
  walkThresholdKm: 1,
  walkSpeedKmh: 4.5,
  roadFactor: 1.3,
  // OPEN-2 / OPEN-13 / OPEN-3
  budget: { min: 5000, max: 200000, step: 500, default: 25000 },
  travellers: { min: 1, max: 6, default: 2 },
  // OPEN-25: scoring weights
  scoring: {
    perInterestMatch: 10,
    popularBonus: 2,
    styleBonus: {
      Budget: { free: 2, affordable: 1, premium: 0 },
      Balanced: { free: 0, affordable: 1, premium: 2 },
      Luxury: { free: 0, affordable: 1, premium: 3 },
    } as Record<TravelStyle, Record<PriceLevel, number>>,
  },
  // OPEN-14: lever order, least experience loss first
  leverOrder: [
    'SWAP_PREMIUM_ACTIVITY',
    'DOWNGRADE_ACCOMMODATION',
    'DOWNGRADE_FOOD',
    'SWAP_PAID_FOR_FREE',
    'DROP_PAID_ACTIVITY',
    'DROP_FAR_ACTIVITY',
  ] as LeverId[],
  // OPEN-19: over-budget replacements are allowed but flagged
  allowOverBudgetReplacement: true,
  // OPEN-20: user replacements are kept (locked) on later replans
  keepUserLockedOnReplan: true,
} as const;

// OPEN-11 / §8.1: three geographic clusters, one per day (geographic grouping)
export const DAY_CLUSTERS: { id: ClusterId; label: string }[] = [
  { id: 'calangute-candolim', label: 'Candolim · Calangute · Baga' },
  { id: 'anjuna-vagator', label: 'Anjuna · Vagator · Assagao' },
  { id: 'panaji-oldgoa', label: 'Panaji · Old Goa · Dona Paula' },
];

export const INTEREST_NOUN: Record<string, string> = {
  Beaches: 'beach',
  Food: 'food',
  Adventure: 'adventure',
  Culture: 'culture',
  Relaxation: 'relaxation',
};
