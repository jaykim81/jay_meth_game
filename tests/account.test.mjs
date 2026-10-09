import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {MathAccount,loginAddress,validSnapshot} from '../dist/account.js';
class MemoryStorage{constructor(){this.data=new Map();}getItem(k){return this.data.get(k)??null;}setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
const uid='b273f889-c703-4c63-a07e-9fc7b0e2b81a';
const session={access_token:'fixture-access',refresh_token:'fixture-refresh',user:{id:uid}};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
function mock(extra=()=>null){return async(url,options)=>{
 const result=await extra(url,options);if(result)return result;
 if(url.includes('grant_type=password'))return json(session);
 if(url.includes('game_profiles'))return json([{user_id:uid,display_name:'Fixture'}]);
 if(url.endsWith('/load_math_state'))return json({totalXP:100,revision:1,progress:{'1-1':{stars:2,score:300,bestCombo:3}}});
 throw new Error('Unexpected API request');
};}
test('shared JAY RPG identity uses normalized SHA256 internal address',async()=>{
 assert.equal(await loginAddress('  Sample_1 '),createHash('sha256').update('sample_1').digest('hex')+'@id.jayrpg.invalid');
 await assert.rejects(loginAddress('admin'));await assert.rejects(loginAddress('bad@email.com'));
});
test('cloud login reads math records and never requests RPG saves',async()=>{
 const urls=[];const storage=new MemoryStorage();const a=new MathAccount(mock(url=>{urls.push(url);}),storage);
 const snapshot=await a.login('fixture','secret-fixture');assert.equal(snapshot.totalXP,100);assert.equal(snapshot.progress['1-1'].bestCombo,3);assert.equal(a.revision,1);
 assert.ok(!urls.some(x=>/game_saves|save_game_state/.test(x)));assert.ok(!JSON.stringify([...storage.data]).includes('fixture-access'));
});
test('failed cloud load clears partially authenticated account',async()=>{
 const a=new MathAccount(mock(url=>url.includes('game_profiles')?json([]):null),new MemoryStorage());
 await assert.rejects(a.login('fixture','secret-fixture'));assert.equal(a.session,null);assert.equal(a.profile,null);
});
test('in-flight save serializes newer snapshots with fresh revision',async()=>{
 let release;let body1;const bodies=[];
 const a=new MathAccount(mock((url,o)=>{if(url.endsWith('/save_math_state')){const body=JSON.parse(o.body);bodies.push(body);if(!body1){body1=body;return new Promise(r=>release=()=>r(json(2)));}return json(3);}}),new MemoryStorage());
 await a.login('fixture','secret-fixture');a.enqueue({totalXP:120,progress:{}});const flush=a.flush();await new Promise(r=>setTimeout(r,0));a.enqueue({totalXP:140,progress:{}});release();await flush;clearTimeout(a.timer);
 assert.deepEqual(bodies.map(x=>x.p_expected_revision),[1,2]);assert.deepEqual(bodies.map(x=>x.p_total_xp),[120,140]);assert.equal(a.pending,null);assert.equal(a.revision,3);
});
test('conflicting save retains account backup and blocks overwriting',async()=>{
 const storage=new MemoryStorage();const a=new MathAccount(mock(url=>url.endsWith('/save_math_state')?json({message:'MATH_SAVE_CONFLICT'},409):null),storage);
 await a.login('fixture','secret-fixture');a.enqueue({totalXP:200,progress:{}});await assert.rejects(a.flush());assert.ok(a.conflict);assert.equal(JSON.parse(storage.getItem(a.backupKey())).snapshot.totalXP,200);
 await a.logout(true);assert.equal(a.profile,null);assert.ok(storage.getItem('jay-math-unsent-v1.'+uid));
});
test('network failure preserves pending snapshot for retry',async()=>{
 const storage=new MemoryStorage();const a=new MathAccount(mock(url=>{if(url.endsWith('/save_math_state'))throw Error('offline');}),storage);
 await a.login('fixture','secret-fixture');a.enqueue({totalXP:200,progress:{}});await assert.rejects(a.flush());assert.equal(a.conflict,false);assert.ok(a.pending);clearTimeout(a.timer);assert.ok(storage.getItem(a.backupKey()));
});
test('expired access token refreshes once and persists no session secrets',async()=>{
 let failed=false,refreshes=0;const storage=new MemoryStorage();const a=new MathAccount(mock((url,o)=>{
 if(url.includes('grant_type=refresh_token')){refreshes++;return json({...session,access_token:'new-access'});}
 if(url.endsWith('/save_math_state')){if(!failed){failed=true;return json({},401);}assert.equal(o.headers.Authorization,'Bearer new-access');return json(2);}
 }),storage);await a.login('fixture','secret-fixture');a.enqueue({totalXP:200,progress:{}});await a.flush();assert.equal(refreshes,1);assert.ok(!JSON.stringify([...storage.data]).includes('new-access'));clearTimeout(a.timer);
});
test('local backups are isolated by account and stale backups require reload',async()=>{
 const storage=new MemoryStorage();storage.setItem('jay-math-unsent-v1.other-user',JSON.stringify({revision:1,snapshot:{totalXP:9999,progress:{}}}));
 const a=new MathAccount(mock(),storage);assert.equal((await a.login('fixture','secret-fixture')).totalXP,100);
 storage.setItem(a.backupKey(),JSON.stringify({revision:0,snapshot:{totalXP:999,progress:{}}}));await a.load();assert.ok(a.conflict);
 assert.equal((await a.reloadCloud()).totalXP,100);assert.ok(!a.conflict);assert.ok(storage.getItem(a.backupKey()+'.conflict'));
});
test('untrusted local snapshot is bounded and cannot inject map markup',()=>{
 const value=validSnapshot({totalXP:Infinity,progress:{'<script>':{stars:3,score:1},'1-1':{stars:99,score:1},'1-2':{stars:2,score:-1,bestCombo:5}}});
 assert.equal(value.totalXP,0);assert.deepEqual(Object.keys(value.progress),['1-2']);assert.equal(value.progress['1-2'].score,0);
});
