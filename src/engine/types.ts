// Domain types for the Personal Trip Planner engine.
// The engine is pure: no React, no DOM, no clock, no randomness.

export type Interest = 'Beaches' | 'Food' | 'Adventure' | 'Culture' | 'Relaxation';
export type TravelStyle = 'Budget' | 'Balanced' | 'Luxury';
export type Pace = 'Relaxed' | 'Moderate' | 'Packed';
export type TransportMode = 'Scooter' | 'Cab' | 'PublicTransport';
export type PriceLevel = 'free' | 'affordable' | 'premium';
export type ClusterId = string;
export type DestinationId = 'Goa' | 'Bali' | 'Phuket' | 'Dubai';

export interface Coords {
  lat: number;
  lng: number;
}

export interface TripPreferences {
  destination: DestinationId;
  startDate: string; // ISO yyyy-mm-dd
  durationDays: 3;
  budget: number;
  travellers: number;
  interests: Interest[];
  travelStyle: TravelStyle;
  pace: Pace;
  transport: TransportMode;
}

export interface Activity {
  id: string;
  name: string;
  description: string;
  category: string;
  area: string;
  region: string;
  cluster: ClusterId;
  coords: Coords;
  durationMin: number;
  costPerPerson: number;
  priceLevel: PriceLevel;
  openingHours: { open: string; close: string };
  tags: Interest[];
  popular: boolean;
  alternativeGroup: string;
  /** Local photo path under /photos (optional). */
  photo?: string;
}

export interface Tiers {
  accommodation: TravelStyle;
  food: TravelStyle;
}

export interface ScheduledItem {
  key: string;
  kind: 'activity' | 'meal';
  activityId?: string;
  title: string;
  description: string;
  area: string;
  start: string; // HH:MM
  end: string; // HH:MM
  durationMin: number;
  cost: number; // ₹ for the whole group
  costNote?: string;
  travelFromPrevMin: number;
  travelCostFromPrev: number;
  travelMode: string;
  waitBeforeMin: number; // free time before this item starts
  lockedByUser?: boolean;
  tags?: Interest[];
  priceLevel?: PriceLevel;
}

export interface DayPlan {
  dayNumber: number;
  date: string;
  cluster: ClusterId;
  clusterLabel: string;
  items: ScheduledItem[];
  returnToHotel: { minutes: number; cost: number; mode: string };
  transportCost: number; // leg costs only (scooter rental is trip-level)
}

export interface BudgetBreakdown {
  accommodation: number;
  food: number;
  transport: number;
  activities: number;
  misc: number;
  total: number;
  budget: number;
  remaining: number;
  utilisation: number;
}

export interface AppliedAssumptions {
  accommodationTier: TravelStyle;
  foodTier: TravelStyle;
  miscTier: TravelStyle;
  transport: TransportMode;
  nights: number;
  rooms: number;
  vehicles: number; // cabs or scooters needed (0 for public transport)
  hotelArea: string;
}

export type WarningCode = 'BUDGET_INFEASIBLE' | 'OVER_BUDGET' | 'REPLACEMENT_REJECTED';

export interface PlanWarning {
  code: WarningCode;
  message: string;
}

export type ExplanationCode =
  | 'PREMIUM_ACTIVITY_SWAPPED'
  | 'ACCOMMODATION_TIER_DOWNGRADED'
  | 'FOOD_TIER_DOWNGRADED'
  | 'PAID_ACTIVITY_SWAPPED_FOR_FREE'
  | 'PAID_ACTIVITY_DROPPED'
  | 'FAR_ACTIVITY_DROPPED'
  | 'FREE_ATTRACTION_KEPT'
  | 'USER_REPLACEMENT';

export interface Explanation {
  code: ExplanationCode;
  message: string;
  saving?: number;
  relatedActivityIds?: string[];
}

export interface UserEdits {
  locked: { activityId: string; day: number }[];
  excluded: string[];
}

export interface Plan {
  preferences: TripPreferences;
  assumptions: AppliedAssumptions;
  days: DayPlan[];
  breakdown: BudgetBreakdown;
  warnings: PlanWarning[];
  explanations: Explanation[];
  feasible: boolean;
  userEdits: UserEdits;
}

export interface CategoryRow {
  category: 'Accommodation' | 'Food' | 'Transport' | 'Activities' | 'Miscellaneous' | 'Total';
  before: number;
  after: number;
  delta: number;
}

export interface ChangeSummary {
  previousTotal: number;
  newTotal: number;
  savings: number;
  previousBudget: number;
  newBudget: number;
  budgetDelta: number;
  categoryRows: CategoryRow[];
  activityChanges: {
    removed: { id: string; name: string; day: number }[];
    added: { id: string; name: string; day: number }[];
    replaced: { fromId: string; from: string; toId: string; to: string; day: number }[];
    kept: { id: string; name: string; day: number }[];
  };
  assumptionChanges: { label: string; before: string; after: string }[];
  preferenceChanges: { label: string; before: string; after: string }[];
  narrative: string;
  feasible: boolean;
}

export interface ReplacementOption {
  activity: Activity;
  durationMin: number;
  estimatedCost: number;
  costDelta: number; // change to trip total if chosen
  feasible: boolean;
  reason?: string;
  overBudget: boolean;
}
