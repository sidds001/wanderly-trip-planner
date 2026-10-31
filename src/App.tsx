import { useMemo, useState } from 'react';
import {
  AlertTriangle, Bike, Bus, Car, Castle, Church, Clock, Coffee, Footprints, Globe, Heart, Lock, MapPin, Menu,
  Landmark, Minus, Mountain, Plus, Sailboat, Search, Share, Sparkles, Star, Store, Sunset, TreePalm, Utensils, Waves, X,
} from 'lucide-react';
import {
  applyReplacement, generateItinerary, getReplacementOptions, replanItinerary, PLANNER_CONFIG,
  type ChangeSummary, type Interest, type Pace, type Plan, type ReplacementOption, type ScheduledItem,
  type TransportMode, type TravelStyle, type TripPreferences,
} from './engine';
import { ACCOMMODATION_LABEL } from './data/assumptions';
import { ALL_ACTIVITIES, DESTINATION_LIST, getDestination } from './data/destinations';
import PHOTOS from './data/photos.json';
import { CHAT_EXAMPLES, parseChat } from './lib/chat';
import { MessageCircle, Send } from 'lucide-react';

const photoOf = (id?: string): string | undefined => (id ? (PHOTOS as Record<string, { src: string }>)[id]?.src : undefined);

type Icon = typeof Waves;
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const ACT = new Map(ALL_ACTIVITIES.map((a) => [a.id, a]));

const INTERESTS: { id: Interest; icon: Icon }[] = [
  { id: 'Beaches', icon: Waves }, { id: 'Food', icon: Utensils }, { id: 'Adventure', icon: Mountain },
  { id: 'Culture', icon: Castle }, { id: 'Relaxation', icon: TreePalm },
];
const STYLES: TravelStyle[] = ['Budget', 'Balanced', 'Luxury'];
const PACES: Pace[] = ['Relaxed', 'Moderate', 'Packed'];
const TRANSPORTS: { id: TransportMode; label: string; icon: Icon }[] = [
  { id: 'Cab', label: 'Cab', icon: Car }, { id: 'Scooter', label: 'Scooter', icon: Bike }, { id: 'PublicTransport', label: 'Bus', icon: Bus },
];

// Category → icon + soft gradient used as the "photo" tile on each card.
const CATEGORY_LOOK: Record<string, { icon: Icon; bg: string }> = {
  Beach: { icon: Waves, bg: 'linear-gradient(135deg,#7dd3fc,#0ea5e9 60%,#fde68a)' },
  Fort: { icon: Castle, bg: 'linear-gradient(135deg,#fcd34d,#b45309)' },
  Church: { icon: Church, bg: 'linear-gradient(135deg,#f5f5f4,#a8a29e)' },
  'Heritage walk': { icon: Footprints, bg: 'linear-gradient(135deg,#fca5a5,#f59e0b)' },
  Café: { icon: Coffee, bg: 'linear-gradient(135deg,#d6bfa7,#78350f)' },
  Food: { icon: Utensils, bg: 'linear-gradient(135deg,#fdba74,#dc2626)' },
  Market: { icon: Store, bg: 'linear-gradient(135deg,#bef264,#16a34a)' },
  Spa: { icon: Sparkles, bg: 'linear-gradient(135deg,#e9d5ff,#a855f7)' },
  Viewpoint: { icon: Sunset, bg: 'linear-gradient(135deg,#fdba74,#e11d48 70%,#6d28d9)' },
  'Water sports': { icon: Sailboat, bg: 'linear-gradient(135deg,#5eead4,#0369a1)' },
  Temple: { icon: Landmark, bg: 'linear-gradient(135deg,#fde68a,#c2410c)' },
  Mosque: { icon: Landmark, bg: 'linear-gradient(135deg,#f5f5f4,#0e7490)' },
  Palace: { icon: Castle, bg: 'linear-gradient(135deg,#fcd34d,#9a3412)' },
  Nature: { icon: TreePalm, bg: 'linear-gradient(135deg,#86efac,#166534)' },
  'Rice terraces': { icon: TreePalm, bg: 'linear-gradient(135deg,#bef264,#15803d)' },
  Walk: { icon: Footprints, bg: 'linear-gradient(135deg,#a7f3d0,#047857)' },
  Adventure: { icon: Mountain, bg: 'linear-gradient(135deg,#fca5a5,#7c2d12)' },
  'Beach club': { icon: Waves, bg: 'linear-gradient(135deg,#a5f3fc,#db2777)' },
  'Island trip': { icon: Sailboat, bg: 'linear-gradient(135deg,#67e8f9,#1d4ed8)' },
  Cruise: { icon: Sailboat, bg: 'linear-gradient(135deg,#93c5fd,#1e3a8a)' },
  'Water park': { icon: Waves, bg: 'linear-gradient(135deg,#67e8f9,#0284c7)' },
  Skyline: { icon: Landmark, bg: 'linear-gradient(135deg,#c7d2fe,#312e81)' },
  Shopping: { icon: Store, bg: 'linear-gradient(135deg,#fbcfe8,#9d174d)' },
  Show: { icon: Sparkles, bg: 'linear-gradient(135deg,#a5b4fc,#1e1b4b)' },
  Desert: { icon: Mountain, bg: 'linear-gradient(135deg,#fed7aa,#c2410c)' },
};
const lookFor = (activityId?: string) => CATEGORY_LOOK[ACT.get(activityId ?? '')?.category ?? ''] ?? { icon: MapPin, bg: 'linear-gradient(135deg,#e5e7eb,#9ca3af)' };

const DEFAULT_PREFS: TripPreferences = {
  destination: 'Goa', startDate: '2026-11-14', durationDays: 3, budget: PLANNER_CONFIG.budget.default,
  travellers: PLANNER_CONFIG.travellers.default, interests: ['Beaches', 'Food', 'Adventure'],
  travelStyle: 'Balanced', pace: 'Moderate', transport: 'Cab',
};
const fmtDate = (iso: string) => new Date(iso + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const dayName = (iso: string) => new Date(iso + 'T00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
const endDate = (iso: string) => { const d = new Date(iso + 'T00:00'); d.setDate(d.getDate() + 2); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// ---------- header + search pill ----------

function Header({ prefs, onSearch }: { prefs: TripPreferences; onSearch: () => void }) {
  const cell = 'flex flex-col px-5 py-2 text-left';
  return (
    <header className="sticky top-0 z-40 border-b border-[#EBEBEB] bg-white">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-6 py-4 lg:px-10">
        <div className="flex items-center gap-1.5 text-[22px] font-extrabold tracking-tight text-[#E8505B]">
          <TreePalm className="h-8 w-8" strokeWidth={2.4} />
          <span className="hidden md:inline">wanderly</span>
        </div>
        <button type="button" onClick={onSearch}
          className="flex items-center rounded-full border border-[#DDDDDD] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.05)] transition hover:shadow-[0_2px_4px_rgba(0,0,0,0.18)]">
          <span className={cell}><span className="text-xs font-semibold">Where</span><span className="text-sm text-[#717171]">{prefs.destination}</span></span>
          <span className="h-8 w-px bg-[#DDDDDD]" />
          <span className={`${cell} hidden sm:flex`}><span className="text-xs font-semibold">When</span><span className="text-sm text-[#717171]">{fmtDate(prefs.startDate)} – {fmtDate(endDate(prefs.startDate))}</span></span>
          <span className="hidden h-8 w-px bg-[#DDDDDD] sm:block" />
          <span className={`${cell} hidden sm:flex`}><span className="text-xs font-semibold">Who</span><span className="text-sm text-[#717171]">{prefs.travellers} guest{prefs.travellers > 1 ? 's' : ''}</span></span>
          <span className="m-2 rounded-full bg-[#E8505B] p-2.5 text-white"><Search className="h-4 w-4" strokeWidth={3} /></span>
        </button>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full px-3 py-2 text-sm font-medium hover:bg-[#F7F7F7] lg:block">Plan a trip</span>
          <span className="hidden rounded-full p-2 hover:bg-[#F7F7F7] lg:block"><Globe className="h-4 w-4" /></span>
          <span className="flex items-center gap-3 rounded-full border border-[#DDDDDD] py-1.5 pl-3 pr-1.5 hover:shadow-md">
            <Menu className="h-4 w-4" /><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#222] text-xs font-semibold text-white">You</span>
          </span>
        </div>
      </div>
    </header>
  );
}

function DestinationBar({ prefs, onPick }: { prefs: TripPreferences; onPick: (d: TripPreferences['destination']) => void }) {
  return (
    <div className="mx-auto flex max-w-[1280px] gap-3 overflow-x-auto px-6 pt-5 lg:px-10">
      {DESTINATION_LIST.map((d) => {
        const on = prefs.destination === d.id;
        const { icon: I, bg } = lookFor(d.heroPhotos[0]);
        return (
          <button key={d.id} type="button" onClick={() => onPick(d.id)}
            className={`flex shrink-0 items-center gap-3 rounded-2xl border p-2 pr-5 text-left transition ${on ? 'border-[#222] shadow-[0_0_0_1px_#222]' : 'border-[#DDDDDD] hover:border-[#222]'}`}>
            <span className="relative h-12 w-12 overflow-hidden rounded-xl" style={{ background: bg }}>{photoOf(d.heroPhotos[0]) ? <img src={photoOf(d.heroPhotos[0])} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <I className="absolute bottom-1.5 right-1.5 h-5 w-5 text-white" />}</span>
            <span><span className="block text-sm font-semibold">{d.name}, {d.country}</span><span className="block text-xs text-[#717171]">{d.tagline}</span></span>
          </button>
        );
      })}
    </div>
  );
}

function CategoryBar({ prefs, setPrefs }: { prefs: TripPreferences; setPrefs: (p: TripPreferences) => void }) {
  const toggle = (i: Interest) => {
    const has = prefs.interests.includes(i);
    if (has && prefs.interests.length === 1) return;
    setPrefs({ ...prefs, interests: has ? prefs.interests.filter((x) => x !== i) : [...prefs.interests, i] });
  };
  return (
    <div className="border-b border-[#EBEBEB] bg-white">
      <div className="mx-auto flex max-w-[1280px] items-center gap-8 overflow-x-auto px-6 pt-4 lg:px-10">
        {INTERESTS.map(({ id, icon: I }) => {
          const on = prefs.interests.includes(id);
          return (
            <button key={id} type="button" onClick={() => toggle(id)}
              className={`flex shrink-0 flex-col items-center gap-2 border-b-2 pb-3 text-xs font-semibold transition ${on ? 'border-[#222] text-[#222]' : 'border-transparent text-[#717171] hover:border-[#DDDDDD] hover:text-[#222]'}`}>
              <I className="h-6 w-6" strokeWidth={on ? 2.2 : 1.6} />{id}
            </button>
          );
        })}
        <span className="ml-auto hidden shrink-0 pb-3 text-xs text-[#717171] md:block">Pick what you love — we’ll plan around it</span>
      </div>
    </div>
  );
}

// ---------- booking-style side card ----------

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (n: number) => void }) {
  const btn = 'flex h-8 w-8 items-center justify-center rounded-full border border-[#B0B0B0] text-[#717171] disabled:opacity-30 hover:border-[#222] hover:text-[#222]';
  return (
    <div className="flex items-center gap-3">
      <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="Fewer"><Minus className="h-3.5 w-3.5" /></button>
      <span className="w-4 text-center tabular-nums">{value}</span>
      <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="More"><Plus className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function Pills<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string; icon?: Icon }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(({ id, label, icon: I }) => (
        <button key={id} type="button" onClick={() => onChange(id)}
          className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition ${value === id ? 'border-[#222] bg-[#222] text-white' : 'border-[#DDDDDD] text-[#222] hover:border-[#222]'}`}>
          {I && <I className="h-4 w-4" />}{label}
        </button>
      ))}
    </div>
  );
}

function TripCard({ prefs, setPrefs, plan, changed, onGenerate, onReplan, onShowChanges, lastSummary }: {
  prefs: TripPreferences; setPrefs: (p: TripPreferences) => void; plan: Plan | null; changed: boolean;
  onGenerate: () => void; onReplan: () => void; onShowChanges: () => void; lastSummary: ChangeSummary | null;
}) {
  const b = PLANNER_CONFIG.budget;
  const total = plan?.breakdown.total;
  const primary = plan && changed ? { label: 'Replan trip', fn: onReplan } : { label: plan ? 'Regenerate itinerary' : 'Plan my trip', fn: onGenerate };
  return (
    <div className="rounded-xl border border-[#DDDDDD] bg-white p-6 shadow-[0_6px_16px_rgba(0,0,0,0.12)]">
      {plan ? (
        <div className="mb-5 flex items-baseline gap-2">
          <span className="text-[22px] font-semibold">{inr(total!)}</span>
          <span className="text-[#717171]">total · {inr(total! / plan.preferences.travellers)}/guest</span>
        </div>
      ) : (
        <div className="mb-5 text-[22px] font-semibold">Plan your 3 days in {prefs.destination}</div>
      )}
      <div className="overflow-hidden rounded-lg border border-[#B0B0B0]">
        <div className="grid grid-cols-2">
          <label className="border-r border-[#B0B0B0] px-3 py-2.5">
            <div className="text-[10px] font-extrabold uppercase tracking-wide">Check-in</div>
            <input type="date" value={prefs.startDate} onChange={(e) => e.target.value && setPrefs({ ...prefs, startDate: e.target.value })} className="w-full bg-transparent text-sm outline-none" />
          </label>
          <div className="px-3 py-2.5">
            <div className="text-[10px] font-extrabold uppercase tracking-wide">Checkout</div>
            <div className="text-sm text-[#717171]">{fmtDate(endDate(prefs.startDate))} · 2 nights</div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-[#B0B0B0] px-3 py-2.5">
          <div><div className="text-[10px] font-extrabold uppercase tracking-wide">Guests</div><div className="text-sm">{prefs.travellers} guest{prefs.travellers > 1 ? 's' : ''}</div></div>
          <Stepper value={prefs.travellers} min={PLANNER_CONFIG.travellers.min} max={PLANNER_CONFIG.travellers.max} onChange={(n) => setPrefs({ ...prefs, travellers: n })} />
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between"><span className="text-sm font-semibold">Total budget</span><span className="text-lg font-semibold">{inr(prefs.budget)}</span></div>
        <input type="range" min={b.min} max={b.max} step={b.step} value={prefs.budget} onChange={(e) => setPrefs({ ...prefs, budget: Number(e.target.value) })} className="mt-2 w-full" />
        <div className="mt-2 flex gap-2">
          {[10000, 15000, 25000, 50000, 75000].map((v) => (
            <button key={v} type="button" onClick={() => setPrefs({ ...prefs, budget: v })}
              className={`flex-1 rounded-full border py-1 text-xs font-medium ${prefs.budget === v ? 'border-[#222] bg-[#222] text-white' : 'border-[#DDDDDD] hover:border-[#222]'}`}>₹{v / 1000}k</button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div><div className="mb-2 text-sm font-semibold">Travel style</div><Pills value={prefs.travelStyle} options={STYLES.map((s) => ({ id: s, label: s }))} onChange={(v) => setPrefs({ ...prefs, travelStyle: v })} /></div>
        <div><div className="mb-2 text-sm font-semibold">Pace</div><Pills value={prefs.pace} options={PACES.map((s) => ({ id: s, label: s }))} onChange={(v) => setPrefs({ ...prefs, pace: v })} /></div>
        <div><div className="mb-2 text-sm font-semibold">Getting around</div><Pills value={prefs.transport} options={TRANSPORTS.map((t) => ({ ...t, label: getDestination(prefs.destination).transportLabels[t.id] }))} onChange={(v) => setPrefs({ ...prefs, transport: v })} /></div>
      </div>

      <button type="button" onClick={primary.fn}
        className="mt-6 w-full rounded-lg bg-[linear-gradient(90deg,#E8505B_0%,#D93B6B_100%)] py-3.5 text-base font-semibold text-white transition active:scale-[0.99] hover:brightness-95">
        {primary.label}
      </button>
      <p className="mt-3 text-center text-sm text-[#717171]">{plan && changed ? 'We keep what still fits and your own picks' : `Typical for 2: ${inr(getDestination(prefs.destination).typicalBudgetFor2)} · excl. flights`}</p>

      {plan && (
        <div className="mt-5 space-y-3 border-t border-[#EBEBEB] pt-5 text-[15px]">
          {([['Stay', plan.breakdown.accommodation, `${ACCOMMODATION_LABEL[plan.assumptions.accommodationTier]} · ${plan.assumptions.nights} nights`],
            ['Food', plan.breakdown.food, getDestination(plan.preferences.destination).mealStyle[plan.assumptions.foodTier].label],
            ['Getting around', plan.breakdown.transport, `${getDestination(plan.preferences.destination).transportLabels[plan.assumptions.transport]}, by distance`],
            ['Activities', plan.breakdown.activities, 'Tickets and experiences'],
            ['Extras', plan.breakdown.misc, 'Tips, water, small buys']] as const).map(([k, v, note]) => (
            <div key={k} className="flex justify-between gap-3">
              <span><span className="underline decoration-[#B0B0B0] underline-offset-2">{k}</span><span className="block text-xs text-[#717171]">{note}</span></span>
              <span className="tabular-nums">{inr(v)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-[#EBEBEB] pt-3 font-semibold"><span>Total</span><span>{inr(plan.breakdown.total)}</span></div>
          <div className={`flex justify-between text-sm ${plan.breakdown.remaining < 0 ? 'text-[#C13515]' : 'text-[#008A05]'}`}>
            <span>{plan.breakdown.remaining < 0 ? 'Over budget by' : 'Left in your budget'}</span><span>{inr(Math.abs(plan.breakdown.remaining))}</span>
          </div>
          {lastSummary && (
            <button type="button" onClick={onShowChanges} className="w-full rounded-lg border border-[#222] py-2.5 text-sm font-semibold hover:bg-[#F7F7F7]">See what changed</button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- itinerary ----------

function ActivityCard({ it, onReplace }: { it: ScheduledItem; onReplace: () => void }) {
  const a = ACT.get(it.activityId!);
  const { icon: I, bg } = lookFor(it.activityId);
  return (
    <div className="group flex gap-4 sm:gap-5">
      <div className="relative h-[112px] w-[132px] shrink-0 overflow-hidden rounded-xl sm:h-[128px] sm:w-[168px]" style={{ background: bg }}>
        {photoOf(it.activityId) ? <img src={photoOf(it.activityId)} alt={it.title} className="absolute inset-0 h-full w-full object-cover" loading="lazy" /> : <I className="absolute bottom-3 right-3 h-10 w-10 text-white/90 drop-shadow" strokeWidth={1.6} />}
        {a?.popular && <span className="absolute left-2 top-2 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold shadow">Guest favourite</span>}
        <Heart className="absolute right-2.5 top-2.5 h-5 w-5 fill-black/30 text-white" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold">{it.title}</div>
            <div className="text-sm text-[#717171]">{a?.category} in {it.area}</div>
          </div>
          {a?.popular && <span className="flex shrink-0 items-center gap-1 text-sm"><Star className="h-3.5 w-3.5 fill-[#222]" />Popular</span>}
        </div>
        <div className="mt-1 line-clamp-2 text-sm text-[#717171]">{it.description}</div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold">{it.cost === 0 ? 'Free' : inr(it.cost)}</span>
            <span className="text-[#717171]">· {it.start}–{it.end}</span>
            {it.lockedByUser && <span className="flex items-center gap-1 rounded-full bg-[#F7F7F7] px-2 py-0.5 text-xs font-semibold"><Lock className="h-3 w-3" />Your pick</span>}
          </div>
          <button type="button" onClick={onReplace} className="rounded-lg border border-[#222] px-3 py-1 text-xs font-semibold hover:bg-[#F7F7F7]">Replace</button>
        </div>
      </div>
    </div>
  );
}

function MealRow({ it }: { it: ScheduledItem }) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-[#F7F7F7] px-4 py-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white"><Utensils className="h-4 w-4" /></span>
      <div className="flex-1 text-sm"><span className="font-semibold">{it.title}</span><span className="text-[#717171]"> · {it.start} · near {it.area}</span></div>
      <span className="text-sm">{inr(it.cost)}</span>
    </div>
  );
}

function TravelLeg({ it }: { it: ScheduledItem }) {
  if (it.travelFromPrevMin <= 0) return null;
  return (
    <div className="flex items-center gap-2 py-1 pl-[60px] text-xs text-[#717171] sm:pl-[72px]">
      <span className="h-4 border-l border-dashed border-[#B0B0B0]" />
      {it.travelMode} · {it.travelFromPrevMin} min{it.travelCostFromPrev ? ` · ${inr(it.travelCostFromPrev)}` : ''}
      {it.waitBeforeMin > 10 && <span>· {it.waitBeforeMin} min free time</span>}
    </div>
  );
}

function Itinerary({ plan, onReplace }: { plan: Plan; onReplace: (day: number, item: ScheduledItem) => void }) {
  return (
    <div className="divide-y divide-[#EBEBEB]">
      {plan.days.map((d) => (
        <section key={d.dayNumber} className="py-8 first:pt-2">
          <div className="mb-5">
            <h3 className="text-[22px] font-semibold">Day {d.dayNumber} · {d.clusterLabel}</h3>
            <div className="text-[#717171]">{dayName(d.date)} · {d.items.filter((i) => i.activityId).length} experiences · back at your stay by {(() => { const last = d.items[d.items.length - 1]; const [h, m] = last.end.split(':').map(Number); const t = h * 60 + m + d.returnToHotel.minutes; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; })()}</div>
          </div>
          <div className="space-y-2">
            {d.items.map((it) => (
              <div key={it.key}>
                <TravelLeg it={it} />
                <div className="flex gap-3 sm:gap-4">
                  <div className="w-12 shrink-0 pt-1 text-right text-sm font-semibold tabular-nums sm:w-14">{it.start}</div>
                  <div className="min-w-0 flex-1">{it.kind === 'meal' ? <MealRow it={it} /> : <ActivityCard it={it} onReplace={() => onReplace(d.dayNumber, it)} />}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Notices({ plan }: { plan: Plan }) {
  return (
    <>
      {plan.warnings.map((w, i) => (
        <div key={i} className="mb-4 flex gap-3 rounded-xl border border-[#F5C2BC] bg-[#FFF8F6] p-4 text-sm text-[#C13515]"><AlertTriangle className="h-5 w-5 shrink-0" />{w.message}</div>
      ))}
      {plan.explanations.length > 0 && (
        <div className="mb-4 rounded-xl border border-[#DDDDDD] p-5">
          <div className="mb-2 flex items-center gap-2 font-semibold"><Sparkles className="h-5 w-5 text-[#E8505B]" />How we fit your budget</div>
          <ul className="space-y-1.5 text-sm text-[#484848]">{plan.explanations.map((e, i) => <li key={i} className="flex gap-2"><span className="text-[#E8505B]">•</span>{e.message}</li>)}</ul>
        </div>
      )}
    </>
  );
}

// ---------- modals ----------

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-6" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex items-center justify-center border-b border-[#EBEBEB] px-6 py-4">
          <button type="button" onClick={onClose} aria-label="Close" className="absolute left-4 rounded-full p-2 hover:bg-[#F7F7F7]"><X className="h-4 w-4" /></button>
          <h3 className="font-semibold">{title}</h3>
        </div>
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

function ChangeModal({ s, onClose }: { s: ChangeSummary; onClose: () => void }) {
  const ac = s.activityChanges;
  const lists = [
    ['Swapped', ac.replaced.map((r) => `Day ${r.day}: ${r.from} → ${r.to}`)],
    ['Removed', ac.removed.map((r) => `Day ${r.day}: ${r.name}`)],
    ['Added', ac.added.map((r) => `Day ${r.day}: ${r.name}`)],
    ['Kept', ac.kept.map((r) => `Day ${r.day}: ${r.name}`)],
  ] as const;
  return (
    <Modal title="What changed" onClose={onClose}>
      <div className="mb-6 grid grid-cols-3 overflow-hidden rounded-xl border border-[#DDDDDD] text-center">
        <div className="p-3"><div className="text-xs text-[#717171]">Before</div><div className="text-lg font-semibold">{inr(s.previousTotal)}</div></div>
        <div className="border-x border-[#DDDDDD] p-3"><div className="text-xs text-[#717171]">After</div><div className="text-lg font-semibold">{inr(s.newTotal)}</div></div>
        <div className="p-3"><div className="text-xs text-[#717171]">{s.savings >= 0 ? 'You save' : 'Extra'}</div><div className={`text-lg font-semibold ${s.savings >= 0 ? 'text-[#008A05]' : 'text-[#C13515]'}`}>{inr(Math.abs(s.savings))}</div></div>
      </div>
      <p className="mb-6 text-[15px] leading-relaxed text-[#222]">{s.narrative}</p>
      <h4 className="mb-2 text-lg font-semibold">Price details</h4>
      <div className="mb-6 space-y-2 text-[15px]">
        {s.categoryRows.map((r) => (
          <div key={r.category} className={`flex justify-between ${r.category === 'Total' ? 'border-t border-[#EBEBEB] pt-2 font-semibold' : ''}`}>
            <span>{r.category}</span>
            <span className="tabular-nums"><span className="text-[#717171] line-through decoration-[#B0B0B0]">{r.delta !== 0 ? inr(r.before) : ''}</span> {inr(r.after)}</span>
          </div>
        ))}
      </div>
      {s.assumptionChanges.length > 0 && (
        <div className="mb-6"><h4 className="mb-2 text-lg font-semibold">Your stay and dining</h4>
          {s.assumptionChanges.map((c, i) => <div key={i} className="text-[15px]">{c.label}: <span className="text-[#717171] line-through">{c.before}</span> → {c.after}</div>)}
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        {lists.filter(([, xs]) => xs.length).map(([t, xs]) => (
          <div key={t}><h4 className="mb-1 font-semibold">{t}</h4><ul className="space-y-0.5 text-sm text-[#717171]">{xs.map((x) => <li key={x}>{x}</li>)}</ul></div>
        ))}
      </div>
    </Modal>
  );
}

function ReplaceModal({ day, item, options, onPick, onClose, error }: { day: number; item: ScheduledItem; options: ReplacementOption[]; onPick: (id: string) => void; onClose: () => void; error?: string }) {
  return (
    <Modal title={`Replace ${item.title}`} onClose={onClose}>
      <p className="mb-4 text-sm text-[#717171]">Day {day} · options that fit the same slot and your interests</p>
      {error && <div className="mb-4 rounded-lg bg-[#FFF8F6] p-3 text-sm text-[#C13515]">{error}</div>}
      {options.length === 0 && <p className="text-sm text-[#717171]">No alternatives fit this day.</p>}
      <div className="space-y-4">
        {options.map((o) => {
          const { icon: I, bg } = CATEGORY_LOOK[o.activity.category] ?? lookFor();
          return (
            <button key={o.activity.id} type="button" disabled={!o.feasible} onClick={() => onPick(o.activity.id)}
              className={`flex w-full gap-4 rounded-xl p-2 text-left transition ${o.feasible ? 'hover:bg-[#F7F7F7]' : 'cursor-not-allowed opacity-40'}`}>
              <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-lg" style={{ background: bg }}>{photoOf(o.activity.id) ? <img src={photoOf(o.activity.id)} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <I className="absolute bottom-2 right-2 h-7 w-7 text-white/90" />}</div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2"><span className="font-semibold">{o.activity.name}</span>
                  <span className={`shrink-0 text-sm font-semibold ${o.costDelta > 0 ? 'text-[#C13515]' : o.costDelta < 0 ? 'text-[#008A05]' : 'text-[#717171]'}`}>{o.costDelta === 0 ? 'Same price' : `${o.costDelta > 0 ? '+' : '−'}${inr(Math.abs(o.costDelta))}`}</span>
                </div>
                <div className="text-sm text-[#717171]">{o.activity.area} · {o.durationMin} min · {o.estimatedCost ? inr(o.estimatedCost) : 'Free'}</div>
                <div className="line-clamp-1 text-sm text-[#717171]">{o.activity.description}</div>
                {o.overBudget && <div className="text-xs font-semibold text-[#C13515]">Puts you over budget</div>}
                {!o.feasible && o.reason && <div className="text-xs text-[#C13515]">{o.reason}</div>}
              </div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

// ---------- plan by chat ----------

type ChatMsg = { from: 'you' | 'bot'; text: string; action?: 'changes' };

function ChatPanel({ open, setOpen, messages, onSend, onShowChanges }: {
  open: boolean; setOpen: (b: boolean) => void; messages: ChatMsg[]; onSend: (t: string) => void; onShowChanges: () => void;
}) {
  const [text, setText] = useState('');
  const send = (t: string) => { if (!t.trim()) return; onSend(t.trim()); setText(''); };
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-[linear-gradient(90deg,#E8505B_0%,#D93B6B_100%)] px-5 py-3.5 font-semibold text-white shadow-[0_8px_24px_rgba(217,59,107,0.4)] hover:brightness-95">
        <Sparkles className="h-5 w-5" />Plan by chat
      </button>
    );
  }
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex h-[78vh] flex-col overflow-hidden rounded-t-2xl border border-[#DDDDDD] bg-white shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[600px] sm:w-[400px] sm:rounded-2xl">
      <div className="flex items-center justify-between border-b border-[#EBEBEB] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E8505B] text-white"><MessageCircle className="h-4 w-4" /></span>
          <div><div className="text-sm font-semibold">Plan by chat</div><div className="text-xs text-[#717171]">Describe your trip or ask for a change</div></div>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="rounded-full p-2 hover:bg-[#F7F7F7]"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === 'you' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm ${m.from === 'you' ? 'rounded-br-md bg-[#222] text-white' : 'rounded-bl-md bg-[#F7F7F7] text-[#222]'}`}>
              {m.text}
              {m.action === 'changes' && <button type="button" onClick={onShowChanges} className="mt-2 block text-sm font-semibold underline">See what changed</button>}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-[#EBEBEB] p-3">
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {CHAT_EXAMPLES.map((e) => (
            <button key={e} type="button" onClick={() => send(e)} className="shrink-0 rounded-full border border-[#DDDDDD] px-3 py-1 text-xs hover:border-[#222]">{e}</button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex items-center gap-2 rounded-full border border-[#B0B0B0] py-1 pl-4 pr-1 focus-within:border-[#222]">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. 4 friends to Bali, ₹60k, chill" className="min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label="Message" />
          <button type="submit" aria-label="Send" className="rounded-full bg-[#E8505B] p-2 text-white disabled:opacity-40" disabled={!text.trim()}><Send className="h-4 w-4" /></button>
        </form>
      </div>
    </div>
  );
}

// ---------- page ----------

export default function App() {
  // Deep links for demos/screenshots: #demo = generated ₹25k trip, #replan = replanned to ₹15k with summary open.
  const [boot] = useState(() => {
    const h = typeof location !== 'undefined' ? location.hash : '';
    if (h !== '#demo' && h !== '#replan') return null;
    const p1 = generateItinerary(DEFAULT_PREFS);
    if (h === '#demo') return { prefs: DEFAULT_PREFS, plan: p1, summary: null };
    const r = replanItinerary(p1, { budget: 15000 });
    return { prefs: r.plan.preferences, plan: r.plan, summary: r.summary };
  });
  const [prefs, setPrefs] = useState<TripPreferences>(boot?.prefs ?? DEFAULT_PREFS);
  const [plan, setPlan] = useState<Plan | null>(boot?.plan ?? null);
  const [summary, setSummary] = useState<ChangeSummary | null>(boot?.summary ?? null);
  const [lastSummary, setLastSummary] = useState<ChangeSummary | null>(boot?.summary ?? null);
  const [replacing, setReplacing] = useState<{ day: number; item: ScheduledItem } | null>(null);
  const [replaceErr, setReplaceErr] = useState<string>();
  const [toast, setToast] = useState<string>();

  const changed = useMemo(() => !!plan && JSON.stringify(plan.preferences) !== JSON.stringify(prefs), [plan, prefs]);
  const options = useMemo(() => (plan && replacing ? getReplacementOptions(plan, replacing.day, replacing.item.activityId!) : []), [plan, replacing]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(undefined), 3000); };
  const generate = () => { setPlan(generateItinerary(prefs)); setLastSummary(null); };
  const pickDestination = (d: TripPreferences['destination']) => {
    if (d === prefs.destination) return;
    const next = { ...prefs, destination: d, budget: getDestination(d).typicalBudgetFor2 * Math.max(1, prefs.travellers) / 2 };
    setPrefs(next);
    if (plan) { setPlan(generateItinerary(next)); setLastSummary(null); }
  };
  const [chatOpen, setChatOpen] = useState(() => typeof location !== 'undefined' && location.hash === '#chat');
  const [chat, setChat] = useState<ChatMsg[]>([{ from: 'bot', text: 'Hi! Tell me about your trip — where, who, budget, what you love and your pace. Or ask for a change like “cut the budget by 5k” or “skip temples”.' }]);
  const onChat = (text: string) => {
    const msgs: ChatMsg[] = [...chat, { from: 'you', text }];
    const parsed = parseChat(text, prefs);
    if (parsed.understood.length === 0) {
      setChat([...msgs, { from: 'bot', text: 'I didn’t catch any trip details there. Try a destination (Goa, Bali, Phuket, Dubai), a budget like ₹40k, how many people, interests (beaches, food, adventure, culture, relaxing) or a pace (chill / packed).' }]);
      return;
    }
    const next: TripPreferences = { ...prefs, ...parsed.patch };
    const destChange = next.destination !== prefs.destination;
    if (destChange && parsed.patch.budget === undefined) next.budget = getDestination(next.destination).typicalBudgetFor2 * Math.max(1, next.travellers) / 2;
    setPrefs(next);
    const heard = `Got it: ${parsed.understood.join(' · ')}${destChange && parsed.patch.budget === undefined ? ` · typical budget ${inr(next.budget)}` : ''}.`;
    if (!plan || destChange || parsed.fresh) {
      const p = generateItinerary(next);
      setPlan(p); setLastSummary(null);
      const b = p.breakdown;
      setChat([...msgs, { from: 'bot', text: `${heard}\n\nHere’s your 3-day ${next.destination} plan: ${p.days.reduce((n, d) => n + d.items.filter((i) => i.activityId).length, 0)} experiences for ${inr(b.total)} — ${b.remaining >= 0 ? `${inr(b.remaining)} left in your budget` : `${inr(-b.remaining)} over your budget`}.${p.warnings.length ? '\n\n⚠️ ' + p.warnings[0].message : ''}` }]);
    } else {
      const r = replanItinerary(plan, next);
      setPlan(r.plan); setLastSummary(r.summary);
      setChat([...msgs, { from: 'bot', text: `${heard}\n\n${r.summary.narrative}${r.plan.warnings.length ? '\n\n⚠️ ' + r.plan.warnings[0].message : ''}`, action: 'changes' }]);
    }
  };
  const replan = () => {
    if (!plan) return;
    const r = replanItinerary(plan, prefs);
    setPlan(r.plan); setSummary(r.summary); setLastSummary(r.summary);
  };
  const pick = (id: string) => {
    if (!plan || !replacing) return;
    const r = applyReplacement(plan, replacing.day, replacing.item.activityId!, id);
    if (!r.ok) { setReplaceErr(r.reason); return; }
    setPlan(r.plan); setReplacing(null); setReplaceErr(undefined); flash(r.message);
  };
  const actCount = plan ? plan.days.reduce((s, d) => s + d.items.filter((i) => i.activityId).length, 0) : 0;

  return (
    <div className="min-h-screen bg-white text-[#222]">
      <Header prefs={prefs} onSearch={() => (plan && changed ? replan() : generate())} />
      <DestinationBar prefs={prefs} onPick={pickDestination} />
      <CategoryBar prefs={prefs} setPrefs={setPrefs} />
      <main className="mx-auto max-w-[1280px] px-6 pb-20 pt-6 lg:px-10">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-semibold leading-tight">{plan ? `Your 3 days in ${plan.preferences.destination}, ${plan.preferences.travelStyle.toLowerCase()} style` : `Three days in ${prefs.destination}, planned around your budget`}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[15px] text-[#717171]">
              <MapPin className="h-4 w-4" />{getDestination(prefs.destination).region}
              {plan && <> · {actCount} experiences · {plan.preferences.pace} pace · {plan.preferences.interests.join(', ')}</>}
            </div>
          </div>
          {plan && <span className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold underline hover:bg-[#F7F7F7] sm:flex"><Share className="h-4 w-4" />Share</span>}
        </div>

        {/* gallery-style hero */}
        <div className="mb-8 grid h-[240px] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-xl sm:h-[320px]">
          {getDestination(prefs.destination).heroPhotos.map((id, i) => {
            const { icon: I, bg } = lookFor(id);
            return (
              <div key={id} className={`relative ${i === 0 ? 'col-span-2 row-span-2' : ''}`} style={{ background: bg }}>
                {photoOf(id) ? <img src={photoOf(id)} alt={ACT.get(id)?.name ?? ''} className="absolute inset-0 h-full w-full object-cover" /> : <I className={`absolute bottom-4 right-4 text-white/85 ${i === 0 ? 'h-16 w-16' : 'h-9 w-9'}`} strokeWidth={1.4} />}
              </div>
            );
          })}
        </div>

        <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
          <div className="min-w-0">
            {!plan ? (
              <div className="border-t border-[#EBEBEB] py-10">
                <h2 className="text-[22px] font-semibold">How it works</h2>
                <div className="mt-6 grid gap-6 sm:grid-cols-3">
                  {[
                    ['Tell us your budget', 'Set the total, guests and what you love. Every rupee is shown.'],
                    ['Get a real plan', 'Timed days with travel, meals and opening hours, one area per day.'],
                    ['Change your mind', 'Move the budget and replan. We show exactly what changed and why.'],
                  ].map(([t, d], i) => (
                    <div key={t}><div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#222] text-sm font-semibold text-white">{i + 1}</div><div className="font-semibold">{t}</div><div className="text-sm text-[#717171]">{d}</div></div>
                  ))}
                </div>
                <button type="button" onClick={generate} className="mt-8 rounded-lg bg-[#222] px-6 py-3 font-semibold text-white hover:bg-black">Try the demo trip</button>
              </div>
            ) : (
              <>
                <div className="mb-6 border-y border-[#EBEBEB] py-6">
                  <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F7F7]"><TreePalm className="h-6 w-6" /></span>
                    <div>
                      <div className="font-semibold">Staying in {plan.assumptions.hotelArea}</div>
                      <div className="text-sm text-[#717171]">{ACCOMMODATION_LABEL[plan.assumptions.accommodationTier]} · {plan.assumptions.rooms} room{plan.assumptions.rooms > 1 ? 's' : ''} · breakfast included · {getDestination(plan.preferences.destination).mealStyle[plan.assumptions.foodTier].label.toLowerCase()}</div>
                    </div>
                  </div>
                </div>
                <Notices plan={plan} />
                <Itinerary plan={plan} onReplace={(day, item) => { setReplaceErr(undefined); setReplacing({ day, item }); }} />
                <p className="mt-2 flex items-center gap-2 text-xs text-[#717171]"><Clock className="h-3.5 w-3.5" />Prices, durations and travel times are illustrative estimates, not live rates.</p>
              </>
            )}
          </div>
          <aside className="lg:sticky lg:top-[180px] lg:self-start">
            <TripCard prefs={prefs} setPrefs={setPrefs} plan={plan} changed={changed} onGenerate={generate} onReplan={replan}
              onShowChanges={() => lastSummary && setSummary(lastSummary)} lastSummary={lastSummary} />
          </aside>
        </div>
      </main>
      {summary && <ChangeModal s={summary} onClose={() => setSummary(null)} />}
      {replacing && plan && <ReplaceModal day={replacing.day} item={replacing.item} options={options} onPick={pick} onClose={() => setReplacing(null)} error={replaceErr} />}
      <ChatPanel open={chatOpen} setOpen={setChatOpen} messages={chat} onSend={onChat} onShowChanges={() => lastSummary && setSummary(lastSummary)} />
      {toast && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-[#222] px-5 py-3 text-sm font-medium text-white shadow-xl">{toast}</div>}
    </div>
  );
}
