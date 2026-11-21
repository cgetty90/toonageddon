import {resolve, SCATTER, EXPAND, WILD} from './engine.mjs';
import {config} from './math-v2.mjs';
import {symbols, tiers, v1Config} from './math-v1.mjs';
import {buyProfile,buyOptions,quoteBuy,resolvePurchase,replayPurchase,settlePurchase} from './bonus-buy.mjs';
import {createAudio} from './audio.mjs';
const $ = id => document.getElementById(id);
const assetFile = path => globalThis.__toonAssets?.[path] || path;
const keys = ['balance','stake','last','active','settings'];
const settings = {music:.24,effects:.55,mute:false,turbo:false};
const wallet = {balance:100000000,stake:20,last:null,active:null,settings};
const key = 'toonageddon-wallet-3.0.0';
function readWallet(storageKey=key) {
  try {
    const saved=JSON.parse(localStorage.getItem(storageKey));
    if(saved&&Number.isSafeInteger(saved.balance)&&saved.balance>=0){
      const values=Object.fromEntries(keys.filter(field=>Object.hasOwn(saved,field)).map(field=>[field,saved[field]]));
      values.settings={...settings,...saved.settings};
      return values;
    }
  } catch {}
  return null;
}
const previousV2=readWallet('toonageddon-wallet-'+config.version);
const legacy=previousV2??readWallet('toonageddon-wallet-'+v1Config.version);
const savedWallet=readWallet();
if(!savedWallet&&legacy){
  Object.assign(wallet,{balance:legacy.balance,stake:legacy.stake,settings:legacy.settings,
    last:legacy.last?{...legacy.last,version:legacy.last.version??(previousV2?config.version:v1Config.version)}:null});
  try{localStorage.setItem(key,JSON.stringify(wallet));}catch{}
}else Object.assign(wallet,savedWallet);
function commit(patch) {
  const next={...wallet,...readWallet(),...patch};
  localStorage.setItem(key,JSON.stringify(next));
  Object.assign(wallet,next);
}
const audio=createAudio(()=>wallet.settings);
const amounts=[10,20,50,100,200,500,1000,2000,5000,10000];
const money = units => (units/10000).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2});
const prefersReduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let state='loading', autoplay=0, feature=-1, shownWin=0, shownPoints=0, shownStage=0, displayBalance=wallet.balance;
let cells=[], ticker=0;
const transition = next => { state=next; $('game').dataset.state=next; controls(); };
const status = message => { $('status').textContent=message; };
const wait = (ms,fast=false) => new Promise(done=>setTimeout(done,fast?0:prefersReduced?Math.min(ms,45):wallet.settings.turbo?Math.min(ms*.23,260):ms));
function controls(){
  const ready=state==='ready';
  $('spin').disabled=!ready;
  $('buy-open').disabled=!ready;
  $('minus').disabled=!ready||wallet.stake===amounts[0];
  $('plus').disabled=!ready||wallet.stake===amounts.at(-1);
  $('stake').textContent=money(wallet.stake*100);
  $('balance').textContent=money(displayBalance);
  $('auto').setAttribute('aria-pressed',String(autoplay>0));
  $('mute').setAttribute('aria-pressed',String(wallet.settings.mute));
  $('mute').setAttribute('aria-label',wallet.settings.mute?'Unmute sound':'Mute sound');
  $('turbo').setAttribute('aria-pressed',String(wallet.settings.turbo));
  $('game').toggleAttribute('data-turbo',wallet.settings.turbo);
}
function imageInfo(id) {
  if(id<SCATTER) return [symbols[id][1],symbols[id][0],''];
  if(id===SCATTER) return ['scatter-ufo','Scatter','SCATTER'];
  if(id===EXPAND) return ['wild-base','Expanding wild','EXPAND'];
  const mult=id-WILD;
  return ['wild-base',mult?'Wild ×'+mult:'Wild',mult?'WILD ×'+mult:'WILD'];
}
function makeCell(id){
  const [asset,name,badge]=imageInfo(id);
  const cell=document.createElement('div');
  cell.dataset.symbol=id;
  cell.className='cell'+(id>=EXPAND?' wild':id===SCATTER?' scatter':'');
  const img=new Image();
  img.alt=name;
  img.src=assetFile('assets/reel-art-v4/'+asset+'.png');
  img.addEventListener('error',()=>{img.hidden=true;cell.textContent=name; cell.classList.add('missing');},{once:true});
  cell.append(img);
  if(badge) cell.append(Object.assign(document.createElement('span'),{className:'symbol-caption',textContent:badge}));
  return cell;
}
function reelNode(reel){
  const container=document.createElement('div');
  container.className='reel';
  container.style.setProperty('--rows',reel.length);
  container.append(...reel.map(makeCell));
  return container;
}
function render(board){
  $('reels').dataset.max=Math.max(...board.map(reel=>reel.length));
  const reels=board.map(reelNode);
  $('reels').replaceChildren(...reels);
  cells=reels.map(node=>Array.from(node.children));
}
function winCounter(units,fast){
  cancelAnimationFrame(ticker);
  const previous=shownWin;
  shownWin=units;
  if(fast||prefersReduced||wallet.settings.turbo){$('win').textContent=money(units);return;}
  const start=performance.now();
  function animate(now){
    const t=Math.min(1,(now-start)/360);
    $('win').textContent=money(previous+(units-previous)*t);
    if(t<1) ticker=requestAnimationFrame(animate);
  }
  ticker=requestAnimationFrame(animate);
}
function featurePanel(tier,remaining=0,scatters=0){
  feature=tier;
  const active=tier>=0;
  if(active) $('game').dataset.tier=tier+1;
  else delete $('game').dataset.tier;
  $('chaos').hidden=!active;
  $('pilot').hidden=false;
  $('feature-stage').hidden=!active;
  $('mode').textContent=active?tiers[tier].toUpperCase():'BASE GAME';
  $('feature-label').textContent=active?'FREE SPINS':'SCATTER BONUS';
  $('feature-number').hidden=!active;
  $('feature-number').textContent=active?remaining:'';
  if(active)$('feature-note').textContent=scatters?scatters+' scatters triggered':'Direct feature entry';
  else $('feature-note').textContent='3 / 4 / 5+ UFO SCATTERS';
  updateMeter();
}
function updateMeter(){
  $('points').textContent=shownPoints+' / 120 Chaos Points';
  $('chaos-progress').value=shownPoints;
  $('feature-stage').textContent='Stage '+shownStage+' / 5';
  $('meter').replaceChildren(...config.milestones.map((points,index)=>{
    const level=document.createElement('div');
    level.className='level'+(index<shownStage?' active':'');
    level.textContent=(index<shownStage?'✓ ':'')+points;
    level.append(Object.assign(document.createElement('small'),{textContent:feature<0?'+2 spins':'+2 spins · ×'+config.drops[feature][index][2]}));
    return level;
  }));
}
function particles(positions,count=6){
  if(prefersReduced||wallet.settings.turbo)return;
  const bounds=$('effect').getBoundingClientRect();
  for(const [c,r] of positions){
    const box=cells[c]?.[r]?.getBoundingClientRect();
    if(!box)continue;
    for(let i=0;i<count;i++){
      const spark=document.createElement('i');
      spark.className='spark';
      spark.style.left=(box.x-bounds.x+box.width/2)+'px';
      spark.style.top=(box.y-bounds.y+box.height/2)+'px';
      const angle=(i/count)*Math.PI*2+c;
      const reach=21+((r*17+i*7)%29);
      spark.style.setProperty('--dx',Math.cos(angle)*reach+'px');
      spark.style.setProperty('--dy',Math.sin(angle)*reach+'px');
      $('effect').append(spark);
      setTimeout(()=>spark.remove(),550);
    }
  }
}
function showConnections(groups) {
  if(prefersReduced||wallet.settings.turbo)return;
  const bounds=$('effect').getBoundingClientRect();
  for(const group of groups){
    const eligible=cells.slice(0,group.length).map(reel=>reel.filter(cell=>{
      const id=Number(cell.dataset.symbol);
      return id===group.id||id>=WILD;
    }));
    const natural=eligible.findIndex(reel=>reel.some(cell=>Number(cell.dataset.symbol)===group.id));
    const nodes=eligible.map((reel,c)=>c===natural?reel.find(cell=>Number(cell.dataset.symbol)===group.id):reel[0]);
    for(let c=1;c<nodes.length;c++){
      const a=nodes[c-1].getBoundingClientRect(), b=nodes[c].getBoundingClientRect();
      const x=a.x+a.width/2, y=a.y+a.height/2;
      const dx=b.x+b.width/2-x, dy=b.y+b.height/2-y;
      const line=document.createElement('i');
      line.className='connection';
      Object.assign(line.style,{left:(x-bounds.x)+'px',top:(y-bounds.y)+'px',width:Math.hypot(dx,dy)+'px',transform:'rotate('+Math.atan2(dy,dx)+'rad)'});
      $('effect').append(line);
      setTimeout(()=>line.remove(),360);
    }
  }
}
async function spinReels(board){
  if(prefersReduced){render(board);await wait(60);return;}
  const previous=cells.map(reel=>reel.map(cell=>Number(cell.dataset.symbol)));
  render(board);
  const turbo=wallet.settings.turbo;
  await Promise.all(Array.from($('reels').children).map(async (reel,c)=>{
    const final=board[c];
    const old=Array.from({length:final.length},(_,r)=>previous[c]?.[r] ?? (c+r)%14);
    const intermediate=Array.from({length:turbo?5:16},(_,r)=>(r*5+c*3+2)%14);
    const strip=document.createElement('div');
    strip.className='reel-strip';
    strip.setAttribute('aria-hidden','true');
    strip.append(...[...final,...intermediate,...old].map(makeCell));
    reel.append(strip);
    reel.classList.add('in-flight');
    const travel=(final.length+intermediate.length)*cells[c][0].getBoundingClientRect().height;
    const animation=strip.animate([
      {transform:'translateY(-'+travel+'px)',filter:'blur(0px)',offset:0,easing:'cubic-bezier(.68,.02,.83,.6)'},
      {transform:'translateY(-'+travel*.79+'px)',filter:'blur(2.8px)',offset:.28,easing:'linear'},
      {transform:'translateY(-'+travel*.12+'px)',filter:'blur(2.8px)',offset:.74,easing:'cubic-bezier(.17,.69,.33,1)'},
      {transform:'translateY(4px)',filter:'blur(0px)',offset:.94},
      {transform:'translateY(0)',filter:'blur(0px)',offset:1}
    ],{duration:turbo?300+c*25:940+c*112,fill:'both'});
    await animation.finished.catch(()=>{});
    strip.remove();
    reel.classList.remove('in-flight');
    reel.classList.add('impact');
    audio.cue('stop',c);
  }));
}
async function deliverWilds(event){
  if(prefersReduced||wallet.settings.turbo||!event.positions.length){await wait(270);return;}
  const bounds=$('effect').getBoundingClientRect();
  const ship=$('beam-ship').getBoundingClientRect();
  const originX=ship.x+ship.width*.5-bounds.x;
  const originY=ship.y+ship.height*.68-bounds.y;
  await Promise.all(event.positions.map(async ([c,r],count)=>{
    const target=cells[c][r].getBoundingClientRect();
    const x=target.x+target.width*.5-bounds.x;
    const y=target.y+target.height*.5-bounds.y;
    const bolt=document.createElement('i');
    bolt.className='wild-flight';
    bolt.textContent='×'+event.mult;
    Object.assign(bolt.style,{left:originX+'px',top:originY+'px'});
    $('effect').append(bolt);
    const dx=x-originX,dy=y-originY;
    const flight=bolt.animate([
      {transform:'translate(-50%,-50%) scale(.26)',opacity:0},
      {transform:'translate('+dx*.38+'px,'+dy*.18+'px) scale(1.15)',opacity:1,offset:.3},
      {transform:'translate('+dx+'px,'+dy+'px) scale(.74)',opacity:.92}
    ],{duration:435+event.level*29,delay:Math.min(200,count*30),fill:'both',easing:'cubic-bezier(.32,.12,.58,1)'});
    await flight.finished.catch(()=>{});
    bolt.remove();
    cells[c][r].classList.add('hit-wild');
  }));
}
async function animateRound(round,stake,fast){
  shownPoints=0;shownStage=0;
  featurePanel(-1);
  winCounter(0,true);
  let scatterCount=0;
  for(const e of round.events){
    transition(e.type);
    switch(e.type){
      case 'spin': {
        if(e.bonus) $('feature-number').textContent=e.remaining;
        scatterCount=e.scatters || scatterCount;
        $('ways').textContent=e.ways.toLocaleString('en-GB')+' WAYS';
        status(e.bonus?'Free spin in flight':'Reels spinning');
        if(!fast){
          audio.cue('spin');
          await spinReels(e.board);
        } else render(e.board);
        if(!e.bonus&&e.scatters>1){audio.cue('scatter');status(e.scatters+' scatters landed');await wait(220,fast);}
        break;
      }
      case 'expand':
        status('Expanding wild');
        if(!fast){
          audio.cue('expand');
          $('pilot').classList.add('react');
          setTimeout(()=>$('pilot').classList.remove('react'),680);
        }
        e.reels.forEach(c=>$('reels').children[c].classList.add('expanding'));
        await wait(310,fast);
        render(e.board);
        e.reels.forEach(c=>$('reels').children[c].classList.add('expanding'));
        await wait(440,fast);
        break;
      case 'win':
        status(e.groups.reduce((n,g)=>n+g.ways,0).toLocaleString('en-GB')+' winning ways');
        winCounter(e.total*stake,fast);
        if(!fast){
          audio.cue(e.paid>=1500?'large':'win');
          e.positions.forEach(([c,r])=>cells[c][r].classList.add('winning'));
          showConnections(e.groups);
          await wait(330);
          audio.cue('burst');
          e.positions.forEach(([c,r])=>cells[c][r].classList.add('burst'));
          particles(e.positions);
          await wait(200);
        }
        break;
      case 'tumble':
        render(e.board);
        if(!fast){
          audio.cue('tumble');
          e.fallen.forEach(([c,r,dist])=>{
            const cell=cells[c][r];
            cell.style.setProperty('--from',(-100*dist)+'%');
            cell.classList.add('falling');
          });
          await wait(445);
        }
        break;
      case 'bonus':
        featurePanel(e.tier,e.remaining,scatterCount);
        status(tiers[e.tier]+' activated · 8 free spins');
        if(!fast)audio.cue('bonus',e.tier);
        await wait(1650+e.tier*300,fast);
        break;
      case 'points':
        shownPoints=e.points;
        updateMeter();
        break;
      case 'milestone':
        shownStage=e.stage;
        $('feature-number').textContent=e.remaining;
        updateMeter();
        status('Milestone '+e.stage+' · +2 free spins');
        if(!fast)audio.cue('milestone',e.stage);
        await wait(690,fast);
        break;
      case 'drop':
        status((e.boosted?'Wild Surge':'Wild Drop')+' · '+e.positions.length+' wilds ×'+e.mult);
        if(!fast){
          audio.cue('beam',e.level);
          $('game').classList.add('beaming');
          $('game').classList.toggle('surging',e.boosted);
          await wait(175);
          await deliverWilds(e);
        }
        render(e.board);
        e.positions.forEach(([c,r])=>cells[c][r].classList.add('dropping','wild-impact'));
        if(!fast){particles(e.positions,e.boosted?7:4);audio.cue('drop',e.level);}
        await wait(425,fast);
        $('game').classList.remove('beaming','surging');
        break;
      case 'guarantee':
        winCounter(e.total*stake,fast);
        status('100× bonus minimum applied');
        await wait(920,fast);
        break;
      case 'cap':
        status('Maximum win · 50,000×');
        if(!fast)audio.cue('cap');
        document.querySelectorAll('.burst,.winning').forEach(cell=>cell.classList.remove('burst','winning'));
        await wait(1800,fast);
        break;
      case 'summary':
        status(tiers[e.tier]+' complete · '+money(e.bonusWin*stake)+' credits');
        if(!fast)audio.cue('large');
        await wait(1900,fast);
        break;
      case 'end':
        if(round.tier<0)status(e.capped?'Maximum win · 50,000×':e.total?'Round complete · '+money(e.total*stake)+' credits':'Ready to spin');
        break;
    }
  }
  featurePanel(-1);
}
async function play(existing=null,featurePreview=-1,replay=false,purchase=null){
  if(state!=='ready')return;
  transition('resolving');
  if(!replay&&featurePreview<0&&navigator.locks){
    const recovering=Boolean(existing);
    await navigator.locks.request(key,{ifAvailable:!existing},async lock=>{
      if(!lock){
        autoplay=0;
        transition('ready');
        status('A paid round is active in another tab');
        return;
      }
      const latest=readWallet();
      if(latest){
        Object.assign(wallet,latest);
        displayBalance=wallet.balance;
        existing=wallet.active;
      }
      if(recovering&&!existing){
        transition('ready');
        status('Ready to spin');
        return;
      }
      await playRound(existing,featurePreview,replay,purchase);
    });
  }else await playRound(existing,featurePreview,replay,purchase);
}
async function playRound(existing,featurePreview,replay,purchase){
  if(!purchase&&!existing&&featurePreview<0&&!replay&&wallet.balance<wallet.stake*100){
    autoplay=0; transition('ready'); status('Insufficient fictional credits');return;
  }
  const stake=existing?.stake ?? wallet.stake;
  const seed=existing?.seed ?? crypto.getRandomValues(new Uint32Array(1))[0];
  const featureId=existing?.feature ?? featurePreview;
  const record={stake,seed,feature:featureId,version:config.version,...(!existing&&purchase?{buy:purchase.id,requestId:purchase.requestId}:{})};
  let settled=Boolean(existing && !replay);
  try{
    const buy=existing?.buy??record.buy;
    if(!existing&&purchase&&purchase.stake!==stake){
      transition('ready');status('Stake changed. Refresh the Bonus Buy quote.');return;
    }
    const rules=existing?.version===v1Config.version?v1Config:config;
    const round=buy?(existing?replayPurchase(existing,{rules}):resolvePurchase(seed,buy,{rules})):resolve(seed,{feature:featureId,rules});
    if(!existing&&buy){
      const result=settlePurchase(wallet.balance,wallet.active,wallet.last,{...record,buyTier:round.tier,featureSeed:round.seed},round.total);
      if(result.error){transition('ready');status(result.error);return;}
      commit(result);
      displayBalance=result.balance-round.total*stake;
      settled=true;
    } else if(!existing && featureId<0){
      displayBalance=wallet.balance-stake*100;
      commit({balance:displayBalance+round.total*stake,last:record,active:record});
      settled=true;
    }
    if(buy==='mystery'&&(!existing||replay))await revealMystery(round.tier);
    await animateRound(round,stake,Boolean(existing&&!replay));
    if(settled)commit({active:null});
    displayBalance=wallet.balance;
    transition('ready');
    if(autoplay>0){
      autoplay--;controls();
      if(autoplay>0)setTimeout(()=>{if(autoplay>0&&!$('panel').open)void play();},420);
    }
  }catch(error){
    console.error(error);
    autoplay=0;displayBalance=wallet.balance;
    transition('ready');
    status(settled?'Round saved. Reload to recover.':'Round could not start. Check browser storage.');
  }
}
function updateSettings(patch){
  try{commit({settings:{...wallet.settings,...readWallet()?.settings,...patch}});}
  catch{Object.assign(wallet.settings,patch);}
  controls();
  audio.refresh();
}
function openPanel(title,content){
  autoplay=0;controls();
  $('panel-title').textContent=title;
  $('panel-content').innerHTML=content;
  $('panel').showModal();
}
$('settings').onclick=()=>{
  openPanel('Settings','<label>Music <input id="music" type="range" min="0" max="1" step=".01"></label><label>Sound effects <input id="effects" type="range" min="0" max="1" step=".01"></label><p><button id="replay">Replay last settled round</button><button id="log">Download last round log</button></p><p>Preview a bonus with the current bet. Preview payouts have no effect on balance.</p><p id="previews"></p>');
  for(const name of ['music','effects']){
    $(name).value=wallet.settings[name];
    $(name).oninput=()=>{audio.unlock();updateSettings({[name]:Number($(name).value)});};
  }
  $('replay').disabled=!wallet.last||state!=='ready';
  $('replay').onclick=()=>{$('panel').close();audio.unlock();void play(wallet.last,-1,true);};
  $('log').disabled=!wallet.last;
  $('log').onclick=()=>{
    const rules=wallet.last.version===v1Config.version?v1Config:config;
    const data=wallet.last.buy?replayPurchase(wallet.last,{rules}):resolve(wallet.last.seed,{rules});
    const url=URL.createObjectURL(new Blob([JSON.stringify({...data,stake:wallet.last.stake/100,buyCost:wallet.last.buy?wallet.last.cost/10000:undefined},null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='toonageddon-'+data.seed+'.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  };
  tiers.forEach((label,id)=>{
    const b=Object.assign(document.createElement('button'),{textContent:label,disabled:state!=='ready'});
    b.onclick=()=>{$('panel').close();audio.unlock();void play(null,id);};
    $('previews').append(b);
  });
};
$('info').onclick=()=>{
  const values=symbols.map(([name,,...p])=>'<tr><th scope="row">'+name+'</th>'+p.map(v=>'<td>'+(v/100).toFixed(2)+'×</td>').join('')+'</tr>').join('');
  const dropRows=config.milestones.map((points,index)=>'<tr><th>'+points+'</th>'+config.drops.map(table=>{
    const [min,max,x]=table[index];
    return '<td>'+(min===max?min:min+'–'+max)+' ×'+x+'</td>';
  }).join('')+'</tr>').join('');
  const dropTable='<h3>Wild Drops by stage</h3><table><thead><tr><th>Points</th><th>Regular</th><th>Super</th><th>Super Super</th></tr></thead><tbody>'+dropRows+'</tbody></table>';
  openPanel('Paytable and rules','<p>Match a paying symbol from reel one across at least three consecutive reels. Each position combination pays. Wild multipliers add within each way.</p><table><thead><tr><th>Symbol</th><th>3 reels</th><th>4 reels</th><th>5 reels</th><th>6 reels</th></tr></thead><tbody>'+values+'</tbody></table><p>Exactly 3 UFO scatters trigger Regular Bonus. Exactly 4 trigger Super Bonus. 5 or more trigger Super Super Bonus. Every tier starts with 8 free spins. Removing a winning position in free spins adds one Chaos Point. At 12, 30, 55, 85 and 120 points, earn two free spins and a Wild Drop. Super Super Bonus has a 100× minimum bonus payout. Super Super stage four has a '+(config.surge.chance*100).toFixed(2)+'% chance to drop '+config.surge.min+'–'+config.surge.max+' actual ×35 wilds when reached. The full round has a 50,000× ceiling.</p>'+dropTable);
};
let pendingBuy;
function clearBuy(){
  pendingBuy=null;
  $('buy-cards').hidden=false;
  $('buy-confirmation').hidden=true;
  $('buy-feedback').textContent='';
}
$('buy-dialog').addEventListener('close',clearBuy);
$('buy-close').onclick=()=>$('buy-dialog').close();
$('buy-back').onclick=()=>{clearBuy();$('buy-cards').querySelector('button:not(:disabled)')?.focus();};
$('buy-open').onclick=()=>{
  if(state!=='ready')return;
  autoplay=0; controls(); clearBuy();
  const latest=readWallet()??wallet;
  $('buy-wallet').textContent='Stake '+money(latest.stake*100)+' credits · Available '+money(latest.balance)+' credits';
  $('buy-cards').replaceChildren(...buyOptions.map(option=>{
    const quote=quoteBuy(option.id,latest.stake);
    const card=document.createElement('article');
    card.className='buy-card '+option.id;
    const [regular,superBonus,superSuper]=buyProfile.mysteryWeights;
    const chance=weight=>(weight*100/(regular+superBonus+superSuper)).toLocaleString('en-GB',{maximumFractionDigits:2})+'%';
    card.innerHTML='<img alt=""><h3>'+option.name+'</h3><p>'+(
      option.tier===0?'Direct entry to the three-scatter feature.':
      option.tier===1?'Direct entry to the four-scatter feature.':
      'Regular '+chance(regular)+' · Super '+chance(superBonus)+' · Super Super '+chance(superSuper)
    )+'</p><span class="buy-spins">8 STARTING FREE SPINS</span><strong>'+money(quote.cost)+' credits</strong><small>'+ quote.multiplier+'× stake</small>';
    card.querySelector('img').src=assetFile('assets/symbols-v2/'+option.art+'.png');
    const choose=Object.assign(document.createElement('button'),{className:'buy-launch',textContent:'Choose '+option.name,disabled:latest.balance<quote.cost});
    if(choose.disabled)card.insertAdjacentHTML('beforeend','<small>Insufficient fictional credits</small>');
    choose.onclick=()=>{
      pendingBuy=quote;
      $('buy-cards').hidden=true;
      $('buy-confirmation').hidden=false;
      $('buy-quote').textContent='Spend '+money(quote.cost)+' fictional credits on '+option.name+'? The feature starts with 8 free spins.';
      $('buy-back').focus();
    };
    card.append(choose);
    return card;
  }));
  $('buy-dialog').showModal();
};
$('buy-confirm').onclick=()=>{
  if(!pendingBuy||state!=='ready')return;
  const purchase={...pendingBuy,requestId:crypto.randomUUID()};
  pendingBuy=null;
  $('buy-dialog').close();
  audio.unlock();
  void play(null,-1,false,purchase);
};
async function revealMystery(tier){
  transition('mystery');
  const screen=$('mystery-reveal');
  const options=$('mystery-possibilities');
  options.replaceChildren(...tiers.map(name=>Object.assign(document.createElement('span'),{textContent:name})));
  $('mystery-result').textContent='';
  screen.hidden=false;
  audio.cue('beam',2);
  await new Promise(done=>setTimeout(done,prefersReduced?60:1370));
  options.children[tier].classList.add('selected');
  $('mystery-result').textContent=tiers[tier];
  audio.cue('bonus',tier);
  await new Promise(done=>setTimeout(done,prefersReduced?60:1430));
  screen.hidden=true;
}
$('close').onclick=()=>$('panel').close();
$('spin').onclick=()=>{audio.unlock();void play();};
$('mute').onclick=()=>{audio.unlock();updateSettings({mute:!wallet.settings.mute});};
$('turbo').onclick=()=>updateSettings({turbo:!wallet.settings.turbo});
$('auto').onclick=()=>{
  if(autoplay){autoplay=0;controls();return;}
  if(state!=='ready')return;
  openPanel('Autoplay','<p>Play up to 10 paid rounds at your current bet. Use the A button to stop after the active round.</p><button id="start-auto">Start 10 rounds</button>');
  $('start-auto').onclick=()=>{$('panel').close();audio.unlock();autoplay=10;void play();};
};
function adjust(direction){
  if(state!=='ready')return;
  autoplay=0;
  try{commit({stake:amounts[amounts.indexOf(wallet.stake)+direction]});controls();}
  catch{status('Bet could not be saved');}
}
$('minus').onclick=()=>adjust(-1);
$('plus').onclick=()=>adjust(1);
document.addEventListener('keydown',e=>{
  if(e.code==='Space'&&!e.repeat&&!document.querySelector('dialog[open]')&&(e.target===document.body||e.target===$('game'))){
    e.preventDefault();$('spin').click();
  }
});
const preview=[[4,9,3,13],[5,12,11,8,1],[6,1,8,10],[1,9,7,2,5],[2,0,8,11],[3,10,12,13]];
render(preview);
$('ways').textContent=preview.reduce((n,r)=>n*r.length,1).toLocaleString('en-GB')+' WAYS';
document.title=config.title;
$('game').setAttribute('aria-label',config.title);
document.querySelectorAll('h1 img,.intro-content img').forEach(img=>img.alt=config.title);
controls();

function ready(){
  transition('ready');
  if(wallet.active){status('Recovering saved round'); void play(wallet.active);}
}
addEventListener('storage',event=>{
  if(event.key!==key||state!=='ready')return;
  Object.assign(wallet,readWallet());
  displayBalance=wallet.balance;
  controls();
  audio.refresh();
});
const seen=()=>{try{return sessionStorage.getItem('toonageddon-intro');}catch{return false;}};
if(wallet.active||seen()||new URLSearchParams(location.search).has('skipIntro'))ready();
else{
  transition('intro');
  $('intro').showModal();
  const scenes=[
    [0,'space','Deep Space'],[1000,'ufo','The Approach'],[2300,'pilot','The Captain'],[3350,'alarm','Wrong lever'],
    [4100,'beam','Galactic Chaos'],[5900,'reveal','Toonageddon']
  ];
  let sceneIndex=-1,frame,cinematicAudio=false;
  const preloads=[...symbols.map(s=>'assets/reel-art-v4/'+s[1]+'.png'),'assets/reel-art-v4/wild-base.png','assets/reel-art-v4/scatter-ufo.png',...scenes.filter(s=>s[1]!=='alarm').map(s=>'assets/intro-'+s[1]+'.jpg')];
  let fetched=0;
  for(const path of preloads){
    const asset=new Image();
    asset.onload=asset.onerror=()=>fetched++;
    asset.src=assetFile(path);
  }
  const start=performance.now();
  function intro(now){
    const ms=now-start;
    const index=scenes.findLastIndex(scene=>scene[0]<=ms);
    if(index!==sceneIndex&&index>=0){
      sceneIndex=index;
      $('intro').dataset.scene=scenes[index][1];
      if(cinematicAudio) audio.cue(['ambience','spin','expand','alarm','burst','large'][index]);
      $('scene').style.backgroundImage='url('+assetFile('assets/intro-'+(scenes[index][1]==='alarm'?'pilot':scenes[index][1])+'.jpg')+')';
      $('scene-title').textContent=scenes[index][2];
    }
    $('progress').value=Math.min(100,ms/80,100*fetched/preloads.length);
    if(ms<8000)frame=requestAnimationFrame(intro);
    else finish();
  }
  function finish(){
    cancelAnimationFrame(frame);
    try{sessionStorage.setItem('toonageddon-intro','1');}catch{}
    $('intro').close();$('game').classList.add('launch');
    setTimeout(()=>$('game').classList.remove('launch'),470);
    ready();
  }
  $('intro-audio').onclick=()=>{audio.unlock();cinematicAudio=true;$('intro-audio').setAttribute('aria-pressed','true');};
  $('enter').onclick=()=>{audio.unlock();finish();};
  $('intro').addEventListener('cancel',e=>{e.preventDefault();finish();});
  frame=requestAnimationFrame(intro);
}
