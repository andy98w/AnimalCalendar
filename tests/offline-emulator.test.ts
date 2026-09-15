import 'fake-indexeddb/auto';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { ref, set, get, runTransaction, goOffline, goOnline } from 'firebase/database';
import { BrowserQueue, flushQueue, transactionValue, PendingEdit } from '../src/app/shared/services/offline-queue';
if(!process.env.FIREBASE_DATABASE_EMULATOR_HOST) throw Error('Disposable emulator required');
let env: any;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-animalcalendar',database:{rules:readFileSync('database.rules.json','utf8')}});});
after(async()=>{await env?.cleanup();});
const initial={title:'Vet',start:1,end:2,version:1,deleted:false};
const transport=(db:any)=>({commit:async(edit:PendingEdit):Promise<'saved'|'conflict'>=>{
 const result=await runTransaction(ref(db,`${edit.uid}/events/${edit.eventId}`),current=>transactionValue(current,edit),{applyLocally:false});
 return result.committed||result.snapshot.val()?.operationId===edit.operationId?'saved':'conflict';
}});
for(const remoteDelete of [false,true]) test(`offline draft conflicts with another client ${remoteDelete?'deletion':'edit'}`,async()=>{
 const uid=remoteDelete?'offline-delete':'offline-edit';
 const a=env.authenticatedContext(uid).database(),b=env.authenticatedContext(uid).database();
 const path=`${uid}/events/event`;await set(ref(a,path),initial);await get(ref(a,path));goOffline(a);
 const draft:PendingEdit={key:`${uid}/event`,uid,eventId:'event',operationId:'local',expected:1,status:'pending',record:{...initial,title:'Local draft'}};
 await new BrowserQueue().add(draft);
 await set(ref(b,path),{...initial,title:'Remote version',version:2,deleted:remoteDelete});
 goOnline(a);const restored=new BrowserQueue();await flushQueue(restored,transport(a),uid,()=>true);
 assert.equal((await restored.list(uid))[0].status,'conflict');
 const current=(await get(ref(b,path))).val();assert.equal(current.version,2);assert.equal(current.deleted,remoteDelete);assert.equal(current.title,'Remote version');
});
test('successful reconnect and lost acknowledgement replay increment only once',async()=>{
 const uid='replay';const a=env.authenticatedContext(uid).database(),b=env.authenticatedContext(uid).database();
 await set(ref(a,`${uid}/events/event`),initial);goOffline(a);
 const draft:PendingEdit={key:`${uid}/event`,uid,eventId:'event',operationId:'stable-operation',expected:1,status:'pending',record:{...initial,title:'Offline change'}};
 const queue=new BrowserQueue();await queue.add(draft);goOnline(a);
 // Server accepted, but simulate losing the acknowledgement before local deletion.
 assert.equal(await transport(a).commit(draft),'saved');
 await flushQueue(new BrowserQueue(),transport(b),uid,()=>true);
 assert.deepEqual(await queue.list(uid),[]);
 const current=(await get(ref(b,`${uid}/events/event`))).val();assert.equal(current.version,2);assert.equal(current.title,'Offline change');
});
