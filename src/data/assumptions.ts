// Illustrative pricing assumptions (seed values — NOT live prices).
import type { TransportMode, TravelStyle } from '../engine/types';

/** ₹ per room per night */
export const ACCOMMODATION_RATE: Record<TravelStyle, number> = {
  Budget: 2500,
  Balanced: 4000,
  Luxury: 9000,
};

export const ACCOMMODATION_LABEL: Record<TravelStyle, string> = {
  Budget: 'Budget guesthouse',
  Balanced: 'Comfortable 3-star hotel',
  Luxury: 'Luxury beach resort',
};

/** ₹ per person per day (breakfast, lunch, dinner, snacks) */
export const FOOD_RATE: Record<TravelStyle, number> = {
  Budget: 600,
  Balanced: 850,
  Luxury: 1800,
};

export const MEAL_STYLE: Record<TravelStyle, { lunch: string; dinner: string; label: string }> = {
  Budget: { lunch: 'Lunch at a local Goan restaurant', dinner: 'Dinner at a beach shack', label: 'Affordable local restaurants' },
  Balanced: { lunch: 'Lunch at a popular café-restaurant', dinner: 'Dinner at a well-rated seafood restaurant', label: 'Good mid-range dining' },
  Luxury: { lunch: 'Lunch at a premium restaurant', dinner: 'Fine-dining dinner', label: 'Premium fine dining' },
};

/** ₹ per person per day — tips, water, entry extras, shopping buffer. Follows accommodation tier. */
export const MISC_RATE: Record<TravelStyle, number> = {
  Budget: 150,
  Balanced: 250,
  Luxury: 500,
};

export interface TransportParams {
  label: string;
  speedKmh: number;
  waitMin: number;
  /** cab: ₹/km per vehicle */
  perKm?: number;
  minFare?: number;
  /** scooter: ₹ per scooter per day */
  perVehiclePerDay?: number;
  /** public transport: ₹ per person per leg */
  perPersonPerLeg?: number;
}

export const TRANSPORT: Record<TransportMode, TransportParams> = {
  Scooter: { label: 'Scooter', speedKmh: 25, waitMin: 0, perVehiclePerDay: 500 },
  Cab: { label: 'Cab', speedKmh: 25, waitMin: 5, perKm: 25, minFare: 150 },
  PublicTransport: { label: 'Public transport', speedKmh: 15, waitMin: 15, perPersonPerLeg: 15 },
};
