// Goa activity dataset. All prices, durations, hours and coordinates are
// illustrative seed estimates — NOT verified or live data.
import type { Activity } from '../engine/types';

export const ACTIVITIES: Activity[] = [
  {
    id: 'fort-aguada', name: 'Fort Aguada', category: 'Fort',
    description: '17th-century Portuguese fort and lighthouse overlooking the Arabian Sea.',
    area: 'Candolim', region: 'North Goa', cluster: 'calangute-candolim',
    coords: { lat: 15.492, lng: 73.774 }, durationMin: 90, costPerPerson: 50, priceLevel: 'affordable',
    openingHours: { open: '09:30', close: '18:00' }, tags: ['Culture', 'Beaches'], popular: true, alternativeGroup: 'heritage',
  },
  {
    id: 'baga-beach', name: 'Baga Beach', category: 'Beach',
    description: 'Lively beach lined with shacks and water-sports operators.',
    area: 'Baga', region: 'North Goa', cluster: 'calangute-candolim',
    coords: { lat: 15.555, lng: 73.752 }, durationMin: 120, costPerPerson: 0, priceLevel: 'free',
    openingHours: { open: '06:00', close: '19:00' }, tags: ['Beaches', 'Relaxation'], popular: true, alternativeGroup: 'beach',
  },
  {
    id: 'calangute-beach', name: 'Calangute Beach', category: 'Beach',
    description: "Goa's largest and busiest stretch of sand — the 'queen of beaches'.",
    area: 'Calangute', region: 'North Goa', cluster: 'calangute-candolim',
    coords: { lat: 15.544, lng: 73.755 }, durationMin: 120, costPerPerson: 0, priceLevel: 'free',
    openingHours: { open: '06:00', close: '19:00' }, tags: ['Beaches', 'Relaxation'], popular: true, alternativeGroup: 'beach',
  },
  {
    id: 'anjuna-beach', name: 'Anjuna Beach', category: 'Beach',
    description: 'Rocky, laid-back beach known for its cafés and flea-market culture.',
    area: 'Anjuna', region: 'North Goa', cluster: 'anjuna-vagator',
    coords: { lat: 15.573, lng: 73.741 }, durationMin: 90, costPerPerson: 0, priceLevel: 'free',
    openingHours: { open: '06:00', close: '19:00' }, tags: ['Beaches', 'Relaxation'], popular: true, alternativeGroup: 'beach',
  },
  {
    id: 'vagator-beach', name: 'Vagator Beach', category: 'Beach',
    description: 'Red cliffs and a quieter shoreline below Chapora Fort.',
    area: 'Vagator', region: 'North Goa', cluster: 'anjuna-vagator',
    coords: { lat: 15.603, lng: 73.734 }, durationMin: 90, costPerPerson: 0, priceLevel: 'free',
    openingHours: { open: '06:00', close: '19:00' }, tags: ['Beaches', 'Relaxation'], popular: false, alternativeGroup: 'beach',
  },
  {
    id: 'chapora-fort', name: 'Chapora Fort', category: 'Fort',
    description: 'Hilltop fort ruins with sweeping coastal views — a short uphill scramble.',
    area: 'Vagator', region: 'North Goa', cluster: 'anjuna-vagator',
    coords: { lat: 15.606, lng: 73.736 }, durationMin: 60, costPerPerson: 0, priceLevel: 'free',
    openingHours: { open: '09:00', close: '17:30' }, tags: ['Culture', 'Adventure'], popular: true, alternativeGroup: 'heritage',
  },
  {
    id: 'bom-jesus', name: 'Basilica of Bom Jesus', category: 'Church',
    description: 'UNESCO-listed baroque basilica in Old Goa.',
    area: 'Old Goa', region: 'Old Goa', cluster: 'panaji-oldgoa',
    coords: { lat: 15.501, lng: 73.912 }, durationMin: 60, costPerPerson: 0, priceLevel: 'free',
    openingHours: { open: '09:00', close: '18:30' }, tags: ['Culture'], popular: true, alternativeGroup: 'church',
  },
  {
    id: 'fontainhas', name: 'Fontainhas Latin Quarter walk', category: 'Heritage walk',
    description: "Stroll through Panaji's colourful Portuguese-era lanes.",
    area: 'Panaji', region: 'Panaji', cluster: 'panaji-oldgoa',
    coords: { lat: 15.496, lng: 73.832 }, durationMin: 90, costPerPerson: 0, priceLevel: 'free',
    openingHours: { open: '08:00', close: '19:00' }, tags: ['Culture', 'Food'], popular: true, alternativeGroup: 'heritage',
  },
  {
    id: 'goan-food-trail', name: 'Local Goan food experience', category: 'Food',
    description: 'Guided tasting of Goan staples — fish curry rice, xacuti and bebinca.',
    area: 'Panaji', region: 'Panaji', cluster: 'panaji-oldgoa',
    coords: { lat: 15.498, lng: 73.828 }, durationMin: 120, costPerPerson: 600, priceLevel: 'affordable',
    openingHours: { open: '11:00', close: '21:00' }, tags: ['Food', 'Culture'], popular: false, alternativeGroup: 'food',
  },
  {
    id: 'premium-water-sports', name: 'Premium water sports package', category: 'Water sports',
    description: 'Bundled parasailing, jet-ski and banana-boat session.',
    area: 'Calangute', region: 'North Goa', cluster: 'calangute-candolim',
    coords: { lat: 15.546, lng: 73.754 }, durationMin: 180, costPerPerson: 2500, priceLevel: 'premium',
    openingHours: { open: '09:00', close: '17:00' }, tags: ['Adventure', 'Beaches'], popular: false, alternativeGroup: 'water',
  },
  {
    id: 'beach-kayaking', name: 'Beach kayaking & banana ride', category: 'Water sports',
    description: 'Short, affordable kayaking or banana-boat ride off Baga.',
    area: 'Baga', region: 'North Goa', cluster: 'calangute-candolim',
    coords: { lat: 15.556, lng: 73.751 }, durationMin: 60, costPerPerson: 500, priceLevel: 'affordable',
    openingHours: { open: '09:00', close: '17:00' }, tags: ['Adventure', 'Beaches'], popular: false, alternativeGroup: 'water',
  },
  {
    id: 'dona-paula-sunset', name: 'Sunset at Dona Paula viewpoint', category: 'Viewpoint',
    description: 'Watch the sun set over the bay from the Dona Paula headland.',
    area: 'Dona Paula', region: 'Panaji', cluster: 'panaji-oldgoa',
    coords: { lat: 15.456, lng: 73.804 }, durationMin: 60, costPerPerson: 0, priceLevel: 'free',
    openingHours: { open: '16:30', close: '19:00' }, tags: ['Relaxation', 'Beaches'], popular: true, alternativeGroup: 'sunset',
  },
  {
    id: 'panaji-market', name: 'Panaji municipal market', category: 'Market',
    description: 'Browse spices, cashews, local sweets and fresh produce.',
    area: 'Panaji', region: 'Panaji', cluster: 'panaji-oldgoa',
    coords: { lat: 15.497, lng: 73.826 }, durationMin: 60, costPerPerson: 0, priceLevel: 'free',
    openingHours: { open: '08:00', close: '20:00' }, tags: ['Food', 'Culture'], popular: false, alternativeGroup: 'market',
  },
  {
    id: 'assagao-cafe', name: 'Café experience in Assagao', category: 'Café',
    description: 'Slow brunch or coffee in the leafy café belt of Assagao.',
    area: 'Assagao', region: 'North Goa', cluster: 'anjuna-vagator',
    coords: { lat: 15.596, lng: 73.774 }, durationMin: 90, costPerPerson: 400, priceLevel: 'affordable',
    openingHours: { open: '09:00', close: '22:00' }, tags: ['Food', 'Relaxation'], popular: false, alternativeGroup: 'food',
  },
  {
    id: 'ayurvedic-spa', name: 'Ayurvedic spa session', category: 'Spa',
    description: 'Traditional Ayurvedic massage and wellness treatment.',
    area: 'Candolim', region: 'North Goa', cluster: 'calangute-candolim',
    coords: { lat: 15.513, lng: 73.767 }, durationMin: 90, costPerPerson: 2000, priceLevel: 'premium',
    openingHours: { open: '10:00', close: '20:00' }, tags: ['Relaxation'], popular: false, alternativeGroup: 'relax',
  },
];

export const ACTIVITY_BY_ID: Record<string, Activity> = Object.fromEntries(ACTIVITIES.map((a) => [a.id, a]));
