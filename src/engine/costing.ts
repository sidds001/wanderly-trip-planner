import { getDestination } from '../data/destinations';
import { PLANNER_CONFIG } from './config';
import { vehiclesNeeded } from './travel';
import type { AppliedAssumptions, BudgetBreakdown, DayPlan, Tiers, TripPreferences } from './types';

export function buildAssumptions(prefs: TripPreferences, tiers: Tiers): AppliedAssumptions {
  return {
    accommodationTier: tiers.accommodation,
    foodTier: tiers.food,
    miscTier: tiers.accommodation,
    transport: prefs.transport,
    nights: PLANNER_CONFIG.nights,
    rooms: Math.ceil(prefs.travellers / PLANNER_CONFIG.travellersPerRoom),
    vehicles: vehiclesNeeded(prefs.transport, prefs.travellers),
    hotelArea: getDestination(prefs.destination).hotel.area,
  };
}

export function computeBreakdown(prefs: TripPreferences, a: AppliedAssumptions, days: DayPlan[]): BudgetBreakdown {
  const d = getDestination(prefs.destination);
  const accommodation = d.accommodationRate[a.accommodationTier] * a.nights * a.rooms;
  const food = d.foodRate[a.foodTier] * prefs.durationDays * prefs.travellers;
  const misc = d.miscRate[a.miscTier] * prefs.durationDays * prefs.travellers;
  const activities = days.reduce(
    (s, d) => s + d.items.filter((i) => i.kind === 'activity').reduce((t, i) => t + i.cost, 0),
    0,
  );
  const rental = prefs.transport === 'Scooter' ? d.transport.Scooter.perVehiclePerDay! * a.vehicles * prefs.durationDays : 0;
  const transport = rental + days.reduce((s, d) => s + d.transportCost, 0);
  const total = accommodation + food + transport + activities + misc;
  return {
    accommodation,
    food,
    transport,
    activities,
    misc,
    total,
    budget: prefs.budget,
    remaining: prefs.budget - total,
    utilisation: prefs.budget > 0 ? total / prefs.budget : 0,
  };
}
