export function createAudio(settings) {
  let ctx, music, effects, compressor, noise, interval, beat=0;
  const chords=[[46,53,58,62],[43,50,55,62],[41,48,53,57],[44,51,56,60]];
  const hz=n=>440*2**((n-69)/12);
  function tone(note,time,duration,gain,bus,wave='sine',end=note){
    const voice=ctx.createOscillator(),env=ctx.createGain();
    voice.type=wave;
    voice.frequency.setValueAtTime(hz(note),time);
    voice.frequency.exponentialRampToValueAtTime(hz(end),time+duration);
    env.gain.setValueAtTime(.0001,time);
    env.gain.exponentialRampToValueAtTime(gain,time+.014);
    env.gain.exponentialRampToValueAtTime(.0001,time+duration);
    voice.connect(env).connect(bus);
    voice.start(time);voice.stop(time+duration+.01);
  }
  function texture(dur,low,high,volume,pan=0,delay=0){
    if(!noise)return;
    const now=ctx.currentTime+.005+delay;
    const source=ctx.createBufferSource(), filter=ctx.createBiquadFilter(), level=ctx.createGain(), space=ctx.createStereoPanner();
    source.buffer=noise;
    filter.type='bandpass';filter.Q.value=.83;
    filter.frequency.setValueAtTime(low,now);
    filter.frequency.exponentialRampToValueAtTime(high,now+dur);
    level.gain.setValueAtTime(.001,now);
    level.gain.exponentialRampToValueAtTime(volume,now+.018);
    level.gain.exponentialRampToValueAtTime(.001,now+dur);
    space.pan.value=pan;
    source.connect(filter).connect(level).connect(space).connect(effects);
    source.start(now);source.stop(now+dur);
  }
  function refresh(){
    if(!ctx)return;
    const s=settings();
    music.gain.setTargetAtTime(s.mute?0:s.music,ctx.currentTime,.04);
    effects.gain.setTargetAtTime(s.mute?0:s.effects,ctx.currentTime,.04);
  }
  function unlock(){
    try{
      if(!ctx){
        ctx=new AudioContext();
        music=ctx.createGain();effects=ctx.createGain();compressor=ctx.createDynamicsCompressor();
        music.connect(compressor);effects.connect(compressor);compressor.connect(ctx.destination);
        compressor.threshold.value=-17;compressor.knee.value=16;compressor.ratio.value=5;
        compressor.attack.value=.008;compressor.release.value=.19;
        noise=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);
        const samples=noise.getChannelData(0);
        let seed=818391;
        for(let i=0;i<samples.length;i++){
          seed=(Math.imul(seed,1664525)+1013904223)>>>0;
          samples[i]=seed/2147483648-1;
        }
        refresh();
        interval=setInterval(()=>{
          if(ctx.state!=='running'||document.hidden||settings().mute)return;
          const tier=Number(document.getElementById('game').dataset.tier||0);
          const chord=chords[Math.floor(beat/8)%chords.length];
          const now=ctx.currentTime+.025;
          tone(chord[beat%4]+(tier?12:0),now,.34,.052,music,'triangle');
          if(beat%4===0)tone(chord[0]-12,now,.85,.072,music);
          if(tier>1&&beat%2===1)tone(35+tier,now,.15,.057,music,'triangle',24);
          beat++;
        },245);
      }
      void ctx.resume().catch(()=>{});
    }catch{}
  }
  const cues={
    scatterLaunch:[45,57],scatterLand:[52,64,76],
    ambience:[31,43,50],alarm:[63,75,63],spin:[36,42,48],stop:[48],scatter:[63,70,75],expand:[50,62,74],win:[64,68,71,76],burst:[54,36],
    tumble:[74,66,55],bonus:[48,55,60,67,72],milestone:[67,72,76,84],beam:[38,49,63],drop:[56,43,68],
    large:[60,64,67,72,76,79],cap:[48,55,60,64,67,72,76,79,84]
  };
  function cue(name,variant=0){
    if(!ctx||ctx.state!=='running'||settings().mute||!cues[name])return;
    const now=ctx.currentTime+.01;
    if(name==='spin'){
      texture(.33,220,1750,.078);
      texture(.73,410,1200,.051,0,.16);
      tone(29,now,.54,.066,effects,'triangle',43);
    }
    if(name==='stop'){
      texture(.072,1650,220,.12,(variant-2.5)/3);
      tone(34+variant,now,.095,.092,effects,'sine',25+variant);
    }
    if(name==='scatterLaunch')texture(.19,420,2800,.078,(variant-2)/3);
    if(name==='scatterLand'){
      texture(.12,2700,510,.10,(variant-2)/3);
      tone(39+variant,now,.18,.094,effects,'sine',30);
    }
    if(name==='burst')texture(.26,1720,110,.15);
    if(name==='tumble')texture(.19,250,116,.075);
    if(name==='expand')texture(.41,540,3700,.073);
    if(name==='beam')texture(.35,140,2200,.11);
    if(name==='drop')texture(.29,1300,340,.13);
    if(name==='alarm')texture(.31,230,1800,.06);
    const low=['burst','spin','beam','stop','scatterLaunch'].includes(name);
    cues[name].forEach((n,i)=>tone(n+variant,now+i*.055,low?.17:.26,low?.11:.065,effects,low?'triangle':'sine',low?n-9:n+variant));
  }
  addEventListener('pagehide',()=>{if(interval)clearInterval(interval);});
  return {unlock,refresh,cue};
}