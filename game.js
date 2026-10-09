import {WORLDS,TOPICS,GRADE_HINTS,DESCRIPTIONS,timeLimit,generateQuestion,isCorrect,attackDamage,enemyFor,ENEMIES} from './math.js';
import {levelInfo,questionXP} from './progression.js';
import {MathAccount,validSnapshot} from './account.js';
const $=id=>document.getElementById(id);
const SAVE_KEY='jay-math-progress-v1';
let storage=null;try{storage=localStorage;}catch{}
const account=new MathAccount(globalThis.fetch.bind(globalThis),storage);
let practiceAllowed=false,syncState='guest';
function guestSnapshot(){try{return validSnapshot({totalXP:Number(storage?.getItem('jay-math-xp-v1')||0),progress:JSON.parse(storage?.getItem(SAVE_KEY)||'{}')});}catch{return {totalXP:0,progress:{}};}}
let {progress,totalXP}=guestSnapshot(),earnedXP=0,toastTimeout;
function persist(){const snapshot={totalXP,progress};if(account.profile){account.enqueue(snapshot);}else{try{storage?.setItem(SAVE_KEY,JSON.stringify(progress));storage?.setItem('jay-math-xp-v1',String(totalXP));}catch{}}}
function renderGrowth(){const info=levelInfo(totalXP);$('level-label').textContent=`Lv. ${info.level}`;$('xp-text').textContent=`${info.xp} / ${info.required} XP`;$('xp-fill').style.width=`${info.xp/info.required*100}%`;$('hero-level').textContent=`루나 · Lv. ${info.level}`;}
function gainXP(amount){const before=levelInfo(totalXP).level;totalXP+=amount;earnedXP+=amount;persist();renderGrowth();const info=levelInfo(totalXP);if(info.level>before){playerHP=Math.min(120,playerHP+15);refreshHP();$('level-toast').textContent=`✦ LEVEL UP! Lv. ${info.level} · 공격력 +${info.attackBonus} · 체력 15 회복`;$('level-toast').hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>{$('level-toast').hidden=true;},2600);tone('critical');}}
let grade=1,stage=1,state='map',round=1,playerHP=120,enemyHP=0,enemyMax=0,combo=0,bestCombo=0,score=0,correct=0,attempts=0,input='',current,next,limit=18,started=0,remaining=0,animationTimeout,raf=0,sound=false,audio;
function saveProgress(stars){const key=`${grade}-${stage}`;const previous=progress[key]||{};progress[key]={stars:Math.max(previous.stars||0,stars),score:Math.max(previous.score||0,score),bestCombo:Math.max(previous.bestCombo||0,bestCombo)};persist();}
function renderMap(){
 $('grades').innerHTML=GRADE_HINTS.map((hint,i)=>`<button class="grade-button ${grade===i+1?'active':''}" data-grade="${i+1}" aria-pressed="${grade===i+1}"><span class="grade-number">${i+1}</span><span>학년<small>${hint}</small></span></button>`).join('');
 $('world-label').textContent=`GRADE ${String(grade).padStart(2,'0')} · ${grade}학년 모험`;
 $('world-name').textContent=WORLDS[grade-1];
 $('world-progress').textContent=`${Object.keys(progress).filter(k=>k.startsWith(grade+'-')&&progress[k]?.stars>0).length} / 6 완료`;
 $('stages').innerHTML=TOPICS[grade-1].map((name,i)=>{const stars=progress[`${grade}-${i+1}`]?.stars||0;return `<button class="stage-node ${stage===i+1?'active':''} ${i===5?'boss':''}" data-stage="${i+1}" aria-pressed="${stage===i+1}" aria-label="${i+1}단계 ${name}${i===5?' 보스':''}${stars?`, ${stars}별 완료`:''}"><span class="node-number">${i===5?'♛':String(i+1).padStart(2,'0')}</span><span class="node-title">${name}</span><span class="node-stars ${stars?'complete':''}">${'★'.repeat(stars)+'☆'.repeat(3-stars)}</span></button>`;}).join('');
 $('selected-label').textContent=`STAGE ${String(stage).padStart(2,'0')}${stage===6?' · BOSS':''}`;
 $('selected-title').textContent=TOPICS[grade-1][stage-1];$('stage-time').textContent=`${timeLimit(grade,stage)}초`;$('selected-desc').textContent=DESCRIPTIONS[grade-1][stage-1];
 document.querySelector('.preview-monster .sprite').className=`sprite sprite-${enemyFor(grade,stage,3)}`;
}
function tone(type){if(!sound)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const o=audio.createOscillator(),gain=audio.createGain();o.connect(gain);gain.connect(audio.destination);o.type='sine';o.frequency.setValueAtTime(type==='bad'?170:type==='critical'?880:520,audio.currentTime);o.frequency.exponentialRampToValueAtTime(type==='bad'?80:1040,audio.currentTime+.13);gain.gain.setValueAtTime(.065,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.2);o.start();o.stop(audio.currentTime+.22);}catch{}}
function animate(id,name){const el=$(id);el.classList.remove(name);void el.offsetWidth;el.classList.add(name);}
function showInput(){ $('answer').textContent=input||'?'; }
function refreshHP(){ $('player-hp').style.width=`${Math.max(0,playerHP)/120*100}%`;$('player-hp-text').textContent=`${Math.max(0,playerHP)} / 120`;$('enemy-hp').style.width=`${Math.max(0,enemyHP)/enemyMax*100}%`;$('enemy-hp-text').textContent=`${Math.max(0,enemyHP)} / ${enemyMax}`; }
function resetAnimation(){clearTimeout(animationTimeout);cancelAnimationFrame(raf);['hero','monster'].forEach(id=>$(id).classList.remove('hit','attacking'));$('damage').classList.remove('show');$('attack-fx').classList.remove('flash');}
function showMap(){resetAnimation();state='map';for(const id of ['pause-dialog','result-dialog','help-dialog'])$(id).close();$('battle').hidden=true;$('map').hidden=false;renderMap();}
function spawnEnemy(){const key=enemyFor(grade,stage,round);enemyMax=(round===3?100:65)+stage*7+(stage===6&&round===3?35:0);enemyHP=enemyMax;$('enemy-name').textContent=ENEMIES[key].name;$('enemy-tag').textContent=ENEMIES[key].tag;$('enemy-sprite').className=`sprite sprite-${key}`;$('round-label').textContent=`ROUND ${round} / 3`;refreshHP();}
function startBattle(){if(!account.profile&&!practiceAllowed||account.conflict){openAccount();return;}resetAnimation();for(const id of ['pause-dialog','result-dialog'])$(id).close();$('map').hidden=true;$('battle').hidden=false;round=1;playerHP=120;earnedXP=0;combo=0;bestCombo=0;score=0;correct=0;attempts=0;limit=timeLimit(grade,stage);$('battle-location').textContent=`${grade}학년 · ${WORLDS[grade-1]} · ${stage}단계`;$('combo-count').textContent='0';$('score').textContent='0 점';$('combo-note').textContent='연속 정답에 도전!';spawnEnemy();current=generateQuestion(grade,stage);next=generateQuestion(grade,stage);newQuestion(false);}
function newQuestion(advance=true){if(advance){current=next;next=generateQuestion(grade,stage);}state='playing';input='';showInput();$('submit').disabled=false;$('question-topic').textContent=current.topic;$('question-text').textContent=current.text;$('question-text').classList.toggle('word',current.word);$('next-text').textContent=next.text;$('critical-hint').textContent=`${(limit*.35).toFixed(1)}초 안에 맞히면 크리티컬 · 3연속마다 추가 피해`;$('input-hint').textContent=grade>=3?'분수는 1/2, 소수는 0.5로 입력해요.':'숫자를 입력하고 공격을 눌러요.';$('feedback').textContent='문제를 풀어 공격해요!';started=performance.now();tick();}
function tick(){if(state!=='playing')return;remaining=Math.max(0,limit-(performance.now()-started)/1000);$('time-text').textContent=`${remaining.toFixed(1)}초`;$('timer-bar').style.transform=`scaleX(${remaining/limit})`;$('timer-bar').classList.toggle('urgent',remaining<limit*.25);if(remaining<=0){resolve(false,true);return;}raf=requestAnimationFrame(tick);}
function key(k){if(state!=='playing')return;if(k==='back')input=input.slice(0,-1);else if(k==='clear')input='';else if(input.length<12){if(/^\d$/.test(k))input+=k;else if(k==='.'&&input&&!input.split('/').at(-1).includes('.'))input+='.';else if(k==='/'&&input&&!input.includes('/')&&!input.endsWith('.'))input+='/';}showInput();}
function submit(){if(state!=='playing'||!input)return;const elapsed=(performance.now()-started)/1000;if(elapsed>=limit)resolve(false,true);else resolve(isCorrect(input,current));}
function resolve(ok,timeout=false){
 if(state!=='playing')return;state='resolving';cancelAnimationFrame(raf);$('submit').disabled=true;attempts++;
 if(ok){correct++;combo++;bestCombo=Math.max(combo,bestCombo);const hit=attackDamage(stage,combo,(performance.now()-started)/1000,limit);hit.damage+=levelInfo(totalXP).attackBonus;enemyHP=Math.max(0,enemyHP-hit.damage);gainXP(questionXP(grade,hit.critical,hit.bonus));score+=100+(hit.critical?50:0)+(hit.bonus?30:0);$('feedback').textContent=hit.bonus?`${combo} 콤보! 연속 공격!`:hit.critical?'크리티컬! 아주 빨랐어요!':'정답! 공격 성공!';$('damage').textContent=`${hit.critical?'CRITICAL ':''}−${hit.damage}`;$('damage').style.left='70%';$('damage').style.color='var(--gold)';animate('hero','attacking');animate('monster','hit');animate('attack-fx','flash');tone(hit.critical?'critical':'good');}
 else{combo=0;playerHP=Math.max(0,playerHP-(18+stage*2));$('feedback').textContent=`${timeout?'시간 초과!':'아쉬워요!'} 정답은 ${current.display}`;$('damage').textContent=`−${18+stage*2}`;$('damage').style.left='23%';$('damage').style.color='#ffa88a';animate('monster','attacking');animate('hero','hit');tone('bad');}
 animate('damage','show');animate('combo-count','pulse');$('combo-count').textContent=combo;$('combo-note').textContent=combo?`${3-combo%3}번 더 맞히면 연속 공격`:'다시 콤보를 쌓아봐요';$('score').textContent=`${score.toLocaleString()} 점`;refreshHP();
 animationTimeout=setTimeout(()=>{if(state!=='resolving')return;if(playerHP<=0){finish(false);return;}if(enemyHP<=0){if(round===3){finish(true);return;}gainXP(15+grade*5);round++;spawnEnemy();}newQuestion();},ok?850:2100);
}
function finish(win){state='result';cancelAnimationFrame(raf);const accuracy=attempts?correct/attempts:0,stars=win?(accuracy>=.95?3:accuracy>=.75?2:1):0;if(win){gainXP(60+stage*10);saveProgress(stars);}$('result-label').textContent=win?'STAGE CLEAR':'TRY AGAIN';$('result-title').textContent=win?'모험 성공!':'다시 도전해 볼까요?';$('result-stars').textContent=win?'★'.repeat(stars)+'☆'.repeat(3-stars):'✦';$('result-message').textContent=win?`${grade}학년 ${stage}단계의 몬스터를 모두 물리쳤어요!`:'틀린 문제의 정답을 떠올리며 다시 도전해요.';$('result-score').textContent=score.toLocaleString();$('result-xp').textContent=`+${earnedXP}`;$('result-combo').textContent=bestCombo;$('result-accuracy').textContent=`${Math.round(accuracy*100)}%`;$('next-stage').hidden=!win||grade===6&&stage===6;$('next-stage').textContent=stage===6?'다음 학년':'다음 단계';$('result-dialog').showModal();}
function pause(){if(state==='resolving'){resetAnimation();state='pausedTransition';$('pause-dialog').showModal();return;}if(state!=='playing')return;remaining=Math.max(0,limit-(performance.now()-started)/1000);if(remaining===0){resolve(false,true);return;}cancelAnimationFrame(raf);state='paused';$('pause-dialog').showModal();}
function resume(){if(account.conflict){openAccount();return;}if(state!=='paused')return;$('pause-dialog').close();started=performance.now()-(limit-remaining)*1000;state='playing';tick();}
$('grades').addEventListener('click',e=>{const b=e.target.closest('[data-grade]');if(b){grade=Number(b.dataset.grade);stage=1;renderMap();}});
$('stages').addEventListener('click',e=>{const b=e.target.closest('[data-stage]');if(b){stage=Number(b.dataset.stage);renderMap();}});
document.querySelectorAll('[data-key]').forEach(b=>b.addEventListener('click',()=>key(b.dataset.key)));
$('start').onclick=startBattle;$('submit').onclick=submit;$('back-map').onclick=()=>{pause();if(state==='resolving'){resetAnimation();state='pausedTransition';$('pause-dialog').showModal();}};
$('pause').onclick=pause;$('resume').onclick=()=>{if(account.conflict){openAccount();return;}if(state==='pausedTransition'){$('pause-dialog').close();if(playerHP<=0)finish(false);else if(enemyHP<=0){if(round===3)finish(true);else{gainXP(15+grade*5);round++;spawnEnemy();newQuestion();}}else newQuestion();}else resume();};$('leave').onclick=showMap;
$('retry').onclick=startBattle;$('result-map').onclick=showMap;$('next-stage').onclick=()=>{if(stage<6)stage++;else{grade++;stage=1;}startBattle();};
$('sound').onclick=()=>{sound=!sound;$('sound').textContent=sound?'♪ 소리 켜짐':'♪ 소리 꺼짐';$('sound').setAttribute('aria-pressed',String(sound));$('sound').setAttribute('aria-label',sound?'효과음 끄기':'효과음 켜기');if(sound)tone('good');};
$('help').onclick=()=>{if(state==='playing'||state==='resolving')pause();$('help-dialog').showModal();};document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
$('pause-dialog').addEventListener('cancel',e=>{e.preventDefault();$('resume').click();});$('result-dialog').addEventListener('cancel',e=>{e.preventDefault();showMap();});
document.addEventListener('keydown',e=>{if($('help-dialog').open||$('pause-dialog').open||$('result-dialog').open||$('account-dialog').open)return;if(state==='playing'&&(/^[0-9./]$/.test(e.key)||['Enter','Backspace','Delete','Escape'].includes(e.key))){e.preventDefault();if(e.key==='Enter')submit();else if(e.key==='Backspace')key('back');else if(e.key==='Delete')key('clear');else if(e.key==='Escape')pause();else key(e.key);}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
renderMap();renderGrowth();

function applySnapshot(snapshot){const valid=validSnapshot(snapshot);totalXP=valid.totalXP;progress=valid.progress;renderMap();renderGrowth();}
function renderAccount(){
 const logged=!!account.profile;
 $('login-fields').hidden=logged;$('account-fields').hidden=!logged;
 $('account-heading').textContent=logged?`${account.profile.display_name}님의 모험`:'같은 계정, 새로운 모험';
 $('account-button').textContent=logged?account.profile.display_name:'JAY RPG 로그인';
 $('account-button').title=logged?`${account.profile.display_name} · ${$('sync-status').textContent}`:'JAY RPG 계정으로 로그인';
 $('account-status').textContent=logged?`${account.profile.display_name}님 · JAY RPG 계정으로 이어하는 중`:'연습 기록은 이 기기에 저장돼요. 로그인하면 다른 기기에서도 이어할 수 있어요.';
 $('save-caption').textContent=logged?'모험 기록을 계정에 저장해요.':'완료 기록은 이 기기에 저장돼요.';
 $('account-summary').textContent=logged?`수학게임 Lv. ${levelInfo(totalXP).level} · ${totalXP} XP. RPG 캐릭터의 레벨과 장비는 별도로 유지돼요.`:'';
 $('reload-cloud').hidden=!account.conflict;$('sync-retry').hidden=account.conflict;$('keep-backup-logout').hidden=!['offline','conflict','expired'].includes(syncState);
 let claim=null;try{claim=storage?.getItem('jay-math-practice-owner');}catch{}
 const guest=guestSnapshot();$('import-practice').hidden=!logged||account.conflict||(!guest.totalXP&&!Object.keys(guest.progress).length)||claim&&claim!==account.profile.user_id||totalXP>=guest.totalXP&&Object.keys(guest.progress).every(k=>progress[k]&&progress[k].stars>=guest.progress[k].stars&&progress[k].score>=guest.progress[k].score);
 $('start').disabled=account.conflict;
}
account.onStatus=(message,type)=>{syncState=type;$('sync-status').textContent=type==='offline'?'오프라인 · 미전송 기록 보관':message;$('sync-status').dataset.state=type;$('account-message').textContent=message;renderAccount();if(type==='conflict'||type==='expired'){pause();openAccount();}};
function openAccount(){if(state==='playing'||state==='resolving')pause();renderAccount();if(!$('account-dialog').open)$('account-dialog').showModal();}
$('account-button').onclick=openAccount;
$('account-close').onclick=()=>{if(!account.profile)practiceAllowed=true;$('account-dialog').close();};
$('account-dialog').addEventListener('cancel',()=>{if(!account.profile)practiceAllowed=true;});
$('practice').onclick=()=>{practiceAllowed=true;$('account-dialog').close();};
try{$('login-id').value=storage?.getItem('jay-math-last-id')||'';}catch{}
$('login-form').onsubmit=async e=>{
 e.preventDefault();$('login-submit').disabled=true;$('account-message').textContent='계정과 모험 기록을 불러오는 중…';
 try{const snapshot=await account.login($('login-id').value,$('login-password').value);$('login-password').value='';showMap();applySnapshot(snapshot);syncState=account.conflict?'conflict':account.pending?'saving':'saved';$('sync-status').textContent=account.conflict?'최신 기록 확인 필요':'계정 기록 불러옴';renderAccount();if(account.revision===0&&!account.pending)persist();if(!account.conflict)$('account-dialog').close();}
 catch(error){$('login-password').value='';$('account-message').textContent=error.message;renderAccount();}
 finally{$('login-submit').disabled=false;}
};
$('sync-retry').onclick=async()=>{try{if(!account.pending)persist();await account.flush();}catch(e){$('account-message').textContent=e.message;}};
$('reload-cloud').onclick=async()=>{const b=$('reload-cloud');b.disabled=true;try{const snapshot=await account.reloadCloud();showMap();applySnapshot(snapshot);syncState='saved';$('sync-status').textContent='최신 기록 불러옴';$('account-message').textContent='이전 미전송 기록은 이 기기에 별도로 보관했어요.';renderAccount();}catch(e){$('account-message').textContent=e.message;}finally{b.disabled=false;}};
async function logout(keepBackup=false){$('logout').disabled=true;try{await account.logout(keepBackup);showMap();applySnapshot(guestSnapshot());practiceAllowed=false;syncState='guest';$('sync-status').textContent='기기 저장';$('account-message').textContent='로그아웃했어요.';renderAccount();}catch(e){$('account-message').textContent=e.message;}finally{$('logout').disabled=false;}}
$('logout').onclick=()=>logout();$('keep-backup-logout').onclick=()=>logout(true);
$('import-practice').onclick=()=>{if(!account.ready)return;const guest=guestSnapshot();for(const [k,v] of Object.entries(guest.progress)){const old=progress[k]||{};progress[k]={stars:Math.max(old.stars||0,v.stars),score:Math.max(old.score||0,v.score),bestCombo:Math.max(old.bestCombo||0,v.bestCombo)};}totalXP=Math.max(totalXP,guest.totalXP);try{storage?.setItem('jay-math-practice-owner',account.profile.user_id);}catch{}persist();renderMap();renderGrowth();renderAccount();$('account-message').textContent='연습 기록을 계정으로 가져왔어요.';};
window.addEventListener('online',()=>{if(account.ready&&account.pending)account.flush().catch(()=>{});});
window.addEventListener('pagehide',()=>{account.backup();});
renderAccount();openAccount();
