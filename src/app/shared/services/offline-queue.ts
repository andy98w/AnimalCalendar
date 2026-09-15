export interface EventRecord { title: string; start: number; end: number; color?: { primary: string; secondary: string }; version: number; deleted: boolean; operationId?: string; }
export interface PendingEdit { key: string; uid: string; eventId: string; operationId: string; expected: number; record: EventRecord; status: 'pending' | 'conflict'; }
export interface QueueStore {
  list(uid: string): Promise<PendingEdit[]>;
  add(edit: PendingEdit): Promise<void>;
  remove(edit: PendingEdit): Promise<void>;
  conflict(edit: PendingEdit): Promise<void>;
}
export interface Transport { commit(edit: PendingEdit): Promise<'saved' | 'conflict'>; }

// Returning undefined aborts; an uncached null is retried by Firebase against server data.
export function transactionValue(current: EventRecord | null, edit: PendingEdit) {
  if (current?.operationId === edit.operationId || current?.deleted || (current && current.version !== edit.expected)) return undefined;
  return { ...edit.record, version: edit.expected + 1, operationId: edit.operationId };
}

export async function flushQueue(store: QueueStore, transport: Transport, uid: string, active: () => boolean) {
  for (const edit of await store.list(uid)) {
    if (!active()) break;
    if (edit.status === 'conflict') continue;
    // Network/auth errors leave the durable draft pending, not falsely marked saved.
    const result = await transport.commit(edit);
    if (result === 'saved') await store.remove(edit);
    else await store.conflict(edit);
  }
}

/** IndexedDB transactions serialize writes from multiple tabs; removal checks operation identity. */
export class BrowserQueue implements QueueStore {
  private database: Promise<IDBDatabase>;
  constructor() {
    this.database = new Promise((resolve, reject) => {
      const request = indexedDB.open('animal-calendar-offline-v1', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('edits', { keyPath: 'key' });
        request.result.createObjectStore('snapshots');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Local storage is unavailable. Your edit has not been saved.'));
    });
  }
  private async transaction<T>(name: string, mode: IDBTransactionMode, work: (store: IDBObjectStore, done: (value: T) => void) => void): Promise<T> {
    const db = await this.database;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(name, mode);
      let value: T;
      transaction.oncomplete = () => resolve(value);
      transaction.onerror = () => reject(new Error('Could not save the local draft. Resolve any existing draft for this event first.'));
      transaction.onabort = () => reject(new Error('Local draft write was interrupted.'));
      work(transaction.objectStore(name), result => { value = result; });
    });
  }
  list(uid: string): Promise<PendingEdit[]> {
    return this.transaction('edits', 'readonly', (store, done) => {
      const request = store.getAll();
      request.onsuccess = () => done(request.result.filter((edit: PendingEdit) => edit.uid === uid));
    });
  }
  add(edit: PendingEdit): Promise<void> {
    // One unresolved draft per event. Never replace a possibly in-flight write.
    return this.transaction('edits', 'readwrite', store => { store.add(edit); });
  }
  private change(edit: PendingEdit, conflict: boolean): Promise<void> {
    return this.transaction('edits', 'readwrite', store => {
      const request = store.get(edit.key);
      request.onsuccess = () => {
        if (request.result?.operationId !== edit.operationId) return;
        if (conflict) store.put({ ...request.result, status: 'conflict' });
        else store.delete(edit.key);
      };
    });
  }
  remove(edit: PendingEdit) { return this.change(edit, false); }
  conflict(edit: PendingEdit) { return this.change(edit, true); }
  snapshot(uid: string): Promise<Record<string, EventRecord>> {
    return this.transaction('snapshots', 'readonly', (store, done) => {
      const request = store.get(uid); request.onsuccess = () => done(request.result || {});
    });
  }
  cache(uid: string, records: Record<string, EventRecord>): Promise<void> {
    return this.transaction('snapshots', 'readwrite', store => { store.put(records, uid); });
  }
}
