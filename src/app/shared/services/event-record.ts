import type { CalendarEvent } from 'angular-calendar';

// Timed events are instants, not date-only strings or server-local wall times.
export function encodeEvent(event: CalendarEvent) {
  const start = event.start.getTime();
  const end = (event.end || event.start).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw new Error('Choose a valid end time at or after the start.');
  }
  if (event.allDay) throw new Error('All-day events need a date-only model and are not supported yet.');
  const title = event.title.trim();
  if (!title || title.length > 200) throw new Error('Use a title between 1 and 200 characters.');
  return { title, start, end };
}

export function decodeEvent(id: string, value: any): CalendarEvent {
  const instant = (raw: unknown) => {
    if (typeof raw !== 'number' && !(typeof raw === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(raw))) {
      throw new Error('An event has an ambiguous date. Export and repair it before editing.');
    }
    return new Date(raw);
  };
  const event: CalendarEvent = { id, title: value.title, start: instant(value.start),
    end: instant(value.end ?? value.start), allDay: value.allDay,
    meta: { version: value.version ?? 0 }, draggable: true,
    resizable: { beforeStart: true, afterEnd: true } };
  encodeEvent(event);
  return event;
}
