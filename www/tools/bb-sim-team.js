// 队伍强度模拟：node tools\bb-sim-team.js <队伍人数2|3> [每队对手数] [每对场数]
// 全部无重复组合队伍 vs 随机对手采样，按胜率排名输出前8 + 灌伤组相关排名
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '\\..\\js\\ballbattle.js', 'utf8');
vm.runInThisContext(src + '\n;globalThis.__BB={BallBattleGame:BallBattleGame,BB_TYPES:BB_TYPES,BB_SYNERGY:BB_SYNERGY};');
const { BallBattleGame, BB_TYPES, BB_SYNERGY } = globalThis.__BB;

const N = parseInt(process.argv[2] || '2', 10);      // 每队人数
const OPPS = parseInt(process.argv[3] || '30', 10);  // 每队抽多少个对手
const GAMES = parseInt(process.argv[4] || '3', 10);  // 每个对手打几场
const host = Object.create(BallBattleGame.prototype);
host.uiSpeed = 1;

const types = Object.keys(BB_TYPES);
// 全部C(15,N)无重复组合
const teams = [];
(function comb(start, cur) {
    if (cur.length === N) { teams.push(cur.slice()); return; }
    for (let i = start; i < types.length; i++) { cur.push(types[i]); comb(i + 1, cur); cur.pop(); }
})(0, []);

const wins = new Array(teams.length).fill(0), games = new Array(teams.length).fill(0);
for (let i = 0; i < teams.length; i++) {
    for (let s = 0; s < OPPS; s++) {
        const j = Math.floor(Math.random() * teams.length);
        if (j === i) continue;
        for (let g = 0; g < GAMES; g++) {
            const flip = Math.random() < 0.5;
            const w = flip ? host._simulateTeams(teams[i], teams[j]) : host._simulateTeams(teams[j], teams[i]);
            const wi = w === null ? -1 : (flip ? w : 1 - w); // -1平 0=teams[i]赢 1=teams[j]赢
            games[i]++; games[j]++;
            if (wi === 0) wins[i]++; else if (wi === 1) wins[j]++;
        }
    }
    if ((i + 1) % 25 === 0) console.error('进度 ' + (i + 1) + '/' + teams.length);
}
const rank = teams.map((t, i) => ({ t, r: games[i] ? wins[i] / games[i] : 0, g: games[i] }))
    .sort((a, b) => b.r - a.r);
const name = tt => tt.map(x => BB_TYPES[x].name).join('+');
// 找每个队伍命中的羁绊
const synOf = tt => BB_SYNERGY.filter(s => s.types.every(x => tt.includes(x))).map(s => s.name).join(',');
console.log('==== ' + N + 'v' + N + ' 队伍排名（' + teams.length + '队，每队约' + OPPS * GAMES + '场）====');
rank.slice(0, 8).forEach((x, i) =>
    console.log('#' + (i + 1), name(x.t), (x.r * 100).toFixed(1) + '%', synOf(x.t) ? '[' + synOf(x.t) + ']' : ''));
// 灌伤组/含灌伤成员的队伍排名
const GS = ['pct', 'roll', 'boot'];
rank.forEach((x, i) => {
    const hit = GS.filter(m => x.t.includes(m));
    if (hit.length === N || (N === 3 && hit.length === 3))
        console.log('>> #' + (i + 1), name(x.t), (x.r * 100).toFixed(1) + '%', '命中灌伤成员:' + hit.length + '/' + N, synOf(x.t) ? '[' + synOf(x.t) + ']' : '');
});
