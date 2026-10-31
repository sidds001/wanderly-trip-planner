// Destination profiles. Every destination carries its own stay base, day areas,
// price levels (all in ₹, converted from local estimates), transport rates and
// activities. All values are illustrative seed estimates — NOT live prices.
// Flights to and from the destination are not included.
import type { Activity, Coords, DestinationId, TransportMode, TravelStyle } from '../engine/types';
import { ACTIVITIES as GOA_ACTIVITIES } from './activities';
import { BALI_ACTIVITIES } from './bali';
import { DUBAI_ACTIVITIES } from './dubai';
import { PHUKET_ACTIVITIES } from './phuket';
import { ACCOMMODATION_RATE, FOOD_RATE, MEAL_STYLE, MISC_RATE, TRANSPORT, type TransportParams } from './assumptions';

export interface DestinationProfile {
  id: DestinationId;
  name: string;
  country: string;
  tagline: string;
  region: string; // shown under the page title
  hotel: { area: string; coords: Coords };
  clusters: { id: string; label: string }[]; // one per day, in day order
  accommodationRate: Record<TravelStyle, number>; // ₹ per room per night
  foodRate: Record<TravelStyle, number>; // ₹ per person per day
  miscRate: Record<TravelStyle, number>; // ₹ per person per day
  mealStyle: Record<TravelStyle, { lunch: string; dinner: string; label: string }>;
  transport: Record<TransportMode, TransportParams>;
  transportLabels: Record<TransportMode, string>; // what the three options are called locally
  typicalBudgetFor2: number; // a comfortable Balanced budget for 2, excluding flights
  heroPhotos: string[]; // 5 photos for the gallery header
  activities: Activity[];
}

const GOA: DestinationProfile = {
  id: 'Goa', name: 'Goa', country: 'India', tagline: 'Beaches, forts and Goan food', region: 'North Goa & Panaji',
  hotel: { area: 'Calangute', coords: { lat: 15.544, lng: 73.762 } },
  clusters: [
    { id: 'calangute-candolim', label: 'Candolim · Calangute · Baga' },
    { id: 'anjuna-vagator', label: 'Anjuna · Vagator · Assagao' },
    { id: 'panaji-oldgoa', label: 'Panaji · Old Goa · Dona Paula' },
  ],
  accommodationRate: ACCOMMODATION_RATE, foodRate: FOOD_RATE, miscRate: MISC_RATE, mealStyle: MEAL_STYLE, transport: TRANSPORT,
  transportLabels: { Cab: 'Cab', Scooter: 'Scooter', PublicTransport: 'Bus' },
  typicalBudgetFor2: 25000,
  heroPhotos: ['baga-beach', 'fort-aguada', 'dona-paula-sunset', 'bom-jesus', 'fontainhas'],
  activities: GOA_ACTIVITIES,
};

const BALI: DestinationProfile = {
  id: 'Bali', name: 'Bali', country: 'Indonesia', tagline: 'Temples, rice terraces and surf', region: 'Seminyak, Ubud & Uluwatu',
  hotel: { area: 'Seminyak', coords: { lat: -8.6913, lng: 115.1683 } },
  clusters: [
    { id: 'seminyak-canggu', label: 'Seminyak · Canggu · Tanah Lot' },
    { id: 'ubud', label: 'Ubud · Tegallalang' },
    { id: 'uluwatu', label: 'Uluwatu · Jimbaran · Nusa Dua' },
  ],
  accommodationRate: { Budget: 2500, Balanced: 5000, Luxury: 14000 },
  foodRate: { Budget: 900, Balanced: 1500, Luxury: 3500 },
  miscRate: { Budget: 250, Balanced: 400, Luxury: 800 },
  mealStyle: {
    Budget: { lunch: 'Lunch at a local warung', dinner: 'Dinner at a night-market warung', label: 'Local warungs' },
    Balanced: { lunch: 'Lunch at a popular café', dinner: 'Dinner at a well-rated Balinese restaurant', label: 'Good mid-range dining' },
    Luxury: { lunch: 'Lunch at a premium restaurant', dinner: 'Fine-dining dinner', label: 'Premium fine dining' },
  },
  transport: {
    Scooter: { label: 'Scooter', speedKmh: 25, waitMin: 0, perVehiclePerDay: 450 },
    Cab: { label: 'Ride-hail', speedKmh: 22, waitMin: 8, perKm: 22, minFare: 200 },
    PublicTransport: { label: 'Shuttle bus', speedKmh: 18, waitMin: 20, perPersonPerLeg: 80 },
  },
  transportLabels: { Cab: 'Ride-hail', Scooter: 'Scooter', PublicTransport: 'Shuttle' },
  typicalBudgetFor2: 40000,
  heroPhotos: ['seminyak-beach', 'tanah-lot', 'tegallalang', 'uluwatu-temple', 'monkey-forest'],
  activities: BALI_ACTIVITIES,
};

const PHUKET: DestinationProfile = {
  id: 'Phuket', name: 'Phuket', country: 'Thailand', tagline: 'Island beaches, temples and street food', region: 'Patong, Old Town & the south coast',
  hotel: { area: 'Patong', coords: { lat: 7.8961, lng: 98.2966 } },
  clusters: [
    { id: 'patong-kata', label: 'Patong · Karon · Kata' },
    { id: 'old-town', label: 'Phuket Old Town · Chalong' },
    { id: 'south', label: 'Rawai · Nai Harn · Promthep' },
  ],
  accommodationRate: { Budget: 2200, Balanced: 4500, Luxury: 13000 },
  foodRate: { Budget: 1000, Balanced: 1600, Luxury: 3800 },
  miscRate: { Budget: 250, Balanced: 400, Luxury: 800 },
  mealStyle: {
    Budget: { lunch: 'Lunch at a street-food stall', dinner: 'Dinner at a night-market stall', label: 'Street food and local diners' },
    Balanced: { lunch: 'Lunch at a popular Thai café', dinner: 'Dinner at a well-rated seafood restaurant', label: 'Good mid-range dining' },
    Luxury: { lunch: 'Lunch at a beach-club restaurant', dinner: 'Fine-dining dinner', label: 'Premium fine dining' },
  },
  transport: {
    Scooter: { label: 'Scooter', speedKmh: 25, waitMin: 0, perVehiclePerDay: 350 },
    Cab: { label: 'Taxi', speedKmh: 25, waitMin: 8, perKm: 40, minFare: 300 },
    PublicTransport: { label: 'Songthaew', speedKmh: 18, waitMin: 20, perPersonPerLeg: 80 },
  },
  transportLabels: { Cab: 'Taxi', Scooter: 'Scooter', PublicTransport: 'Songthaew' },
  typicalBudgetFor2: 40000,
  heroPhotos: ['kata-beach', 'big-buddha', 'promthep-cape', 'old-town-walk', 'wat-chalong'],
  activities: PHUKET_ACTIVITIES,
};

const DUBAI: DestinationProfile = {
  id: 'Dubai', name: 'Dubai', country: 'UAE', tagline: 'Skyline, souks and desert', region: 'Downtown, Marina & Jumeirah',
  hotel: { area: 'Downtown Dubai', coords: { lat: 25.1972, lng: 55.2744 } },
  clusters: [
    { id: 'downtown-old', label: 'Downtown · Old Dubai' },
    { id: 'marina-palm', label: 'Dubai Marina · JBR · Palm' },
    { id: 'jumeirah-desert', label: 'Jumeirah · Desert' },
  ],
  accommodationRate: { Budget: 5500, Balanced: 9000, Luxury: 25000 },
  foodRate: { Budget: 2000, Balanced: 3200, Luxury: 7000 },
  miscRate: { Budget: 500, Balanced: 800, Luxury: 1500 },
  mealStyle: {
    Budget: { lunch: 'Lunch at a shawarma and grill spot', dinner: 'Dinner at a Karama eatery', label: 'Affordable local eateries' },
    Balanced: { lunch: 'Lunch at a popular café', dinner: 'Dinner at a well-rated Arabic restaurant', label: 'Good mid-range dining' },
    Luxury: { lunch: 'Lunch at a premium restaurant', dinner: 'Fine-dining dinner', label: 'Premium fine dining' },
  },
  transport: {
    Scooter: { label: 'Rental car', speedKmh: 45, waitMin: 0, perVehiclePerDay: 2500 },
    Cab: { label: 'Taxi', speedKmh: 40, waitMin: 5, perKm: 45, minFare: 300 },
    PublicTransport: { label: 'Metro', speedKmh: 35, waitMin: 10, perPersonPerLeg: 100 },
  },
  transportLabels: { Cab: 'Taxi', Scooter: 'Rental car', PublicTransport: 'Metro' },
  typicalBudgetFor2: 75000,
  heroPhotos: ['burj-khalifa', 'jbr-beach', 'desert-safari', 'al-fahidi', 'burj-al-arab-view'],
  activities: DUBAI_ACTIVITIES,
};

export const DESTINATIONS: Record<DestinationId, DestinationProfile> = { Goa: GOA, Bali: BALI, Phuket: PHUKET, Dubai: DUBAI };
export const DESTINATION_LIST: DestinationProfile[] = [GOA, BALI, PHUKET, DUBAI];
export const getDestination = (id: DestinationId): DestinationProfile => DESTINATIONS[id];
export const ALL_ACTIVITIES: Activity[] = DESTINATION_LIST.flatMap((d) => d.activities);
