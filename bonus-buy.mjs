import {random, resolve} from './engine.mjs';

export const buyProfile = Object.freeze({
  id:'koala-matched-1',
  multipliers:Object.freeze({regular:100,super:300,mystery:500}),
  mysteryWeights:[81,16,3]
});
export const buyOptions = [
  {id:'regular',name:'Regular Bonus',art:'cyclopz',tier:0},
  {id:'super',name:'Super Bonus',art:'octo-lab',tier:1},
  {id:'mystery',name:'Mystery Bonus',art:'alien-boss',tier:null}
];

export function chooseMystery(roll,weights=buyProfile.mysteryWeights){
  const [a,b,c]=weights;
  if(!Number.isFinite(roll)||roll<0||roll>=1||weights.length!==3||
     weights.some(weight=>!Number.isFinite(weight)||weight<0)||a+b+c<=0)throw Error('Invalid mystery odds');
  const draw=roll*(a+b+c);
  return draw<a?0:draw<a+b?1:2;
}

export function quoteBuy(id,stake){
  const option=buyOptions.find(item=>item.id===id);
  if(!option||!Number.isSafeInteger(stake)||stake<=0)throw Error('Invalid buy quote');
  const multiplier=buyProfile.multipliers[id];
  const priceBasis=multiplier*100;
  const cost=priceBasis*stake;
  if(!Number.isSafeInteger(cost))throw Error('Invalid buy cost');
  return {id,stake,cost,priceBasis,multiplier};
}

export function resolvePurchase(seed,id,{trace=true,rules}={}){
  const option=buyOptions.find(item=>item.id===id);
  if(!option)throw Error('Unknown buy option');
  // The selector consumes a separate deterministic stream from feature play.
  const tier=option.tier ?? chooseMystery(random(seed ^ 0x7ae75b39)());
  const featureSeed=Math.floor(random(seed ^ 0xc3546bd1)()*4294967296);
  const result=resolve(featureSeed,{feature:tier,trace,rules});
  return {...result,purchaseId:id,purchaseSeed:seed};
}

export function replayPurchase(record,{rules}={}){
  if(![0,1,2].includes(record.buyTier)||!Number.isInteger(record.featureSeed))
    return resolvePurchase(record.seed,record.buy,{rules});
  return {...resolve(record.featureSeed,{feature:record.buyTier,rules}),
    purchaseId:record.buy,purchaseSeed:record.seed};
}
export function settlePurchase(balance,active,last,record,payout){
  if(active||last?.requestId===record.requestId)return {error:'This purchase is already settled.'};
  if(!record.requestId||!Number.isSafeInteger(balance)||!Number.isSafeInteger(payout)||payout<0)
    throw Error('Invalid purchase settlement');
  const quote=quoteBuy(record.buy,record.stake);
  if(balance<quote.cost)return {error:'Insufficient fictional credits.'};
  const remaining=balance-quote.cost+payout*record.stake;
  if(!Number.isSafeInteger(remaining))throw Error('Balance exceeds the safe credit limit');
  const saved={...record,cost:quote.cost,buyProfile:buyProfile.id};
  return {balance:remaining,active:saved,last:saved};
}