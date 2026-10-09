export const projectUrl='https://qymkdanlcykljpqozjnh.supabase.co';
export const publishableKey='sb_publishable_n1y6LDqgZTnmvYFwuO3fxA_stXtqoTc';
export function normalizeId(value){const id=value.trim().toLowerCase();if(!/^[a-z0-9_]{3,24}$/.test(id))throw new Error('아이디는 영문·숫자·밑줄로 3~24자 입력해 주세요.');if(id==='admin')throw new Error('테스트 전용 계정은 사용할 수 없어요.');return id;}
export async function loginAddress(value){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(normalizeId(value)));return Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('')+'@id.jayrpg.invalid';}
export function validSnapshot(value){
 const xp=Number.isSafeInteger(value?.totalXP)&&value.totalXP>=0&&value.totalXP<=1e9?value.totalXP:0;const progress={};
 for(const [key,v] of Object.entries(value?.progress||{})){if(!/^[1-6]-[1-6]$/.test(key)||!v||!Number.isInteger(v.stars)||v.stars<1||v.stars>3)continue;progress[key]={stars:v.stars,score:Number.isInteger(v.score)&&v.score>=0&&v.score<=1e6?v.score:0,bestCombo:Number.isInteger(v.bestCombo)&&v.bestCombo>=0&&v.bestCombo<=1e5?v.bestCombo:0};}
 return {totalXP:xp,progress};
}
function errorFor(data,status){if(status===409)return '다른 기기에서 저장했어요. 최신 기록을 불러온 뒤 다시 시작해주세요.';if(data?.error_code==='invalid_credentials'||data?.code==='invalid_credentials')return '아이디 또는 비밀번호가 맞지 않아요.';if(status===401)return '로그인이 만료됐어요. 다시 로그인해주세요.';if(status===429)return '요청이 많아요. 잠시 후 다시 시도해주세요.';return '연결하지 못했어요. 잠시 후 다시 시도해주세요.';}
export class MathAccount {
 constructor(fetcher=globalThis.fetch.bind(globalThis),storage=globalThis.localStorage){this.fetcher=fetcher;this.storage=storage;this.session=null;this.profile=null;this.revision=0;this.pending=null;this.flushing=null;this.refreshing=null;this.conflict=false;this.timer=null;this.onStatus=()=>{};}
 get ready(){return !!this.profile&&!this.conflict;}
 backupKey(){return 'jay-math-unsent-v1.'+this.profile.user_id;}
 backup(){try{if(this.pending)this.storage?.setItem(this.backupKey(),JSON.stringify({revision:this.revision,snapshot:this.pending}));}catch{}}
 async request(path,{body,auth=false,retry=true}={}){
  const headers={apikey:publishableKey,'Content-Type':'application/json'};if(auth){if(!this.session)throw new Error('먼저 로그인해주세요.');headers.Authorization='Bearer '+this.session.access_token;}
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);let response;
  try{response=await this.fetcher(projectUrl+path,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});}catch{throw new Error('연결이 끊겼어요. 기록을 이 기기에 보관하고 다시 저장할게요.');}finally{clearTimeout(timeout);}
  const data=await response.json().catch(()=>null);
  if(response.status===401&&auth&&retry&&this.session?.refresh_token){await this.refresh();return this.request(path,{body,auth,retry:false});}
  if(!response.ok){const e=new Error(errorFor(data,response.status));e.status=response.status;throw e;}return data;
 }
 async refresh(){if(this.refreshing)return this.refreshing;const token=this.session?.refresh_token;this.refreshing=this.request('/auth/v1/token?grant_type=refresh_token',{body:{refresh_token:token}}).then(s=>{if(!s?.access_token)throw new Error('다시 로그인해주세요.');this.session=s;}).finally(()=>{this.refreshing=null;});return this.refreshing;}
 async login(id,password){
  if(this.profile)throw new Error('먼저 로그아웃해주세요.');if(!password)throw new Error('비밀번호를 입력해주세요.');
  try{this.session=await this.request('/auth/v1/token?grant_type=password',{body:{email:await loginAddress(id),password}});if(!this.session?.user?.id||!this.session.access_token)throw new Error('로그인 정보를 확인할 수 없어요.');
   const result=await this.load();try{this.storage?.setItem('jay-math-last-id',normalizeId(id));}catch{}return result;
  }catch(e){this.session=null;this.profile=null;this.pending=null;throw e;}
 }
 async load(){
  const uid=this.session?.user?.id;if(!uid)throw new Error('먼저 로그인해주세요.');
  const [profiles,cloud]=await Promise.all([this.request(`/rest/v1/game_profiles?select=user_id,display_name&user_id=eq.${uid}`,{auth:true}),this.request('/rest/v1/rpc/load_math_state',{auth:true,body:{}})]);
  if(!Array.isArray(profiles)||profiles.length!==1||profiles[0].user_id!==uid||!cloud||!Number.isSafeInteger(cloud.revision)||cloud.revision<0)throw new Error('JAY RPG 계정 정보를 불러올 수 없어요.');
  this.profile=profiles[0];this.revision=cloud.revision;this.conflict=false;this.pending=null;const snapshot=validSnapshot(cloud);
  let recovery=null;try{recovery=JSON.parse(this.storage?.getItem(this.backupKey())||'null');}catch{}
  if(recovery?.snapshot){if(recovery.revision===this.revision){const local=validSnapshot(recovery.snapshot);this.enqueue(local);return local;}this.conflict=true;this.onStatus('이 기기에 미전송 기록이 있어요. 최신 기록을 불러오거나 보관 기록을 확인해주세요.','conflict');}
  return snapshot;
 }
 enqueue(snapshot){if(!this.ready)return;this.pending=validSnapshot(snapshot);this.backup();this.onStatus('저장 중…','saving');clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush().catch(()=>{}),800);}
 async flush(){
  clearTimeout(this.timer);if(this.flushing)return this.flushing;if(this.conflict)throw new Error('최신 기록을 먼저 불러와주세요.');
  this.flushing=(async()=>{while(this.pending){const snapshot=this.pending;try{const revision=await this.request('/rest/v1/rpc/save_math_state',{auth:true,body:{p_total_xp:snapshot.totalXP,p_records:snapshot.progress,p_expected_revision:this.revision}});if(!Number.isSafeInteger(revision)||revision<=this.revision)throw new Error('저장 응답을 확인할 수 없어요.');this.revision=revision;if(this.pending===snapshot){this.pending=null;try{this.storage?.removeItem(this.backupKey());}catch{}}else this.backup();}catch(e){if(e.status===409||e.status===401||e.status===400){this.conflict=true;this.onStatus(e.message,e.status===409?'conflict':'expired');}else{this.onStatus(e.message,'offline');this.timer=setTimeout(()=>this.flush().catch(()=>{}),15000);}throw e;}}this.onStatus('저장 완료','saved');})().finally(()=>{this.flushing=null;});return this.flushing;
 }
 async reloadCloud(){clearTimeout(this.timer);if(this.flushing)await this.flushing.catch(()=>{});if(this.profile){try{const backup=this.storage?.getItem(this.backupKey());if(backup)this.storage?.setItem(this.backupKey()+'.conflict',backup);this.storage?.removeItem(this.backupKey());}catch{}}this.pending=null;this.conflict=false;return this.load();}
 async logout(keepBackup=false){if(!keepBackup)await this.flush();if(this.session&&!keepBackup)await this.request('/auth/v1/logout?scope=local',{body:{},auth:true});clearTimeout(this.timer);this.session=null;this.profile=null;this.pending=null;this.conflict=false;}
}
