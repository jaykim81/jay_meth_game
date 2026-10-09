export function levelInfo(totalXP) {
 let level=1,spent=0,required=100;
 const total=Number.isSafeInteger(totalXP)&&totalXP>=0?Math.min(totalXP,1000000000):0;
 while(total-spent>=required){spent+=required;level++;required=100+(level-1)*40;}
 return {level,xp:total-spent,required,total,attackBonus:Math.min(12,level-1)};
}
export function questionXP(grade,critical,bonus){return 10+grade*2+(critical?4:0)+(bonus?6:0);}
