import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { CalendarEvent } from 'angular-calendar';
import { from } from 'rxjs';
import { decodeEvent, encodeEvent } from './event-record';

@Injectable({ providedIn: 'root' })
export class CrudService {
  constructor(private db: AngularFireDatabase, private auth: AngularFireAuth) {}

  private async events() {
    const user = await this.auth.currentUser;
    if (!user) throw new Error('Sign in to view your calendar.');
    return this.db.database.ref(`${user.uid}/events`);
  }

  GetEventsList() { return from(this.loadEvents()); }

  private async loadEvents(): Promise<CalendarEvent[]> {
    const snapshot = await (await this.events()).once('value');
    return Object.entries(snapshot.val() || {})
      .filter(([, value]: [string, any]) => !value.deleted)
      .map(([id, value]) => decodeEvent(id, value));
  }

  async saveEvent(event: CalendarEvent, deleted = false) {
    const events = await this.events();
    const ref = event.id == null ? events.push() : events.child(String(event.id));
    const expected = event.meta?.version ?? 0;
    const record = { ...encodeEvent(event), version: expected + 1, deleted };
    const result = await ref.transaction(current => {
      // An uncached transaction can first receive null; the server retries it
      // against current data. Rules reject recreating a missing version > 1.
      if ((current && (current.version ?? 0) !== expected) || current?.deleted) return undefined;
      return record;
    }, undefined, false);
    if (!result.committed) throw new Error('This event changed elsewhere. Reload before editing.');
    return decodeEvent(ref.key!, result.snapshot.val());
  }
}
