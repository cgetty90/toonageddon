import {v1Config} from './math-v1.mjs';

export const config = Object.freeze({
  ...v1Config,
  version:'2.0.0',
  drops:[
    [[3,3,2],[3,3,4],[3,3,6],[2,3,10],[2,3,15]],
    [[3,3,3],[3,3,6],[3,3,10],[3,3,15],[3,3,25]],
    [[3,3,5],[3,3,10],[3,3,20],[3,3,35],[3,3,50]]
  ],
  surge:{tier:2,level:4,chance:.0015,min:12,max:18}
});