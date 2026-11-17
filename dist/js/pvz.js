// 植物大战僵尸（还原原版·前4关：1-1 / 1-2 / 1-3 / 1-4）
// 原版数值：草坪 9列×5行，格子 80×100；阳光 25；豌豆射手 100阳光/300血/每1.4秒发射一颗20伤害的豌豆；
// 向日葵 50阳光/每24秒产1个阳光；樱桃炸弹 150阳光/1.1秒引爆/3×3范围1800伤害；普通僵尸 200血，路障 +370，
// 每秒啃食 100 伤害；每行一台割草机。
// 新机制：融合（豌豆射手 + 豌豆射手 = 双发射手）；丢车保护与临界值（僵尸越过临界线时割草机启动）。
(function () {
    'use strict';

    const VW = 800, VH = 600;                       // 虚拟分辨率（与原版一致）
    const GX = 255, GY = 85, CW = 80, CH = 100;     // 草坪左上角（背景图坐标）、格子尺寸
    const COLS = 9, ROWS = 5;
    const CAM_PLAY = 220, CAM_MAX = 600;            // 对局镜头：背景图向左偏移220，草坪显示在屏幕 x=35..755
    const SPAWN_X = 1060, LOSE_X = 190, MOWER_X = 215;
    const CRIT_X = GX + 40, MOWER_TRIGGER_X = GX - 10;   // 临界值线 / 割草机启动线
    const SUN_VALUE = 25, SUN_TARGET = { x: 38, y: 34 };
    const IMG_DIR = 'assets/pvz/';

    const IMG_FILES = {
        bg: 'bg_day.jpg', mainmenu: 'mainmenu.png',
        adv0: 'Adventure_0.png', adv1: 'Adventure_1.png',
        bank: 'ChooserBackground.png',
        car: 'car.png', boom: 'boom.png',
        pea: 'pea_normal.png', splat: 'pea_explode.png',
        z_normal: 'zombie_normal.png', z_cone: 'zombie_cone.png', z_flag: 'zombie_flag.png',
        card_peashooter: 'card_peashooter.png', card_sunflower: 'card_sunflower.png',
        card_repeater: 'card_repeaterpea.png',
        card_cherrybomb: 'card_cherrybomb.png', card_wallnut: 'card_wallnut.png',
        pea0: 'pea0.png', sun0: 'sun0.png', cher0: 'cher0.png', nutM: 'nutM.png',
    };
    const IM = {};
    for (const k in IMG_FILES) { const im = new Image(); im.src = IMG_DIR + IMG_FILES[k]; IM[k] = im; }
    for (let i = 0; i < 22; i++) { const im = new Image(); im.src = IMG_DIR + 'sun_' + i + '.png'; IM['sun_' + i] = im; }
    const ok = (k) => { const im = IM[k]; return !!(im && im.complete && im.naturalWidth); };

    const PLANTS = {
        peashooter: { name: '豌豆射手', cost: 100, cd: 7.5, hp: 300, art: 'pea_idle', fallback: 'pea0', startCd: 0,
            desc: '豌豆射手向僵尸发射豌豆，是你最基本的攻击手段。' },
        repeater: { name: '双发射手', cost: 200, cd: 7.5, hp: 300, art: 'rep_idle', fallback: 'pea0', startCd: 0,
            desc: '双发射手每次发射两颗豌豆，火力是豌豆射手的两倍。' },
        sunflower: { name: '向日葵', cost: 50, cd: 7.5, hp: 300, art: 'sun_idle', fallback: 'sun0', startCd: 0,
            desc: '向日葵能为你生产额外的阳光，多种几棵吧！' },
        cherrybomb: { name: '樱桃炸弹', cost: 150, cd: 50, hp: 300, art: 'cher_idle', fallback: 'cher0', startCd: 20,
            desc: '樱桃炸弹能炸死一定范围内的所有僵尸。' },
        wallnut: { name: '坚果墙', cost: 50, cd: 30, hp: 4000, art: 'nut_idleH', fallback: 'nutM', startCd: 0,
            desc: '坚果墙拥有坚硬的外壳，可以保护你的其他植物。' },
    };

    // 融合表：把 A 种在 B 上 → 变成 C
    const FUSION = {
        peashooter: { peashooter: 'repeater' },
    };

    const ZOMBIES = {
        normal: { hp: 200, armor: 0 },
        cone: { hp: 200, armor: 370 },
        flag: { hp: 200, armor: 0 },
    };

    // 原版前三关：1-1 单行(中间一行)只有豌豆射手；1-2 三行+向日葵；1-3 三行+樱桃炸弹+路障僵尸
    const N = 'normal', C = 'cone', F = 'flag';
    const LEVELS = [
        {
            name: '1-1', rows: [2], plants: ['peashooter'], sun: 50, reward: 'sunflower', tutorial: true, huge: false,
            waves: [
                { t: 22, z: [N] }, { t: 42, z: [N] }, { t: 58, z: [N] },
                { t: 72, z: [N, N] }, { t: 90, z: [N, N] }, { t: 108, z: [N, N, N] },
            ],
        },
        {
            name: '1-2', rows: [1, 2, 3], plants: ['peashooter', 'sunflower'], sun: 50, reward: 'cherrybomb', huge: true,
            waves: [
                { t: 25, z: [N] }, { t: 40, z: [N] }, { t: 55, z: [N, N] }, { t: 72, z: [N] },
                { t: 88, z: [N, N] }, { t: 104, z: [N, N, N] },
                { t: 125, z: [F, N, N, N, N, N] },
            ],
        },
        {
            name: '1-3', rows: [1, 2, 3], plants: ['peashooter', 'sunflower', 'cherrybomb'], sun: 50, reward: 'wallnut', huge: true,
            waves: [
                { t: 25, z: [N] }, { t: 40, z: [N, C] }, { t: 55, z: [N, N] }, { t: 70, z: [C, N] },
                { t: 86, z: [N, N, C] }, { t: 102, z: [N, C, C] }, { t: 118, z: [N, N, C, N] },
                { t: 140, z: [F, N, N, C, C, N, N] },
            ],
        },
        {
            name: '1-4', rows: [0, 1, 2, 3, 4], plants: ['peashooter', 'sunflower', 'cherrybomb', 'wallnut'],
            sun: 50, reward: 'repeater', huge: true,
            waves: [
                { t: 25, z: [N] }, { t: 40, z: [N, N] }, { t: 56, z: [N, C] }, { t: 72, z: [N, N, N] },
                { t: 88, z: [C, N, C] }, { t: 104, z: [N, N, C, N] }, { t: 120, z: [C, C, N, N] },
                { t: 145, z: [F, N, N, N, C, C, N, N] },
            ],
        },
    ];
    for (const L of LEVELS) L.total = L.waves.reduce((a, w) => a + w.z.length, 0);

    const lerp = (a, b, t) => a + (b - a) * t;
    const ease = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
    const rnd = (a, b) => a + Math.random() * (b - a);
    const snd = (n) => { try { if (typeof PvzAudio !== 'undefined') PvzAudio.play(n); } catch (e) { } };
    const mus = (k) => { try { if (typeof PvzAudio !== 'undefined') PvzAudio.music(k); } catch (e) { } };

    class PvzGame {
        constructor() {
            this.canvas = document.getElementById('pvzCanvas');
            this.ctx = this.canvas.getContext('2d');
            this.running = false; this._raf = null; this._last = 0;
            this.mx = -99; this.my = -99;
            this.view = { s: 1, ox: 0, oy: 0 };
            let u = 0; try { u = +localStorage.getItem('pvz_orig_unlocked') || 0; } catch (e) { }
            this.unlocked = Math.max(0, Math.min(LEVELS.length - 1, u));
            this.screen = 'menu';
            this._pix = {};
            this._bind();
        }

        // ========== 生命周期 ==========
        start() {
            this.running = true;
            this._last = performance.now();
            this._resize();
            this.screen = 'menu';
            this._music('menu');
            const loop = (now) => {
                if (!this.running) return;
                const dt = Math.min(0.05, (now - this._last) / 1000);
                this._last = now;
                this._update(dt);
                this._draw();
                this._raf = requestAnimationFrame(loop);
            };
            this._raf = requestAnimationFrame(loop);
        }
        stop() {
            this.running = false;
            if (this._raf) cancelAnimationFrame(this._raf);
            mus(null); this._musKind = undefined;
        }
        _music(k) { if (this._musKind !== k) { this._musKind = k; mus(k); } }

        _bind() {
            this._resize = () => {
                this.canvas.width = innerWidth; this.canvas.height = innerHeight;
                const s = Math.min(this.canvas.width / VW, this.canvas.height / VH);
                this.view = { s, ox: (this.canvas.width - VW * s) / 2, oy: (this.canvas.height - VH * s) / 2 };
            };
            addEventListener('resize', () => { if (this.running) this._resize(); });
            const toV = (e) => {
                const r = this.canvas.getBoundingClientRect();
                this.mx = (e.clientX - r.left - this.view.ox) / this.view.s;
                this.my = (e.clientY - r.top - this.view.oy) / this.view.s;
            };
            this.canvas.addEventListener('pointermove', (e) => { if (this.running) toV(e); });
            this.canvas.addEventListener('pointerdown', (e) => {
                if (!this.running) return;
                try { PvzAudio.resume(); } catch (err) { }
                toV(e); this._click(this.mx, this.my, e.button);
            });
            this.canvas.addEventListener('contextmenu', (e) => {
                if (!this.running) return;
                e.preventDefault(); this.sel = -1;
            });
            addEventListener('keydown', (e) => {
                if (!this.running) return;
                if (e.code === 'KeyM') { try { PvzAudio.resume(); PvzAudio.toggleMute(); } catch (err) { } }
                if (e.code === 'Escape' && this.screen === 'game') {
                    if (this.phase === 'play' && this.sel >= 0) this.sel = -1;
                    else if (this.phase === 'play') this.phase = 'pause';
                    else if (this.phase === 'pause') this.phase = 'play';
                }
            });
        }

        // ========== 开局 ==========
        _startLevel(i) {
            const L = LEVELS[i];
            this.lv = i; this.L = L;
            this.sun = L.sun;
            this.cards = L.plants.map(k => ({ key: k, cd: PLANTS[k].startCd }));
            this.sel = -1;
            this.grid = Array.from({ length: COLS }, () => Array(ROWS).fill(null));
            this.zombies = []; this.peas = []; this.suns = []; this.booms = []; this.parts = []; this.splats = [];
            this.mowers = L.rows.map(r => ({ row: r, x: MOWER_X, state: 'idle' }));
            this.crit = {}; this.critSeen = {};
            this.time = 0; this.waveIdx = 0; this.spawned = 0; this.killed = 0;
            this.skyT = 5; this.hugeShown = false;
            this.camX = CAM_PLAY; this.shake = 0;
            this.phase = 'intro'; this.introT = 0; this.bankY = -90;
            this.banner = null; this.reward = null; this.rewardT = 0; this.loseT = 0;
            this.lastDeath = { x: GX + 4 * CW, row: L.rows[0] };
            this.hint = { sunSeen: false, planted: 0, fused: false };
            this.groanT = 6;
            const types = []; for (const w of L.waves) for (const t of w.z) types.push(t);
            this.preview = [];
            const n = Math.min(7, types.length);
            for (let j = 0; j < n; j++) {
                const t = types[Math.floor(j * types.length / n)];
                this.preview.push({ type: t === F ? N : t, x: 1010 + (j % 3) * 62 + rnd(0, 26), row: L.rows[j % L.rows.length], t: rnd(0, 6), coneGone: false, armor: t === C ? 1 : 0 });
            }
            this.screen = 'game';
            this._music(null);
        }

        // ========== 输入 ==========
        _hit(x, y, rx, ry, rw, rh) { return x > rx && x < rx + rw && y > ry && y < ry + rh; }
        _cardRect(i) { return { x: 79 + i * 54.5, y: 9 + this.bankY, w: 50, h: 70 }; }
        _click(x, y, btn) {
            if (this.screen === 'menu') {
                if (this._hit(x, y, 470, 100, 250, 105)) { snd('click'); this._startLevel(this.unlocked); }
                return;
            }
            if (this.screen !== 'game') return;
            if (btn === 2) { this.sel = -1; return; }
            const ph = this.phase;
            if (ph === 'intro') { if (this.introT < 5.2) this.introT = 5.2; return; }
            if (ph === 'pause') {
                if (this._hit(x, y, 300, 230, 200, 50)) { snd('click'); this.phase = 'play'; }
                else if (this._hit(x, y, 300, 295, 200, 50)) { snd('click'); this._startLevel(this.lv); }
                else if (this._hit(x, y, 300, 360, 200, 50)) { snd('click'); this._toMenu(); }
                return;
            }
            if (ph === 'lose') {
                if (this.loseT < 1.8) return;
                if (this._hit(x, y, 300, 330, 200, 50)) { snd('click'); this._startLevel(this.lv); }
                else if (this._hit(x, y, 300, 395, 200, 50)) { snd('click'); this._toMenu(); }
                return;
            }
            if (ph === 'reward') {
                if (this.rewardT < 1.2) return;
                if (this._hit(x, y, 300, 500, 200, 56)) {
                    snd('click');
                    if (this.lv + 1 < LEVELS.length) { this._startLevel(this.lv + 1); } else this._toMenu();
                }
                return;
            }
            // play / win
            if (this._hit(x, y, 700, 4, 92, 30)) { snd('click'); this.phase = 'pause'; return; }
            const wx = x + this.camX, wy = y;
            if (ph === 'win' && this.reward && this.reward.state === 'idle' && Math.hypot(wx - this.reward.x, wy - this.reward.y) < 44) {
                this.phase = 'reward'; this.rewardT = 0; this.rewardFrom = { x: this.reward.x - this.camX, y: this.reward.y };
                snd('win'); this._music(null);
                if (this.lv + 1 > this.unlocked && this.lv + 1 < LEVELS.length) {
                    this.unlocked = this.lv + 1;
                    try { localStorage.setItem('pvz_orig_unlocked', String(this.unlocked)); } catch (e) { }
                }
                return;
            }
            for (let i = this.suns.length - 1; i >= 0; i--) {
                const s = this.suns[i];
                if ((s.state === 'rest' || s.state === 'fall' || s.state === 'pop') && Math.hypot(wx - s.x, wy - s.y) < 34) {
                    s.state = 'fly'; s.t = 0; s.sx = s.x; s.sy = s.y; snd('sun'); this.hint.sunSeen = true; return;
                }
            }
            for (let i = 0; i < this.cards.length; i++) {
                const R = this._cardRect(i);
                if (this._hit(x, y, R.x, R.y, R.w, R.h)) {
                    const c = this.cards[i], p = PLANTS[c.key];
                    if (c.cd <= 0 && this.sun >= p.cost) { this.sel = this.sel === i ? -1 : i; if (this.sel >= 0) snd('card'); }
                    return;
                }
            }
            if (this.sel >= 0) {
                const c = Math.floor((wx - GX) / CW), r = Math.floor((wy - GY) / CH);
                if (c >= 0 && c < COLS && r >= 0 && r < ROWS && this.L.rows.includes(r)) {
                    const card = this.cards[this.sel], p = PLANTS[card.key];
                    const cur = this.grid[c][r];
                    const fuseTo = cur ? this._fuseResult(card.key, cur.key) : null;
                    if (this.sun >= p.cost && card.cd <= 0 && (!cur || fuseTo)) {
                        this.sun -= p.cost; card.cd = p.cd;
                        if (fuseTo) {
                            this._fusePlant(cur, fuseTo);
                            this.hint.fused = true;
                        } else {
                            this.grid[c][r] = {
                                key: card.key, c, r, hp: p.hp, t: rnd(0, 3), hit: 0,
                                sunT: card.key === 'sunflower' ? rnd(6, 9) : 0,
                                shootT: 0.8, shoot2: 0, fuseT: 0,
                                fuse: card.key === 'cherrybomb' ? 1.1 : 0, fuseMax: 1.1,
                            };
                            this.hint.planted++;
                            this._puff(GX + c * CW + CW / 2, GY + r * CH + 86, '#8d6e3f', 6);
                        }
                        this.sel = -1; snd('plant');
                    }
                }
            }
        }
        _toMenu() { this.screen = 'menu'; this._music('menu'); }

        // ========== 融合 ==========
        _fuseResult(cardKey, plantKey) {
            const f = FUSION[cardKey];
            return f && f[plantKey] ? f[plantKey] : null;
        }
        _fusePlant(p, key) {
            const def = PLANTS[key];
            p.key = key; p.hp = def.hp; p.t = 0; p.hit = 0.3; p.fuseT = 0.6;
            p.shootT = 0.4; p.shoot2 = 0;
            const x = GX + p.c * CW + CW / 2, y = GY + p.r * CH + 60;
            this._puff(x, y, '#aed581', 12);
            this._puff(x, y, '#fff59d', 6);
            this.banner = { txt: '融合成功：双发射手!', t: 1.6, size: 30, color: '#aed581' };
            snd('plant');
        }

        // ========== 更新 ==========
        _update(dt) {
            if (this.screen !== 'game') return;
            const ph = this.phase;
            if (ph === 'pause') return;
            if (ph === 'intro') { this._updateIntro(dt); return; }
            if (ph === 'reward') { this.rewardT += dt; return; }
            if (ph === 'lose') {
                this.loseT += dt; this._updateFx(dt);
                for (const z of this.zombies) z.t += dt;
                return;
            }
            const L = this.L;
            this.time += dt;
            if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
            if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
            for (const c of this.cards) if (c.cd > 0) c.cd = Math.max(0, c.cd - dt);
            for (const k in this.crit) { this.crit[k] -= dt; if (this.crit[k] <= 0) delete this.crit[k]; }

            if (ph === 'play') {
                this.skyT -= dt;
                if (this.skyT <= 0) { this._skySun(); this.skyT = rnd(8, 11); }
                const nw = L.waves[this.waveIdx];
                if (nw) {
                    if (L.huge && this.waveIdx === L.waves.length - 1 && !this.hugeShown && this.time >= nw.t - 4) {
                        this.hugeShown = true; this.banner = { txt: '一大波僵尸正在接近!', t: 3.4, size: 46, color: '#e53935' }; snd('wave');
                    }
                    if (this.time >= nw.t) { this._spawnWave(nw); this.waveIdx++; }
                }
                this.groanT -= dt;
                if (this.groanT <= 0 && this.zombies.some(z => !z.dead)) { snd('groan'); this.groanT = rnd(6, 11); }
            }

            for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
                const p = this.grid[c][r];
                if (!p) continue;
                p.t += dt; if (p.hit > 0) p.hit -= dt; if (p.fuseT > 0) p.fuseT -= dt;
                if (p.key === 'sunflower') {
                    p.sunT -= dt;
                    if (p.sunT <= 0) {
                        p.sunT = 24;
                        const px = GX + c * CW + CW / 2, py = GY + r * CH + 60;
                        this.suns.push({ x: px, y: py, state: 'pop', vx: rnd(-26, 26), vy: -150, ty: py + rnd(12, 30), life: 9, t: 0 });
                    }
                } else if (p.key === 'peashooter' || p.key === 'repeater') {
                    const px = GX + c * CW + CW / 2;
                    if (p.shoot2 > 0) {
                        p.shoot2 -= dt;
                        if (p.shoot2 <= 0) { this.peas.push({ x: px + 28, y: GY + r * CH + 40, row: r }); snd('shoot'); }
                    }
                    p.shootT -= dt;
                    if (p.shootT <= 0) {
                        if (this.zombies.some(z => !z.dead && z.row === r && z.x > px && z.x < this.camX + VW + 20)) {
                            this.peas.push({ x: px + 28, y: GY + r * CH + 40, row: r });
                            p.shootT = 1.4; snd('shoot');
                            if (p.key === 'repeater') p.shoot2 = 0.14;
                        } else p.shootT = 0;
                    }
                } else if (p.key === 'cherrybomb') {
                    p.fuse -= dt;
                    if (p.fuse <= 0) { this._cherryBoom(p); }
                }
            }

            for (let i = this.peas.length - 1; i >= 0; i--) {
                const pe = this.peas[i];
                pe.x += 300 * dt;
                let hit = null;
                for (const z of this.zombies) {
                    if (z.dead || z.row !== pe.row) continue;
                    if (Math.abs((z.x - 16) - pe.x) < 22 && (!hit || z.x < hit.x)) hit = z;
                }
                if (hit) {
                    this._dmgZombie(hit, 20); hit.flash = 0.12;
                    this.splats.push({ x: pe.x, y: pe.y, t: 0.18 }); snd('splat');
                    this.peas.splice(i, 1);
                } else if (pe.x > 1120) this.peas.splice(i, 1);
            }

            for (const z of this.zombies) this._updateZombie(z, dt);
            if (this.phase === 'lose') return;
            this.zombies = this.zombies.filter(z => !(z.dead && z.die > z.dieMax));

            for (const m of this.mowers) {
                if (m.state !== 'run') continue;
                m.x += 330 * dt;
                for (const z of this.zombies) {
                    if (!z.dead && z.row === m.row && z.x < m.x + 50 && z.x > m.x - 60) this._killZombie(z, 'mow');
                }
                if (m.x > 1120) m.state = 'gone';
            }

            for (let i = this.suns.length - 1; i >= 0; i--) {
                const s = this.suns[i];
                s.t += dt;
                if (s.state === 'fall') {
                    s.y += 70 * dt;
                    if (s.y >= s.ty) { s.y = s.ty; s.state = 'rest'; }
                } else if (s.state === 'pop') {
                    s.x += s.vx * dt; s.vy += 380 * dt; s.y += s.vy * dt;
                    if (s.vy > 0 && s.y >= s.ty) { s.y = s.ty; s.state = 'rest'; }
                } else if (s.state === 'rest') {
                    s.life -= dt;
                    if (s.life <= 0) this.suns.splice(i, 1);
                } else if (s.state === 'fly') {
                    const u = Math.min(1, s.t / 0.55), e = ease(u);
                    s.x = lerp(s.sx, this.camX + SUN_TARGET.x, e); s.y = lerp(s.sy, SUN_TARGET.y, e);
                    if (u >= 1) { this.sun += SUN_VALUE; this.suns.splice(i, 1); }
                }
            }

            this._updateFx(dt);

            if (this.reward) {
                const rw = this.reward; rw.t += dt;
                if (rw.state === 'pop') {
                    rw.vy += 520 * dt; rw.y += rw.vy * dt; rw.x += rw.vx * dt;
                    if (rw.vy > 0 && rw.y >= rw.ty) { rw.y = rw.ty; rw.state = 'idle'; }
                }
            } else if (ph === 'play' && this.waveIdx >= L.waves.length && this.zombies.every(z => z.dead)) {
                const px = Math.max(GX + 60, Math.min(GX + (COLS - 1) * CW, this.lastDeath.x));
                const py = GY + this.lastDeath.row * CH + 62;
                this.reward = { x: px, y: py, ty: py + 18, vx: rnd(-18, 18), vy: -280, t: 0, state: 'pop', plant: L.reward };
                this.phase = 'win';
                this.banner = null;
            }
        }
        _updateIntro(dt) {
            this.introT += dt;
            const t = this.introT;
            let c = CAM_PLAY;
            if (t < 0.8) c = CAM_PLAY;
            else if (t < 2.0) c = lerp(CAM_PLAY, CAM_MAX, ease((t - 0.8) / 1.2));
            else if (t < 4.0) c = CAM_MAX;
            else if (t < 5.2) c = lerp(CAM_MAX, CAM_PLAY, ease((t - 4.0) / 1.2));
            this.camX = c;
            this.bankY = lerp(-90, 0, ease((t - 5.0) / 0.5));
            for (const p of this.preview) p.t += dt;
            if (this._lastReady === undefined) this._lastReady = -1;
            const stage = t < 5.2 ? -1 : t < 5.8 ? 0 : t < 6.4 ? 1 : t < 7.2 ? 2 : 3;
            if (stage !== this._lastReady) { this._lastReady = stage; if (stage === 0) snd('ready'); }
            if (stage >= 3) {
                this._lastReady = -1;
                this.phase = 'play'; this.camX = CAM_PLAY; this.bankY = 0;
                this._music('battle');
            }
        }
        _updateFx(dt) {
            for (let i = this.parts.length - 1; i >= 0; i--) {
                const p = this.parts[i];
                p.t -= dt; p.vy += (p.g === undefined ? 420 : p.g) * dt; p.x += p.vx * dt; p.y += p.vy * dt;
                if (p.rot !== undefined) p.rot += p.vr * dt;
                if (p.t <= 0) this.parts.splice(i, 1);
            }
            for (let i = this.splats.length - 1; i >= 0; i--) { this.splats[i].t -= dt; if (this.splats[i].t <= 0) this.splats.splice(i, 1); }
            for (let i = this.booms.length - 1; i >= 0; i--) { this.booms[i].t += dt; if (this.booms[i].t > 0.7) this.booms.splice(i, 1); }
        }
        _puff(x, y, color, n) {
            for (let i = 0; i < n; i++) {
                const a = rnd(0, Math.PI * 2), v = rnd(30, 90);
                this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, t: rnd(0.3, 0.6), r: rnd(2, 4), color });
            }
        }
        _skySun() {
            const rows = this.L.rows;
            const r = rows[Math.floor(Math.random() * rows.length)];
            const x = rnd(GX + 40, GX + COLS * CW - 40);
            this.suns.push({ x, y: -30, ty: GY + r * CH + rnd(30, 80), state: 'fall', life: 9, t: 0 });
        }
        _spawnWave(w) {
            const rows = this.L.rows.slice().sort(() => Math.random() - 0.5);
            w.z.forEach((type, i) => {
                const d = ZOMBIES[type];
                this.zombies.push({
                    type, x: SPAWN_X + rnd(0, 30) + i * 22, row: rows[i % rows.length],
                    hp: d.hp, armor: d.armor, coneGone: false,
                    spd: rnd(10, 14), t: rnd(0, 6), eat: null, flash: 0,
                    dead: false, die: 0, dieMax: 1.5, dieType: 'fall', munchT: 0,
                });
                this.spawned++;
            });
        }
        _updateZombie(z, dt) {
            z.t += dt;
            if (z.flash > 0) z.flash -= dt;
            if (z.dead) { z.die += dt; return; }
            if (z.eat && z.eat.hp <= 0) z.eat = null;
            const c = Math.floor((z.x - 28 - GX) / CW);
            let target = null;
            if (c >= 0 && c < COLS) target = this.grid[c][z.row];
            if (target) {
                z.eat = target;
                target.hp -= 100 * dt; target.hit = 0.1;
                z.munchT -= dt; if (z.munchT <= 0) { snd('munch'); z.munchT = 0.5; }
                if (target.hp <= 0) {
                    this.grid[target.c][target.r] = null; z.eat = null;
                    this._puff(GX + target.c * CW + CW / 2, GY + target.r * CH + 60, '#558b2f', 8);
                }
            } else {
                z.eat = null;
                z.x -= z.spd * dt;
            }
            // 临界值：僵尸越过临界线时给出警告
            if (z.x < CRIT_X) {
                this.crit[z.row] = 0.5;
                if (!this.critSeen[z.row]) {
                    this.critSeen[z.row] = true;
                    this.banner = { txt: '僵尸突破临界值!', t: 2.2, size: 34, color: '#ff5252' };
                    snd('wave');
                }
            }
            // 丢车保护：僵尸压到割草机时自动启动
            if (z.x < MOWER_TRIGGER_X) {
                const m = this.mowers.find(mm => mm.row === z.row && mm.state === 'idle');
                if (m) { m.state = 'run'; snd('mower'); this.shake = 0.2; }
            }
            if (z.x < LOSE_X && !this.mowers.some(mm => mm.row === z.row && mm.state === 'run')) this._lose();
        }
        _lose() {
            if (this.phase === 'lose') return;
            this.phase = 'lose'; this.loseT = 0; this.sel = -1;
            snd('lose'); this._music(null);
        }
        _dmgZombie(z, d) {
            if (z.dead) return;
            if (z.armor > 0) {
                const a = Math.min(z.armor, d); z.armor -= a; d -= a;
                if (z.armor <= 0 && !z.coneGone) {
                    z.coneGone = true;
                    this.parts.push({ x: z.x, y: GY + z.row * CH + 20, vx: rnd(10, 40), vy: -170, t: 1.2, cone: true, rot: 0, vr: 5 });
                }
            }
            z.hp -= d;
            if (z.hp <= 0) this._killZombie(z, 'fall');
        }
        _killZombie(z, type) {
            if (z.dead) return;
            z.dead = true; z.die = 0; z.dieType = type; z.eat = null;
            z.dieMax = type === 'burn' ? 1.1 : type === 'mow' ? 0.8 : 1.5;
            this.killed++;
            this.lastDeath = { x: z.x, row: z.row };
            snd(type === 'mow' ? 'hit' : 'zdie');
        }
        _cherryBoom(p) {
            const cx = GX + p.c * CW + CW / 2, cy = GY + p.r * CH + 50;
            this.grid[p.c][p.r] = null;
            this.booms.push({ x: cx, y: cy, t: 0 });
            this.shake = 0.35; snd('boom');
            for (const z of this.zombies) {
                if (z.dead) continue;
                if (Math.abs(z.x - cx) < CW * 1.6 && Math.abs(z.row - p.r) <= 1) this._killZombie(z, 'burn');
            }
            this._puff(cx, cy, '#ff8f00', 14);
        }

        // ========== 绘制 ==========
        _draw() {
            const ctx = this.ctx;
            ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.fillStyle = '#000'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.save();
            ctx.translate(this.view.ox, this.view.oy);
            ctx.scale(this.view.s, this.view.s);
            ctx.beginPath(); ctx.rect(0, 0, VW, VH); ctx.clip();
            if (this.screen === 'menu') this._drawMenu(ctx); else this._drawGame(ctx);
            ctx.restore();
        }
        _text(ctx, s, x, y, size, fill, stroke, align) {
            ctx.font = 'bold ' + size + 'px "Microsoft YaHei", sans-serif';
            ctx.textAlign = align || 'center';
            if (stroke) { ctx.lineWidth = Math.max(3, size / 7); ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
            ctx.fillStyle = fill; ctx.fillText(s, x, y);
        }
        _rr(ctx, x, y, w, h, r) {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
        }
        _btn(ctx, x, y, w, h, label) {
            const hov = this._hit(this.mx, this.my, x, y, w, h);
            const g = ctx.createLinearGradient(0, y, 0, y + h);
            g.addColorStop(0, hov ? '#c79a55' : '#a97a3d'); g.addColorStop(1, hov ? '#8a5a26' : '#6e4520');
            ctx.fillStyle = 'rgba(0,0,0,0.4)'; this._rr(ctx, x + 2, y + 3, w, h, 8); ctx.fill();
            ctx.fillStyle = g; this._rr(ctx, x, y, w, h, 8); ctx.fill();
            ctx.strokeStyle = '#3b2410'; ctx.lineWidth = 3; ctx.stroke();
            this._text(ctx, label, x + w / 2, y + h / 2 + 7, Math.min(22, h * 0.42), '#ffe9a8', '#3b2410');
        }

        _drawMenu(ctx) {
            if (ok('mainmenu')) ctx.drawImage(IM.mainmenu, -50, 0, 900, 600);
            else { ctx.fillStyle = '#2b4a1c'; ctx.fillRect(0, 0, VW, VH); }
            const hov = this._hit(this.mx, this.my, 470, 100, 250, 105);
            const im = hov && ok('adv1') ? IM.adv1 : IM.adv0;
            if (ok('adv0')) ctx.drawImage(im, 470, 100, 250, 105);
            else this._btn(ctx, 470, 120, 250, 60, '冒险模式');
            this._text(ctx, '关卡 ' + LEVELS[this.unlocked].name, 595, 232, 24, '#d9d9d9', '#2a2a2a');
            this._text(ctx, '点击木牌开始冒险  ·  M 键静音', 595, 262, 14, '#bdbdbd', '#2a2a2a');
        }

        _frames(key) {
            if (this._pix[key]) return this._pix[key];
            const d = (typeof PVZ_ART !== 'undefined') ? PVZ_ART[key] : null;
            const out = [];
            if (d) {
                for (const rows of d.frames) {
                    const cv = document.createElement('canvas');
                    cv.width = d.w; cv.height = d.h;
                    const g = cv.getContext('2d');
                    for (let y = 0; y < d.h; y++) {
                        const r = rows[y];
                        for (let i = 0; i < r.length; i += 3) {
                            g.fillStyle = d.pal[r.charCodeAt(i) - 33];
                            g.fillRect(r.charCodeAt(i + 1) - 33, y, r.charCodeAt(i + 2) - 33, 1);
                        }
                    }
                    out.push(cv);
                }
            }
            this._pix[key] = out;
            return out;
        }
        // 植物序列帧：x为中心、base为脚底
        _art(ctx, key, fallback, x, base, tm, fps) {
            const fr = this._frames(key), n = fr.length;
            if (n) {
                const d = PVZ_ART[key], pos = tm * fps, fi = Math.floor(pos) % n, f = pos - Math.floor(pos), fj = (fi + 1) % n;
                ctx.drawImage(fr[fi], x - d.w / 2, base - d.h);
                if (f > 0.01 && fj !== fi) { ctx.globalAlpha = f; ctx.drawImage(fr[fj], x - d.w / 2, base - d.h); ctx.globalAlpha = 1; }
            } else if (ok(fallback)) {
                const im = IM[fallback]; ctx.drawImage(im, x - im.naturalWidth / 2, base - im.naturalHeight);
            }
        }

        _drawPlant(ctx, p, c, r) {
            const def = PLANTS[p.key];
            const art = (p.key === 'repeater' && p.shootT > 1.15) ? 'rep_atk' : def.art;
            const x = GX + c * CW + CW / 2, base = GY + r * CH + 88;
            ctx.fillStyle = 'rgba(0,0,0,0.22)';
            ctx.beginPath(); ctx.ellipse(x, base - 2, 26, 7, 0, 0, 7); ctx.fill();
            ctx.save();
            if (p.key === 'cherrybomb') {
                const u = 1 - Math.max(0, p.fuse) / p.fuseMax;
                const s = 1 + 0.45 * u;
                ctx.translate(x, base); ctx.scale(s, s); ctx.translate(-x, -base);
                this._art(ctx, def.art, def.fallback, x, base, p.t, 10);
                if (Math.floor(p.t * 12) % 2 === 0) {
                    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.45 * u;
                    this._art(ctx, def.art, def.fallback, x, base, p.t, 10);
                }
            } else {
                if (p.fuseT > 0) {
                    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5 * Math.min(1, p.fuseT / 0.6);
                    this._art(ctx, art, def.fallback, x, base, p.t, 12);
                    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
                }
                if (p.hit > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25; this._art(ctx, art, def.fallback, x, base, p.t, 12); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
                const sway = p.key === 'sunflower' ? Math.sin(p.t * 2.2) * 0.03 : 0;
                ctx.translate(x, base); ctx.rotate(sway); ctx.translate(-x, -base);
                this._art(ctx, art, def.fallback, x, base, p.t, 12);
                if (p.key === 'sunflower' && p.sunT < 1.2) {
                    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35 * (1 - p.sunT / 1.2);
                    this._art(ctx, art, def.fallback, x, base, p.t, 12);
                }
            }
            ctx.restore();
        }

        _zombieKey(z) {
            if (z.type === 'flag') return 'z_flag';
            if (z.type === 'cone' && z.armor > 0 && !z.coneGone) return 'z_cone';
            return 'z_normal';
        }
        _drawZombie(ctx, z, standing) {
            const im = IM[this._zombieKey(z)];
            const base = GY + z.row * CH + 92, S = 0.9;
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            if (!z.dead) { ctx.beginPath(); ctx.ellipse(z.x, base, 28, 7, 0, 0, 7); ctx.fill(); }
            if (!ok(this._zombieKey(z))) return;
            ctx.save();
            ctx.translate(z.x, base);
            let alpha = 1;
            if (z.dead) {
                const u = Math.min(1, z.die / z.dieMax);
                if (z.dieType === 'fall') { ctx.rotate(ease(Math.min(1, u * 2.2)) * 1.5); alpha = u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1; }
                else if (z.dieType === 'burn') { ctx.filter = 'brightness(0.12)'; ctx.scale(1 - u * 0.15, 1 - u * 0.15); alpha = 1 - u; }
                else { ctx.scale(1 + u * 0.3, Math.max(0.08, 1 - u * 1.1)); alpha = 1 - u; }
            } else if (!standing) {
                if (z.eat) { ctx.rotate(-0.05 - Math.abs(Math.sin(z.t * 8)) * 0.08); }
                else { ctx.translate(0, -Math.abs(Math.sin(z.t * 3.6)) * 3); ctx.rotate(Math.sin(z.t * 3.6) * 0.04); }
            } else { ctx.rotate(Math.sin(z.t * 2.2) * 0.03); }
            ctx.globalAlpha = alpha;
            ctx.drawImage(im, -95 * S, -160 * S, 188 * S, 180 * S);
            if (z.flash > 0 && !z.dead) {
                ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.4;
                ctx.drawImage(im, -95 * S, -160 * S, 188 * S, 180 * S);
            }
            ctx.restore();
        }

        _drawSun(ctx, s) {
            const i = Math.floor(s.t * 14) % 22;
            const k = ok('sun_' + i) ? 'sun_' + i : null;
            let a = 1;
            if (s.state === 'rest' && s.life < 2) a = Math.floor(s.life * 6) % 2 ? 0.45 : 1;
            ctx.save(); ctx.globalAlpha = a;
            const hov = this._hit(this.mx + this.camX, this.my, s.x - 34, s.y - 34, 68, 68);
            if (hov && s.state !== 'fly') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * 0.3; if (k) ctx.drawImage(IM[k], s.x - 42, s.y - 42, 84, 84); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a; }
            if (k) ctx.drawImage(IM[k], s.x - 39, s.y - 39, 78, 78);
            else { ctx.fillStyle = '#ffd54f'; ctx.beginPath(); ctx.arc(s.x, s.y, 24, 0, 7); ctx.fill(); }
            ctx.restore();
        }

        _drawGame(ctx) {
            const L = this.L, cam = this.camX;
            ctx.save();
            if (this.shake > 0) ctx.translate(rnd(-4, 4) * (this.shake / 0.35), rnd(-3, 3) * (this.shake / 0.35));
            if (ok('bg')) ctx.drawImage(IM.bg, cam, 0, VW, VH, 0, 0, VW, VH);
            else { ctx.fillStyle = '#4caf50'; ctx.fillRect(0, 0, VW, VH); }
            ctx.translate(-cam, 0);

            // 未开放的行：裸土
            for (let r = 0; r < ROWS; r++) {
                if (L.rows.includes(r)) continue;
                const y0 = r === 0 ? 54 : GY + r * CH, y1 = r === ROWS - 1 ? 596 : GY + (r + 1) * CH;
                const g = ctx.createLinearGradient(0, y0, 0, y1);
                g.addColorStop(0, '#6a4727'); g.addColorStop(1, '#583a1e');
                ctx.fillStyle = g; ctx.fillRect(246, y0, 756, y1 - y0);
                ctx.fillStyle = 'rgba(0,0,0,0.14)';
                for (let k = 0; k < 90; k++) {
                    const hx = 250 + ((k * 97 + r * 31) % 748), hy = y0 + ((k * 53 + r * 17) % Math.max(1, (y1 - y0 - 6)));
                    ctx.beginPath(); ctx.ellipse(hx, hy, 5 + (k % 4), 2.5, 0, 0, 7); ctx.fill();
                }
            }

            // 割草机
            for (const m of this.mowers) {
                if (m.state === 'gone' || !ok('car')) continue;
                const y = GY + m.row * CH + 90;
                ctx.save();
                ctx.translate(m.x, y - (m.state === 'run' ? Math.abs(Math.sin(this.time * 30)) * 2 : 0));
                ctx.drawImage(IM.car, -30, -50, 62, 50);
                ctx.restore();
            }

            // 按行绘制：植物 → 僵尸 → 豌豆
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) { const p = this.grid ? this.grid[c][r] : null; if (p) this._drawPlant(ctx, p, c, r); }
                const zs = this.zombies.filter(z => z.row === r).sort((a, b) => b.x - a.x);
                for (const z of zs) this._drawZombie(ctx, z, false);
                if (this.phase === 'intro') for (const z of this.preview) if (z.row === r) this._drawZombie(ctx, z, true);
                for (const pe of this.peas) {
                    if (pe.row !== r) continue;
                    if (ok('pea')) ctx.drawImage(IM.pea, pe.x - 14, pe.y - 14, 28, 17 * 28 / 28 + 0);
                    else { ctx.fillStyle = '#7cb342'; ctx.beginPath(); ctx.arc(pe.x, pe.y, 8, 0, 7); ctx.fill(); }
                }
            }
            for (const s of this.splats) { if (ok('splat')) ctx.drawImage(IM.splat, s.x - 14, s.y - 14, 28, 28); }

            // 临界值警告（僵尸越过临界线）
            for (const k in this.crit) {
                const row = +k, y0 = GY + row * CH;
                const a = 0.16 + 0.14 * Math.sin(this.time * 10);
                const g = ctx.createLinearGradient(CRIT_X - 45, 0, CRIT_X + 75, 0);
                g.addColorStop(0, 'rgba(229,57,53,' + a + ')');
                g.addColorStop(1, 'rgba(229,57,53,0)');
                ctx.fillStyle = g; ctx.fillRect(CRIT_X - 45, y0, 120, CH);
                ctx.strokeStyle = 'rgba(255,82,82,' + (0.45 + 0.4 * Math.sin(this.time * 10)) + ')';

                ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
                ctx.beginPath(); ctx.moveTo(CRIT_X, y0 + 4); ctx.lineTo(CRIT_X, y0 + CH - 4); ctx.stroke();
                ctx.setLineDash([]);
                this._text(ctx, '临界', CRIT_X, y0 + 18, 13, '#ffcdd2', '#5b0000');
            }

            for (const p of this.parts) {
                if (p.cone) {
                    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = '#ef6c00';
                    ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(12, 10); ctx.lineTo(-12, 10); ctx.closePath(); ctx.fill();
                    ctx.restore();
                } else {
                    ctx.globalAlpha = Math.max(0, Math.min(1, p.t * 2)); ctx.fillStyle = p.color;
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
                }
            }
            for (const b of this.booms) {
                if (!ok('boom')) continue;
                const u = b.t / 0.7, s = 0.8 + u * 0.5;
                ctx.globalAlpha = Math.max(0, 1 - u * u);
                ctx.drawImage(IM.boom, b.x - 106 * s * 1.35, b.y - 80 * s * 1.35, 213 * s * 1.35, 160 * s * 1.35);
                ctx.globalAlpha = 1;
            }
            for (const s of this.suns) this._drawSun(ctx, s);
            if (this.reward && this.phase === 'win') this._drawRewardItem(ctx);
            ctx.restore();

            this._drawHud(ctx);
            this._drawGhost(ctx);
            this._drawBanners(ctx);
            if (this.phase === 'pause') this._drawPause(ctx);
            else if (this.phase === 'lose') this._drawLose(ctx);
            else if (this.phase === 'reward') this._drawReward(ctx);
        }

        _drawRewardItem(ctx) {
            const rw = this.reward, d = PLANTS[rw.plant], im = IM['card_' + rw.plant];
            ctx.save(); ctx.translate(rw.x, rw.y);
            const pulse = 0.6 + 0.4 * Math.sin(rw.t * 6);
            ctx.globalCompositeOperation = 'lighter';
            ctx.rotate(rw.t * 1.2);
            for (let i = 0; i < 10; i++) {
                ctx.rotate(Math.PI / 5);
                ctx.fillStyle = 'rgba(255,230,120,' + (0.22 * pulse) + ')';
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(70, -9); ctx.lineTo(70, 9); ctx.closePath(); ctx.fill();
            }
            ctx.restore();
            ctx.save(); ctx.translate(rw.x, rw.y);
            const hov = this._hit(this.mx + this.camX, this.my, rw.x - 34, rw.y - 46, 68, 92);
            const sc = hov ? 1.1 : 1;
            ctx.scale(sc, sc);
            if (im && im.complete && im.naturalWidth) ctx.drawImage(im, -32, -45, 64, 90);
            else { ctx.fillStyle = '#f5e6b0'; ctx.fillRect(-32, -45, 64, 90); this._text(ctx, d.name, 0, 4, 14, '#333'); }
            ctx.restore();
        }

        _drawHud(ctx) {
            const by = this.bankY;
            if (ok('bank')) ctx.drawImage(IM.bank, 0, by);
            else { ctx.fillStyle = '#6d3f1d'; ctx.fillRect(0, by, 522, 87); }
            ctx.fillStyle = '#f3e2b0'; this._rr(ctx, 11, 62 + by, 54, 21, 4); ctx.fill();
            this._text(ctx, String(this.sun), 38, 79 + by, 17, '#2b1b0a', null);
            for (let i = 0; i < this.cards.length; i++) {
                const R = this._cardRect(i), c = this.cards[i], p = PLANTS[c.key], im = IM['card_' + c.key];
                if (im && im.complete && im.naturalWidth) ctx.drawImage(im, R.x, R.y, R.w, R.h);
                else { ctx.fillStyle = '#f3e2b0'; ctx.fillRect(R.x, R.y, R.w, R.h); }
                const afford = this.sun >= p.cost;
                if (c.cd > 0 || !afford) {
                    ctx.fillStyle = 'rgba(0,0,0,0.5)';
                    ctx.fillRect(R.x, R.y, R.w, R.h);
                    if (c.cd > 0) {
                        ctx.fillStyle = 'rgba(0,0,0,0.35)';
                        ctx.fillRect(R.x, R.y, R.w, R.h * (c.cd / p.cd));
                    }
                }
                if (this.sel === i) { ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = 3; ctx.strokeRect(R.x - 1, R.y - 1, R.w + 2, R.h + 2); }
            }
            // 菜单按钮
            if (this.phase !== 'intro') {
                const hov = this._hit(this.mx, this.my, 700, 4, 92, 30);
                const g = ctx.createLinearGradient(0, 4, 0, 34);
                g.addColorStop(0, hov ? '#c79a55' : '#a97a3d'); g.addColorStop(1, '#6e4520');
                ctx.fillStyle = g; this._rr(ctx, 700, 4, 92, 30, 6); ctx.fill();
                ctx.strokeStyle = '#3b2410'; ctx.lineWidth = 2.5; ctx.stroke();
                this._text(ctx, '菜单', 746, 26, 16, '#ffe9a8', '#3b2410');
            }
            // 关卡进度条
            if (this.phase !== 'intro') {
                const x = 590, y = 574, w = 190, h = 16;
                const p = Math.min(1, ((this.spawned + this.killed) / (2 * this.L.total)));
                ctx.fillStyle = 'rgba(30,20,8,0.75)'; this._rr(ctx, x, y, w, h, 8); ctx.fill();
                ctx.save(); this._rr(ctx, x + 2, y + 2, w - 4, h - 4, 6); ctx.clip();
                const g = ctx.createLinearGradient(0, y, 0, y + h);
                g.addColorStop(0, '#9ccc65'); g.addColorStop(1, '#558b2f');
                ctx.fillStyle = g; ctx.fillRect(x + w - 2 - (w - 4) * p, y + 2, (w - 4) * p, h - 4);
                ctx.restore();
                ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 2; this._rr(ctx, x, y, w, h, 8); ctx.stroke();
                if (this.L.huge) {
                    const fx = x + w * 0.2;
                    ctx.strokeStyle = '#eee'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx, y + 14); ctx.lineTo(fx, y - 6); ctx.stroke();
                    ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.moveTo(fx, y - 6); ctx.lineTo(fx + 11, y - 2); ctx.lineTo(fx, y + 2); ctx.closePath(); ctx.fill();
                }
                ctx.fillStyle = '#cfd8a8'; ctx.beginPath(); ctx.arc(x + w - 2 - (w - 4) * p, y + h / 2, 7, 0, 7); ctx.fill();
                ctx.strokeStyle = '#33401c'; ctx.lineWidth = 1.5; ctx.stroke();
                this._text(ctx, '关卡 ' + this.L.name, x + w / 2, y - 6, 13, '#fff', '#33401c');
            }
            // 1-1 教学提示
            if (this.L.tutorial && this.phase === 'play') {
                let t = null;
                if (this.hint.planted === 0) t = this.sel >= 0 ? '点击草坪种下植物' : (this.sun >= 100 ? '点击上方种子包，选择豌豆射手' : '点击掉落的阳光，收集阳光');
                else if (!this.hint.sunSeen && this.suns.some(s => s.state === 'rest')) t = '点击掉落的阳光，收集阳光';
                else if (!this.hint.fused && this.hint.planted >= 2) t = '把豌豆射手种在豌豆射手身上，可以融合成双发射手';
                if (t) {
                    ctx.font = 'bold 18px "Microsoft YaHei", sans-serif';
                    const tw = ctx.measureText(t).width + 30;
                    ctx.fillStyle = 'rgba(30,20,8,0.7)'; this._rr(ctx, VW / 2 - tw / 2, 520, tw, 34, 8); ctx.fill();
                    this._text(ctx, t, VW / 2, 543, 18, '#fff3c4', null);
                }
            }
            if (this.phase === 'intro' && this.introT < 4.5) this._text(ctx, '关卡 ' + this.L.name, VW - 30, VH - 24, 26, '#fff', '#2b3a10', 'right');
        }

        _drawGhost(ctx) {
            if (this.phase !== 'play' || this.sel < 0) return;
            const key = this.cards[this.sel].key, def = PLANTS[key];
            const wx = this.mx + this.camX, wy = this.my;
            const c = Math.floor((wx - GX) / CW), r = Math.floor((wy - GY) / CH);
            ctx.save(); ctx.translate(-this.camX, 0);
            const inGrid = c >= 0 && c < COLS && r >= 0 && r < ROWS && this.L.rows.includes(r);
            const cur = inGrid ? this.grid[c][r] : null;
            const fuseTo = cur ? this._fuseResult(key, cur.key) : null;
            if (inGrid && !cur) {
                ctx.globalAlpha = 0.45;
                this._art(ctx, def.art, def.fallback, GX + c * CW + CW / 2, GY + r * CH + 88, this.time, 12);
            } else if (fuseTo) {
                const fd = PLANTS[fuseTo];
                const x = GX + c * CW + CW / 2, base = GY + r * CH + 88;
                ctx.globalAlpha = 0.5 + 0.25 * Math.sin(this.time * 8);
                ctx.fillStyle = 'rgba(174,213,81,0.35)';
                ctx.beginPath(); ctx.ellipse(x, base - 32, 40, 46, 0, 0, 7); ctx.fill();
                this._art(ctx, fd.art, fd.fallback, x, base, this.time, 12);
                ctx.globalAlpha = 1;
                this._text(ctx, '融合', x, base - 96, 16, '#e8f5a0', '#2b3a10');
            }
            ctx.globalAlpha = 0.9;
            this._art(ctx, def.art, def.fallback, wx, wy + 36, this.time, 12);
            ctx.restore();
        }

        _drawBanners(ctx) {
            if (this.phase === 'intro') {
                const t = this.introT;
                const txt = t >= 5.2 && t < 5.8 ? '准备...' : t >= 5.8 && t < 6.4 ? '安放...' : t >= 6.4 && t < 7.2 ? '植物!' : null;
                if (txt) this._text(ctx, txt, VW / 2, 320, txt === '植物!' ? 84 : 70, '#d32f2f', '#fff');
            }
            if (this.banner) {
                const b = this.banner, a = Math.min(1, b.t * 2);
                ctx.globalAlpha = a;
                this._text(ctx, b.txt, VW / 2, 330, b.size, b.color, '#fff');
                ctx.globalAlpha = 1;
            }
        }

        _drawPause(ctx) {
            ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, VW, VH);
            this._text(ctx, '游戏暂停', VW / 2, 190, 44, '#ffe082', '#3b2410');
            this._btn(ctx, 300, 230, 200, 50, '继续游戏');
            this._btn(ctx, 300, 295, 200, 50, '重新开始');
            this._btn(ctx, 300, 360, 200, 50, '主菜单');
        }
        _drawLose(ctx) {
            const u = Math.min(1, this.loseT / 1.2);
            ctx.fillStyle = 'rgba(0,0,0,' + (0.62 * u) + ')'; ctx.fillRect(0, 0, VW, VH);
            ctx.globalAlpha = u;
            this._text(ctx, '僵尸吃掉了你的脑子!', VW / 2, 250, 52, '#c62828', '#2b0000');
            ctx.globalAlpha = 1;
            if (this.loseT >= 1.8) {
                this._btn(ctx, 300, 330, 200, 50, '重新开始');
                this._btn(ctx, 300, 395, 200, 50, '主菜单');
            }
        }
        _drawReward(ctx) {
            const t = this.rewardT, k = this.reward.plant, d = PLANTS[k], im = IM['card_' + k];
            ctx.fillStyle = 'rgba(0,0,0,' + (0.7 * Math.min(1, t / 0.6)) + ')'; ctx.fillRect(0, 0, VW, VH);
            const e = ease(t / 1.0);
            const fx = this.rewardFrom.x, fy = this.rewardFrom.y;
            const x = lerp(fx, VW / 2, e), y = lerp(fy, 300, e), sc = lerp(1, 2.8, e);
            ctx.save(); ctx.translate(x, y);
            ctx.globalCompositeOperation = 'lighter'; ctx.rotate(t * 0.6);
            for (let i = 0; i < 14; i++) {
                ctx.rotate(Math.PI / 7);
                ctx.fillStyle = 'rgba(255,230,120,' + (0.16 * e) + ')';
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(330, -22); ctx.lineTo(330, 22); ctx.closePath(); ctx.fill();
            }
            ctx.restore();
            ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
            if (im && im.complete && im.naturalWidth) ctx.drawImage(im, -32, -45, 64, 90);
            ctx.restore();
            if (t >= 0.7) {
                ctx.globalAlpha = Math.min(1, (t - 0.7) / 0.5);
                this._text(ctx, '你得到了一株新植物!', VW / 2, 110, 40, '#ffe082', '#3b2410');
                this._text(ctx, d.name, VW / 2, 450, 30, '#fff', '#3b2410');
                this._text(ctx, d.desc, VW / 2, 482, 17, '#e0e0e0', '#222');
                ctx.globalAlpha = 1;
            }
            if (t >= 1.2) this._btn(ctx, 300, 500, 200, 56, this.lv + 1 < LEVELS.length ? '下一关' : '主菜单');
        }
    }

    window.PvzGame = PvzGame;
})();
