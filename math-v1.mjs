export const v1Config = Object.freeze({
  version: '1.0.1', title: 'Toonageddon', cap: 5000000, guarantee: 10000,
  heights: [0.4, 0.4, 0.2], wildChance: .01, expandChance: .003,
  scatterField: { stormChance: .014472359475164858, quiet: .0542, storm: .3145 },
  weights: [5,5,6,6,7,7,7,8,8,10,10,10,10,11],
  milestones: [12,30,55,85,120],
  drops: [
    [[2,5,2],[4,7,4],[5,9,6],[7,11,10],[9,14,15]],
    [[3,6,3],[5,9,6],[7,11,10],[9,14,15],[11,17,25]],
    [[5,9,5],[7,12,10],[9,15,20],[12,18,35],[15,22,50]]
  ]
});
export const tiers = ['Regular Bonus','Super Bonus','Super Super Bonus'];
export const symbols = [
 ['Alien Boss','alien-boss',20,60,200,800],
 ['Cyclopz','cyclopz',15,45,150,600],
 ['Octo-Lab','octo-lab',12,36,120,500],
 ['Space Cow','space-cow',10,30,100,400],
 ['Ray Gun','ray-gun',8,20,60,200],
 ['Asteroid','asteroid',7,18,50,150],
 ['Satellite','satellite',6,15,40,120],
 ['Toxic Barrel','toxic-barrel',5,12,30,100],
 ['Planet','planet',5,10,25,80],
 ['A','card-a',4,8,20,60],
 ['K','card-k',4,8,18,50],
 ['Q','card-q',3,6,15,40],
 ['J','card-j',3,6,12,35],
 ['10','card-10',2,5,10,30]
];