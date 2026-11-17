// ===== 单场对局探针：打印每局胜者/时长/存活血量（复刻 _simulate） =====
// 用法: node tools/bb_probe.js <球A> <球B> [场次]
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
const proto = BallBattleGame.prototype;
const g = Object.create(proto);

const [ta, tb] = [process.argv[2] || 'boot', process.argv[3] || 'stun'];
const N = parseInt(process.argv[4] || '10', 10);
console.log(BB_TYPES[ta].name + ' vs ' + BB_TYPES[tb].name + ' x' + N);
for (let i = 0; i < N; i++) {
    const sim = Object.create(proto);
    sim.canvas = { width: 800, height: 600 };
    sim.picks = [ta, tb];
    sim.floats = []; sim.particles = []; sim.pills = []; sim.shots = [];
    sim.balls = [g._makeBall(ta, 200, 300), g._makeBall(tb, 600, 300)];
    sim.balls[0].team = 0; sim.balls[1].team = 1;
    sim.bounds = { x: 0, y: 0, w: 800, h: 600 };
    sim.timeMul = sim.balls.some(b => b.pillEvery) ? 1.8 : 1;
    sim.uiSpeed = 1;
    sim.battleTime = 0; sim.phase = 'battle'; sim.winner = null;
    sim._overTimer = 0; sim.isSim = true;
    sim._float = () => {}; sim._sparks = () => {}; sim._explode = () => {};
    let steps = 0;
    while (sim.phase === 'battle' && steps < 5400) { sim._update(1 / 30); steps++; }
    const a = sim.balls[0], b = sim.balls[1];
    console.log('局' + (i + 1) + ': ' + (steps / 30).toFixed(1) + 's  ' +
        a.name + ' ' + Math.round(a.hp) + (a.dead ? '死' : '') + ' / ' +
        b.name + ' ' + Math.round(b.hp) + (b.dead ? '死' : '') +
        ' → ' + (sim.winner ? sim.winner.name : '平'));
}
