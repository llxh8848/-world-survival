// Node DOM 桩：加载 pvz.js 并在所有界面上跑 _update/_draw，捕获首个异常
const fs = require('fs'), vm = require('vm');

function mkCtx() {
    const grad = { addColorStop() { } };
    return new Proxy({
        canvas: null,
        measureText: () => ({ width: 10 }),
        createLinearGradient: () => grad,
        createRadialGradient: () => grad,
        createPattern: () => ({}),
        getImageData: () => ({ data: new Uint8ClampedArray(4) }),
        setTransform() { },
    }, {
        get(t, k) {
            if (k in t) return t[k];
            // 未定义的属性：方法返回noop函数，属性返回0
            return typeof k === 'string' ? (t[k] = function () { }) : undefined;
        },
        set(t, k, v) { t[k] = v; return true; }
    });
}
function mkCanvas() {
    return {
        width: 300, height: 150,
        getContext: () => mkCtx(),
        addEventListener() { },
        getBoundingClientRect: () => ({ left: 0, top: 0 }),
    };
}
const store = {};
const sandbox = {
    console, Math, JSON, Set, Map, Array, Object, Number, String, Boolean, Uint8ClampedArray, Promise,
    innerWidth: 1100, innerHeight: 620,
    devicePixelRatio: 1,
    performance: { now: () => Date.now() },
    requestAnimationFrame: (fn) => 0,
    cancelAnimationFrame() { },
    addEventListener() { },
    localStorage: {
        getItem: k => store[k] ?? null,
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: k => { delete store[k]; },
    },
    document: {
        getElementById: () => mkCanvas(),
        createElement: () => mkCanvas(),
        addEventListener() { },
    },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const src = fs.readFileSync('D:\\xyxnyz\\www\\js\\pvz.js', 'utf8');
try {
    vm.runInContext(src + '\n;this.__PvzGame = PvzGame; this.__PVZ_LEVELS = PVZ_LEVELS; this.__PVZ_CHALLENGES = PVZ_CHALLENGES;', sandbox);
} catch (e) {
    console.log('LOAD FAIL:', e.stack); process.exit(1);
}
const G = sandbox.__PvzGame, LV = sandbox.__PVZ_LEVELS, CH = sandbox.__PVZ_CHALLENGES;
const g = new G();

function run(label, frames = 5) {
    try {
        for (let i = 0; i < frames; i++) { g._last += 16; g._update(0.016); g._draw(); }
        console.log('OK  ', label, '| screen=' + g.screen);
        return true;
    } catch (e) {
        console.log('FAIL', label, '| screen=' + g.screen);
        console.log(e.stack.split('\n').slice(0, 6).join('\n'));
        return false;
    }
}

run('home');
// 普通关：逐个进入1-1~1-9并渲染
for (let i = 0; i < LV.length; i++) {
    try { g._openChoose(i, false); } catch (e) { console.log('FAIL openChoose L' + i, e.stack.split('\n')[0]); continue; }
    if (g.screen === 'choose') {
        if (!run('choose L' + i)) continue;
        try { g._startGame(); } catch (e) { console.log('FAIL startGame L' + i, e.stack.split('\n').slice(0,5).join('\n')); continue; }
    }
    if (!run('game L' + i + ' early', 30)) continue;
    // 快进模拟：跑15秒游戏时间
    try { for (let f = 0; f < 900; f++) { g._last += 16; g._update(0.016); } } catch (e) { console.log('FAIL update L' + i, e.stack.split('\n').slice(0,6).join('\n')); continue; }
    run('game L' + i + ' t=15s', 10);
}
// 挑战关
for (let i = 0; i < CH.length; i++) {
    try { g._openChoose(i, true); } catch (e) { console.log('FAIL openChoose C' + i, e.stack.split('\n')[0]); continue; }
    if (g.screen === 'choose') { if (!run('choose C' + i)) continue; try { g._startGame(); } catch (e) { console.log('FAIL startGame C' + i, e.stack.split('\n').slice(0,5).join('\n')); continue; } }
    if (!run('game C' + i + ' early', 30)) continue;
    try { for (let f = 0; f < 900; f++) { g._last += 16; g._update(0.016); } } catch (e) { console.log('FAIL update C' + i, e.stack.split('\n').slice(0,6).join('\n')); continue; }
    run('game C' + i + ' t=15s', 10);
}
// 火柴人改版：选关页→L1剧情→种4个石子火柴人→快进走完一旗→结算→选关页→L2剧情+时钟火柴人
try {
    g._openStick();
    run('stickmenu', 10);
    g._click(175, 330); // 第1关卡片（4关后卡位：x0=80，间距250）
    run('stick story', 20); // 剧情过场渲染
    for (let k = 0; k < 14 && g.stick.phase === 'story'; k++) { g.stick.story.t = 99; g.stick._click(500, 300); }
    console.log('stick L1 story done phase=' + g.stick.phase);
    run('stick intro', 10);
    g.stick.ink = 999;
    g.stick._click(193, 46); // 选石子卡
    g.stick._click(291, 148); g.stick._click(369, 252); g.stick._click(291, 356);
    g.stick.cd.thrower = 0; g.stick.sel = 'thrower'; g.stick._click(369, 460); // 补第4个
    g.stick._click(500, 200); // 空地点击（未选中，应无异常）
    for (let f = 0; f < 5600 && g.stick.phase === 'play'; f++) {
        g._last += 16; g._update(0.016);
        if (f % 500 === 0) g._draw();
    }
    console.log('stick L1 end phase=' + g.stick.phase + ' killed=' + g.stick.killed + '/' + g.stick.total + ' t=' + g.stick.time.toFixed(1) + ' stkLv=' + g.stkLv);
    if (g.stick.phase === 'play') { // 快推：强制清场→触发胜利结算+解锁L2
        g.stick.zombies = []; g.stick.planI = g.stick.plan.length;
        g.stick.flagDone = true; g.stick.flagQ = [];
        g._update(0.016);
        console.log('stick L1 forced win phase=' + g.stick.phase + ' stkLv=' + g.stkLv);
    }
    run('stick over', 10);
    g.stick._click(450, 428); // 再来一次（跳剧情直接开战）
    run('stick retry', 10);
    g.stick.phase = 'lose'; run('stick lose', 5);
    g.stick._click(650, 428); // 返回主页→选关页
    console.log('stick back screen=' + g.screen + ' stkLv=' + g.stkLv);
    run('stickmenu after', 5);
    if (g.screen === 'stickmenu' && g.stkLv >= 2) { // L1胜利后解锁第2关
        g._click(425, 330); // 第2关卡片
        run('stick L2 story', 20);
        for (let k = 0; k < 16 && g.stick.phase === 'story'; k++) { g.stick.story.t = 99; g.stick._click(500, 300); }
        console.log('stick L2 story done phase=' + g.stick.phase);
        g.stick.ink = 999;
        g.stick._click(265, 46); // 选时钟火柴人卡
        g.stick._click(291, 148); // 种下
        g.stick.ink = 999; g.stick.cd.thrower = 0; g.stick._click(193, 46); g.stick._click(369, 148); // 石子
        for (let f = 0; f < 1400 && g.stick.phase === 'play'; f++) {
            g._last += 16; g._update(0.016);
            if (f % 300 === 0) g._draw();
        }
        console.log('stick L2 t=' + g.stick.time.toFixed(1) + ' zombies=' + g.stick.zombies.length + ' inks=' + g.stick.inks.length + ' killed=' + g.stick.killed + '/' + g.stick.total + ' phase=' + g.stick.phase);
        if (g.stick.phase === 'play') { // 快推L2→解锁L3
            g.stick.zombies = []; g.stick.planI = g.stick.plan.length;
            g.stick.flagDone = true; g.stick.flagQ = [];
            g._update(0.016);
            console.log('stick L2 forced win phase=' + g.stick.phase + ' stkLv=' + g.stkLv);
        }
        g.stick._click(650, 428); // 返回主页→选关页
        run('stickmenu end', 5);
    }
    if (g.screen === 'stickmenu' && g.stkLv >= 3) { // L3：红温火柴人
        g._click(675, 330); // 第3关卡片
        run('stick L3 story', 20);
        for (let k = 0; k < 20 && g.stick.phase === 'story'; k++) { g.stick.story.t = 99; g.stick._click(500, 300); }
        console.log('stick L3 story done phase=' + g.stick.phase);
        g.stick.ink = 999;
        g.stick._click(193, 46); g.stick._click(369, 252); // 石子
        g.stick.ink = 999; g.stick._click(337, 46); g.stick._click(369, 148); // 红温①(相邻)→爆+buff1
        g.stick.ink = 999; g.stick.cd.rage = 0; g.stick.sel = 'rage'; g.stick._click(291, 252); // 红温②→buff2
        for (let f = 0; f < 1300 && g.stick.phase === 'play'; f++) {
            g._last += 16; g._update(0.016);
            if (f % 300 === 0) g._draw();
        }
        let buffs = 0; for (const col of g.stick.grid) for (const p of col) if (p && p.buff) buffs += p.buff;
        console.log('stick L3 t=' + g.stick.time.toFixed(1) + ' zombies=' + g.stick.zombies.length + ' buffLayers=' + buffs + ' killed=' + g.stick.killed + '/' + g.stick.total + ' phase=' + g.stick.phase);
        if (g.stick.phase === 'play') { // 快推L3→解锁L4
            g.stick.zombies = []; g.stick.planI = g.stick.plan.length;
            g.stick.flagDone = true; g.stick.flagQ = [];
            g._update(0.016);
            console.log('stick L3 forced win phase=' + g.stick.phase + ' stkLv=' + g.stkLv);
            g.stick._click(650, 428); // 返回主页→选关页
        }
    }
    if (g.screen === 'stickmenu' && g.stkLv >= 4) { // L4：绿帽子僵尸
        g._click(925, 330); // 第4关卡片
        run('stick L4 story', 20);
        for (let k = 0; k < 16 && g.stick.phase === 'story'; k++) { g.stick.story.t = 99; g.stick._click(500, 300); }
        console.log('stick L4 story done phase=' + g.stick.phase);
        for (let f = 0; f < 1780 && g.stick.phase === 'play'; f++) { g._last += 16; g._update(0.016); } // ~28.5s
        console.log('stick L4 t=' + g.stick.time.toFixed(1) + ' zombies@29s=' + g.stick.zombies.filter(z => !z.dead).length + '(应为0:首波30s)');
        for (let f = 0; f < 200 && g.stick.phase === 'play'; f++) { g._last += 16; g._update(0.016); } // ~31.7s：波1出场
        console.log('stick L4 wave1 planI=' + g.stick.planI + ' zombies=' + g.stick.zombies.length);
        // 波2-4：清场推进（每波1只）
        for (let w = 0; w < 3 && g.stick.planI < g.stick.plan.length; w++) { g.stick.zombies = []; g._update(0.016); }
        console.log('stick L4 planI=' + g.stick.planI + '/4 zombies=' + g.stick.zombies.length);
        // 第5波=旗波：清场触发，快进让flagQ出完8只
        g.stick.zombies = []; g._update(0.016);
        console.log('stick L4 flagDone=' + g.stick.flagDone + '(第5波旗波)');
        g.stick.time = g.stick.flagT + 16;
        for (let f = 0; f < 60; f++) { g._last += 16; g._update(0.016); }
        const hats = g.stick.zombies.filter(z => z.type === 'hat'), hatsCfg = (g.stick.flagTypes || []).filter(t => t === 'hat').length;
        console.log('stick L4 flagIdx=' + g.stick.flagIdx + '/8 hatsInWave=' + hatsCfg + '(应3) hatsAlive=' + hats.length + ' zombies=' + g.stick.zombies.length);
        // 第6波=收尾波：清场推进（3只含1帽）
        g.stick.zombies = []; g._update(0.016);
        console.log('stick L4 postI=' + g.stick.postI + '/1 postZombies=' + g.stick.zombies.map(z => z.type).join(',') + '(应hat,basic,basic)');
        // 绿帽子机制：80防具先挡→溢出伤体→移速恢复
        g.stick._spawnZombie('hat');
        const z = g.stick.zombies[g.stick.zombies.length - 1]; z.row = 4;
        const x0 = z.x; for (let f = 0; f < 10; f++) { g._last += 16; g._update(0.016); }
        const dFast = x0 - z.x; // 戴帽速度（应为1.5x）
        g.stick._hitZ(z, 40); const hpA = z.hp; // 帽40:本体不掉血
        g.stick._hitZ(z, 50); // 帽破+10溢出
        const x1 = z.x; for (let f = 0; f < 10; f++) { g._last += 16; g._update(0.016); }
        const dSlow = x1 - z.x; // 帽掉恢复
        console.log('stick L4 hat hp@40dmg=' + hpA + ' hpAfterBreak=' + z.hp + ' armor=' + z.armor + ' spd戴帽=' + dFast.toFixed(2) + '(应3.74=1.8x) spd帽掉=' + dSlow.toFixed(2) + '(应2.08)');
        g._draw(); run('stick L4 mid', 5);
        // 通关→结尾剧情(发明家)：清场触发胜利→应先进'end'阶段
        g.stick.zombies = []; g.stick.postI = g.stick.post.length;
        g._update(0.016);
        console.log('stick L4 win->end phase=' + g.stick.phase + '(应end) line0=' + (g.stick.storyL ? g.stick.storyL[0].who + ':' + g.stick.storyL[0].text.slice(0, 10) : '-'));
        run('stick L4 endstory', 10); // 结尾剧情渲染（发明家瘫坐）
        for (let k = 0; k < 10 && g.stick.phase === 'end'; k++) { g.stick.story.t = 99; g.stick._click(500, 300); }
        console.log('stick L4 endstory done phase=' + g.stick.phase + '(应win) seen=' + !!g.stick._seen['e3']);
        run('stick L4 win', 5); // 结算屏
        g.stick._click(650, 428); // 返回主页→选关页
    }
    g.screen = 'home'; run('back home', 5);
} catch (e) { console.log('FAIL stick', e.stack.split('\n').slice(0, 6).join('\n')); }
console.log('DONE');
