import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BrowserQueue, flushQueue, transactionValue, PendingEdit } from '../src/app/shared/services/offline-queue';
const edit = (uid: string, operationId = 'op-1'): PendingEdit => ({key: `${uid}/event`,uid,eventId:'event',operationId,expected:1,status:'pending',record:{title:'Vet',start:1,end:2,version:1,deleted:false}});

test('draft survives a new queue instance, with account-scoped listing and snapshots',async()=>{
  const queue=new BrowserQueue(); await queue.add(edit('reload'));
  await queue.cache('reload',{event:edit('reload').record});
  const restored=new BrowserQueue();assert.equal((await restored.list('reload')).length,1);
  assert.deepEqual(await restored.list('other'),[]);
  assert.equal((await restored.snapshot('reload')).event.title,'Vet');
  assert.deepEqual(await restored.snapshot('other'),{});
});
test('multiple tabs cannot replace an unresolved draft or delete a newer operation',async()=>{
  const a=new BrowserQueue(),b=new BrowserQueue(),first=edit('tabs');await a.add(first);
  await assert.rejects(b.add(edit('tabs','other')));
  await a.remove(first);const next=edit('tabs','next');await b.add(next);
  await a.remove(first);await a.conflict(first);
  assert.equal((await b.list('tabs'))[0].operationId,'next');
  assert.equal((await b.list('tabs'))[0].status,'pending');
});
test('network errors retain drafts and conflicts wait for explicit discard',async()=>{
  const queue=new BrowserQueue();const draft=edit('errors');await queue.add(draft);
  await assert.rejects(flushQueue(queue,{commit:async()=>{throw Error('offline');}},draft.uid,()=>true));
  assert.equal((await queue.list(draft.uid))[0].status,'pending');
  await flushQueue(queue,{commit:async()=> 'conflict'},draft.uid,()=>true);
  await flushQueue(queue,{commit:async()=>{throw Error('must not retry conflict');}},draft.uid,()=>true);
  assert.equal((await queue.list(draft.uid))[0].status,'conflict');
  await queue.remove(draft);assert.deepEqual(await queue.list(draft.uid),[]);
});
test('account change stops processing; stale writes and tombstones cannot be overwritten',async()=>{
  const queue=new BrowserQueue();const draft=edit('stopped');await queue.add(draft);
  await flushQueue(queue,{commit:async()=>{throw Error('wrong account');}},draft.uid,()=>false);
  assert.equal((await queue.list(draft.uid)).length,1);
  assert.equal(transactionValue({...draft.record,version:2},draft),undefined);
  assert.equal(transactionValue({...draft.record,deleted:true},draft),undefined);
  assert.equal(transactionValue({...draft.record,operationId:draft.operationId},draft),undefined);
});
