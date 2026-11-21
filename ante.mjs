import {config} from './math-v2.mjs';

export const anteProfile = Object.freeze({
  ...config,
  version:'2.0.0-ante-1',
  scatterField:Object.freeze({stormChance:.053,quiet:.0924,storm:.3145})
});
export const anteMultiplier=3;
export const paidCost=(stake,ante)=>stake*100*(ante?anteMultiplier:1);
