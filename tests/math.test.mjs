import test from 'node:test';
import assert from 'node:assert/strict';
import {generateQuestion,isCorrect,parseAnswer,attackDamage,timeLimit,TOPICS} from '../dist/math.js';
import {levelInfo,questionXP} from '../dist/progression.js';
test('all 36 curriculum stages produce valid questions and accept their exact answers',()=>{
 let seed=43521;const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
 for(let grade=1;grade<=6;grade++)for(let stage=1;stage<=6;stage++)for(let i=0;i<150;i++){
  const q=generateQuestion(grade,stage,rng);assert.ok(Number.isFinite(q.answer)&&q.answer>=0,`${grade}-${stage}: ${q.text}`);assert.ok(q.text.length>0);assert.equal(q.topic,TOPICS[grade-1][stage-1]);assert.ok(isCorrect(q.display,q),`${q.text} => ${q.display}, expected ${q.answer}`);assert.ok(!isCorrect(String(q.answer+1),q));assert.ok(timeLimit(grade,stage)>=13);
 }
});
test('equivalent fractions and decimals accepted, invalid input rejected',()=>{
 assert.ok(isCorrect('2/4',{answer:.5}));assert.ok(isCorrect('0.5',{answer:.5}));assert.ok(isCorrect('0.30',{answer:.3}));
 for(const s of ['', '1/0','NaN','Infinity','1+1','1/2/3','1.','0/0','<script>'])assert.equal(parseAnswer(s),null);
});
test('critical timing and every third combo add damage',()=>{
 assert.deepEqual(attackDamage(1,1,2,18),{damage:40,critical:true,bonus:false});assert.deepEqual(attackDamage(1,3,10,18),{damage:34,critical:false,bonus:true});assert.equal(attackDamage(1,3,2,18).damage,54);assert.equal(attackDamage(1,0,10,18).bonus,false);
});
test('XP level boundaries, carry-over, safe persisted data, and rewards',()=>{
 assert.deepEqual(levelInfo(99),{level:1,xp:99,required:100,total:99,attackBonus:0});
 assert.deepEqual(levelInfo(100),{level:2,xp:0,required:140,total:100,attackBonus:1});
 assert.equal(levelInfo(250).level,3);assert.equal(levelInfo(250).xp,10);
 assert.equal(levelInfo(NaN).total,0);assert.equal(levelInfo(-1).level,1);
 assert.equal(questionXP(1,false,false),12);assert.equal(questionXP(6,true,true),32);
});
