import { expect, it } from 'vitest';
import { parseChat } from '../src/lib/chat';
import { DEMO_PREFS } from './helpers';

const today = new Date('2026-10-31T10:00:00');
const p = (t: string, cur = DEMO_PREFS) => parseChat(t, cur, today);

it('reads a full trip request', () => {
  const r = p('4 friends to Bali, beaches and food, ₹60k, chill pace');
  expect(r.patch).toMatchObject({ destination: 'Bali', travellers: 4, budget: 60000, pace: 'Relaxed' });
  expect(r.patch.interests).toEqual(expect.arrayContaining(['Beaches', 'Food']));
});
it('reads lakh, couple and luxury', () => {
  expect(p('Couple trip to Dubai, luxury, 1.5 lakh').patch).toMatchObject({ destination: 'Dubai', travellers: 2, budget: 150000, travelStyle: 'Luxury' });
});
it('reads solo backpacking with a plain number and scooter', () => {
  expect(p('Solo backpacking in Phuket under 20000 by scooter').patch).toMatchObject({ destination: 'Phuket', travellers: 1, budget: 20000, travelStyle: 'Budget', transport: 'Scooter' });
});
it('applies relative budget cuts', () => {
  expect(p('Cut the budget by 5k').patch.budget).toBe(20000);
  expect(p('increase budget by 10k').patch.budget).toBe(35000);
});
it('edits interests and pace', () => {
  const r = p('Make it more relaxed and skip temples', { ...DEMO_PREFS, interests: ['Beaches', 'Culture'] });
  expect(r.patch.pace).toBe('Relaxed');
  expect(r.patch.interests).toEqual(['Beaches', 'Relaxation']);
});
it('reads dates and rolls into next year when past', () => {
  expect(p('from 20 dec').patch.startDate).toBe('2026-12-20');
  expect(p('starting march 5').patch.startDate).toBe('2027-03-05');
});
it('does not mistake comfortable for forts or thousand for sand', () => {
  expect(p('a comfortable trip for two thousand reasons').patch.interests).toBeUndefined();
});
it('returns nothing understood for small talk', () => {
  expect(p('hello there').understood).toEqual([]);
});
