export const WORLDS = ['새싹의 숲','오크의 숲','해골의 계곡','마법의 호수','수정의 산맥','고대의 성'];
export const TOPICS = [
 ['10까지의 덧셈','10까지의 뺄셈','20까지의 덧셈','20까지의 뺄셈','덧셈·뺄셈 모험','두 자리 수 계산'],
 ['두 자리 수 덧셈','두 자리 수 뺄셈','2·3·4단 구구단','5·6·7단 구구단','8·9단 구구단','구구단 종합'],
 ['세 자리 수 계산','두 자리 수 곱셈','나눗셈 기초','길이 단위','분수 알아보기','곱셈·나눗셈 종합'],
 ['큰 수 계산','두 자리 수 나눗셈','분수의 덧셈·뺄셈','소수의 덧셈·뺄셈','각도 알아보기','계산 종합'],
 ['약수와 배수','분모가 다른 분수','분수와 자연수 곱셈','소수의 곱셈','넓이 알아보기','평균 구하기'],
 ['분수의 나눗셈','소수의 나눗셈','비와 비율','백분율','직육면체의 부피','원과 비율 종합']
];
export const GRADE_HINTS = ['덧셈 · 뺄셈','구구단 · 두 자리 수','곱셈 · 나눗셈 · 분수','큰 수 · 소수 · 각도','분수 · 소수 · 넓이','비율 · 부피 · 원'];
export const DESCRIPTIONS = [
 ['두 수를 더해 10까지 만들어 봐요.','10까지의 수에서 작은 수를 빼요.','받아올림이 있는 덧셈에 도전해요.','20까지의 수에서 빼 보는 모험이에요.','덧셈과 뺄셈을 번갈아 풀어 봐요.','새싹의 숲 보스! 받아올림 없는 두 자리 수 계산이에요.'],
 ['받아올림이 있는 두 자리 수 덧셈이에요.','받아내림이 있는 두 자리 수 뺄셈이에요.','2단부터 4단까지 차근차근 풀어요.','5단부터 7단까지 도전해요.','8단과 9단을 연습해요.','오크 보스! 2단부터 9단까지 모두 만나요.'],
 ['세 자리 수를 더하거나 빼요.','두 자리 수에 한 자리 수를 곱해요.','나머지가 없는 나눗셈을 풀어요.','m와 cm를 cm로 바꿔 봐요.','똑같이 나눈 것 중 몇 조각일까요?','해골 보스! 곱셈과 나눗셈을 번갈아 풀어요.'],
 ['네 자리 수를 더하거나 빼요.','두 자리 수로 나누는 계산이에요.','분모가 같은 분수끼리 계산해요.','소수 첫째 자리의 덧셈과 뺄셈이에요.','직각과 평각에서 남은 각도를 찾아요.','마법사 보스! 분수와 소수 계산을 함께 풀어요.'],
 ['두 수의 최대공약수를 찾아요.','분모를 같게 만들어 분수를 더해요.','분수에 자연수를 곱해 봐요.','소수에 자연수를 곱해요.','직사각형과 삼각형의 넓이를 구해요.','수정 보스! 세 수의 평균을 구해요.'],
 ['분수를 자연수로 나눠 봐요.','소수끼리 나누는 계산에 도전해요.','전체에 대한 부분의 비율을 분수로 구해요.','전체의 몇 %인지 계산해요.','가로 × 세로 × 높이로 부피를 구해요.','최종 보스! 원주율은 3.14로 계산해요.']
];
export function timeLimit(grade, stage) { return (grade >= 5 ? 30 : grade >= 3 ? 24 : 18) - (stage - 1); }
export function gcd(a,b) { while(b) [a,b]=[b,a%b]; return a; }
export function fraction(n,d) { const g=gcd(n,d); return d/g===1 ? String(n/g) : `${n/g}/${d/g}`; }
const decimal = n => String(Math.round(n*10000)/10000);
export function generateQuestion(grade,stage,rng=Math.random) {
 const int=(min,max)=>Math.floor(rng()*(max-min+1))+min;
 const pick=a=>a[int(0,a.length-1)];
 let text,answer,display; const topic=TOPICS[grade-1][stage-1];
 const calc=(a,b,op)=>{text=`${decimal(a)} ${op} ${decimal(b)} = ?`;answer=op==='+'?a+b:op==='−'?a-b:op==='×'?a*b:a/b;};
 if(grade===1){
  if(stage===1){let a=int(0,9);calc(a,int(0,10-a),'+');}
  else if(stage===2){let a=int(1,10);calc(a,int(0,a),'−');}
  else if(stage===3){let a=int(5,14);calc(a,int(Math.max(1,11-a),20-a),'+');}
  else if(stage===4){let a=int(11,20);calc(a,int(1,a),'−');}
  else if(stage===5){let a=int(1,15),op=pick(['+','−']);calc(a,int(0,op==='+'?20-a:a),op);}
  else {let tens=int(1,5),ones=int(0,9),bT=int(1,3),bO=int(0,9-ones);calc(tens*10+ones,bT*10+bO,'+');}
 } else if(grade===2){
  if(stage<=2){const a=int(20,85),b=int(11,stage===1?99-a:Math.min(65,a-1));calc(a,b,stage===1?'+':'−');}
  else{const range=stage===3?[2,4]:stage===4?[5,7]:stage===5?[8,9]:[2,9];calc(int(...range),int(1,9),'×');}
 } else if(grade===3){
  if(stage===1){const a=int(300,700),b=int(100,299);calc(a,b,pick(['+','−']));}
  else if(stage===2)calc(int(11,49),int(2,9),'×');
  else if(stage===3){let b=int(2,9);calc(b*int(2,12),b,'÷');}
  else if(stage===4){const m=int(1,9),cm=int(1,99);text=`${m} m ${cm} cm = ? cm`;answer=m*100+cm;}
  else if(stage===5){const d=int(3,9),n=int(1,d-1);text=`${d}조각 중 ${n}조각은 전체의 얼마?`;answer=n/d;display=fraction(n,d);}
  else{const a=int(2,9),b=int(2,9),op=pick(['×','÷']);calc(op==='×'?a:a*b,b,op);}
 } else if(grade===4){
  if(stage===1){let a=int(2000,7000),b=int(1000,1999);calc(a,b,pick(['+','−']));}
  else if(stage===2){let b=int(11,35);calc(b*int(3,15),b,'÷');}
  else if(stage===3||(stage===6&&rng()<.5)){let d=int(3,12),a=int(1,d-1),b=int(1,d-1),op=pick(['+','−']);if(op==='−'&&b>a)[a,b]=[b,a];text=`${a}/${d} ${op} ${b}/${d} = ?`;let n=op==='+'?a+b:a-b;answer=n/d;display=fraction(n,d);}
  else if(stage===4||stage===6){let a=int(12,89),b=int(1,a),op=pick(['+','−']);calc(a/10,b/10,op);}
  else{let total=pick([90,180]),a=int(1,total/10-1)*10;text=`${total}°에서 ${a}°를 빼면 ?°`;answer=total-a;}
 } else if(grade===5){
  if(stage===1){const g=int(2,9),a=int(2,6)*g,b=int(2,6)*g;text=`${a}과 ${b}의 최대공약수는?`;answer=gcd(a,b);}
  else if(stage===2){let d=pick([2,3,4,5]),e=d*int(2,3),a=int(1,d-1),b=int(1,e-1);text=`${a}/${d} + ${b}/${e} = ?`;answer=a/d+b/e;display=fraction(a*e+b*d,d*e);}
  else if(stage===3){let d=int(3,9),a=int(1,d-1),b=int(2,9);text=`${a}/${d} × ${b} = ?`;answer=a*b/d;display=fraction(a*b,d);}
  else if(stage===4)calc(int(11,49)/10,int(2,9),'×');
  else if(stage===5){let a=int(3,12)*2,b=int(3,12),triangle=rng()<.5;text=triangle?`밑변 ${a} cm, 높이 ${b} cm인 삼각형 넓이는? (cm²)`:`가로 ${a} cm, 세로 ${b} cm인 직사각형 넓이는? (cm²)`;answer=a*b/(triangle?2:1);}
  else{let a=int(10,40),b=int(5,15);text=`${a-b}, ${a}, ${a+b}의 평균은?`;answer=a;}
 } else {
  if(stage===1){let d=int(2,9),a=int(1,d-1),b=int(2,5);text=`${a}/${d} ÷ ${b} = ?`;answer=a/(d*b);display=fraction(a,d*b);}
  else if(stage===2){let b=int(2,9)/10,q=int(2,15);calc(b*q,b,'÷');}
  else if(stage===3){let total=pick([10,20,25,50]),part=int(1,total-1);text=`${total}개 중 ${part}개의 비율은? (분수)`;answer=part/total;display=fraction(part,total);}
  else if(stage===4||(stage===6&&rng()<.5)){let total=pick([20,50,100]),part=int(1,total/5-1)*5;text=`전체 ${total}개 중 ${part}개는 몇 %?`;answer=part/total*100;}
  else if(stage===5){let a=int(2,9),b=int(2,9),c=int(2,9);text=`가로 ${a}, 세로 ${b}, 높이 ${c} cm인 직육면체 부피는? (cm³)`;answer=a*b*c;}
  else{let r=int(2,9),area=rng()<.5;text=area?`반지름 ${r} cm인 원의 넓이는? (π=3.14, cm²)`:`반지름 ${r} cm인 원의 둘레는? (π=3.14, cm)`;answer=3.14*(area?r*r:2*r);}
 }
 return {text,answer,display:display??decimal(answer),topic,word:!/ = \?$/.test(text)};
}
export function parseAnswer(value){
 if(typeof value!=='string'||!/^\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?$/.test(value))return null;
 const parts=value.split('/').map(Number);if(parts.length===2&&parts[1]===0)return null;
 const result=parts.length===2?parts[0]/parts[1]:parts[0];return Number.isFinite(result)?result:null;
}
export function isCorrect(value,question){const n=parseAnswer(value);return n!==null&&Math.abs(n-question.answer)<1e-8;}
export function attackDamage(stage,combo,elapsed,limit){const critical=elapsed<=limit*.35;const bonus=combo>0&&combo%3===0;const damage=(18+stage*2)*(critical?2:1)+(bonus?14:0);return {damage,critical,bonus};}
export const ENEMIES={slime:{name:'새싹 슬라임',tag:'SPROUT SLIME'},skeleton:{name:'해골 전사',tag:'SKELETON'},orc:{name:'오크 전사',tag:'ORC WARRIOR'},mage:{name:'오크 마법사',tag:'ORC MAGE'},golem:{name:'수정 골렘',tag:'CRYSTAL GOLEM'}};
export function enemyFor(grade,stage,round){const waves=[['slime','skeleton','orc'],['slime','orc','orc'],['skeleton','orc','skeleton'],['slime','skeleton','mage'],['orc','mage','golem'],['skeleton','mage','golem']];return stage===6&&round===3?'golem':waves[grade-1][round-1];}
