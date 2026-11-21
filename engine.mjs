import {config} from './math-v2.mjs';
import {symbols} from './math-v1.mjs';
export const SCATTER = 14, EXPAND = 15, WILD = 16;
const isWild = id => id >= WILD;
const copy = board => board.map(reel => reel.slice());
export function random(seed) {
  let state = seed >>> 0;
  return () => {
    let value = state = (state + 0x9e3779b9) >>> 0;
    value = Math.imul(value ^ value >>> 16, 0x21f0aaad);
    value = Math.imul(value ^ value >>> 15, 0x735a2d97);
    return ((value ^ value >>> 15) >>> 0) / 4294967296;
  };
}

// First moment of additive multipliers, plus the count of zero-multiplier ways.
function extend([ways, ordinary, sum], [count, plain, multiplier]) {
  return [ways * count, ordinary * plain, sum * count + ways * multiplier];
}
const valueOf = ([, ordinary, sum]) => ordinary + sum;
export function evaluate(board) {
  const counts = board.map(reel => {
    const paying = new Uint8Array(14);
    const wild = [0,0,0];
    for (const id of reel) {
      if (id < SCATTER) paying[id]++;
      if (isWild(id)) {
        wild[0]++;
        if (id === WILD) wild[1]++;
        wild[2] += id - WILD;
      }
    }
    return {paying,wild};
  });
  const wildProducts = [[1,1,0]];
  for (const {wild} of counts) wildProducts.push(extend(wildProducts.at(-1),wild));
  const masks = [0,0,0,0,0,0];
  const groups = [];
  let payout = 0;
  for (let id = 0; id < symbols.length; id++) {
    let product = [1,1,0], length = 0;
    for (const {paying,wild} of counts) {
      const natural = paying[id];
      if (!natural && !wild[0]) break;
      product = extend(product,[wild[0]+natural,wild[1]+natural,wild[2]]);
      length++;
    }
    if (length < 3 || product[0] === wildProducts[length][0]) continue;
    const win = symbols[id][length-1] * (valueOf(product)-valueOf(wildProducts[length]));
    payout += win;
    groups.push({id,length,ways:product[0]-wildProducts[length][0],payout:win});
    const naturalReels = counts.slice(0,length).filter(reel => reel.paying[id]).length;
    for (let c = 0; c < length; c++) for (let r = 0; r < board[c].length; r++) {
      const cell = board[c][r];
      if (cell === id || (isWild(cell) && naturalReels > Number(counts[c].paying[id] > 0))) masks[c] |= 1 << r;
    }
  }
  let wildLength = 0;
  while (wildLength < 6 && wildProducts[wildLength+1][0]) wildLength++;
  if (wildLength >= 3) {
    const win = symbols[0][wildLength-1] * valueOf(wildProducts[wildLength]);
    payout += win;
    groups.push({id:WILD,length:wildLength,ways:wildProducts[wildLength][0],payout:win});
    for (let c = 0; c < wildLength; c++) for (let r = 0; r < board[c].length; r++) {
      if (isWild(board[c][r])) masks[c] |= 1 << r;
    }
  }
  const positions = [];
  for (let c = 0; c < 6; c++) for (let r = 0; r < board[c].length; r++) if (masks[c] & 1 << r) positions.push([c,r]);
  return {payout,positions,masks,groups};
}

export const scatterTier = count => count < 3 ? -1 : Math.min(2,count-3);
export function resolve(seed,{feature = -1, trace = true, rules = config, initial} = {}) {
  const rng = random(seed);
  const events = [];
  const stats = {tumbles:0, chains:[], wild:0, expand:0, free:0, points:0, stage:0, guarantee:0, scatters:0};
  const weights = rules.weights.reduce((sum,w) => { sum.push(w+(sum.at(-1) || 0)); return sum; },[]);
  let tier = feature, remaining = 0, total = 0, base = 0, uncapped = 0, capped = false;
  const event = (type,data = {}) => { if (trace) events.push({type,...data}); };
  const snapshot = (type,board,data = {}) => { if (trace) event(type,{board:copy(board),...data}); };
  const draw = c => {
    const special = rng();
    if (c > 0 && special < rules.expandChance) return EXPAND;
    if (special < rules.wildChance + (c > 0 ? rules.expandChance : 0)) return WILD;
    const roll = rng() * weights.at(-1);
    return weights.findIndex(weight => roll < weight);
  };
  const credit = (amount,type,data) => {
    const paid = Math.min(amount,rules.cap-total);
    uncapped += amount;
    total += paid;
    event(type,{...data,calculated:amount,paid,total});
    if (total === rules.cap) {
      capped = true;
      event('cap',{calculated:uncapped,paid:total,reason:'round payout ceiling reached'});
    }
  };
  let pending = 0;
  function spin(bonus) {
    let scatterCount = 0, chain = 0;
    const board = !bonus && initial ? copy(initial) : Array.from({length:6},(_,c) => {
      const height = rng();
      return Array.from({length:height < rules.heights[0] ? 4 : height < rules.heights[0]+rules.heights[1] ? 5 : 6},() => draw(c));
    });
    if (!bonus && !initial) {
      const field = rules.scatterField;
      const rate = rng() < field.stormChance ? field.storm : field.quiet;
      for (const reel of board) if (rng() < rate) reel[Math.floor(rng()*reel.length)] = SCATTER;
    }
    if (!bonus) scatterCount = board.flat().filter(id => id === SCATTER).length;
    snapshot('spin',board,{bonus,remaining,ways:board.reduce((n,r) => n*r.length,1),scatters:scatterCount});
    // The drop cursor persists across the full feature.
    for (;;) {
      const expanded = [];
      board.forEach((reel,c) => {
        if (reel.some(isWild)) stats.wild = 1;
        if (reel.includes(EXPAND)) {
          stats.expand = 1;
          stats.wild = 1;
          board[c] = reel.map(() => WILD);
          expanded.push(c);
        }
      });
      if (expanded.length) snapshot('expand',board,{reels:expanded});
      if (pending < stats.stage) {
        const level = pending++;
        let [min,max,mult] = rules.drops[tier][level];
        const candidates = [];
        board.forEach((reel,c) => reel.forEach((id,r) => { if (id < SCATTER) candidates.push([c,r]); }));
        const option = rules.surge;
        let roll = rng();
        const boosted = Boolean(option && option.tier === tier && option.level === level+1 && roll < option.chance);
        if (boosted) {
          min = option.min;
          max = option.max;
          roll /= option.chance;
          stats.surges = (stats.surges || 0)+1;
        } else if (option && option.tier === tier && option.level === level+1) {
          roll = (roll-option.chance)/(1-option.chance);
        }
        const requested = min+Math.floor(roll*(max-min+1));
        const positions = [];
        for (let i = 0; i < requested && candidates.length; i++) {
          const index = Math.floor(rng()*candidates.length);
          const [c,r] = candidates[index];
          candidates[index] = candidates.at(-1);
          candidates.pop();
          board[c][r] = WILD+mult;
          positions.push([c,r]);
        }
        if (positions.length) stats.wild = 1;
        snapshot('drop',board,{positions,level:level+1,mult,requested,boosted});
      }
      const win = evaluate(board);
      if (!win.payout) {
        if (pending < stats.stage) continue;
        break;
      }
      credit(win.payout,'win',trace ? win : undefined);
      chain++;
      stats.tumbles++;
      if (capped) break;
      const fallen = trace ? [] : null;
      for (let c = 0; c < 6; c++) {
        if (!win.masks[c]) continue;
        const survivors = board[c].filter((id,r) => !(win.masks[c] & 1 << r));
        const added = board[c].length-survivors.length;
        if (trace) {
          let destination = added;
          board[c].forEach((id,r) => {
            if (!(win.masks[c] & 1 << r)) { fallen.push([c,destination,destination-r]); destination++; }
          });
          for (let r = 0; r < added; r++) fallen.push([c,r,added]);
        }
        board[c] = Array.from({length:added},() => draw(c)).concat(survivors);
      }
      snapshot('tumble',board,{fallen});
      if (bonus) {
        stats.points += win.positions.length;
        event('points',{points:stats.points});
        while (stats.points >= rules.milestones[stats.stage]) {
          stats.stage++;
          remaining += 2;
          event('milestone',{stage:stats.stage,remaining,points:stats.points});
        }
      }
    }
    stats.chains.push(chain);
    return scatterCount;
  }
  if (feature < 0) {
    stats.scatters = spin(false);
    base = total;
    tier = scatterTier(stats.scatters);
  }
  if (tier >= 0 && !capped) {
    remaining = 8;
    event('bonus',{tier,remaining,scatters:stats.scatters});
    while (remaining && !capped) {
      remaining--;
      stats.free++;
      spin(true);
    }
    if (tier === 2 && !capped && total-base < rules.guarantee) {
      stats.guarantee = rules.guarantee-(total-base);
      credit(stats.guarantee,'guarantee');
    }
    event('summary',{tier,bonusWin:total-base,total,capped});
  }
  event('end',{total,capped});
  return {version:rules.version,seed,tier,total,base,uncapped,capped,stats,events};
}