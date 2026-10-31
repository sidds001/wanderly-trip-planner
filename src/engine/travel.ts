import { getDestination } from '../data/destinations';
import { PLANNER_CONFIG } from './config';
import { ceilTo5 } from './time';
import type { Coords, DestinationId, TransportMode } from './types';

export interface Leg {
  km: number;
  minutes: number;
  cost: number;
  mode: string;
}

const R_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(a: Coords, b: Coords): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(h));
}

export function vehiclesNeeded(mode: TransportMode, travellers: number): number {
  if (mode === 'Cab') return Math.ceil(travellers / PLANNER_CONFIG.travellersPerCab);
  if (mode === 'Scooter') return Math.ceil(travellers / PLANNER_CONFIG.travellersPerScooter);
  return 0;
}

/** Travel estimate between two points. Legs under 1 km are walked (free). */
export function leg(from: Coords, to: Coords, mode: TransportMode, travellers: number, destination: DestinationId = 'Goa'): Leg {
  const roadKm = Math.round(haversineKm(from, to) * PLANNER_CONFIG.roadFactor * 10) / 10;
  if (roadKm < PLANNER_CONFIG.walkThresholdKm) {
    return { km: roadKm, minutes: roadKm === 0 ? 0 : ceilTo5((roadKm / PLANNER_CONFIG.walkSpeedKmh) * 60), cost: 0, mode: 'Walk' };
  }
  const p = getDestination(destination).transport[mode];
  const minutes = ceilTo5((roadKm / p.speedKmh) * 60 + p.waitMin);
  let cost = 0;
  if (mode === 'Cab') cost = Math.max(p.minFare!, Math.round((roadKm * p.perKm!) / 10) * 10) * vehiclesNeeded(mode, travellers);
  if (mode === 'PublicTransport') cost = p.perPersonPerLeg! * travellers;
  return { km: roadKm, minutes, cost, mode: p.label };
}
