import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { CalendarEvent } from 'angular-calendar';
import { BehaviorSubject } from 'rxjs';
import { decodeEvent, encodeEvent } from './event-record';
import { BrowserQueue, EventRecord, PendingEdit, flushQueue, transactionValue } from './offline-queue';

@Injectable({ providedIn: 'root' })
export class CrudService {
  private queue = new BrowserQueue();
  private uid: string | null = null;
  private records: Record<string, EventRecord> = {};
  private connected = false;
  private flushing = false;
  private rerun = false;
  private generation = 0;
  private detach: () => void = () => {};
  private events = new BehaviorSubject<CalendarEvent[]>([]);
  readonly sync = new BehaviorSubject<{ online: boolean; edits: PendingEdit[]; error: string }>({ online: false, edits: [], error: '' });

  constructor(private db: AngularFireDatabase, private auth: AngularFireAuth) {
    this.db.database.ref('.info/connected').on('value', snapshot => {
      this.connected = snapshot.val() === true;
      void this.refresh().then(() => this.flush()).catch(error => this.failure(error));
    });
    this.auth.authState.subscribe(user => { void this.selectUser(user?.uid || null).catch(error => this.failure(error)); });
    // Another tab may have queued or resolved a draft. Reconcile when returning to this tab.
    window.addEventListener('focus', () => { void this.refresh().then(() => this.flush()).catch(error => this.failure(error)); });
  }
  private failure(error: any) { this.sync.next({ ...this.sync.value, error: error.message || 'Sync failed. Your draft remains on this device.' }); }
  private async selectUser(uid: string | null) {
    this.detach(); this.uid = uid; const generation = ++this.generation;
    this.records = {}; this.events.next([]); this.sync.next({ online: this.connected, edits: [], error: '' });
    if (!uid) return;
    const cached = await this.queue.snapshot(uid);
    if (generation !== this.generation) return;
    this.records = cached; await this.refresh();
    if (generation !== this.generation) return;
    const ref = this.db.database.ref(`${uid}/events`);
    const handler = (snapshot: any) => {
      if (generation !== this.generation) return;
      this.records = snapshot.val() || {};
      void this.queue.cache(uid, this.records).then(() => this.refresh()).catch(error => this.failure(error));
    };
    ref.on('value', handler, error => this.failure(error));
    this.detach = () => ref.off('value', handler);
    await this.flush();
  }
  GetEventsList() { return this.events.asObservable(); }
  private async refresh() {
    const uid = this.uid;
    if (!uid) return;
    const edits = await this.queue.list(uid);
    if (uid !== this.uid) return;
    const visible = { ...this.records };
    for (const edit of edits) if (edit.status === 'pending') visible[edit.eventId] = edit.record;
    this.events.next(Object.entries(visible).filter(([, record]) => !record.deleted).map(([id, record]) => decodeEvent(id, record)));
    this.sync.next({ online: this.connected, edits, error: '' });
  }
  async saveEvent(event: CalendarEvent, deleted = false) {
    const uid = this.uid;
    if (!uid) throw new Error('Sign in to edit your calendar.');
    const id = event.id == null ? this.db.database.ref(`${uid}/events`).push().key! : String(event.id);
    const expected = event.meta?.version ?? 0;
    const record = { ...encodeEvent(event), version: expected, deleted };
    await this.queue.add({ key: `${uid}/${id}`, uid, eventId: id, expected, record, operationId: crypto.randomUUID(), status: 'pending' });
    if (uid !== this.uid) throw new Error('Account changed. The draft belongs to the previous account.');
    await this.refresh();
    void this.flush();
    return decodeEvent(id, record);
  }
  async flush() {
    if (this.flushing) { this.rerun = true; return; }
    if (!this.uid || !this.connected) return;
    this.rerun = false;
    const uid = this.uid;
    this.flushing = true;
    try {
      await flushQueue(this.queue, { commit: async edit => {
        const ref = this.db.database.ref(`${edit.uid}/events/${edit.eventId}`);
        const result = await ref.transaction(current => transactionValue(current, edit), undefined, false);
        const current = result.snapshot.val();
        if (edit.uid === this.uid && current) this.records[edit.eventId] = current;
        return result.committed || current?.operationId === edit.operationId ? 'saved' : 'conflict';
      } }, uid, () => uid === this.uid && this.connected);
      await this.refresh();
    } catch (error) { this.failure(error); }
    finally { this.flushing = false; }
    if (uid !== this.uid || this.rerun) void this.flush();
  }
  async discard(edit: PendingEdit) {
    if (edit.uid !== this.uid || edit.status !== 'conflict') return;
    await this.queue.remove(edit); await this.refresh();
  }
}
