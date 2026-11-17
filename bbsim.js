const fs = require('fs');
const src = fs.readFileSync('F:/xy/xyxnyz/www/js/ballbattle.js', 'utf8');
const mod = { exports: {} };
eval(src + '\nmod.exports = { BB_TYPES, BallBattleGame };');
const { BB_TYPES, BallBattleGame } = mod.exports;

const g = Object.create(BallBattleGame.prototype);
const types = Object.keys(BB_TYPES);
const SIMS = 80;
const out = [];
const wins = {}, games = {};
types.forEach(t => { wins[t] = 0; games[t] = 0; });
for (let i = 0; i < types.length; i++) {
    for (let j = i + 1; j < types.length; j++) {
        const ta = types[i], tb = types[j];
        let wa = 0, wb = 0, dr = 0;
        for (let k = 0; k < SIMS; k++) {
            const w = g._simulate(ta, tb);
            if (w === ta) wa++; else if (w === tb) wb++; else dr++;
        }
        wins[ta] += wa; wins[tb] += wb;
        games[ta] += SIMS; games[tb] += SIMS;
        out.push(`${BB_TYPES[ta].name} vs ${BB_TYPES[tb].name}: ${wa}-${wb} (平${dr})`);
    }
}
out.push('---- 总胜率 ----');
types.map(t => ({ t, r: wins[t] / games[t] })).sort((a, b) => b.r - a.r)
    .forEach(x => out.push(`${BB_TYPES[x.t].name}: ${(x.r * 100).toFixed(1)}%`));
fs.writeFileSync('F:/xy/xyxnyz/sim_result.txt', out.join('\n'));
