import type { EventEntry, VenueEntry } from './events';

/** The grid covers 9am through 2am the next morning, in 15-minute slots. */
export const GRID_START = 9 * 60;
export const GRID_END = 26 * 60;
export const SLOT = 15;
export const SLOTS = (GRID_END - GRID_START) / SLOT;
/** Shortest visual width for a block, in slots (45 minutes). */
const MIN_SLOTS = 3;
/** Assumed length when an event has no end time. */
const DEFAULT_LEN = 120;

export interface Lane {
  index: number;
  venueId: string;
  /** Venue name on the venue's first lane, room name on further lanes. */
  label: string;
  sub: string;
  first: boolean;
}
export interface Block {
  event: EventEntry;
  lane: number;
  startSlot: number;
  endSlot: number;
  startMin: number;
  endMin: number;
}

/** Minutes since midnight; anything before 5am counts as late the night before. */
export function mins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  const v = h * 60 + m;
  return v < 5 * 60 ? v + 24 * 60 : v;
}

export function slotOf(min: number): number {
  return Math.min(SLOTS, Math.max(0, Math.round((min - GRID_START) / SLOT)));
}

/**
 * Lays one day's events out into lanes. Each venue gets one lane per room,
 * plus extra lanes when events in the same room overlap. Events without a
 * start time come back separately in `tba`.
 */
export function buildDay(events: EventEntry[], venueById: Map<string, VenueEntry>) {
  const timed = events.filter((e) => e.data.start);
  const tba = events.filter((e) => !e.data.start);

  // Venue order: most events first, then alphabetical, so busy bars sit at the top.
  const byVenue = new Map<string, EventEntry[]>();
  for (const e of timed) {
    const list = byVenue.get(e.data.venue.id) ?? [];
    list.push(e);
    byVenue.set(e.data.venue.id, list);
  }
  const venueOrder = [...byVenue.entries()].sort(
    (a, b) => b[1].length - a[1].length || (venueById.get(a[0])?.data.name ?? '').localeCompare(venueById.get(b[0])?.data.name ?? ''),
  );

  const lanes: Lane[] = [];
  const blocks: Block[] = [];
  for (const [venueId, list] of venueOrder) {
    const venue = venueById.get(venueId)!;
    const venueName = venue.data.shortName ?? venue.data.name;
    // Rooms in order of first appearance; events with no room share the venue's main lane.
    // Rooms keyed by a normalised name so "Paramount" and "Paramount Room" share a lane.
    const rooms = new Map<string, { label: string; events: EventEntry[] }>();
    for (const e of list.sort((a, b) => mins(a.data.start!) - mins(b.data.start!))) {
      const label = e.data.location ?? '';
      const key = label
        .toLowerCase()
        .replace(/^the\s+/, '')
        .replace(/\s+(room|bar|lounge)$/, '')
        .trim();
      const entry = rooms.get(key) ?? { label, events: [] };
      entry.events.push(e);
      rooms.set(key, entry);
    }
    let firstLaneOfVenue = true;
    for (const [, { label: room, events: roomEvents }] of rooms) {
      // Greedy lane packing for overlaps within a room.
      const laneEnds: number[] = [];
      const laneIndexes: number[] = [];
      for (const e of roomEvents) {
        const startMin = mins(e.data.start!);
        let endMin = e.data.end ? mins(e.data.end) : startMin + DEFAULT_LEN;
        if (endMin <= startMin) endMin += 24 * 60;
        let k = laneEnds.findIndex((end) => end <= startMin);
        if (k === -1) {
          k = laneEnds.length;
          laneEnds.push(0);
          lanes.push({
            index: lanes.length,
            venueId,
            label: firstLaneOfVenue ? venueName : room || 'also',
            sub: firstLaneOfVenue ? room : '',
            first: firstLaneOfVenue,
          });
          laneIndexes.push(lanes.length - 1);
          firstLaneOfVenue = false;
        }
        laneEnds[k] = endMin;
        const startSlot = slotOf(startMin);
        const endSlot = Math.max(startSlot + MIN_SLOTS, slotOf(endMin));
        blocks.push({ event: e, lane: laneIndexes[k], startSlot, endSlot: Math.min(SLOTS, endSlot), startMin, endMin });
      }
    }
  }
  return { lanes, blocks, tba };
}

/** Hour labels for the header row: 9am, 10am, ... 1am. */
export function hourMarks(): { slot: number; label: string }[] {
  const out: { slot: number; label: string }[] = [];
  for (let m = GRID_START; m < GRID_END; m += 60) {
    const h = (m / 60) % 24;
    const label = h === 0 ? '12am' : h === 12 ? 'noon' : h < 12 ? `${h}am` : `${h - 12}pm`;
    out.push({ slot: (m - GRID_START) / SLOT, label });
  }
  return out;
}
