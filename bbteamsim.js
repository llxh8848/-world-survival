// 队伍强度测试：所有2球/3球组合两两循环对战，输出各队伍胜率到 sim_teams.txt
const fs = require('fs');
const src = fs.readFileSync('F:/xy/xyxnyz/www/js/ballbattle.js', 'utf8');
const mod = { exports: {} };
eval(src + '\nmod.exports = { BB_TYPES, BB_SYNERGY, BallBattleGame };');
const { BB_TYPES, BallBattleGame } = mod.exports;

const g = Object.create(BallBattleGame.prototype);
const types = Object.keys(BB_TYPES);
const SIMS = 15;

function combos(arr, k) {
    const res = [];
    (function go(start, cur) {
        if (cur.length === k) { res.push(cur.slice()); return; }
        for (let i = start; i < arr.length; i++) { cur.push(arr[i]); go(i + 1, cur); cur.pop(); }
    })(0, []);
    return res;
}
const tname = t => BB_TYPES[t].name;

function roundRobin(teams, label, out) {
    const wins = {}, games = {}, draws = {};
    teams.forEach((t, i) => { wins[i] = 0; games[i] = 0; draws[i] = 0; });
    out.push('==== ' + label + '（' + teams.length + '队，每对' + SIMS + '场） ====');
    for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
            let wa = 0, wb = 0, dr = 0;
            for (let k = 0; k < SIMS; k++) {
                const w = g._simulateTeams(teams[i], teams[j]);
                if (w === 0) wa++; else if (w === 1) wb++; else dr++;
            }
            wins[i] += wa; wins[j] += wb;
            draws[i] += dr; draws[j] += dr;
            games[i] += SIMS; games[j] += SIMS;
            if (wa !== 0 || wb !== 0 || dr !== 0)
                out.push(teams[i].map(tname).join('+') + ' vs ' + teams[j].map(tname).join('+') +
                    ': ' + wa + '-' + wb + ' (平' + dr + ')');
        }
    }
    out.push('---- ' + label + '胜率榜 ----');
    teams.map((t, i) => ({ i, r: wins[i] / games[i] }))
        .sort((a, b) => b.r - a.r)
        .forEach((x, n) => out.push('#' + (n + 1) + ' ' + teams[x.i].map(tname).join('+') +
            ': ' + (x.r * 100).toFixed(1) + '% (' + wins[x.i] + '胜' + draws[x.i] + '平/' + games[x.i] + '场)'));
    out.push('');
}

const out = [];
roundRobin(combos(types, 2), '2球队伍', out);
roundRobin(combos(types, 3), '3球队伍', out);
fs.writeFileSync('F:/xy/xyxnyz/sim_teams.txt', out.join('\n'));
console.log('done, lines=' + out.length);
