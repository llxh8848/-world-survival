// 球球大作战强度模拟：node tools\bb-sim.js [--sims N] [type:key=val,...]...
// 例子：node tools\bb-sim.js --sims 80 roll:rollDmg=280,rollEvery=5 speed:spd=2.2
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '\\..\\js\\ballbattle.js', 'utf8');
vm.runInThisContext(src + '\n;globalThis.__BB={BallBattleGame:BallBattleGame,BB_TYPES:BB_TYPES};');
const { BallBattleGame, BB_TYPES } = globalThis.__BB;

let SIMS = 60;
const args = process.argv.slice(2);
for (const a of args) {
    if (a.startsWith('--sims')) SIMS = parseInt(a.split('=')[1] || '60', 10);
    else {
        const [type, kv] = a.split(':');
        kv.split(',').forEach(p => {
            const [k, v] = p.split('=');
            BB_TYPES[type][k] = isNaN(+v) ? v : +v;
        });
    }
}
const host = Object.create(BallBattleGame.prototype);
host.uiSpeed = 1;
const types = Object.keys(BB_TYPES);
const wins = {}, games = {};
types.forEach(t => { wins[t] = 0; games[t] = 0; });
for (let i = 0; i < types.length; i++)
    for (let j = i + 1; j < types.length; j++) {
        const ta = types[i], tb = types[j];
        for (let k = 0; k < SIMS; k++) {
            const w = host._simulate(ta, tb);
            games[ta]++; games[tb]++;
            if (w === ta) wins[ta]++; else if (w === tb) wins[tb]++;
        }
    }
types.map(t => ({ t, n: BB_TYPES[t].name, r: wins[t] / games[t] }))
    .sort((a, b) => b.r - a.r)
    .forEach((x, i) => console.log('#' + (i + 1), x.n.padEnd(4), (x.r * 100).toFixed(1) + '%', '(' + wins[x.t] + '/' + games[x.t] + ')'));
