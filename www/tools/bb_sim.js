// ===== 球战全配对胜率矩阵 =====
// 用法: node tools/bb_sim.js [每对场次]
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'ballbattle.js'), 'utf8');
const sandbox = {
    performance, console, Math, JSON,
    document: { getElementById: () => null, querySelectorAll: () => [], addEventListener: () => {} },
    window: { addEventListener: () => {} },
};
vm.createContext(sandbox);
vm.runInContext(src + '\nthis.__X = { BB_TYPES, BallBattleGame };', sandbox);
const { BB_TYPES, BallBattleGame } = sandbox.__X;

// _simulate 未初始化 swords 数组，补一层防御（不影响浏览器路径）
const proto = BallBattleGame.prototype;
if (proto._dropSword) {
    const orig = proto._dropSword;
    proto._dropSword = function (...a) { this.swords = this.swords || []; return orig.apply(this, a); };
}
const g = Object.create(proto);

const types = Object.keys(BB_TYPES).filter(t => !BB_TYPES[t].elim && !BB_TYPES[t].noRank);
const SIMS = parseInt(process.argv[2] || '100', 10);
const wins = {}, games = {}, draws = {};
const matrix = {};
for (const a of types) { wins[a] = 0; games[a] = 0; draws[a] = 0; matrix[a] = {}; }

for (let i = 0; i < types.length; i++) {
    for (let j = i + 1; j < types.length; j++) {
        const ta = types[i], tb = types[j];
        let wa = 0, wb = 0, dr = 0;
        for (let k = 0; k < SIMS; k++) {
            const w = g._simulate(ta, tb);
            games[ta]++; games[tb]++;
            if (w === ta) { wa++; wins[ta]++; }
            else if (w === tb) { wb++; wins[tb]++; }
            else { dr++; draws[ta]++; draws[tb]++; }
        }
        matrix[ta][tb] = wa / SIMS;
        matrix[tb][ta] = wb / SIMS;
    }
    process.stderr.write('done ' + types[i] + ' (' + (i + 1) + '/' + types.length + ')\n');
}

const name = t => BB_TYPES[t].name;
const pad = (s, n) => { s = String(s); while (s.length < n) s += ' '; return s; };

console.log('\n===== 胜率矩阵 (行胜率 vs 列) =====');
let head = pad('', 5);
for (const t of types) head += pad(name(t), 5);
console.log(head);
for (const a of types) {
    let row = pad(name(a), 5);
    for (const b of types) row += a === b ? pad(' - ', 5) : pad((matrix[a][b] * 100).toFixed(0), 5);
    console.log(row);
}

console.log('\n===== 总胜率排行 =====');
const rank = types.map(t => ({ t, rate: games[t] ? wins[t] / games[t] : 0 }))
    .sort((x, y) => y.rate - x.rate);
rank.forEach((r, i) => {
    const T = BB_TYPES[r.t];
    console.log(pad('#' + (i + 1), 4) + pad(name(r.t), 5) +
        ' 胜率 ' + (r.rate * 100).toFixed(1) + '%  ' +
        wins[r.t] + '胜/' + games[r.t] + '场  平' + draws[r.t] +
        '  (' + T.hp + '血/' + T.atk + '攻/' + T.spd + '速)');
});

console.log('\n===== 每球克制与被克制 (胜率<40%被克, >60%克制) =====');
for (const a of types) {
    const beats = types.filter(b => b !== a && matrix[a][b] >= 0.6).map(b => name(b) + (matrix[a][b] * 100).toFixed(0) + '%');
    const loses = types.filter(b => b !== a && matrix[a][b] <= 0.4).map(b => name(b) + (matrix[a][b] * 100).toFixed(0) + '%');
    console.log(name(a) + ': 克[' + (beats.join(' ') || '无') + '] 被[' + (loses.join(' ') || '无') + ']');
}
