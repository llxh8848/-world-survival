// BOSS模拟：指定BOSS球 vs 所有3球挑战者组合（同种最多2个），输出胜率到 sim_boss.txt
const fs = require('fs');
const src = fs.readFileSync('F:/xy/xyxnyz/www/js/ballbattle.js', 'utf8');
const mod = { exports: {} };
eval(src + '\nmod.exports = { BB_TYPES, BB_SYNERGY, BallBattleGame };');
const { BB_TYPES, BallBattleGame } = mod.exports;

const g = Object.create(BallBattleGame.prototype);
const types = Object.keys(BB_TYPES);
const SIMS = 15;
const BOSS_TYPE = process.env.BOSS || 'judge'; // BOSS球种（默认超伤）

// 3球组合（multiset，每种最多2个）
function combos(arr, k, maxDup) {
    const res = [];
    (function go(start, cur) {
        if (cur.length === k) { res.push(cur.slice()); return; }
        for (let i = start; i < arr.length; i++) {
            if (cur.filter(t => t === arr[i]).length >= maxDup) continue;
            cur.push(arr[i]); go(i, cur); cur.pop();
        }
    })(0, []);
    return res;
}

// 复刻 _startBattle 的BOSS模式造球，无头跑一局，返回胜方team（0=BOSS, 1=挑战者, null=平）
function simBoss(bossType, challs) {
    const sim = Object.create(BallBattleGame.prototype);
    sim.canvas = { width: 800, height: 600 };
    sim.floats = []; sim.particles = []; sim.pills = [];
    sim.bossBattle = true;
    sim.noShrink = true; // BOSS模式不缩圈
    const balls = [];
    const boss = g._makeBall(bossType, 400, 300);
    boss.isBoss = true;
    boss.hp = boss.maxHp = 4000;
    boss.atk *= 3;
    boss.judgeDps *= 3;
    boss.auraDmg *= 3;
    boss.dmgReduce += 0.10;
    boss.r = 30 * 1.8;
    boss.spdMul = 2;
    sim._normalize ? null : null;
    BallBattleGame.prototype._normalize.call(sim, boss);
    boss.team = 0;
    balls.push(boss);
    challs.forEach((t, i) => {
        const b = g._makeBall(t, 800 * (i + 1) / (challs.length + 1), 180 + i * 200);
        b.team = 1;
        balls.push(b);
    });
    sim.balls = balls;
    sim.bounds = { x: 0, y: 0, w: 800, h: 600 };
    sim.timeMul = sim.balls.some(b => b.pillEvery) ? 1.8 : 1;
    sim.battleTime = 0;
    sim.phase = 'battle';
    sim.winner = null;
    sim._overTimer = 0;
    sim.isSim = true;
    sim._float = () => {};
    sim._sparks = () => {};
    sim._explode = () => {};
    sim._applySynergy(); // 挑战者同队可触发羁绊
    let steps = 0;
    while (sim.phase === 'battle' && steps < 5400) { sim._update(1 / 30); steps++; }
    return { team: sim.winner ? sim.winner.team : null, t: sim.battleTime };
}

const teams = combos(types, 3, 2);
const tn = t => BB_TYPES[t].name;
const out = [];
out.push('==== BOSS: ' + tn(BOSS_TYPE) + '（血4000 伤×3 速×2 体型×1.8 减伤10% 不缩圈）====');
out.push('==== 3球挑战者组合 ' + teams.length + ' 个，每个' + SIMS + '场 ====');
const res = [];
let bossWins = 0, challWins = 0, draws = 0;
for (const team of teams) {
    let w = 0, l = 0, d = 0, tt = 0;
    for (let i = 0; i < SIMS; i++) {
        const r = simBoss(BOSS_TYPE, team);
        tt += r.t;
        if (r.team === 1) w++; else if (r.team === 0) l++; else d++;
    }
    bossWins += l; challWins += w; draws += d;
    res.push({ team, w, l, d, avg: tt / SIMS });
    if (w > 0) out.push(team.map(tn).join('+') + ': 挑战者胜' + w + ' BOSS胜' + l + ' 平' + d);
}
out.push('---- 总结 ----');
out.push('BOSS总胜' + bossWins + ' 挑战者总胜' + challWins + ' 平' + draws);
out.push('能赢BOSS的组合（按胜率排序）:');
res.filter(r => r.w > 0).sort((a, b) => (b.w - b.d * 0.0) - a.w || a.l - b.l)
    .forEach((r, i) => out.push('#' + (i + 1) + ' ' + r.team.map(tn).join('+') +
        ': ' + (r.w / SIMS * 100).toFixed(0) + '% (' + r.w + '胜/' + SIMS + '场)'));
out.push('---- 全榜（按对BOSS胜率、存活时长排序） ----');
res.slice().sort((a, b) => b.w - a.w || b.avg - a.avg)
    .forEach((r, i) => out.push('#' + (i + 1) + ' ' + r.team.map(tn).join('+') +
        ': 挑战者' + r.w + '胜 BOSS' + r.l + '胜 平' + r.d + ' 平均存活' + r.avg.toFixed(1) + 's'));
fs.writeFileSync('F:/xy/xyxnyz/sim_boss_' + BOSS_TYPE + '.txt', out.join('\n'));
console.log('done, teams=' + teams.length + ', bossWins=' + bossWins + ' challWins=' + challWins + ' draws=' + draws);
