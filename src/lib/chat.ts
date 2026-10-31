// "Plan by chat": turns a plain-English request into trip preferences.
// Rule-based (keywords + number patterns) so it runs offline with no API key.
// The interface — text in, a preference patch + what was understood out — is the
// seam where a language model can replace the rules later.
import type { DestinationId, Interest, Pace, TransportMode, TravelStyle, TripPreferences } from '../engine';

export interface ChatParse {
  patch: Partial<TripPreferences>;
  understood: string[]; // human-readable list of what was picked up
  addInterests: Interest[];
  removeInterests: Interest[];
  replaceInterests: boolean; // true when the message states interests outright
  fresh: boolean; // user asked for a new plan rather than an edit
}

const DESTS: [RegExp, DestinationId][] = [
  [/\bgoa\b/, 'Goa'], [/\bbali\b|\bubud\b|\bseminyak\b/, 'Bali'], [/\bphuket\b|\bthailand\b|\bpatong\b/, 'Phuket'], [/\bdubai\b|\buae\b/, 'Dubai'],
];
const INTEREST_WORDS: [RegExp, Interest][] = [
  [/beach|\bsea\b|\bsand\b|swim|island|surf/, 'Beaches'],
  [/food|\beat\b|cuisine|cooking|street food|seafood|cafe|café|restaurant/, 'Food'],
  [/adventure|thrill|water ?sports?|parasail|jet ?ski|hike|trek|desert|safari|dive|snorkel/, 'Adventure'],
  [/culture|heritage|histor|temple|church|\bforts?\b|museum|mosque|old town|architecture/, 'Culture'],
  [/relax|chill|\bspa\b|massage|unwind|sunset|slow|calm|nightlife|beach club/, 'Relaxation'],
];
const WORD_NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, solo: 1, couple: 2, pair: 2 };
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function parseBudget(t: string): number | undefined {
  // ₹60k, 60k, rs 60,000, 1.5 lakh, 60000, budget of 45 k
  const lakh = t.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|l)\b/);
  if (lakh) return Math.round(parseFloat(lakh[1]) * 100000);
  const k = t.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*k\b/);
  if (k) return Math.round(parseFloat(k[1]) * 1000);
  const full = t.match(/(?:₹|rs\.?|inr|budget(?: of| is)?|under|within|for)\s*(\d{1,3}(?:,\d{2,3})+|\d{4,6})/);
  if (full) return parseInt(full[1].replace(/,/g, ''), 10);
  const bare = t.match(/\b(\d{1,3}(?:,\d{3})+|\d{5,6})\b/);
  if (bare) return parseInt(bare[1].replace(/,/g, ''), 10);
  return undefined;
}

function parseTravellers(t: string): number | undefined {
  if (/\b(solo|alone|just me|by myself)\b/.test(t)) return 1;
  if (/\b(couple|honeymoon|my (wife|husband|partner|girlfriend|boyfriend))\b/.test(t)) return 2;
  const m = t.match(/\b(\d|one|two|three|four|five|six)\s*(?:of us|people|persons|pax|guests?|travell?ers?|friends|adults|members)\b/);
  if (m) return WORD_NUM[m[1]] ?? parseInt(m[1], 10);
  const fam = t.match(/family of (\d|three|four|five|six)/);
  if (fam) return WORD_NUM[fam[1]] ?? parseInt(fam[1], 10);
  const add = t.match(/\b(?:add|plus|one more|another)\s*(\d|one|two)?\s*(?:more\s*)?(?:person|people|guest|friend)/);
  if (add) return -(WORD_NUM[add[1] ?? 'one'] ?? parseInt(add[1] ?? '1', 10)); // negative = relative add
  return undefined;
}

function parseDate(t: string, today = new Date()): string | undefined {
  const m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/) ??
    t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (!m) return undefined;
  const [day, mon] = /\d/.test(m[1]) ? [parseInt(m[1], 10), m[2]] : [parseInt(m[2], 10), m[1]];
  const month = MONTHS.indexOf(mon.slice(0, 3));
  if (month < 0 || day < 1 || day > 31) return undefined;
  let year = today.getFullYear();
  if (new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate())) year += 1;
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseChat(input: string, current: TripPreferences, today = new Date()): ChatParse {
  const t = ' ' + input.toLowerCase().replace(/[’']/g, '') + ' ';
  const patch: Partial<TripPreferences> = {};
  const understood: string[] = [];
  const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  for (const [re, d] of DESTS) if (re.test(t)) { patch.destination = d; understood.push(d); break; }

  // budget — relative ("cut budget by 10k", "add 5k") or absolute
  const rel = t.match(/\b(cut|reduce|lower|drop|less|increase|raise|add|more)\b[^.]*?(\d+(?:\.\d+)?)\s*(k|lakh|000)?/);
  const abs = parseBudget(t);
  if (rel && /budget|₹|rs|k\b|lakh/.test(t) && !/\bpeople|guests?|friends|person\b/.test(rel[0])) {
    let n = parseFloat(rel[2]) * (rel[3] === 'k' ? 1000 : rel[3] === 'lakh' ? 100000 : rel[3] === '000' ? 1000 : 1);
    if (n < 1000) n *= 1000;
    const sign = /cut|reduce|lower|drop|less/.test(rel[1]) ? -1 : 1;
    patch.budget = Math.max(5000, current.budget + sign * n);
    understood.push(`budget ${sign < 0 ? 'down' : 'up'} to ${inr(patch.budget)}`);
  } else if (abs && abs >= 5000) {
    patch.budget = Math.min(200000, abs);
    understood.push(`budget ${inr(patch.budget)}`);
  } else if (/\b(cheaper|tighter budget|save money|spend less)\b/.test(t)) {
    patch.budget = Math.max(5000, Math.round(current.budget * 0.8 / 500) * 500);
    understood.push(`budget down 20% to ${inr(patch.budget)}`);
  }

  const tr = parseTravellers(t);
  if (tr !== undefined) {
    patch.travellers = Math.min(6, Math.max(1, tr < 0 ? current.travellers - tr : tr));
    understood.push(`${patch.travellers} guest${patch.travellers > 1 ? 's' : ''}`);
  }

  const date = parseDate(t, today);
  if (date) { patch.startDate = date; understood.push(`starting ${new Date(date + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`); }

  // style
  let style: TravelStyle | undefined;
  if (/\b(luxury|luxurious|5 ?star|five star|premium|splurge|fancy)\b/.test(t)) style = 'Luxury';
  else if (/\b(budget trip|backpack\w*|cheap\w*|hostels?|budget style|on a budget|shoestring)\b/.test(t)) style = 'Budget';
  else if (/\b(balanced|mid ?range|comfortable|3 ?star)\b/.test(t)) style = 'Balanced';
  if (style) { patch.travelStyle = style; understood.push(`${style.toLowerCase()} style`); }

  // pace
  let pace: Pace | undefined;
  if (/\b(chill|relaxed|slow|easy|lazy|lighter|less packed|fewer activities|take it easy)\b/.test(t)) pace = 'Relaxed';
  else if (/\b(packed|busy|action|see everything|more activities|fast paced|full on)\b/.test(t)) pace = 'Packed';
  else if (/\b(moderate|normal pace|balanced pace)\b/.test(t)) pace = 'Moderate';
  if (pace) { patch.pace = pace; understood.push(`${pace.toLowerCase()} pace`); }

  // transport
  let transport: TransportMode | undefined;
  if (/\b(scooter|bike|two wheeler|moped|rental car|self drive|drive ourselves)\b/.test(t)) transport = 'Scooter';
  else if (/\b(cab|taxi|uber|grab|ride ?hail|car with driver)\b/.test(t)) transport = 'Cab';
  else if (/\b(bus|metro|public transport|songthaew|shuttle|train)\b/.test(t)) transport = 'PublicTransport';
  if (transport) { patch.transport = transport; understood.push(`getting around by ${transport === 'PublicTransport' ? 'public transport' : transport.toLowerCase()}`); }

  // interests: "no culture", "skip temples", "less food" remove; "more X", "add X" add; otherwise stated interests replace
  const addInterests: Interest[] = [];
  const removeInterests: Interest[] = [];
  const stated: Interest[] = [];
  for (const [re, interest] of INTEREST_WORDS) {
    const neg = new RegExp(`\\b(no|not|skip|without|less|avoid|hate|dont want|don't want)\\b[^,.]{0,20}(${re.source})`);
    const pos = new RegExp(`\\b(more|add|also|plus|include)\\b[^,.]{0,20}(${re.source})`);
    if (neg.test(t)) removeInterests.push(interest);
    else if (pos.test(t)) addInterests.push(interest);
    else if (re.test(t)) stated.push(interest);
  }
  const replaceInterests = stated.length > 0 && addInterests.length === 0 && removeInterests.length === 0;
  if (replaceInterests) understood.push(`into ${stated.join(', ').toLowerCase()}`);
  if (addInterests.length) understood.push(`more ${addInterests.join(', ').toLowerCase()}`);
  if (removeInterests.length) understood.push(`less ${removeInterests.join(', ').toLowerCase()}`);

  let interests = current.interests;
  if (replaceInterests) interests = stated;
  interests = [...new Set([...interests, ...addInterests])].filter((i) => !removeInterests.includes(i));
  if (interests.length === 0) interests = current.interests;
  if (interests.join() !== current.interests.join()) patch.interests = interests;

  const fresh = !!patch.destination && patch.destination !== current.destination || /\b(new trip|start over|plan a trip|plan me|plan my|trip to)\b/.test(t);
  return { patch, understood, addInterests, removeInterests, replaceInterests, fresh };
}

export const CHAT_EXAMPLES = [
  '4 friends to Bali, beaches and food, ₹60k, chill pace',
  'Couple trip to Dubai, luxury, 1.5 lakh',
  'Cut the budget by 5k',
  'Make it more relaxed and skip temples',
  'Solo backpacking in Phuket under 20000 by scooter',
];
