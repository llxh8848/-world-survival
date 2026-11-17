// 火柴人大战僵尸（从原 pvz.js 拆出的独立宿主；与原版植物大战僵尸 pvz.js 无关）
const PVZ_VW = 1100, PVZ_VH = 620;        // 虚拟分辨率（按窗口等比缩放居中）
const PVZ_COLS = 10, PVZ_ROWS = 5;
const PVZ_GX = 252, PVZ_GY = 96;          // 草坪左上角
const PVZ_CW = 78, PVZ_CH = 104;          // 格子尺寸
const PVZ_LOSE_X = 168;                   // 僵尸越过=进屋
const PVZ_MOWER_X = 232;                  // 小推车停靠位

// ========== 音效与音乐（WebAudio合成，无外部音频文件） ==========
// 首次点击时创建AudioContext（浏览器自动播放策略）；M键或右下角喇叭按钮静音（存pvz_mute）
const PvzAudio = {
    ctx: null, master: null, sfx: null, mus: null, _noise: null,
    muted: (function () { try { return localStorage.getItem('pvz_mute') === '1'; } catch (e) { return false; } })(),
    musTimer: null, musNext: 0, musStep: 0, musKind: null,
    _thr: {},
    init() {
        if (this.ctx) return;
        const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 1;
        const comp = this.ctx.createDynamicsCompressor(); // 压缩器：提音量不削波
        comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.002; comp.release.value = 0.15;
        this.master.connect(comp); comp.connect(this.ctx.destination);
        this.sfx = this.ctx.createGain(); this.sfx.gain.value = 1.1; this.sfx.connect(this.master);
        this.mus = this.ctx.createGain(); this.mus.gain.value = 0.65; this.mus.connect(this.master);
        const len = this.ctx.sampleRate * 0.6, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), ch = buf.getChannelData(0);
        for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
        this._noise = buf;
    },
    resume() { this.init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    toggleMute() {
        this.muted = !this.muted;
        try { localStorage.setItem('pvz_mute', this.muted ? '1' : '0'); } catch (e) { }
        if (this.master) this.master.gain.value = this.muted ? 0 : 1;
    },
    // ---- 基元 ----
    _env(g, t, peak, dur) {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    },
    _osc(type, f0, f1, t, dur, peak, dest) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(Math.max(1, f0), t);
        if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
        this._env(g, t, peak, dur);
        o.connect(g); g.connect(dest || this.sfx);
        o.start(t); o.stop(t + dur + 0.05);
    },
    _hit(t, dur, peak, fType, f0, f1, q, dest) {
        const s = this.ctx.createBufferSource(); s.buffer = this._noise; s.loop = true;
        const fl = this.ctx.createBiquadFilter(); fl.type = fType;
        fl.frequency.setValueAtTime(f0, t);
        if (f1) fl.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
        fl.Q.value = q || 0.7;
        const g = this.ctx.createGain(); this._env(g, t, peak, dur);
        s.connect(fl); fl.connect(g); g.connect(dest || this.sfx);
        s.start(t); s.stop(t + dur + 0.05);
    },
    // ---- 音效 ----
    play(name) {
        if (!this.ctx || this.muted) return;
        const now = performance.now();
        const gap = { splat: 55, munch: 140, shoot: 50, zdie: 130, groan: 700, knock: 40, hit: 170, throw: 60, ink: 60 }[name] || 40;
        if (now - (this._thr[name] || 0) < gap) return;
        this._thr[name] = now;
        const t = this.ctx.currentTime, R = Math.random;
        switch (name) {
            case 'shoot': this._osc('square', 300 + R() * 80, 90, t, 0.07, 0.22); this._hit(t, 0.04, 0.08, 'highpass', 2400); break;
            case 'splat': this._hit(t, 0.07, 0.26, 'bandpass', 500 + R() * 300, 200, 1.4); break;
            case 'plant': this._hit(t, 0.13, 0.35, 'lowpass', 420, 120); this._osc('sine', 150, 65, t, 0.1, 0.24); break;
            case 'sun': this._osc('sine', 660, 1320, t, 0.11, 0.2); this._osc('sine', 990, 1760, t + 0.07, 0.13, 0.16); break;
            case 'munch': this._hit(t, 0.06, 0.2, 'lowpass', 900, 300); break;
            case 'chomp': this._hit(t, 0.2, 0.45, 'lowpass', 800, 140); this._osc('sine', 140, 50, t, 0.2, 0.36); break;
            case 'boom': this._hit(t, 0.6, 0.7, 'lowpass', 3200, 70); this._osc('sine', 95, 26, t, 0.55, 0.55); break;
            case 'mower': this._hit(t, 0.5, 0.3, 'bandpass', 700, 300, 2); this._osc('sawtooth', 75, 170, t, 0.45, 0.2); break;
            case 'zdie': this._osc('sine', 200 + R() * 90, 45, t, 0.24, 0.18); break;
            case 'groan': this._osc('sawtooth', 62 + R() * 30, 50, t, 0.45, 0.1); break;
            case 'wave': [220, 277, 330].forEach((f, i) => this._osc('square', f, f, t + i * 0.1, 0.13, 0.18)); break;
            case 'lose': [392, 370, 311, 233].forEach((f, i) => this._osc('sawtooth', f, f * 0.93, t + i * 0.3, 0.32, 0.24)); this._hit(t + 1.0, 0.7, 0.22, 'lowpass', 500, 80); break;
            case 'win': [523, 659, 784, 1047].forEach((f, i) => this._osc('triangle', f, f, t + i * 0.13, 0.26, 0.26)); this._osc('triangle', 1319, 1319, t + 0.58, 0.42, 0.2); break;
            case 'click': this._osc('sine', 880, 660, t, 0.04, 0.14); break;
            case 'card': this._osc('sine', 500, 820, t, 0.07, 0.16); break;
            case 'shovel': this._hit(t, 0.1, 0.28, 'bandpass', 1600, 450, 1); break;
            case 'bowl': this._osc('sine', 190, 85, t, 0.13, 0.34); this._hit(t, 0.09, 0.18, 'lowpass', 600, 200); break;
            case 'kit': this._osc('sine', 523, 784, t, 0.1, 0.18); this._osc('sine', 784, 1047, t + 0.09, 0.13, 0.15); break;
            case 'vault': this._osc('sine', 280, 820, t, 0.16, 0.14); break;
            case 'ready': [392, 523].forEach((f, i) => this._osc('triangle', f, f, t + i * 0.16, 0.22, 0.2)); break;
            case 'throw': this._hit(t, 0.12, 0.18, 'bandpass', 400, 1800, 1.3); break; // 投掷嗖声
            case 'knock': this._osc('sine', 170, 65, t, 0.09, 0.3); this._hit(t, 0.05, 0.2, 'bandpass', 1100, 350, 1.5); break; // 石子命中
            case 'ink': this._osc('sine', 420, 980, t, 0.1, 0.16); this._osc('sine', 840, 1560, t + 0.05, 0.11, 0.1); break; // 收墨水
            case 'hit': this._hit(t, 0.07, 0.22, 'lowpass', 800, 250); break; // 僵尸锤击
            case 'pop': this._osc('sine', 640, 200, t, 0.08, 0.2); break; // 掉头
        }
    },
    // ---- 音乐：双声部步进音序器（0=休止符；lead主旋律+bass低音+battle镲片） ----
    _MUS: {
        menu: {
            step: 0.26,
            lead: [72, 0, 76, 0, 79, 0, 76, 0, 77, 0, 76, 0, 74, 0, 72, 0, 74, 0, 76, 0, 79, 0, 81, 0, 79, 0, 76, 0, 74, 0, 0, 0],
            bass: [48, 0, 0, 0, 52, 0, 0, 0, 45, 0, 0, 0, 50, 0, 0, 0, 48, 0, 0, 0, 52, 0, 0, 0, 43, 0, 0, 0, 48, 0, 0, 0],
            perc: 0,
        },
        battle: {
            step: 0.22,
            lead: [69, 0, 72, 0, 76, 0, 72, 0, 74, 0, 72, 0, 71, 0, 72, 0, 69, 0, 72, 0, 76, 0, 79, 0, 77, 0, 76, 0, 74, 0, 71, 0],
            bass: [45, 0, 45, 0, 45, 0, 48, 0, 41, 0, 41, 0, 43, 0, 45, 0, 45, 0, 45, 0, 48, 0, 50, 0, 52, 0, 50, 0, 48, 0, 45, 0],
            perc: 4, // 每4步一个镲片
        },
        stick: { // 火柴人战曲：E小调，步幅更紧、每2步一个镲片
            step: 0.19,
            lead: [64, 0, 67, 0, 71, 0, 67, 0, 72, 0, 71, 0, 69, 0, 67, 0, 64, 0, 67, 0, 71, 0, 74, 0, 76, 0, 74, 0, 71, 0, 69, 0],
            bass: [40, 0, 40, 0, 43, 0, 40, 0, 38, 0, 38, 0, 40, 0, 43, 0, 40, 0, 40, 0, 43, 0, 45, 0, 47, 0, 45, 0, 43, 0, 40, 0],
            perc: 2,
        },
    },
    _f(m) { return 440 * Math.pow(2, (m - 69) / 12); },
    _mnote(type, m, t, dur, peak) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type; o.frequency.value = this._f(m);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.mus); o.start(t); o.stop(t + dur + 0.05);
    },
    // 文件音乐表：命中则用mp3循环替代内置音序器
    _MUS_FILES: { menu: 'assets/ai_audio.mp3', battle: 'assets/ai_audio.mp3', stick: 'assets/ai_audio.mp3' },
    // kind: 'menu'|'battle'|'stick'|null；相同则不动；null停止
    music(kind) {
        if (!this.ctx) return; // ctx未建前忽略，画面切换后由_draw每帧同步
        if (this.musKind === kind) { // 同曲：仅在文件音乐被暂停(自动播放策略)时重试
            if (kind && this._bgmEl && this._bgmEl.paused) this._bgmEl.play().catch(() => { });
            return;
        }
        this.musKind = kind;
        if (this.musTimer) { clearInterval(this.musTimer); this.musTimer = null; }
        const file = kind && this._MUS_FILES[kind];
        if (file) { // mp3循环：接入mus增益（统一静音/音量）
            if (!this._bgmEl) {
                this._bgmEl = new Audio(); this._bgmEl.loop = true;
                this.ctx.createMediaElementSource(this._bgmEl).connect(this.mus);
            }
            if (this._bgmFile !== file) { this._bgmEl.src = file; this._bgmFile = file; }
            this._bgmEl.play().catch(() => { }); // 未交互前被拦→下帧music()重试
            return;
        }
        if (this._bgmEl) this._bgmEl.pause();
        if (!kind) return;
        const M = this._MUS[kind];
        this.musStep = 0; this.musNext = this.ctx.currentTime + 0.08;
        this.musTimer = setInterval(() => {
            while (this.musNext < this.ctx.currentTime + 0.4) {
                const t = this.musNext, s = this.musStep;
                const l = M.lead[s % M.lead.length], b = M.bass[s % M.bass.length];
                if (l) this._mnote('triangle', l, t, M.step * 1.7, 0.24);
                if (b) this._mnote('sine', b - 12, t, M.step * 3.4, 0.22);
                if (M.perc && s % M.perc === 0) this._hit(t, 0.04, 0.08, 'highpass', 6000, 0, 0.7, this.mus);
                this.musNext += M.step; this.musStep++;
            }
        }, 60);
    },
};

class StickPvzGame {
    constructor() {
        this.canvas = document.getElementById('pvzCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.running = false; this._raf = null; this._last = 0;
        this.mx = -99; this.my = -99;
        this.view = { s: 1, ox: 0, oy: 0 };
        this.screen = 'stickmenu';
        this.stickAlone = true;
        this._bind();
    }
    startStick() {
        this.running = true;
        this._last = performance.now();
        this._resize();
        this._openStick();
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
    }
    _bind() {
        this._resize = () => {
            this.canvas.width = innerWidth; this.canvas.height = innerHeight;
            const s = Math.min(this.canvas.width / PVZ_VW, this.canvas.height / PVZ_VH);
            this.view = { s, ox: (this.canvas.width - PVZ_VW * s) / 2, oy: (this.canvas.height - PVZ_VH * s) / 2 };
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
            PvzAudio.resume();
            toV(e); this._click(this.mx, this.my);
        });
        this.canvas.addEventListener('contextmenu', (e) => {
            if (!this.running) return;
            e.preventDefault(); if (this.stick) this.stick.sel = false;
        });
        addEventListener('keydown', (e) => {
            if (!this.running) return;
            if (e.code === 'Escape' && this.screen === 'stick' && this.stick) this.stick.sel = false;
            if (e.code === 'KeyM') { PvzAudio.resume(); PvzAudio.toggleMute(); }
        });
    }
    _click(x, y) {
        if (x > 1050 && x < 1094 && y > 84 && y < 124) { PvzAudio.toggleMute(); return; }
        if (this.screen === 'stick') { this.stick._click(x, y); return; }
        PvzAudio.play('click');
        if (this.screen === 'stickmenu') this._clickStickMenu(x, y);
    }
    _update(dt) {
        if (this.screen === 'stick') this.stick._update(dt);
    }
    _draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = '#0a140a';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.save();
        ctx.translate(this.view.ox, this.view.oy);
        ctx.scale(this.view.s, this.view.s);
        PvzAudio.music(this.screen === 'stick'
            ? (this.stick.phase === 'play' ? 'stick' : (this.stick.phase === 'story' ? 'menu' : null))
            : 'menu');
        if (this.screen === 'stickmenu') this._drawStickMenu(ctx);
        else if (this.screen === 'stick') this.stick._draw(ctx);
        this._drawMute(ctx);
        ctx.restore();
    }
    _openStick() { // 进入火柴人改版：选关主页
        if (!this.stick) this.stick = new StickGame(this);
        if (this.stkLv === undefined) { // 已解锁关卡数（1=只有1-1），localStorage持久
            let v = 1; try { v = +localStorage.getItem('stkLv') || 1; } catch (e) { }
            this.stkLv = Math.max(1, Math.min(v, STK_LV.length));
        }
        this.screen = 'stickmenu';
    }
    _startStick(lv) { // 从选关页进入第lv关（0基；看过的剧情自动跳过）
        this.stick.reset(lv, !!this.stick._seen[lv]);
        this.screen = 'stick';
        PvzAudio.play('card');
    }
    _stkCardRect(i) { // 关卡卡矩形：≤6关单行；≥7关分两行（上排1-5，下排其余居中）
        const n = STK_LV.length;
        if (n > 6) {
            const w = 150, h = 178, gap = 16;
            if (i < 5) { const x0 = (PVZ_VW - (5 * w + 4 * gap)) / 2; return { x: x0 + i * (w + gap), y: 208, w, h, two: true }; }
            const m = n - 5, x0 = (PVZ_VW - (m * w + (m - 1) * gap)) / 2;
            return { x: x0 + (i - 5) * (w + gap), y: 412, w, h, two: true };
        }
        const w = n > 5 ? 152 : n > 4 ? 172 : 190, h = 200, gap = n > 5 ? 20 : n > 4 ? 38 : 60; // 关数越多卡越窄
        const x0 = (PVZ_VW - (n * w + (n - 1) * gap)) / 2;
        return { x: x0 + i * (w + gap), y: 230, w, h, two: false };
    }
    _clickStickMenu(x, y) { // 选关页点击
        if (x > 24 && x < 120 && y > 16 && y < 60) { // 返回
            if (this.stickAlone && window.game && window.game.ui) { // 独立入口：直接回游戏盒
                window.game.ui.hideStickPvz();
                window.game.ui.showMainMenu(window.game.username);
                return;
            }
            this.screen = 'home'; return;
        }
        for (let i = 0; i < STK_LV.length; i++) {
            const R = this._stkCardRect(i);
            if (i < this.stkLv && x > R.x && x < R.x + R.w && y > R.y && y < R.y + R.h) { this._startStick(i); return; }
        }
    }
    _drawStickMenu(ctx) { // 火柴人改版·选关主页（纸片风）
        ctx.fillStyle = '#efe8d5'; ctx.fillRect(0, 0, PVZ_VW, PVZ_VH);
        ctx.strokeStyle = 'rgba(96,125,160,0.2)'; ctx.lineWidth = 1;
        for (let y = 40; y < PVZ_VH; y += 26) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(PVZ_VW, y); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(200,80,80,0.4)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(64, 0); ctx.lineTo(64, PVZ_VH); ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#3a2f1d'; ctx.font = 'bold 46px sans-serif';
        ctx.fillText('火柴人大战僵尸', PVZ_VW / 2, 148);
        ctx.fillStyle = '#8d6e63'; ctx.font = '18px sans-serif';
        ctx.fillText('选 择 关 卡', PVZ_VW / 2, 184);
        const n = STK_LV.length;
        const tt = performance.now() / 1000;
        for (let i = 0; i < n; i++) {
            const R = this._stkCardRect(i), L = STK_LV[i];
            const cx = R.x, y0 = R.y, w = R.w, h = R.h, un = i < this.stkLv;
            const hov = un && this.mx > cx && this.mx < cx + w && this.my > y0 && this.my < y0 + h;
            ctx.fillStyle = un ? (hov ? '#ffffff' : '#f7f3e6') : 'rgba(200,200,200,0.55)';
            this._rr(ctx, cx, y0, w, h, 12); ctx.fill();
            ctx.strokeStyle = un ? '#333' : '#999'; ctx.lineWidth = hov ? 3 : 2;
            this._rr(ctx, cx, y0, w, h, 12); ctx.stroke();
            ctx.fillStyle = un ? '#222' : '#999'; ctx.font = 'bold 30px sans-serif';
            ctx.fillText('1-' + (i + 1), cx + w / 2, y0 + (R.two ? 46 : 52));
            ctx.save(); ctx.translate(cx + w / 2, y0 + h - (R.two ? 34 : 26)); ctx.scale(0.9, 0.9);
            if (L.icon === 'shield') this.stick._shieldArt(ctx, { t: tt, hp: 1, maxHp: 1 }, 0, 0); // 本关代表：K盾火柴人
            else if (L.icon === 'bomber') this.stick._bomberArt(ctx, { t: tt, hp: 1, maxHp: 1, fuseT: 0 }, 0, 0); // 本关代表：自爆兵
            else if (L.icon === 'cold') this.stick._coldArt(ctx, { t: tt, hp: 1, maxHp: 1, throwT: 0 }, 0, 0); // 本关代表：寒冷火柴人
            else if (L.icon === 'bird') this.stick._birdArt(ctx, { t: tt, hp: 1, maxHp: 1, chewT: 0, biteT: 0 }, 0, 0); // 本关代表：食人鸟火柴人
            else if (L.icon === 'boss') { // 本关代表：紫柴僵尸boss
                ctx.scale(0.52, 0.52); ctx.translate(0, -this.stick._zY({ row: 0 }));
                this.stick._szArt(ctx, { x: 0, row: 0, t: tt, type: 'pz', armor: 0, maxArmor: 1, hp: 1, maxHp: 1, crit: false, dead: false, die: 0, flash: 0, icon: true });
            }
            else if (L.mode === 'pong') { // 本关代表：弹板+弹珠
                ctx.strokeStyle = '#333'; ctx.lineWidth = 2.5;
                ctx.fillStyle = '#795548'; this._rr(ctx, -34, -32, 13, 52, 5); ctx.fill(); ctx.stroke();
                ctx.fillStyle = '#1e88e5'; ctx.beginPath(); ctx.arc(22, -14, 12, 0, 7); ctx.fill(); ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(18, -18, 3.5, 0, 7); ctx.fill();
            }
            else if (L.flagTypes && L.flagTypes.includes('hat')) { // 本关代表：绿帽子僵尸
                ctx.translate(0, -this.stick._zY({ row: 0 }));
                this.stick._szArt(ctx, { x: 0, row: 0, t: tt, type: 'hat', armor: 1, maxArmor: 1, hp: 1, maxHp: 1, crit: false, dead: false, die: 0, flash: 0, icon: true });
            }
            else if (L.flagTypes && L.flagTypes.includes('pop')) { // 本关代表：人缘僵尸（爱心头）
                ctx.translate(0, -this.stick._zY({ row: 0 }));
                this.stick._szArt(ctx, { x: 0, row: 0, t: tt, type: 'pop', armor: 0, maxArmor: 1, hp: 1, maxHp: 1, crit: false, dead: false, die: 0, flash: 0, icon: true });
            }
            else if (L.cards.includes('shield')) this.stick._shieldArt(ctx, { t: tt, hp: 1, maxHp: 1 }, 0, 0);
            else if (L.cards.includes('rage')) this.stick._rageArt(ctx, { t: tt, hp: 1, maxHp: 1, fuseT: 9 }, 0, 0);
            else if (L.cards.includes('clock')) this.stick._clockArt(ctx, { t: tt, hp: 1, maxHp: 1 }, 0, 0);
            else this.stick._throwerArt(ctx, { t: tt, throwT: 0, hp: 1, maxHp: 1 }, 0, 0);
            ctx.restore();
            ctx.fillStyle = un ? '#666' : '#aaa'; ctx.font = (R.two ? '13' : '14') + 'px sans-serif';
            ctx.fillText(un ? L.name : '通关上一关解锁', cx + w / 2, R.two ? y0 + h - 8 : y0 + h + 26);
        }
        this.stick._skBtn(ctx, 24, 16, 96, 44, '← 返回');
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
    _drawMute(ctx) {
        ctx.save();
        this._rr(ctx, 1050, 84, 44, 40, 8);
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
        ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.translate(1072, 104);
        ctx.fillStyle = '#ffe082';
        ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(-4, -4); ctx.lineTo(3, -11); ctx.lineTo(3, 11); ctx.lineTo(-4, 4); ctx.lineTo(-10, 4); ctx.closePath(); ctx.fill();
        if (PvzAudio.muted) {
            ctx.strokeStyle = '#ef5350'; ctx.lineWidth = 3; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(6, -8); ctx.lineTo(14, 8); ctx.moveTo(14, -8); ctx.lineTo(6, 8); ctx.stroke();
        } else {
            ctx.strokeStyle = '#ffe082'; ctx.lineWidth = 2; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.arc(6, 0, 5, -0.9, 0.9); ctx.stroke();
            ctx.beginPath(); ctx.arc(6, 0, 9, -0.9, 0.9); ctx.stroke();
        }
        ctx.restore();
    }
}

// ==================== 火柴人大战僵尸（改版·第1关） ====================
// 手绘纸片风格独立玩法：药水经济→放置“石子火柴人”(前方有僵尸每1s掷一颗石子,伤害20)；
// “火柴人僵尸”260血，血量<25进入临界——掉头并持续自动掉血；共1旗。复用草坪几何与PvzAudio。
const STK_COST = 100, STK_INK0 = 150, STK_INK_VAL = 25,
    STK_PLANT_HP = 300, STK_ZHP = 260, STK_ZCRIT = 25, STK_ZBLEED = 9,
    STK_ZSPD = 13, STK_ZBITE = 24, STK_STONE_DMG = 20, STK_STONE_SPD = 340, STK_FIRE = 1.0;
const STK_STORY = [ // 1-1开局剧情：小黑(守方·分身术=放石子火柴人) × 小宇?(提供药水线索)
    { who: 'hei', text: '这是哪?' },
    { who: 'yu',  text: '不知道' },
    { who: 'hei', text: '怎么有僵尸?!幸好我会分身术...等等我要消耗点药水。' },
    { who: 'yu',  text: '天上好像掉药水了,我这也有点,僵尸交给你了加油!' },
];
const STK_STORY2 = [ // 1-2剧情：时钟火柴人登场
    { who: 'yu',  text: '僵尸越来越多了!' },
    { who: 'hei', text: '药水不够了要...' },
    { who: 'clk', text: '我是通明吗?我能生成药水' },
    { who: 'hei', text: '我忘了还有你了,那么开始吧。' },
    { who: 'clk', text: '(...好像我不用药水似的)' },
];
const STK_STORY3 = [ // 1-3《我已红温》剧情：小黑红温→气炸→被派去当自爆兵（真_小宇为画外音，无立绘）
    { who: 'hei',    text: '小宇你能给我加表情吗?' },
    { who: 'zhenyu', text: '不能' },
    { who: 'hei',    text: '气死我了!!!' },
    { who: 'yu',     text: '??????' },
    { who: 'hei',    text: '(爆炸)' },
    { who: 'yu',     text: '当自爆兵去吧' },
];
const STK_STORY4 = [ // 1-4剧情：绿帽子僵尸登场（时钟火柴人被冷落）
    { who: 'yu',  text: '僵尸咋喜欢戴绿帽子?' },
    { who: 'hei', text: '不知道,但他速度好快' },
    { who: 'yu',  text: '绿帽子打下来就不快了诶' },
    { who: 'clk', text: '(...没人和我说话吗)' },
];
const STK_STORY4_END = [ // 1-4通关剧情：救出发明家（正常人NPC登场）
    { who: 'inv', text: '呼...有人吗!!!' },
    { who: 'hei', text: '诶,那好像是正常人,快救他!' },
    { who: 'inv', text: '谢谢了,我会帮忙做些事情的' },
];
const STK_STORY5 = [ // 1-5剧情：发明家请小黑玩弹珠（开场剧情首次用正常人NPC）
    { who: 'inv', text: '来一场游戏放松下吧' },
    { who: 'hei', text: '啥?' },
    { who: 'inv', text: '我这里有个弹板,用它弹走我放的弹珠吧,不要让弹珠撞到家了' },
    { who: 'hei', text: '我来玩玩' },
];
const STK_STORY6 = [ // 1-6剧情：发明家送来K盾火柴人挡尸潮（出一半药水）
    { who: 'inv', text: '看我的盾牌,可以帮你阻挡尸潮' },
    { who: 'hei', text: '哇塞这个盾牌真坚硬!' },
    { who: 'inv', text: '1瓶药水我出,你自己找2瓶药水就行' },
    { who: 'yu',  text: '不好僵尸越来越多了!' },
];
const STK_STORY7 = [ // 1-7剧情：药水分身器造出不会死的自爆兵小铭（纸盾僵尸登场）
    { who: 'inv',  text: '我要没药水了,我就帮你弄1瓶药水了' },
    { who: 'hei',  text: '诶...不是僵尸咋也拿盾!?不过好像是纸盾' },
    { who: 'yu',   text: '那里有人' },
    { who: 'ming', text: '那边的人,你们好' },
    { who: 'hei',  text: '过来吧' },
    { who: 'clk',  text: '你会啥啊' },
    { who: 'ming', text: '你不觉得你们的队伍少了东西吗?' },
    { who: 'hei',  text: '没有' },
    { who: 'ming', text: '(拿出手雷)自爆兵!正好实现我的梦想' },
    { who: 'hei',  text: '?我不就是自爆兵吗?' },
    { who: 'ming', text: '我开手雷要一段时间' },
    { who: 'hei',  text: '那你不会死吗?' },
    { who: 'inv',  text: '看我发明的药水分身器!这样他本体就不会死了,他这个只需要1瓶药水' },
    { who: 'hei',  text: '快点防守吧僵尸要来了' },
];
const STK_STORY7_END = [ // 1-7通关剧情：预告“下岗”（可撤回误放的单位）
    { who: 'ming',   text: '我觉得有时候你放错东西了...' },
    { who: 'hei',    text: '可以让放错的撤回啊' },
    { who: 'zhenyu', text: '此关过后玩家你将获得“下岗”!' },
];
const STK_STORY7_END_EGG = [ // 1-7彩蛋剧情：带着“下岗”重打1-7→小宇?察觉、真_小宇送福利（下岗返还50%药水）
    { who: 'ming',   text: '我觉得有时候你放错东西了...' },
    { who: 'hei',    text: '可以让放错的撤回啊' },
    { who: 'yu',     text: '...我咋感觉多了一个东西' },
    { who: 'zhenyu', text: '好吧他没感觉错,不过你触发了彩蛋,我给你一个福利:下岗返还50%药水!' },
];
const STK_STORY8 = [ // 1-8剧情：超级空调冻住发明家→对僵尸扔冰块；药水破了·机械僵尸弹力器预告
    { who: 'hei',  text: '额,你们不觉得最近有点热吗?' },
    { who: 'inv',  text: '看我的超级空调' },
    { who: 'hei',  text: '是不是有点太冷了...' },
    { who: 'yu',   text: '发明家你咋成冰雕了?' },
    { who: 'inv',  text: '....我.....这......有......冰....块' },
    { who: 'hei',  text: '发明家你要不去打僵尸吧,对他们扔冰块!' },
    { who: 'inv',  text: '彳.....亍' },
    { who: 'ming', text: '你们先别聊了,天上的药水好像破了' },
    { who: 'hei',  text: '???怎么回事' },
    { who: 'ming', text: '还有僵尸他们不知道哪来的一次性弹力器,越过了我。' },
    { who: 'yu',   text: '看来我们要让发明家发明一个药水复制器了...' },
];
const STK_STORY9 = [ // 1-9剧情：核司带食人鸟迷路至此；小宇?预告“世吞”（血量僵尸）
    { who: 'hei',  text: '?哪来的食人鸟啊' },
    { who: 'hs',   text: '额,这里是哪?' },
    { who: 'yu',   text: '又来人了?' },
    { who: 'hei',  text: 'emm...这里有僵尸,你来住我们的房子吧' },
    { who: 'hs',   text: '僵尸?食人鸟你要吃饭吗?' },
    { who: 'bird', text: '...吱...' },
    { who: 'hs',   text: '那来吧!' },
    { who: 'yu',   text: '还有世吞' },
];
const STK_STORY10 = [ // 1-10剧情：紫柴僵尸boss登场；发明家送免费分身器；时钟火柴人又落选
    { who: 'yu',   text: '哪来的动静!?' },
    { who: 'hei',  text: '那是什么?' },
    { who: 'ming', text: '好大的紫色火柴人啊' },
    { who: 'inv',  text: '我给你们无需药水的分身器,你们自己慢慢来,有冷却的' },
    { who: 'clk',  text: '依旧不带我...' },
];
const STK_HAT_HP = 80, STK_HAT_SPD = 1.8; // 绿帽子：一类防具80血；戴帽移速+80%，帽掉恢复
// 僵尸出怪等级：hat=2 → 第2波（含旗帜波）起可出现；占1个出怪量
// 僵尸出怪等级：pop=2 → 第2波起可出现；占2个出怪量；psh纸盾=1（前波即可出现）
const STK_ZCOST = { psh: 2, pop: 2, mech: 2, hpz: 3 }; // 占出怪量（未列=1）；血量僵尸占3量
const STK_ZPOOL7 = [['psh', 50], ['basic', 50], ['hat', 40], ['pop', 40]]; // 1-7旗波概率池
const STK_ZPOOL7_PRE = [['psh', 50], ['basic', 50]]; // 1-7前波池：只出等级1（纸盾+普通）
const STK_ZPOOL8_PRE = [['mech', 40], ['psh', 50], ['basic', 50]]; // 1-8前波池：机械/纸盾/普通
const STK_ZPOOL8 = [['mech', 45], ['psh', 40], ['basic', 50], ['hat', 35], ['pop', 35]]; // 1-8旗波概率池
const STK_ZPOOL9_PRE = [['mech', 40], ['psh', 50], ['basic', 50]]; // 1-9前波池
const STK_ZPOOL9 = [['hpz', 26], ['mech', 45], ['psh', 40], ['basic', 50], ['hat', 35], ['pop', 35]]; // 1-9旗波池：血量僵尸登场
// 寒冷火柴人：每1.2s一发冰雹命中减速30%（持续1.6s）；30%概率掷冰块→冻结3s（冻结=定身且受伤×1.8）
const STK_COLD_FIRE = 1.2, STK_COLD_SLOW = 1.6, STK_FREEZE_T = 3, STK_ICE_CHANCE = 0.3, STK_BROKEN_VAL = 15;
// 机械僵尸：一次性弹力器0.62s跳过头个遇到的火柴人，落地后移速+190%（×2.9）
const STK_MECH_JUMP_T = 0.62, STK_MECH_BOOST = 2.9;
// 食人鸟火柴人：同原版大嘴花——一口吞下前方1.3格内僵尸（无视防具/血量），然后咀嚼42s
const STK_BIRD_CHEW = 42, STK_BIRD_REACH = 1.3;
const STK_HPZ_HP = 1000; // 血量僵尸：1000血（约4只普通僵尸）
// 1-10 boss关：紫柴僵尸8000血·免疫小推车·爆炸类伤害×0.1(免90%)·原地不动每18s换行；技能轮转：紫弹球→诅咒→激光
const STK_BOSS_HP = 8000, STK_BOSS_ROW_T = 18, STK_BOSS_SKILL_IV = 7;
const STK_LASER_T = 10, STK_LASER_DPS = 15; // 激光10s(期间不换行)·不穿透·命中者每0.1s吃1.5伤
const STK_BALL_SPD = 330; // 紫弹球：同1-5——球先向左飞撞左墙弹回，右缘弹板(跟鼠标Y)防守；漏过右缘=输；拉锯20s消散
const STK_BOSS_POOL = [['basic', 60], ['hat', 40], ['psh', 35], ['pop', 28], ['mech', 28], ['hpz', 10]]; // 1-10无限出怪每30s×8
const STK_RAND_CARDS = ['thrower', 'rage', 'shield', 'bomber', 'cold']; // 1-10随机卡池(无时钟/食人鸟)
const STK_SHIELD_HP = 4000, STK_SHIELD_AURA = 0.3; // K盾火柴人4000血；4×4内植物只吃30%伤害（抗70%）
const STK_CARDS = { // 可用卡：cost药水/cd秒
    thrower: { cost: 100, cd: 4, name: '石子火柴人' },
    clock:   { cost: 50,  cd: 5, name: '时钟火柴人' },
    rage:    { cost: 150, cd: 13, name: '红温火柴人' },
    shield:  { cost: 75,  cd: 10, name: 'K盾火柴人' }, // 1-6发明家出1瓶(25)→实付50（2瓶药水）
    bomber:  { cost: 25,  cd: 20, name: '自爆兵火柴人' }, // 1-7：18s开雷后僵尸触碰即爆·1.8格连炸两次
    cold:    { cost: 200, cd: 9, name: '寒冷火柴人' }, // 1-8：1.2s冰雹减速30%；30%冰块冻结3s(冻结受伤×1.8)
    bird:    { cost: 150, cd: 7.5, name: '食人鸟火柴人' }, // 1-9：同原版大嘴花，吞1.3格→咀嚼42s
};
const STK_LV = [ // 关卡配置：plan=[秒,同波数量]；flag=大旗时刻/数量；name=关卡标题
    { name: '石子火柴人阵地', banner: '火柴人大战僵尸 · 1-1', plan: [[8, 1], [17, 1], [26, 1], [34, 1]], flagT: 42, flagN: 5, cards: ['thrower'], story: STK_STORY },
    { name: '新伙伴·时钟火柴人', banner: '火柴人大战僵尸 · 1-2', plan: [[15, 2], [25, 1], [35, 1]], flagT: 45, flagN: 5, cards: ['thrower', 'clock'], story: STK_STORY2 },
    { name: '我已红温!', banner: '火柴人大战僵尸 · 1-3 · 我已红温!', plan: [[9, 3], [21, 3], [33, 3]], flagT: 44, flagN: 6, cards: ['thrower', 'clock', 'rage'], story: STK_STORY3 },
    // 1-4：1旗帜=5波(4前波+第5波大旗) + 收尾1波 = 6波；本关起首波30s后才出怪；绿帽子僵尸出怪等级2
    { name: '绿帽子来袭', banner: '火柴人大战僵尸 · 1-4', plan: [[30, 1], [0, 1], [0, 1], [0, 1]], flagT: 0, flagN: 8, flagTypes: ['hat', 'basic', 'basic', 'hat', 'basic', 'hat', 'basic', 'basic'], post: [[0, 3]], postTypes: ['hat', 'basic', 'basic'], cards: ['thrower', 'clock', 'rage'], story: STK_STORY4, endStory: STK_STORY4_END },
    // 1-5：弹珠小游戏——弹板跟鼠标Y轴挡弹珠，弹珠撞左侧家墙=输；坚持60s=赢
    { name: '弹珠保卫战', banner: '火柴人大战僵尸 · 1-5 · 弹珠保卫战', mode: 'pong', cards: [], story: STK_STORY5 },
    // 1-6：K盾火柴人登场（发明家出一半药水，可被红温升级→全场抗伤90%转移给盾）；1旗帜+3波；人缘僵尸占2出怪量/等级2；旗波混绿帽子
    { name: 'K盾守护', banner: '火柴人大战僵尸 · 1-6 · K盾守护', plan: [[25, 1], [0, 1], [0, 1]], flagT: 0, flagN: 6, flagTypes: ['basic', 'pop', 'hat', 'pop', 'basic', 'hat', 'pop'], cards: ['thrower', 'clock', 'rage', 'shield'], halfShield: true, icon: 'shield', story: STK_STORY6 },
    // 1-7：自爆兵登场（25药水/20s冷却/18s开雷后触碰自爆·1.8格连炸两次）；2旗帜；概率出怪(纸盾50/普通50/绿帽40/人缘40，纸盾占2量·等级1)；通关解锁“下岗”
    { name: '自爆兵·双旗', banner: '火柴人大战僵尸 · 1-7 · 自爆兵·双旗', plan: [[22, 1], [0, 1], [0, 2]], flagT: 0, flagN: 5, flag2N: 7, zpool: true, cards: ['thrower', 'clock', 'rage', 'shield', 'bomber'], ink0: 175, icon: 'bomber', story: STK_STORY7, endStory: STK_STORY7_END },
    // 1-8：寒冷火柴人登场（冰雹减速30%·30%冰块冻结3s受伤×1.8）；天上掉破损药水(15/瓶)；机械僵尸占2量·弹力器跳过头个火柴人后移速+190%
    { name: '冰与弹力', banner: '火柴人大战僵尸 · 1-8 · 冰与弹力', plan: [[24, 1], [0, 1], [0, 2]], flagT: 0, flagN: 6, flag2N: 7, zpool: true, zpoolPre: STK_ZPOOL8_PRE, zpoolMain: STK_ZPOOL8, cards: ['thrower', 'clock', 'rage', 'shield', 'bomber', 'cold'], brokenInk: true, ink0: 200, icon: 'cold', story: STK_STORY8 },
    // 1-9：食人鸟火柴人登场（同原版大嘴花：吞前方1.3格僵尸→咀嚼42s）；血量僵尸“世吞”1000血占3量·旗波才出；2旗帜概率出怪
    { name: '食人鸟·世吞', banner: '火柴人大战僵尸 · 1-9 · 食人鸟·世吞', plan: [[24, 1], [0, 1], [0, 2]], flagT: 0, flagN: 6, flag2N: 8, zpool: true, zpoolPre: STK_ZPOOL9_PRE, zpoolMain: STK_ZPOOL9, cards: ['thrower', 'clock', 'rage', 'shield', 'bomber', 'cold', 'bird'], brokenInk: true, ink0: 225, icon: 'bird', story: STK_STORY9 },
    // 1-10 boss关：紫柴僵尸(8000血/免推车/爆炸90%减伤/原地每18s换行)；随机卡关卡：左缘每5s出1张随机卡(无时钟/食人鸟)，点击后免费种一次性；无限出怪每30s×8；击杀boss=胜
    { name: '最终Boss·紫柴', banner: '火柴人大战僵尸 · 1-10 · 最终Boss·紫柴', mode: 'boss', cards: [], icon: 'boss', story: STK_STORY10 },
];

class StickGame {
    constructor(g) { this.g = g; this._seen = {}; } // _seen[lv]=已看过该关剧情
    reset(lv, skip) { // lv=0基；skip=跳过剧情直接开战
        this.lv = lv; const C = STK_LV[lv];
        this.ink = C.ink0 || STK_INK0; this.time = 0; this.phase = 'play'; // story|end|play|win|lose
        this.grid = Array.from({ length: PVZ_COLS }, () => Array(PVZ_ROWS).fill(null));
        this.zombies = []; this.stones = []; this.inks = []; this.parts = []; this.floats = [];
        this.booms = []; // 自爆兵二段爆队列
        this.hasShovel = false; try { this.hasShovel = localStorage.getItem('stkShovel') === '1'; } catch (e) { } // 通关1-7解锁“下岗”
        this.refund = false; try { this.refund = localStorage.getItem('stkRefund') === '1'; } catch (e) { } // 彩蛋福利：下岗返还50%药水
        this.eggEnd = this.lv === 6 && this.hasShovel; // 彩蛋：带着“下岗”重打1-7→结尾剧情变化
        this.ekey = 'e' + lv + (this.eggEnd ? 'e' : ''); // 结尾剧情已看标记（彩蛋独立计）
        this.mowers = Array.from({ length: PVZ_ROWS }, (_, r) => ({ row: r, x: PVZ_MOWER_X, state: 'idle' }));
        this.sel = null; this.cards = C.cards || []; this.cd = {};
        for (const k of this.cards) this.cd[k] = 0;
        this.mode = C.mode || 'fight'; // fight=打僵尸 | pong=1-5弹珠关
        this.halfShield = !!C.halfShield; // 1-6发明家出一半药水：K盾实付50
        this.pong = this.mode === 'pong' ? { // 弹板在左侧跟鼠标Y；弹珠撞墙/弹板反弹
            time: 0, hits: 0, padH: 110, padY: PVZ_VH / 2, spd0: 380,
            ball: { x: PVZ_VW - 180, y: PVZ_VH / 2, vx: -380, vy: (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 140), r: 13 },
        } : null;
        this.skyT = 4; this.groanT = 4;
        this.waveAdd = this.lv >= 5 ? 1 : 0; // 第6关起：每波+1出怪量
        this.plan = C.plan || []; this.planI = 0; this.waveT0 = 0; // plan项=[首波秒数,本波数量]；其后波按清场/35s推进
        this.flagT = C.flagT || 0; this.flagN = C.flagN || 0; this.flagDone = false; this.flagQ = [];
        this.zpool = !!C.zpool; // 1-7/1-8：概率出怪（权重池，占出怪量/出怪等级见常量）
        this.zpoolPre = C.zpoolPre || STK_ZPOOL7_PRE; this.zpoolMain = C.zpoolMain || STK_ZPOOL7; // 前波/旗波权重池
        this.brokenInk = !!C.brokenInk; // 1-8：天降的是破损药水，只值15
        this.flagTypes = C.flagTypes || []; this.flagIdx = 0; // 旗帜波僵尸类型序列（zpool关开旗时随机生成）
        this.flag2N = C.flag2N || 0; this.flag2Done = !this.flag2N; this.flag2Q = []; this.flag2T = 0; // 第二旗（1-7）
        this.flag2Types = C.flag2Types || []; this.flag2Idx = 0;
        this.post = C.post || []; this.postI = 0; // 旗后收尾波
        this.postTypes = C.postTypes || []; this.postIdx = 0;
        // 1-10 boss关：随机分身卡槽+无限出怪+紫柴僵尸(boss)；不走旗帜出怪表
        this.bossMode = C.mode === 'boss';
        this.randCards = []; this.selFrom = -1; this.randT = 3;
        this.spawnT = 6; this.bossZ = null; this.skillT = 10; this.skillI = 0;
        this.laser = null; this.bossBall = null; this.padY = PVZ_VH / 2;
        if (this.bossMode) { this.flagDone = true; this.flag2Done = true; }
        this.preN = this.plan.reduce((s, p) => s + p[1] + this.waveAdd, 0); // 旗前零散总数（进度条旗点用）
        this.postN = this.post.reduce((s, p) => s + p[1] + this.waveAdd, 0);
        this.total = this.preN + this.flagN + this.waveAdd + (this.flag2N ? this.flag2N + this.waveAdd : 0) + this.postN; this.killed = 0;
        this.banner = { txt: '', t: 0 }; this.storyL = C.story;
        this.endStoryL = this.eggEnd ? STK_STORY7_END_EGG : (C.endStory || null); // 通关剧情（1-4发明家/1-7下岗/彩蛋）
        if (skip) this._startPlay();
        else { this.phase = 'story'; this.story = { i: 0, t: 0 }; }
    }
    _startPlay() { // 剧情结束/跳过：正式开战
        this.phase = 'play'; this._seen[this.lv] = true;
        this.banner = { txt: STK_LV[this.lv].banner, t: 3 };
        if (this.bossMode && !this.bossZ) { // 紫柴僵尸登场：右缘站桩（不动/不啃植物/免疫推车·爆炸90%减伤）
            this.bossZ = { type: 'pz', boss: true, pshield: 0, row: 2, x: 1072, hp: STK_BOSS_HP, maxHp: STK_BOSS_HP, armor: 0, maxArmor: 0, crit: false, headT: 0, freezeT: 0, slowT: 0, jumped: true, jumpT: 0, spdMul: 1, t: 0, eatT: 0, dead: false, die: 0, flash: 0, eating: false, rowT: STK_BOSS_ROW_T };
            this.zombies.push(this.bossZ);
            this._float(940, 150, '紫柴僵尸!', '#7b1fa2');
        }
        PvzAudio.play('ready');
    }
    _closeScene() { // 过场收场：开场剧情→开战；结尾剧情→胜利结算
        if (this.phase === 'end') { this._seen[this.ekey] = true; this.phase = 'win'; }
        else this._startPlay();
    }
    _zY(z) { return PVZ_GY + z.row * PVZ_CH + PVZ_CH * 0.82; }
    _float(x, y, txt, color) { this.floats.push({ x, y, txt, color, t: 1 }); }
    _parts(x, y, color, n) {
        for (let i = 0; i < n; i++)
            this.parts.push({ x, y, vx: (Math.random() - 0.5) * 200, vy: -40 - Math.random() * 130, t: 0.5 + Math.random() * 0.3, color });
    }
    _rageBoom(c, r) { // 红温爆炸：3×3灭尸；范围内石子火柴人攻速+35%（≤2层）
        const px = PVZ_GX + c * PVZ_CW + PVZ_CW / 2, py = PVZ_GY + r * PVZ_CH + PVZ_CH * 0.82;
        for (const z of this.zombies)
            if (!z.dead && Math.abs(z.row - r) <= 1 && Math.abs(z.x - px) < PVZ_CW * 1.5) this._hitZ(z, 9999);
        for (let cc = c - 1; cc <= c + 1; cc++) for (let rr = r - 1; rr <= r + 1; rr++) {
            const p2 = (cc >= 0 && cc < PVZ_COLS && rr >= 0 && rr < PVZ_ROWS) ? this.grid[cc][rr] : null;
            if (p2 && p2.type === 'thrower') {
                p2.buff = Math.min(2, (p2.buff || 0) + 1);
                this._float(PVZ_GX + cc * PVZ_CW + PVZ_CW / 2, PVZ_GY + rr * PVZ_CH + 40, '攻速+35%', '#e53935');
            }
            if (p2 && p2.type === 'shield' && !p2.upgraded) { // 红温炸到K盾→升级：全场90%抗伤（伤害转移给盾）+闲置回血
                p2.upgraded = true;
                this._float(PVZ_GX + cc * PVZ_CW + PVZ_CW / 2, PVZ_GY + rr * PVZ_CH + 40, 'K盾升级!', '#f9a825');
            }
        }
        this.grid[c][r] = null;
        this._parts(px, py - 30, '#ff7043', 16); this._parts(px, py - 30, '#e53935', 10);
        PvzAudio.play('boom');
    }
    _blastAt(x, row) { // 半径1.8格内僵尸吃9999伤害（纸盾先挡一段）
        for (const z of this.zombies)
            if (!z.dead && Math.abs(z.row - row) <= 1 && Math.abs(z.x - x) < PVZ_CW * 1.8) this._hitZ(z, 9999);
    }
    _bomberBoom(c, r) { // 自爆兵引爆：原地爆一次+0.35s后同点再爆一次（药水分身器保本体→单位消失）
        const px = PVZ_GX + c * PVZ_CW + PVZ_CW / 2, py = PVZ_GY + r * PVZ_CH + PVZ_CH * 0.82;
        this._blastAt(px, r);
        this.booms.push({ x: px, row: r, t: 0.35 });
        this.grid[c][r] = null;
        this._parts(px, py - 30, '#ff7043', 14); this._parts(px, py - 30, '#78909c', 10);
        PvzAudio.play('boom');
    }
    _spawnZombie(type) { // type: 'basic'普通 | 'hat'绿帽子(80防具,戴帽移速+80%) | 'pop'人缘(死亡随机3僵移速翻倍) | 'psh'纸盾(免疫1次) | 'mech'机械(弹力器) | 'hpz'血量(1000血)
        const hat = type === 'hat', hpz = type === 'hpz';
        this.zombies.push({
            type: (type === 'hat' || type === 'pop' || type === 'psh' || type === 'mech' || type === 'hpz') ? type : 'basic',
            pshield: type === 'psh' ? 1 : 0, // 纸盾僵尸：1点防护免疫任意1次伤害
            row: (Math.random() * PVZ_ROWS) | 0, x: PVZ_VW + 40 + Math.random() * 60,
            hp: hpz ? STK_HPZ_HP : STK_ZHP, maxHp: hpz ? STK_HPZ_HP : STK_ZHP, armor: hat ? STK_HAT_HP : 0, maxArmor: STK_HAT_HP,
            crit: false, headT: 0,
            freezeT: 0, slowT: 0, jumped: false, jumpT: 0, // 冰冻/减速计时；机械僵尸一次性跳
            t: Math.random() * 10, eatT: 0, dead: false, die: 0, flash: 0, eating: false,
        });
    }
    _hitZ(z, dmg) {
        z.flash = 0.08;
        if (z.pshield > 0) { // 纸盾：免疫1次任何伤害（破盾后是普通僵尸）
            z.pshield = 0;
            this._float(z.x, this._zY(z) - 92, '纸盾破了!', '#8d6e63');
            this._parts(z.x + 14, this._zY(z) - 46, '#efe8d5', 8);
            PvzAudio.play('pop');
            return;
        }
        if (z.type === 'pz' && dmg >= 1000) dmg *= 0.1; // 紫柴boss：爆炸类伤害只受10%（免手雷/红温90%）
        if (z.freezeT > 0) dmg *= 1.8; // 冻结：受到的任何伤害×1.8
        if (z.armor > 0) { // 一类防具：绿帽子先挡伤害
            z.armor -= dmg;
            if (z.armor <= 0) {
                dmg = -z.armor; z.armor = 0;
                this._float(z.x, this._zY(z) - 92, '帽子掉了!', '#558b2f');
                this._parts(z.x + 10, this._zY(z) - 66, '#7cb342', 6);
                PvzAudio.play('pop');
            } else dmg = 0;
        }
        z.hp -= dmg;
        if (z.hp < STK_ZCRIT && !z.crit && !z.dead) { // 临界：掉头+持续掉血
            z.crit = true; z.headT = 0.001;
            PvzAudio.play('pop'); this._float(z.x, this._zY(z) - 92, '掉头!', '#b71c1c');
        }
        if (z.hp <= 0 && !z.dead) { z.dead = true; this.killed += this.zpool ? (STK_ZCOST[z.type] || 1) : 1; this._parts(z.x, this._zY(z) - 40, '#33691e', 8); PvzAudio.play('zdie'); this._onPopDeath(z); }
    }
    _onPopDeath(z) { // 人缘僵尸死亡：场上随机3只活僵移速+100%（出怪量2/出怪等级2）
        if (z.type !== 'pop') return;
        const live = this.zombies.filter(o => !o.dead && o !== z);
        for (let i = 0; i < 3 && live.length; i++) {
            const t = live.splice((Math.random() * live.length) | 0, 1)[0];
            t.spdMul = Math.min(2, (t.spdMul || 1) * 2);
            this._float(t.x, this._zY(t) - 96, '人缘爆发·移速+100%!', '#d81b60');
        }
    }
    _auraReduce(col, row) { // 目标格是否在某K盾的4×4减伤光环内（盾自身不吃自己光环）：命中只吃30%伤害
        for (let sc = Math.max(0, col - 2); sc <= Math.min(PVZ_COLS - 1, col + 1); sc++)
            for (let sr = Math.max(0, row - 2); sr <= Math.min(PVZ_ROWS - 1, row + 1); sr++) {
                const p = this.grid[sc][sr];
                if (p && p.type === 'shield' && !(sc === col && sr === row)) return STK_SHIELD_AURA;
            }
        return 1;
    }
    _biteDamage(col, row) { // 有升级K盾在场→全场植物只吃10%，90%转移给盾；否则查4×4光环
        for (let c = 0; c < PVZ_COLS; c++) for (let r = 0; r < PVZ_ROWS; r++) {
            const p = this.grid[c][r];
            if (p && p.type === 'shield' && p.upgraded && !(c === col && r === row))
                return { mul: 0.1, sh: p, sc: c, sr: r };
        }
        return { mul: this._auraReduce(col, row), sh: null };
    }
    _cardCost(k) { // 1-6发明家出1瓶(25)：K盾75→实付50
        const v = STK_CARDS[k].cost;
        return k === 'shield' && this.halfShield ? v - 25 : v;
    }
    _rollZ(pool) { // 权重随机抽一种僵尸类型
        let tot = 0; for (const p of pool) tot += p[1];
        let x = Math.random() * tot;
        for (const p of pool) { x -= p[1]; if (x <= 0) return p[0]; }
        return pool[pool.length - 1][0];
    }
    _genTypes(n, pre) { // 概率出怪：消耗n出怪量生成类型序列（纸盾/人缘各占2量；pre=前波只出等级1）
        const pool = pre ? this.zpoolPre : this.zpoolMain, out = [];
        for (let left = n; left > 0;) { const t = this._rollZ(pool); out.push(t); left -= STK_ZCOST[t] || 1; }
        return out;
    }

    // ========== 更新 ==========
    _update(dt) {
        if (this.phase === 'story' || this.phase === 'end') { this.story.t += dt; return; } // 剧情过场：只走文字计时
        this.time += dt;
        if (this.banner.t > 0) this.banner.t -= dt;
        if (this.phase === 'play' && this.mode === 'pong') { // 1-5弹珠关：独立物理更新
            this._updatePong(dt);
        } else if (this.phase === 'play') {
            // 天上掉药水（1-10无药水经济→不掉）
            if (!this.bossMode) {
                this.skyT -= dt;
                if (this.skyT <= 0) { this.skyT = 5.5 + Math.random() * 2; this.inks.push({ x: 300 + Math.random() * 720, y: 60, ty: 140 + Math.random() * 400, t: 9, state: 'fall', broken: this.brokenInk }); }
            }
            // 1-10 boss关：无限出怪(每30s×8) + 左缘分身卡(每5s随机1张,≤6槽) + boss行为
            if (this.bossMode) {
                this.spawnT -= dt;
                if (this.spawnT <= 0) { this.spawnT = 30; for (let n = 0; n < 8; n++) this._spawnZombie(this._rollZ(STK_BOSS_POOL)); PvzAudio.play('wave'); }
                if (this.randCards.length < 6) { this.randT -= dt; if (this.randT <= 0) { this.randT = 5; this.randCards.push(STK_RAND_CARDS[(Math.random() * STK_RAND_CARDS.length) | 0]); PvzAudio.play('card'); this._float(60, 128, '分身卡!', '#5e35b1'); } }
                this._updateBoss(dt);
            }
            // 出怪：场上僵尸全灭立刻进下一波，否则距上波满35s；大旗=末波同规则
            const alive = this.zombies.some(z => !z.dead);
            if (this.planI < this.plan.length &&
                (this.planI === 0 ? this.time >= this.plan[0][0] : !alive || this.time - this.waveT0 >= 35)) {
                if (this.zpool) for (const t of this._genTypes(this.plan[this.planI][1] + this.waveAdd, true)) this._spawnZombie(t); // 1-7前波：纸盾/普通50:50
                else for (let n = 0; n < this.plan[this.planI][1] + this.waveAdd; n++) this._spawnZombie();
                this.waveT0 = this.time; this.planI++;
            }
            if (!this.flagDone && this.planI >= this.plan.length && (!alive || this.time - this.waveT0 >= 35)) {
                this.flagDone = true; this.flagT = this.time; this.waveT0 = this.time;
                if (this.zpool) this.flagTypes = this._genTypes(this.flagN + this.waveAdd); // 1-7：旗波概率生成
                this.flagQ = Array.from({ length: this.zpool ? this.flagTypes.length : this.flagN + this.waveAdd }, (_, i) => i * 2);
                this.banner = { txt: '一大波火柴人正在接近!', t: 2.4 }; PvzAudio.play('wave');
            }
            if (this.flagQ.length && this.time >= this.flagT + this.flagQ[0]) { this.flagQ.shift(); this._spawnZombie(this.flagTypes[this.flagIdx++]); }
            // 第二旗（1-7）：旗1出完且场上清空/35s后起最后一波
            if (!this.flag2Done && this.flagDone && !this.flagQ.length && (!alive || this.time - this.waveT0 >= 35)) {
                this.flag2Done = true; this.flag2T = this.time; this.waveT0 = this.time;
                if (this.zpool) this.flag2Types = this._genTypes(this.flag2N + this.waveAdd); // 1-7：二旗概率生成
                this.flag2Q = Array.from({ length: this.zpool ? this.flag2Types.length : this.flag2N + this.waveAdd }, (_, i) => i * 2);
                this.banner = { txt: '最后一大波火柴人正在接近!', t: 2.4 }; PvzAudio.play('wave');
            }
            if (this.flag2Q.length && this.time >= this.flag2T + this.flag2Q[0]) { this.flag2Q.shift(); this._spawnZombie(this.flag2Types[this.flag2Idx++]); }
            // 旗后收尾波：旗波出完且场上清空/35s后推进
            if (this.flagDone && !this.flagQ.length && this.flag2Done && !this.flag2Q.length && this.postI < this.post.length && (!alive || this.time - this.waveT0 >= 35)) {
                if (this.zpool) for (const t of this._genTypes(this.post[this.postI][1] + this.waveAdd)) this._spawnZombie(t);
                else for (let n = 0; n < this.post[this.postI][1] + this.waveAdd; n++) this._spawnZombie(this.postTypes[this.postIdx++]);
                this.waveT0 = this.time; this.postI++;
            }
            // 自爆兵二段爆：0.35s后同点再爆一次（破纸盾/补刀）
            for (let i = this.booms.length - 1; i >= 0; i--) {
                const b = this.booms[i]; b.t -= dt;
                if (b.t <= 0) { this.booms.splice(i, 1); this._blastAt(b.x, b.row); this._parts(b.x, PVZ_GY + b.row * PVZ_CH + PVZ_CH * 0.5, '#e53935', 12); PvzAudio.play('boom'); }
            }
            // 卡片冷却
            for (const k of this.cards) this.cd[k] = Math.max(0, this.cd[k] - dt);
            // 石子火柴人掷石 / 时钟火柴人产药水
            for (let c = 0; c < PVZ_COLS; c++) for (let r = 0; r < PVZ_ROWS; r++) {
                const pl = this.grid[c][r]; if (!pl) continue;
                pl.t += dt;
                if (pl.curseT > 0) { // 1-10紫柴诅咒：攻速/血量/攻击-30%持续15s，结束还原血量上限
                    pl.curseT -= dt;
                    if (pl.curseT <= 0 && pl.cursed) { pl.cursed = false; pl.maxHp = pl.maxHpC || pl.maxHp; pl.hp = Math.min(pl.hp, pl.maxHp); }
                }
                const px = PVZ_GX + c * PVZ_CW + PVZ_CW / 2, py = PVZ_GY + r * PVZ_CH + PVZ_CH * 0.82;
                if (pl.type === 'rage') { // 红温：0.9s引信→爆炸（3×3灭尸+石子攻速增益）
                    pl.fuseT -= dt;
                    if (pl.fuseT <= 0) this._rageBoom(c, r);
                    continue;
                }
                if (pl.type === 'clock') { // 时钟：首瓶1.8s→之后每20s产1瓶（原地待收）
                    pl.prodT -= dt;
                    if (pl.prodT <= 0) {
                        pl.prodT = 20;
                        this.inks.push({ x: px + 12 + Math.random() * 26, y: py - 44, ty: py - 44, t: 9, state: 'idle' });
                        PvzAudio.play('ink');
                    }
                    continue;
                }
                if (pl.type === 'bomber') { // 自爆兵：18s开雷期毫无战力；就绪后僵尸触碰即自爆（1.8格连炸两次）
                    if (pl.fuseT > 0) pl.fuseT -= dt;
                    else if (this.zombies.some(z => !z.dead && z.row === r && z.x - 22 < px + PVZ_CW * 0.5)) this._bomberBoom(c, r);
                    continue;
                }
                if (pl.type === 'shield') { // K盾：站桩光环不攻击；3s未受击则每0.5s回5血
                    if (this.time - (pl.lastHitT || 0) >= 3 && pl.hp < pl.maxHp) {
                        pl.healT = (pl.healT || 0) + dt;
                        if (pl.healT >= 0.5) { pl.healT = 0; pl.hp = Math.min(pl.maxHp, pl.hp + 5); this._parts(px, py - 60, '#66bb6a', 2); }
                    } else pl.healT = 0;
                    continue;
                }
                if (pl.type === 'cold') { // 寒冷火柴人：同排有僵尸则每1.2s掷冰雹（命中减速30%）；30%掷冰块冻结3s
                    if (pl.throwT > 0) pl.throwT -= dt;
                    if (this.zombies.some(z => !z.dead && z.row === r && z.x > px)) {
                        pl.fireT -= dt;
                        if (pl.fireT <= 0) {
                            pl.fireT = STK_COLD_FIRE / (pl.curseT > 0 ? 0.7 : 1); pl.throwT = 0.35;
                            const ice = Math.random() < STK_ICE_CHANCE;
                            this.stones.push({ x: px + 14, y: py - 52, row: r, rot: 0, hail: !ice, ice, cw: pl.curseT > 0 });
                            PvzAudio.play('throw');
                        }
                    }
                    continue;
                }
                if (pl.type === 'bird') { // 食人鸟：同原版大嘴花——吞前方1.3格僵尸（无视防具/血量）→咀嚼42s
                    if (pl.biteT > 0) pl.biteT -= dt;
                    if (pl.chewT > 0) { pl.chewT -= dt; continue; }
                    const tgt = this.zombies.find(z => !z.dead && z.type !== 'pz' && z.row === r && z.x > px - 10 && z.x < px + PVZ_CW * STK_BIRD_REACH);
                    if (tgt) {
                        tgt.dead = true; this.killed += this.zpool ? (STK_ZCOST[tgt.type] || 1) : 1;
                        this._onPopDeath(tgt);
                        pl.chewT = STK_BIRD_CHEW; pl.biteT = 0.6;
                        this._parts(px + 40, py - 44, '#ef6c00', 10);
                        this._float(px, py - 82, '吧唧!', '#ef6c00');
                        PvzAudio.play('chomp');
                    }
                    continue;
                }
                if (pl.throwT > 0) pl.throwT -= dt;
                if (this.zombies.some(z => !z.dead && z.row === r && z.x > px)) {
                    pl.fireT -= dt;
                    if (pl.fireT <= 0) {
                        pl.fireT = STK_FIRE / (pl.curseT > 0 ? 0.7 : 1) / (1 + 0.35 * (pl.buff || 0)); pl.throwT = 0.35; // 红温增益每层+35%攻速；诅咒攻速-30%
                        this.stones.push({ x: px + 14, y: py - 52, row: r, rot: 0, cw: pl.curseT > 0 });
                        PvzAudio.play('throw');
                    }
                }
            }
            // 石子飞行/命中
            for (let i = this.stones.length - 1; i >= 0; i--) {
                const s = this.stones[i]; s.x += STK_STONE_SPD * dt; s.rot += dt * 14;
                if (s.x > PVZ_VW + 30) { this.stones.splice(i, 1); continue; }
                const z = this.zombies.find(z => !z.dead && z.row === s.row && Math.abs(z.x - s.x) < 24);
                if (z) {
                    this._parts(s.x, s.y, s.ice ? '#b3e5fc' : s.hail ? '#90caf9' : '#666', 4);
                    if (s.ice) { // 冰块：冻结3s（定身+受伤×1.8），命中本身造成20伤
                        z.freezeT = STK_FREEZE_T;
                        this._hitZ(z, STK_STONE_DMG * (s.cw ? 0.7 : 1));
                        this._float(z.x, this._zY(z) - 96, '冻结!', '#1e88e5');
                    } else if (s.hail) { // 冰雹：减速30%持续1.6s
                        z.slowT = STK_COLD_SLOW;
                        this._hitZ(z, STK_STONE_DMG * (s.cw ? 0.7 : 1));
                    } else this._hitZ(z, STK_STONE_DMG * (s.cw ? 0.7 : 1));
                    PvzAudio.play('knock'); this.stones.splice(i, 1);
                }
            }
            // 环境低吼
            this.groanT -= dt;
            if (this.groanT <= 0) { this.groanT = 3 + Math.random() * 3; if (this.zombies.some(z => !z.dead)) PvzAudio.play('groan'); }
            // 僵尸
            for (let i = this.zombies.length - 1; i >= 0; i--) {
                const z = this.zombies[i];
                if (z.dead) { z.die += dt; if (z.die > 0.8) this.zombies.splice(i, 1); continue; }
                z.t += dt; if (z.flash > 0) z.flash -= dt;
                if (z.crit) { // 临界自动掉血
                    z.headT += dt; z.hp -= STK_ZBLEED * dt;
                    if (z.hp <= 0) { z.dead = true; this.killed++; this._parts(z.x, this._zY(z) - 40, '#33691e', 8); PvzAudio.play('zdie'); this._onPopDeath(z); continue; }
                }
                const front = z.x - 22, col = Math.floor((front - PVZ_GX) / PVZ_CW);
                const pl = (col >= 0 && col < PVZ_COLS) ? this.grid[col][z.row] : null;
                if (z.type === 'pz') { // 紫柴boss：原地站桩不啃咬；只清算冰冻/减速计时
                    z.eating = false;
                    if (z.freezeT > 0) z.freezeT -= dt;
                    if (z.slowT > 0) z.slowT -= dt;
                } else if (z.freezeT > 0) { // 冻结：定身不咬（期间受伤×1.8见_hitZ）
                    z.freezeT -= dt; z.eating = false;
                } else if (z.jumpT > 0) { // 机械僵尸跳跃中：快速跨过火柴人格，不吃咬判定
                    z.jumpT -= dt; z.eating = false;
                    z.x -= STK_ZSPD * (z.spdMul || 1) * 3 * dt;
                } else if (pl && front < PVZ_GX + col * PVZ_CW + PVZ_CW * 0.72) {
                    if (z.type === 'mech' && !z.jumped) { // 机械僵尸：一次性弹力器跳过第一个火柴人，落地移速+190%
                        z.jumped = true; z.jumpT = STK_MECH_JUMP_T; z.spdMul = (z.spdMul || 1) * STK_MECH_BOOST;
                        this._float(z.x, this._zY(z) - 96, '弹力器·跳!', '#8d6e63');
                        this._parts(z.x - 8, this._zY(z) - 8, '#90a4ae', 8);
                        PvzAudio.play('pop');
                    } else {
                        z.eating = true; z.eatT -= dt;
                        if (z.eatT <= 0) {
                            const bd = this._biteDamage(col, z.row); // 基础光环吃30%；升级盾在场→吃10%，90%转给盾
                            z.eatT = 0.6; pl.hp -= STK_ZBITE * bd.mul; PvzAudio.play('hit');
                            this._parts(PVZ_GX + col * PVZ_CW + PVZ_CW / 2, this._zY(z) - 40, bd.mul < 1 ? '#1e88e5' : '#2b2b2b', 3);
                            if (pl.type === 'shield') pl.lastHitT = this.time;
                            if (bd.sh) { // 90%伤害转承给升级K盾
                                bd.sh.hp -= STK_ZBITE * 0.9; bd.sh.lastHitT = this.time;
                                this._parts(PVZ_GX + bd.sc * PVZ_CW + PVZ_CW / 2, PVZ_GY + bd.sr * PVZ_CH + 40, '#42a5f5', 3);
                                if (bd.sh.hp <= 0) {
                                    this.grid[bd.sc][bd.sr] = null;
                                    this._float(PVZ_GX + bd.sc * PVZ_CW + PVZ_CW / 2, PVZ_GY + bd.sr * PVZ_CH + 40, '盾碎了!', '#f9a825');
                                    this._parts(PVZ_GX + bd.sc * PVZ_CW + PVZ_CW / 2, PVZ_GY + bd.sr * PVZ_CH + 40, '#90a4ae', 9);
                                }
                            }
                            if (pl.hp <= 0) { this.grid[col][z.row] = null; this._parts(PVZ_GX + col * PVZ_CW + PVZ_CW / 2, this._zY(z) - 30, '#2b2b2b', 9); }
                        }
                    }
                } else { // 戴绿帽子移速+80%；人缘死亡加成再乘spdMul；冰雹减速×0.7
                    z.eating = false;
                    if (z.slowT > 0) z.slowT -= dt;
                    z.x -= STK_ZSPD * (z.spdMul || 1) * (z.type === 'hat' && z.armor > 0 ? STK_HAT_SPD : 1) * (z.slowT > 0 ? 0.7 : 1) * dt;
                }
                if (z.x < 262) { // 小推车
                    const m = this.mowers[z.row];
                    if (m && m.state === 'idle') { m.state = 'run'; PvzAudio.play('mower'); this._float(m.x + 30, this._zY(z) - 30, '启动!', '#b71c1c'); }
                }
                if (z.x < PVZ_LOSE_X) { this.phase = 'lose'; PvzAudio.play('lose'); }
            }
            // 小推车推进
            for (const m of this.mowers) if (m.state === 'run') {
                m.x += 620 * dt;
                for (const z of this.zombies)
                    if (!z.dead && z.type !== 'pz' && z.row === m.row && Math.abs(z.x - m.x) < 42) {
                        if (z.pshield > 0) this._hitZ(z, 1); // 纸盾挡下小推车（免疫1次）
                        else { z.dead = true; this.killed += this.zpool ? (STK_ZCOST[z.type] || 1) : 1; this._parts(z.x, this._zY(z) - 30, '#33691e', 8); this._onPopDeath(z); }
                    }
                if (m.x > PVZ_VW + 60) m.state = 'gone';
            }
            // 胜利：1-10=击杀紫柴boss；其余=出怪表清空且无活僵尸→解锁下一关
            const won = this.bossMode ? (this.bossZ && this.bossZ.dead) : (this.flagDone && !this.flagQ.length && this.flag2Done && !this.flag2Q.length && this.planI >= this.plan.length && this.postI >= this.post.length && !this.zombies.some(z => !z.dead));
            if (won) {
                if (this.endStoryL && !this._seen[this.ekey]) { // 通关剧情（每会话首通播一次；彩蛋版独立计）
                    this.phase = 'end'; this.story = { i: 0, t: 0 }; this.storyL = this.endStoryL;
                } else this.phase = 'win';
                PvzAudio.play('win');
                this.g.stkLv = Math.max(this.g.stkLv || 1, Math.min(this.lv + 2, STK_LV.length));
                if (this.lv >= 6) { // 通关1-7解锁“下岗”；彩蛋(带下岗重打)→下岗返还50%药水
                    try { localStorage.setItem('stkShovel', '1'); if (this.eggEnd) localStorage.setItem('stkRefund', '1'); } catch (e) { }
                    this.hasShovel = true; if (this.eggEnd) this.refund = true;
                }
                try { localStorage.setItem('stkLv', this.g.stkLv); } catch (e) { }
            }
        }
        // 药水瓶（掉/落/飞）
        for (let i = this.inks.length - 1; i >= 0; i--) {
            const s = this.inks[i];
            if (s.state === 'fall') { s.y += 70 * dt; if (s.y >= s.ty) { s.y = s.ty; s.state = 'idle'; } }
            else if (s.state === 'idle') { s.t -= dt; if (s.t <= 0) { this.inks.splice(i, 1); continue; } }
            else { // fly：飞向左上角药水数后入账（破损瓶只给15）
                const dx = 62 - s.x, dy = 40 - s.y, d = Math.hypot(dx, dy);
                if (d < 18) { const v = s.broken ? STK_BROKEN_VAL : STK_INK_VAL; this.ink += v; this._float(84, 56, '+' + v, '#333'); PvzAudio.play('ink'); this.inks.splice(i, 1); continue; }
                s.x += dx / d * 560 * dt; s.y += dy / d * 560 * dt;
            }
        }
        // 粒子：按速度扩散+下坠，寿命到点移除（否则永久残留成地图小点）
        for (let i = this.parts.length - 1; i >= 0; i--) {
            const p = this.parts[i];
            p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 320 * dt;
            p.t -= dt; if (p.t <= 0) this.parts.splice(i, 1);
        }
        // 浮字
        for (let i = this.floats.length - 1; i >= 0; i--) { const f = this.floats[i]; f.y -= 38 * dt; f.t -= dt; if (f.t <= 0) this.floats.splice(i, 1); }
    }

    _updatePong(dt) { // 弹珠关：弹板跟鼠标Y；弹珠撞左缘家墙=输；坚持60s=赢
        const p = this.pong, F = { l: 120, r: PVZ_VW - 56, t: 96, b: PVZ_VH - 56 };
        p.time += dt;
        if (this.g.my >= 0) p.padY = Math.max(F.t + p.padH / 2, Math.min(F.b - p.padH / 2, this.g.my)); // 弹板只动Y
        const b = p.ball;
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y - b.r < F.t) { b.y = F.t + b.r; b.vy = Math.abs(b.vy); PvzAudio.play('knock'); }
        else if (b.y + b.r > F.b) { b.y = F.b - b.r; b.vy = -Math.abs(b.vy); PvzAudio.play('knock'); }
        if (b.x + b.r > F.r) { b.x = F.r - b.r; b.vx = -Math.abs(b.vx); PvzAudio.play('knock'); }
        const padX = F.l + 20, face = padX + 9; // 弹板右缘
        if (b.vx < 0 && b.x - b.r <= face && b.x - b.r >= face - 26 && Math.abs(b.y - p.padY) <= p.padH / 2 + b.r) {
            b.x = face + b.r; // 按击中点偏角弹回；随时间轻微加速
            const hit = Math.max(-1, Math.min(1, (b.y - p.padY) / (p.padH / 2)));
            const sp = p.spd0 * (1 + 0.4 * p.time / 60), ang = hit * 0.95;
            b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
            p.hits++; PvzAudio.play('pop'); this._parts(face + 4, b.y, '#1e88e5', 5);
        }
        if (b.x - b.r < F.l) { // 弹珠越过弹板撞到家→输
            this.phase = 'lose'; PvzAudio.play('lose');
            this._float(F.l + 70, b.y - 20, '弹珠撞家了!', '#b71c1c'); return;
        }
        if (p.time >= 60) { // 坚持60s→胜利
            this.phase = 'win'; PvzAudio.play('win');
            this.g.stkLv = Math.max(this.g.stkLv || 1, Math.min(this.lv + 2, STK_LV.length));
            try { localStorage.setItem('stkLv', this.g.stkLv); } catch (e) { }
        }
    }
    _updateBoss(dt) { // 1-10紫柴僵尸AI：每18s换行(激光期暂停)；技能轮转 紫弹球→诅咒→激光
        const B = this.bossZ;
        if (!B || B.dead) return;
        if (this.laser) { // 技能3激光：本行10s不穿透；命中者每0.1s吃1.5伤
            const L = this.laser; L.t -= dt; L.tick += dt;
            let tcol = -1; // 命中点=boss行最靠右的火柴人（不穿透）
            for (let c = PVZ_COLS - 1; c >= 0; c--) if (this.grid[c][B.row]) { tcol = c; break; }
            L.hitC = tcol;
            if (tcol >= 0) while (L.tick >= 0.1) {
                L.tick -= 0.1;
                const p = this.grid[tcol][B.row];
                if (!p) break;
                p.hp -= STK_LASER_DPS * 0.1;
                this._parts(PVZ_GX + tcol * PVZ_CW + PVZ_CW / 2, PVZ_GY + B.row * PVZ_CH + 46, '#b388ff', 1);
                if (p.hp <= 0) { this.grid[tcol][B.row] = null; this._parts(PVZ_GX + tcol * PVZ_CW + PVZ_CW / 2, PVZ_GY + B.row * PVZ_CH + 60, '#7b1fa2', 9); }
            }
            if (L.t <= 0) this.laser = null;
            return; // 激光期间不换行不放新技能
        }
        B.rowT -= dt;
        if (B.rowT <= 0) { // 换行：瞬移到另一行
            B.rowT = STK_BOSS_ROW_T;
            const nr = (Math.random() * (PVZ_ROWS - 1)) | 0;
            this._parts(B.x - 10, this._zY(B) - 60, '#7b1fa2', 12);
            B.row = nr >= B.row ? nr + 1 : nr;
            this._parts(B.x - 10, this._zY(B) - 60, '#b388ff', 12);
            this._float(B.x - 60, this._zY(B) - 110, '换位!', '#7b1fa2'); PvzAudio.play('pop');
        }
        if (this.bossBall) { // 技能1紫弹球：同1-5镜像——球向左飞撞左墙弹回，右缘弹板(跟鼠标Y)防守；漏过右缘=输；拉锯20s消散
            const b = this.bossBall, F = { l: 120, r: PVZ_VW - 56, t: 96, b: PVZ_VH - 56 };
            b.t += dt; // 同1-5随时间提速
            if (this.g.my >= 0) this.padY = Math.max(F.t + 55, Math.min(F.b - 55, this.g.my));
            b.x += b.vx * dt; b.y += b.vy * dt;
            if (b.y - b.r < F.t) { b.y = F.t + b.r; b.vy = Math.abs(b.vy); PvzAudio.play('knock'); }
            else if (b.y + b.r > F.b) { b.y = F.b - b.r; b.vy = -Math.abs(b.vy); PvzAudio.play('knock'); }
            if (b.x - b.r < F.l) { b.x = F.l + b.r; b.vx = Math.abs(b.vx); PvzAudio.play('knock'); } // 左墙反弹回场，继续拉锯
            const face = PVZ_VW - 76 - 9; // 右缘弹板左缘（同1-5的F.l+20镜像=F.r-20）
            if (b.vx > 0 && b.x + b.r >= face && b.x + b.r <= face + 26 && Math.abs(b.y - this.padY) <= 55 + b.r) {
                b.x = face - b.r; // 按击中点偏角弹回
                const hit = Math.max(-1, Math.min(1, (b.y - this.padY) / 55)), ang = hit * 0.95, sp = STK_BALL_SPD * (1 + 0.4 * b.t / 20);
                b.vx = -Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
                PvzAudio.play('pop'); this._parts(face - 4, b.y, '#7b1fa2', 5);
            }
            if (b.x - b.r > F.r) { // 漏接：弹球飞出右缘→同1-5撞家=输
                this.phase = 'lose'; PvzAudio.play('lose');
                this._float(PVZ_VW - 140, b.y - 24, '紫弹球漏接了!', '#b71c1c'); return;
            }
            if (b.t >= 20) { // 坚持20s：弹球消散
                this.bossBall = null; this._float(b.x, b.y - 20, '弹走了!', '#7b1fa2');
            }
            return;
        }
        this.skillT -= dt;
        if (this.skillT <= 0) { // 技能轮转：紫弹球→诅咒→激光
            this.skillT = STK_BOSS_SKILL_IV;
            const sk = this.skillI++ % 3;
            if (sk === 0) {
                this.bossBall = { x: B.x - 24, y: this._zY(B) - 56, vx: -STK_BALL_SPD, vy: (Math.random() - 0.5) * 170, r: 13, t: 0 };
                this.padY = PVZ_VH / 2;
                this._float(B.x - 60, this._zY(B) - 110, '紫弹球!', '#7b1fa2'); PvzAudio.play('throw');
            } else if (sk === 1) { // 诅咒：随机3株攻速/血量/攻击-30%（15s）
                const ps = [];
                for (let c = 0; c < PVZ_COLS; c++) for (let r = 0; r < PVZ_ROWS; r++) if (this.grid[c][r]) ps.push([c, r]);
                for (let n = 0; n < 3 && ps.length; n++) {
                    const pt = ps.splice((Math.random() * ps.length) | 0, 1)[0], p = this.grid[pt[0]][pt[1]];
                    p.curseT = 15;
                    if (!p.cursed) { p.cursed = true; p.maxHpC = p.maxHp; p.maxHp = Math.max(40, Math.ceil(p.maxHp * 0.7)); p.hp = Math.min(p.hp, p.maxHp); }
                    this._float(PVZ_GX + pt[0] * PVZ_CW + PVZ_CW / 2, PVZ_GY + pt[1] * PVZ_CH + 30, '诅咒!', '#7b1fa2');
                    this._parts(PVZ_GX + pt[0] * PVZ_CW + PVZ_CW / 2, PVZ_GY + pt[1] * PVZ_CH + 60, '#7b1fa2', 6);
                }
                this._float(B.x - 60, this._zY(B) - 110, '诅咒!', '#7b1fa2'); PvzAudio.play('groan');
            } else {
                this.laser = { t: STK_LASER_T, tick: 0, hitC: -1 };
                this._float(B.x - 60, this._zY(B) - 110, '激光!', '#b71c1c'); PvzAudio.play('throw');
            }
        }
    }

    // ========== 点击 ==========
    _click(x, y) {
        if (this.phase === 'story' || this.phase === 'end') { // 剧情：点跳过钮/主页；其他处点击→补完文字→下一句
            if (x > 1018 && x < 1094 && y > 8 && y < 52) { this.g.screen = 'stickmenu'; PvzAudio.play('click'); return; }
            if (x > 884 && x < 1006 && y > 8 && y < 52) { this._closeScene(); PvzAudio.play('click'); return; }
            const L = this.storyL[this.story.i];
            if (this.story.t * 14 < L.text.length) this.story.t = 99;
            else if (++this.story.i >= this.storyL.length) { this._closeScene(); return; }
            else this.story.t = 0;
            PvzAudio.play('click');
            return;
        }
        if (this.phase !== 'play') { // 结算：重试/主页
            if (x > 360 && x < 540 && y > 400 && y < 456) { this.reset(this.lv, true); return; }
            if (x > 560 && x < 740 && y > 400 && y < 456) { this.g.screen = 'stickmenu'; return; }
            return;
        }
        if (x > 1018 && x < 1094 && y > 8 && y < 52) { this.g.screen = 'stickmenu'; PvzAudio.play('click'); return; }
        if (this.mode === 'pong') return; // 弹珠关：无种卡/收药水，只留主页按钮
        if (this.bossMode) { // 1-10：左缘分身卡槽点击选卡（一次性免费种，无冷却无消耗）
            for (let i = 0; i < this.randCards.length; i++) {
                const cy = 140 + i * 80;
                if (x > 8 && x < 74 && y > cy && y < cy + 72) {
                    if (this.selFrom === i) { this.sel = null; this.selFrom = -1; }
                    else { this.sel = this.randCards[i]; this.selFrom = i; PvzAudio.play('card'); }
                    return;
                }
            }
        }
        for (const s of this.inks) // 收药水
            if (s.state !== 'fly' && Math.hypot(s.x - x, s.y - y) < 34) { s.state = 'fly'; return; }
        for (let i = 0; i < this.cards.length; i++) { // 卡片槽
            const k = this.cards[i], cd = STK_CARDS[k], cx = 160 + i * 72;
            if (x > cx && x < cx + 66 && y > 10 && y < 82) {
                if (this.cd[k] <= 0 && this.ink >= this._cardCost(k)) { this.sel = this.sel === k ? null : k; if (this.sel) PvzAudio.play('card'); }
                return;
            }
        }
        if (this.hasShovel) { // 下岗（1-7通关解锁）：顶栏最右，点选后再点格撤回单位
            const sx = 930;
            if (x > sx && x < sx + 66 && y > 10 && y < 82) { this.sel = this.sel === 'shovel' ? null : 'shovel'; this.selFrom = -1; if (this.sel) PvzAudio.play('click'); return; }
        }
        const c = Math.floor((x - PVZ_GX) / PVZ_CW), r = Math.floor((y - PVZ_GY) / PVZ_CH);
        if (c >= 0 && c < PVZ_COLS && r >= 0 && r < PVZ_ROWS && this.sel) {
            if (this.sel === 'shovel') { // 下岗：撤回误种的单位（彩蛋福利：返还50%药水）
                if (this.grid[c][r]) {
                    const pl = this.grid[c][r], px2 = PVZ_GX + c * PVZ_CW + PVZ_CW / 2, py2 = PVZ_GY + r * PVZ_CH + PVZ_CH * 0.62;
                    this.grid[c][r] = null; this.sel = null;
                    const back = this.refund && pl.paid ? Math.floor(pl.paid * 0.5) : 0;
                    if (back > 0) { this.ink += back; this._float(px2, py2 - 82, '+' + back + '返还', '#43a047'); }
                    this._float(px2, py2 - 60, '已下岗', '#8d6e63'); this._parts(px2, py2 - 30, '#8d6e63', 6);
                    PvzAudio.play('click');
                }
                return;
            }
            if (!this.grid[c][r]) {
                const cd = STK_CARDS[this.sel];
                this.grid[c][r] = this.sel === 'clock'
                    ? { type: 'clock', hp: STK_PLANT_HP, maxHp: STK_PLANT_HP, t: 0, prodT: 1.8 }
                    : this.sel === 'rage'
                        ? { type: 'rage', hp: STK_PLANT_HP, maxHp: STK_PLANT_HP, t: 0, fuseT: 0.9 }
                        : this.sel === 'shield'
                            ? { type: 'shield', hp: STK_SHIELD_HP, maxHp: STK_SHIELD_HP, t: 0, lastHitT: -10, healT: 0, upgraded: false }
                            : this.sel === 'bomber'
                                ? { type: 'bomber', hp: STK_PLANT_HP, maxHp: STK_PLANT_HP, t: 0, fuseT: 18 }
                                : this.sel === 'cold'
                                    ? { type: 'cold', hp: STK_PLANT_HP, maxHp: STK_PLANT_HP, t: 0, fireT: 0.6, throwT: 0 }
                                    : this.sel === 'bird'
                                        ? { type: 'bird', hp: STK_PLANT_HP, maxHp: STK_PLANT_HP, t: 0, chewT: 0, biteT: 0 }
                                        : { type: 'thrower', hp: STK_PLANT_HP, maxHp: STK_PLANT_HP, t: 0, fireT: 0.4, throwT: 0 };
                if (this.bossMode && this.selFrom >= 0) { // 分身卡：免费一次性，不耗药水不走冷却
                    this.grid[c][r].paid = 0;
                    this.randCards.splice(this.selFrom, 1); this.selFrom = -1; this.sel = null;
                } else {
                    this.grid[c][r].paid = this._cardCost(this.sel); // 记录实付（下岗返半价用）
                    this.ink -= this._cardCost(this.sel); this.cd[this.sel] = cd.cd; this.sel = null;
                }
                PvzAudio.play('plant'); this._parts(x, y, '#555', 6);
            }
        }
    }

    // ========== 绘制 ==========
    _draw(ctx) {
        // 纸面底：米黄 + 横格线 + 红边线
        ctx.fillStyle = '#efe8d5'; ctx.fillRect(0, 0, PVZ_VW, PVZ_VH);
        ctx.strokeStyle = 'rgba(96,125,160,0.2)'; ctx.lineWidth = 1;
        for (let y = 40; y < PVZ_VH; y += 26) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(PVZ_VW, y); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(200,80,80,0.4)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(64, 0); ctx.lineTo(64, PVZ_VH); ctx.stroke();
        if (this.mode === 'pong') { // 1-5弹珠关：独立场景/HUD/剧情
            this._drawPongScene(ctx);
            if (this.phase === 'story') { this._drawPongStory(ctx); return; }
            if (this.phase === 'play') this._drawPongHud(ctx);
            for (const p of this.parts) { ctx.globalAlpha = Math.min(1, p.t * 3); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, 7); ctx.fill(); }
            ctx.globalAlpha = 1;
            for (const f of this.floats) { ctx.globalAlpha = Math.min(1, f.t * 2); ctx.fillStyle = f.color; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(f.txt, f.x, f.y); }
            ctx.globalAlpha = 1;
            if (this.banner.t > 0) {
                ctx.save(); ctx.globalAlpha = Math.min(1, this.banner.t * 2); ctx.textAlign = 'center';
                ctx.font = 'bold 44px sans-serif'; ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
                ctx.strokeText(this.banner.txt, PVZ_VW / 2, 300);
                ctx.fillStyle = '#b71c1c'; ctx.fillText(this.banner.txt, PVZ_VW / 2, 300);
                ctx.restore();
            }
            if (this.phase === 'win' || this.phase === 'lose') this._drawOver(ctx);
            return;
        }
        // 草坪：行底色 + 列虚线 + 手绘双线框
        for (let r = 0; r < PVZ_ROWS; r++) {
            ctx.fillStyle = r % 2 ? 'rgba(120,160,90,0.1)' : 'rgba(120,160,90,0.05)';
            ctx.fillRect(PVZ_GX, PVZ_GY + r * PVZ_CH, PVZ_COLS * PVZ_CW, PVZ_CH);
        }
        ctx.strokeStyle = 'rgba(60,60,60,0.14)'; ctx.lineWidth = 1; ctx.setLineDash([5, 6]);
        for (let c = 1; c < PVZ_COLS; c++) { ctx.beginPath(); ctx.moveTo(PVZ_GX + c * PVZ_CW, PVZ_GY); ctx.lineTo(PVZ_GX + c * PVZ_CW, PVZ_GY + PVZ_ROWS * PVZ_CH); ctx.stroke(); }
        ctx.setLineDash([]);
        ctx.strokeStyle = '#5a5240'; ctx.lineWidth = 2;
        ctx.strokeRect(PVZ_GX, PVZ_GY, PVZ_COLS * PVZ_CW, PVZ_ROWS * PVZ_CH);
        ctx.strokeStyle = 'rgba(90,82,64,0.4)'; ctx.lineWidth = 1;
        ctx.strokeRect(PVZ_GX - 3, PVZ_GY - 3, PVZ_COLS * PVZ_CW + 6, PVZ_ROWS * PVZ_CH + 6);
        this._houseArt(ctx);
        for (const m of this.mowers) if (m.state !== 'gone') this._mowerArt(ctx, m);
        for (let c = 0; c < PVZ_COLS; c++) for (let r = 0; r < PVZ_ROWS; r++) {
            const pl = this.grid[c][r];
            if (!pl) continue;
            if (pl.type === 'shield' && !pl.upgraded) { // 基础K盾：4×4减伤光环范围提示
                const c0 = Math.max(0, c - 1), c1 = Math.min(PVZ_COLS - 1, c + 2);
                const r0 = Math.max(0, r - 1), r1 = Math.min(PVZ_ROWS - 1, r + 2);
                ctx.fillStyle = 'rgba(30,136,229,0.08)';
                ctx.fillRect(PVZ_GX + c0 * PVZ_CW, PVZ_GY + r0 * PVZ_CH, (c1 - c0 + 1) * PVZ_CW, (r1 - r0 + 1) * PVZ_CH);
                ctx.strokeStyle = 'rgba(30,136,229,0.3)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]);
                ctx.strokeRect(PVZ_GX + c0 * PVZ_CW, PVZ_GY + r0 * PVZ_CH, (c1 - c0 + 1) * PVZ_CW, (r1 - r0 + 1) * PVZ_CH);
                ctx.setLineDash([]);
            } else if (pl.type === 'shield') { // 升级K盾：全场金边
                ctx.strokeStyle = 'rgba(249,168,37,0.55)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
                ctx.strokeRect(PVZ_GX + 3, PVZ_GY + 3, PVZ_COLS * PVZ_CW - 6, PVZ_ROWS * PVZ_CH - 6);
                ctx.setLineDash([]);
            }
            // 植物脚下柔和投影
            ctx.fillStyle = 'rgba(0,0,0,0.16)';
            ctx.beginPath(); ctx.ellipse(PVZ_GX + c * PVZ_CW + PVZ_CW / 2, PVZ_GY + r * PVZ_CH + PVZ_CH * 0.88, 22, 6, 0, 0, 7); ctx.fill();
            (pl.type === 'clock' ? this._clockArt : pl.type === 'rage' ? this._rageArt : pl.type === 'shield' ? this._shieldArt : pl.type === 'bomber' ? this._bomberArt : pl.type === 'cold' ? this._coldArt : pl.type === 'bird' ? this._birdArt : this._throwerArt).call(this, ctx, pl, PVZ_GX + c * PVZ_CW + PVZ_CW / 2, PVZ_GY + r * PVZ_CH + PVZ_CH * 0.82);
            if (pl.curseT > 0) { // 1-10诅咒标记：紫雾环绕+“咒”字
                const px3 = PVZ_GX + c * PVZ_CW + PVZ_CW / 2, py3 = PVZ_GY + r * PVZ_CH + PVZ_CH * 0.82;
                ctx.fillStyle = 'rgba(123,31,162,' + (0.22 + Math.sin(this.time * 6) * 0.08).toFixed(2) + ')';
                ctx.beginPath(); ctx.arc(px3, py3 - 42, 22, 0, 7); ctx.fill();
                ctx.fillStyle = '#7b1fa2'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
                ctx.fillText('咒', px3, py3 - 84);
            }
        }
        if (this.laser && this.bossZ) { // 技能3激光：boss行→命中点前止（不穿透）
            const B = this.bossZ, by = this._zY(B) - 58;
            const ex = this.laser.hitC >= 0 ? PVZ_GX + this.laser.hitC * PVZ_CW + PVZ_CW : PVZ_GX - 40;
            const w = 6 + Math.sin(this.time * 30) * 2;
            ctx.strokeStyle = 'rgba(123,31,162,0.3)'; ctx.lineWidth = w + 10; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(B.x - 20, by); ctx.lineTo(ex, by); ctx.stroke();
            ctx.strokeStyle = '#e1bee7'; ctx.lineWidth = w;
            ctx.beginPath(); ctx.moveTo(B.x - 20, by); ctx.lineTo(ex, by); ctx.stroke();
        }
        for (const z of [...this.zombies].sort((a, b) => a.row - b.row)) {
            if (!z.icon) { // 僵尸脚下柔和投影
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.beginPath(); ctx.ellipse(z.x, this._zY(z), 20, 6, 0, 0, 7); ctx.fill();
            }
            this._szArt(ctx, z);
        }
        if (this.bossBall) { // 技能1：紫弹球 + 右缘弹板（发明家分身器，跟鼠标Y，同1-5镜像）
            const padX = PVZ_VW - 76;
            ctx.fillStyle = '#795548'; ctx.strokeStyle = '#333'; ctx.lineWidth = 2.5;
            this.g._rr(ctx, padX - 9, this.padY - 55, 18, 110, 8); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#a1887f'; this.g._rr(ctx, padX - 3, this.padY - 49, 4, 98, 2); ctx.fill();
            const b = this.bossBall;
            ctx.fillStyle = '#7b1fa2'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
            ctx.strokeStyle = '#4a148c'; ctx.lineWidth = 2; ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.arc(b.x - 4, b.y - 4, 3.6, 0, 7); ctx.fill();
        }
        for (const s of this.stones) this._stoneArt(ctx, s);
        for (const s of this.inks) this._inkArt(ctx, s.x, s.y, s.state === 'idle' ? Math.min(1, s.t) : 1, s.broken);
        for (const p of this.parts) { ctx.globalAlpha = Math.min(1, p.t * 3); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
        for (const f of this.floats) { ctx.globalAlpha = Math.min(1, f.t * 2); ctx.fillStyle = f.color; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(f.txt, f.x, f.y); }
        ctx.globalAlpha = 1;
        if (this.phase === 'story' || this.phase === 'end') {
            (this.phase === 'end' ? this._drawEndStory : this._drawStory).call(this, ctx);
            return;
        }
        // 画质：柔和暗角 + 左上暖光
        const vg = ctx.createRadialGradient(PVZ_VW / 2, PVZ_VH / 2, PVZ_VH * 0.42, PVZ_VW / 2, PVZ_VH / 2, PVZ_VW * 0.62);
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,16,40,0.26)');
        ctx.fillStyle = vg; ctx.fillRect(0, 0, PVZ_VW, PVZ_VH);
        const sg = ctx.createLinearGradient(0, 0, PVZ_VW * 0.5, PVZ_VH * 0.6);
        sg.addColorStop(0, 'rgba(255,240,200,0.09)'); sg.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = sg; ctx.fillRect(0, 0, PVZ_VW, PVZ_VH);
        this._drawHud(ctx);
        if (this.banner.t > 0) {
            ctx.save(); ctx.globalAlpha = Math.min(1, this.banner.t * 2); ctx.textAlign = 'center';
            ctx.font = 'bold 44px sans-serif'; ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.strokeText(this.banner.txt, PVZ_VW / 2, 300);
            ctx.fillStyle = '#b71c1c'; ctx.fillText(this.banner.txt, PVZ_VW / 2, 300);
            ctx.restore();
        }
        if (this.phase === 'win' || this.phase === 'lose') this._drawOver(ctx);
    }
    _drawStory(ctx) { // 开局剧情：小黑 × 小宇?（×时钟火柴人）（战场作舞台，打字机对话框）
        const L = this.storyL[this.story.i], t = this.story.t;
        const show = Math.min(L.text.length, (t * 14) | 0);
        const hasClk = this.storyL.some(l => l.who === 'clk');
        const hasInv = this.storyL.some(l => l.who === 'inv'); // 1-6发明家开场登场
        const hasMing = this.storyL.some(l => l.who === 'ming'); // 1-7小铭登场→五人站位
        const hasHs = this.storyL.some(l => l.who === 'hs');     // 1-9核司登场
        const hasBird = this.storyL.some(l => l.who === 'bird'); // 1-9食人鸟登场
        const P = hasHs ? { hei: 270, hs: 490, bird: 665, yu: 855 }
            : hasMing ? { inv: 160, hei: 350, clk: 505, yu: 655, ming: 845 } : hasInv ? { inv: 300, hei: 565, yu: 790 } : hasClk ? { hei: 330, clk: 565, yu: 790 } : { hei: 430, yu: 700 };
        this._storyMan(ctx, P.hei, 400, this.lv === 2 ? '#c62828' : '#212121', 1, L.who === 'hei'); // 小黑（1-3红温）
        this._storyMan(ctx, P.yu, 400, '#1565c0', -1, L.who === 'yu');   // 小宇?
        if (hasInv) this._inventorArt(ctx, P.inv, 400, L.who === 'inv', false);
        if (hasMing) { // 小铭：紫衣火柴人登场（不持雷，仅“拿出手雷”句亮雷；比其他角色小些）
            ctx.save(); ctx.translate(P.ming, 400 + (L.who === 'ming' ? Math.sin(t * 8) * 2 : 0)); ctx.scale(-1.15, 1.15);
            this._bomberArt(ctx, { t, hp: 1, maxHp: 1, fuseT: 0 }, 0, 0, L.text.indexOf('拿出手雷') < 0); ctx.restore();
        }
        if (this.lv === 2 && L.text === '(爆炸)') { // 1-3“(爆炸)”句：小黑处火环炸裂
            const bt = (t * 1.8) % 1;
            ctx.strokeStyle = 'rgba(229,57,53,' + (1 - bt).toFixed(2) + ')'; ctx.lineWidth = 7;
            ctx.beginPath(); ctx.arc(P.hei, 368, 26 + bt * 74, 0, 7); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,167,38,' + (1 - bt).toFixed(2) + ')'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(P.hei, 368, 16 + bt * 50, 0, 7); ctx.stroke();
        }
        if (hasClk) { // 时钟火柴人（居中，说话时起伏）
            ctx.save(); ctx.translate(P.clk, 400 + (L.who === 'clk' ? Math.sin(t * 8) * 2 : 0)); ctx.scale(1.5, 1.5);
            this._clockArt(ctx, { t, hp: 1, maxHp: 1 }, 0, 0); ctx.restore();
        }
        if (hasHs) this._storyMan(ctx, P.hs, 400, '#ef6c00', 1, L.who === 'hs'); // 核司（橙色火柴人）
        if (hasBird) { // 食人鸟：站在核司与小宇?之间；“吱”句张嘴
            ctx.save(); ctx.translate(P.bird, 400 + (L.who === 'bird' ? Math.sin(t * 8) * 2 : 0)); ctx.scale(1.35, 1.35);
            this._birdArt(ctx, { t, hp: 1, maxHp: 1, chewT: 0, biteT: L.who === 'bird' ? 0.6 : 0 }, 0, 0); ctx.restore();
        }
        ctx.textAlign = 'center'; ctx.font = 'bold 15px sans-serif';
        ctx.fillStyle = '#212121'; ctx.fillText('小黑', P.hei, 306);
        ctx.fillStyle = '#1565c0'; ctx.fillText('小宇?', P.yu, 306);
        if (hasInv) { ctx.fillStyle = '#00838f'; ctx.fillText('发明家', P.inv, 306); }
        if (hasClk) { ctx.fillStyle = '#6d4c41'; ctx.fillText('时钟火柴人', P.clk, 268); }
        if (hasMing) { ctx.fillStyle = '#5e35b1'; ctx.fillText('小铭', P.ming, 306); }
        if (hasHs) { ctx.fillStyle = '#ef6c00'; ctx.fillText('核司', P.hs, 306); }
        if (hasBird) { ctx.fillStyle = '#455a64'; ctx.fillText('食人鸟', P.bird, 288); }
        if (L.who === 'zhenyu') { // 真_小宇：画外音（不出现在场上）→对话框上方飘名字
            ctx.fillStyle = '#546e7a'; this.g._rr(ctx, 470, 398, 160, 34, 9); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('真_小宇(画外音)', 550, 421);
        }
        if (this.story.i >= 2) // 第3句起：绿僵尸从右缘探头（1-4戴绿帽子/1-6人缘爱心）
            this._szArt(ctx, { row: 2, x: this.lv === 9 ? 1036 : 1092, t, crit: false, dead: false, die: 0, flash: 0, hp: 1, maxHp: 1, type: this.lv === 9 ? 'pz' : this.lv === 8 ? 'hpz' : this.lv === 6 ? 'psh' : this.lv === 5 ? 'pop' : 'basic', pshield: this.lv === 6 ? 1 : 0, armor: this.lv === 3 ? STK_HAT_HP : 0, maxArmor: STK_HAT_HP });
        if (this.story.i >= (this.lv === 6 ? 1 : hasInv ? 2 : 3)) { // 落药水时机：1-7发明家第1句送1瓶；1-6“一半药水我出”起；其余第4句起
            const nk = this.lv === 6 ? 1 : 3;
            for (let k = 0; k < nk; k++) this._inkArt(ctx, 510 + k * 140, 60 + ((t * 110 + k * 110) % 300), 1);
            this._inkArt(ctx, 668, 366, 1);
        }
        // 对话框（纸片+双线手绘框+名字牌+打字机）
        this._sceneDialog(ctx, L, t, show, {
            hei: '小黑', yu: '小宇?', clk: '时钟火柴人', zhenyu: '真_小宇', inv: '发明家', ming: '小铭', hs: '核司', bird: '食人鸟'
        }, {
            hei: this.lv === 2 ? '#c62828' : '#212121', yu: '#1565c0', clk: '#6d4c41', zhenyu: '#546e7a', inv: '#00838f', ming: '#5e35b1', hs: '#ef6c00', bird: '#455a64'
        });
    }
    _sceneDialog(ctx, L, t, show, nms, ncs) { // 剧情对话框：纸片框+名字牌+打字机+继续提示
        ctx.fillStyle = 'rgba(245,240,226,0.96)'; this.g._rr(ctx, 60, 442, 980, 148, 12); ctx.fill();
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2.5; this.g._rr(ctx, 60, 442, 980, 148, 12); ctx.stroke();
        ctx.strokeStyle = 'rgba(51,51,51,0.35)'; ctx.lineWidth = 1; this.g._rr(ctx, 56, 438, 988, 156, 14); ctx.stroke();
        ctx.fillStyle = ncs[L.who]; this.g._rr(ctx, 84, 418, 92, 36, 9); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 19px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(nms[L.who], 130, 442);
        ctx.fillStyle = '#2a2418'; ctx.font = '21px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(L.text.slice(0, show), 92, 492);
        if (show >= L.text.length && Math.sin(t * 7) > -0.2) { // 打完字后闪烁提示
            ctx.fillStyle = '#8d6e63'; ctx.font = '15px sans-serif'; ctx.textAlign = 'right';
            ctx.fillText('▼ 点击继续', 1020, 576);
        }
        this._skBtn(ctx, 884, 8, 122, 44, '跳过剧情');
        this._skBtn(ctx, 1018, 8, 76, 44, '← 主页');
    }
    _drawEndStory(ctx) { // 结尾剧情：1-4发明家×小黑（预告新盟友）；1-7小黑×小铭（预告铲子）
        const L = this.storyL[this.story.i], t = this.story.t;
        const show = Math.min(L.text.length, (t * 14) | 0);
        if (this.storyL.some(l => l.who === 'ming')) { // 1-7结尾：小黑×小铭(+真_小宇画外音)；彩蛋版加小宇?
            const egg = this.storyL.some(l => l.who === 'yu');
            const hx = egg ? 360 : 430, mx = egg ? 640 : 720;
            this._storyMan(ctx, hx, 400, '#212121', 1, L.who === 'hei');
            ctx.save(); ctx.translate(mx, 400 + (L.who === 'ming' ? Math.sin(t * 8) * 2 : 0)); ctx.scale(-1.15, 1.15);
            this._bomberArt(ctx, { t, hp: 1, maxHp: 1, fuseT: 0 }, 0, 0, true); ctx.restore();
            if (egg) this._storyMan(ctx, 880, 400, '#1565c0', -1, L.who === 'yu'); // 彩蛋：小宇?察觉多了东西
            ctx.textAlign = 'center'; ctx.font = 'bold 15px sans-serif';
            ctx.fillStyle = '#212121'; ctx.fillText('小黑', hx, 306);
            ctx.fillStyle = '#5e35b1'; ctx.fillText('小铭', mx, 306);
            if (egg) { ctx.fillStyle = '#1565c0'; ctx.fillText('小宇?', 880, 306); }
            if (L.who === 'zhenyu') { // 画外音名牌
                ctx.fillStyle = '#546e7a'; this.g._rr(ctx, 470, 398, 160, 34, 9); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
                ctx.fillText('真_小宇(画外音)', 550, 421);
            }
            this._sceneDialog(ctx, L, t, show,
                { hei: '小黑', ming: '小铭', zhenyu: '真_小宇', yu: '小宇?' },
                { hei: '#212121', ming: '#5e35b1', zhenyu: '#546e7a', yu: '#1565c0' });
            return;
        }
        const P = { hei: 430, inv: 720 };
        const sit = this.story.i < 2; // 获救前：发明家瘫坐在地呼救
        this._storyMan(ctx, P.hei, 400, '#212121', 1, L.who === 'hei');
        this._inventorArt(ctx, P.inv, 400, L.who === 'inv', sit);
        ctx.textAlign = 'center'; ctx.font = 'bold 15px sans-serif';
        ctx.fillStyle = '#212121'; ctx.fillText('小黑', P.hei, 306);
        ctx.fillStyle = '#00838f'; ctx.fillText('发明家', P.inv, 306);
        this._sceneDialog(ctx, L, t, show, { hei: '小黑', inv: '发明家' }, { hei: '#212121', inv: '#00838f' });
    }
    _inventorArt(ctx, x, y, act, sit) { // 发明家（正常人）：肤色头+蓝外套+护目镜+小背包；sit=瘫坐呼救
        ctx.save(); ctx.translate(x, y + (act ? Math.sin(this.story.t * 8) * 2 : 0));
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const hip = sit ? -16 : -30;
        ctx.strokeStyle = '#37474f'; ctx.lineWidth = 3.4; // 深灰裤腿
        if (sit) { ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(20, -6); ctx.moveTo(0, -16); ctx.lineTo(18, 4); ctx.stroke(); } // 瘫坐：双腿前伸
        else { ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(-9, 0); ctx.moveTo(0, -30); ctx.lineTo(9, 0); ctx.stroke(); }
        ctx.strokeStyle = '#00838f'; ctx.lineWidth = 3.4;
        ctx.beginPath(); ctx.moveTo(0, hip); ctx.lineTo(0, hip - 28); ctx.stroke(); // 蓝外套躯干
        ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 2.6;
        ctx.strokeRect(-15, hip - 26, 9, 17); // 小背包
        ctx.strokeStyle = '#00838f'; ctx.lineWidth = 3.4;
        if (sit) { // 挥手呼救
            ctx.beginPath(); ctx.moveTo(0, hip - 24); ctx.lineTo(15, hip - 42 + Math.sin(this.story.t * 6) * 5); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, hip - 24); ctx.lineTo(-11, hip - 12); ctx.stroke();
        } else { // 获救致意：招手
            ctx.beginPath(); ctx.moveTo(0, hip - 24); ctx.lineTo(-15, hip - 40 + (act ? Math.sin(this.story.t * 9) * 6 : 0)); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, hip - 24); ctx.lineTo(11, hip - 12); ctx.stroke();
        }
        const hy = hip - 42; // 头（肤色正常人）
        ctx.fillStyle = '#ffdbb5'; ctx.beginPath(); ctx.arc(0, hy, 12, 0, 7); ctx.fill();
        ctx.strokeStyle = '#37474f'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#5d4037'; ctx.beginPath(); ctx.arc(0, hy - 4, 12, Math.PI, 0); ctx.fill(); // 头发
        ctx.strokeStyle = '#455a64'; ctx.lineWidth = 2; // 护目镜
        ctx.beginPath(); ctx.arc(-5, hy - 8, 4.4, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.arc(5, hy - 8, 4.4, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-0.6, hy - 8); ctx.lineTo(0.6, hy - 8); ctx.stroke();
        ctx.fillStyle = '#333'; // 眼
        ctx.beginPath(); ctx.arc(-4, hy + 1, 1.6, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(4, hy + 1, 1.6, 0, 7); ctx.fill();
        if (sit) { ctx.fillStyle = '#7b3f3f'; ctx.beginPath(); ctx.arc(0, hy + 6, 3, 0, 7); ctx.fill(); } // 张口呼救
        else { ctx.strokeStyle = '#333'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, hy + 4, 4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); } // 微笑
        ctx.restore();
    }
    _storyMan(ctx, x, y, col, dir, act) { // 剧情火柴人：dir=1朝右 / -1朝左，说话时轻微起伏
        ctx.save(); ctx.translate(x, y + (act ? Math.sin(this.story.t * 8) * 2 : 0));
        if (dir < 0) ctx.scale(-1, 1);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = col; ctx.lineWidth = 3.4;
        ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(-9, 0); ctx.moveTo(0, -30); ctx.lineTo(9, -1); ctx.stroke(); // 腿
        ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, -56); ctx.stroke(); // 身
        ctx.beginPath(); ctx.arc(2, -66, 11, 0, 7); ctx.fillStyle = '#f7f3e6'; ctx.fill(); ctx.stroke(); // 头
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(6.5, -67, 1.8, 0, 7); ctx.fill(); // 眼（朝行进方向）
        ctx.beginPath(); ctx.moveTo(0, -52); ctx.lineTo(13, -43); ctx.stroke(); // 前臂
        ctx.beginPath(); ctx.moveTo(0, -52); ctx.lineTo(-10, -41); ctx.stroke(); // 后臂
        ctx.restore();
    }
    _drawHud(ctx) {
        if (this.bossMode) { // 1-10：顶部boss血条 + 左缘分身卡列 + 出怪计时条（无药水/卡槽）
            const B = this.bossZ;
            if (B) {
                ctx.fillStyle = 'rgba(255,255,255,0.85)'; this.g._rr(ctx, 300, 12, 500, 34, 10); ctx.fill();
                ctx.strokeStyle = '#333'; ctx.lineWidth = 2; this.g._rr(ctx, 300, 12, 500, 34, 10); ctx.stroke();
                ctx.fillStyle = '#efe6f7'; this.g._rr(ctx, 306, 18, 488, 22, 7); ctx.fill();
                ctx.fillStyle = '#7b1fa2'; this.g._rr(ctx, 306, 18, Math.max(0, 488 * B.hp / B.maxHp), 22, 7); ctx.fill();
                ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
                ctx.fillText('紫柴僵尸 ' + Math.max(0, Math.ceil(B.hp)) + '/' + B.maxHp, 550, 34);
            }
            for (let i = 0; i < this.randCards.length; i++) { // 左缘分身卡列：点击选卡→点格免费种
                const k = this.randCards[i], cy = 140 + i * 80;
                ctx.save();
                if (this.selFrom === i) ctx.translate(4, 0);
                ctx.fillStyle = '#fffdf5'; this.g._rr(ctx, 8, cy, 66, 72, 8); ctx.fill();
                ctx.strokeStyle = this.selFrom === i ? '#7b1fa2' : '#333'; ctx.lineWidth = this.selFrom === i ? 3 : 2;
                this.g._rr(ctx, 8, cy, 66, 72, 8); ctx.stroke();
                ctx.save(); ctx.translate(41, cy + 52); ctx.scale(0.55, 0.55);
                (k === 'rage' ? this._rageArt : k === 'shield' ? this._shieldArt : k === 'bomber' ? this._bomberArt : k === 'cold' ? this._coldArt : this._throwerArt)
                    .call(this, ctx, { t: this.time, hp: 1, maxHp: 1, fuseT: 9, throwT: 0 }, 0, 0);
                ctx.restore(); ctx.restore();
                ctx.fillStyle = '#555'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
                ctx.fillText(STK_CARDS[k].name, 41, cy + 66);
            }
            ctx.fillStyle = 'rgba(255,255,255,0.8)'; this.g._rr(ctx, 780, 590, 304, 22, 8); ctx.fill();
            ctx.strokeStyle = '#333'; ctx.lineWidth = 2; this.g._rr(ctx, 780, 590, 304, 22, 8); ctx.stroke();
            ctx.fillStyle = '#7b1fa2'; this.g._rr(ctx, 784, 594, Math.max(8, 296 * Math.min(1, 1 - this.spawnT / 30)), 14, 6); ctx.fill();
            ctx.fillStyle = '#555'; ctx.font = '12px sans-serif'; ctx.textAlign = 'right';
            ctx.fillText('无限出怪·每30s×8', 776, 606);
            this._skBtn(ctx, 1018, 8, 76, 44, '← 主页');
            return;
        }
        // 药水计数
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; this.g._rr(ctx, 16, 12, 116, 56, 10); ctx.fill();
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2; this.g._rr(ctx, 16, 12, 116, 56, 10); ctx.stroke();
        this._inkArt(ctx, 44, 42, 1);
        ctx.fillStyle = '#222'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(this.ink, 66, 50);
        // 卡片槽（本关可用卡逐个排）
        for (let i = 0; i < this.cards.length; i++) {
            const k = this.cards[i], cd = STK_CARDS[k], cx = 160 + i * 72;
            const ok = this.ink >= this._cardCost(k) && this.cd[k] <= 0;
            ctx.save();
            if (this.sel === k) ctx.translate(0, -4);
            ctx.fillStyle = ok ? '#fffdf5' : 'rgba(225,225,225,0.85)';
            this.g._rr(ctx, cx, 10, 66, 72, 8); ctx.fill();
            ctx.strokeStyle = this.sel === k ? '#1565c0' : '#333'; ctx.lineWidth = this.sel === k ? 3 : 2;
            this.g._rr(ctx, cx, 10, 66, 72, 8); ctx.stroke();
            ctx.save(); ctx.translate(cx + 33, 62); ctx.scale(0.55, 0.55);
            if (k === 'clock') this._clockArt(ctx, { t: this.time, hp: 1, maxHp: 1 }, 0, 0);
            else if (k === 'rage') this._rageArt(ctx, { t: this.time, hp: 1, maxHp: 1, fuseT: 9 }, 0, 0);
            else if (k === 'shield') this._shieldArt(ctx, { t: this.time, hp: 1, maxHp: 1 }, 0, 0);
            else if (k === 'bomber') this._bomberArt(ctx, { t: this.time, hp: 1, maxHp: 1, fuseT: 0 }, 0, 0);
            else if (k === 'cold') this._coldArt(ctx, { t: this.time, hp: 1, maxHp: 1, throwT: 0 }, 0, 0);
            else if (k === 'bird') this._birdArt(ctx, { t: this.time, hp: 1, maxHp: 1, chewT: 0, biteT: 0 }, 0, 0);
            else this._throwerArt(ctx, { t: this.time, throwT: 0, hp: 1, maxHp: 1 }, 0, 0);
            ctx.restore();
            ctx.fillStyle = ok ? '#222' : '#999'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(this._cardCost(k), cx + 33, 79);
            if (k === 'shield' && this.halfShield) { // 发明家出一半：划线原价
                ctx.strokeStyle = '#999'; ctx.lineWidth = 1; ctx.font = '10px sans-serif';
                ctx.fillStyle = '#999'; ctx.fillText(cd.cost, cx + 50, 79);
                ctx.beginPath(); ctx.moveTo(cx + 44, 76); ctx.lineTo(cx + 56, 76); ctx.stroke();
            }
            if (this.cd[k] > 0) {
                const hh = 72 * Math.min(1, this.cd[k] / cd.cd);
                ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(cx, 10 + 72 - hh, 66, hh);
            }
            ctx.restore();
            ctx.fillStyle = '#555'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(cd.name, cx + 33, 96);
        }
        if (this.hasShovel) { // 下岗槽：通关1-7解锁，顶栏最右（主页钮左侧）
            const sx = 930;
            ctx.save();
            if (this.sel === 'shovel') ctx.translate(0, -4);
            ctx.fillStyle = '#fffdf5'; this.g._rr(ctx, sx, 10, 66, 72, 8); ctx.fill();
            ctx.strokeStyle = this.sel === 'shovel' ? '#1565c0' : '#333'; ctx.lineWidth = this.sel === 'shovel' ? 3 : 2;
            this.g._rr(ctx, sx, 10, 66, 72, 8); ctx.stroke();
            this._shovelArt(ctx, sx + 33, 48);
            ctx.restore();
            ctx.fillStyle = '#555'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('下岗', sx + 33, 96);
        }
        // 返回主页
        this._skBtn(ctx, 1018, 8, 76, 44, '← 主页');
        // 旗进度（1旗：击杀进度 + 旗标）
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; this.g._rr(ctx, 780, 590, 304, 22, 8); ctx.fill();
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2; this.g._rr(ctx, 780, 590, 304, 22, 8); ctx.stroke();
        ctx.fillStyle = '#7cb342'; this.g._rr(ctx, 784, 594, Math.max(8, 296 * this.killed / this.total), 14, 6); ctx.fill();
        const fx = 784 + 296 * (this.preN / this.total); // 旗点在零散怪/总怪数处
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(fx, 590); ctx.lineTo(fx, 576); ctx.stroke();
        ctx.fillStyle = this.flagDone ? '#b71c1c' : '#8d8d8d';
        ctx.beginPath(); ctx.moveTo(fx, 576); ctx.lineTo(fx + 14, 581); ctx.lineTo(fx, 586); ctx.closePath(); ctx.fill();
        if (this.flag2N) { // 第二旗点（1-7）：旗1出怪量之后
            const fx2 = 784 + 296 * ((this.preN + this.flagN + this.waveAdd) / this.total);
            ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(fx2, 590); ctx.lineTo(fx2, 576); ctx.stroke();
            ctx.fillStyle = this.flag2Done && !this.flag2Q.length ? '#b71c1c' : '#8d8d8d';
            ctx.beginPath(); ctx.moveTo(fx2, 576); ctx.lineTo(fx2 + 14, 581); ctx.lineTo(fx2, 586); ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = '#555'; ctx.font = '12px sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(this.flag2N ? '2旗帜' : '第1旗', 776, 606);
    }
    _skBtn(ctx, x, y, w, h, txt) { // 纸片按钮
        const hov = this.g.mx > x && this.g.mx < x + w && this.g.my > y && this.g.my < y + h;
        ctx.fillStyle = hov ? '#ffffff' : '#f5f0e2';
        this.g._rr(ctx, x, y, w, h, 8); ctx.fill();
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2; this.g._rr(ctx, x, y, w, h, 8); ctx.stroke();
        ctx.fillStyle = '#222'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(txt, x + w / 2, y + h / 2 + 6);
    }
    _drawPongScene(ctx) { // 弹珠关场地：左侧家墙+弹板+弹珠+发明家发球
        const F = { l: 120, r: PVZ_VW - 56, t: 96, b: PVZ_VH - 56 }, p = this.pong;
        ctx.fillStyle = 'rgba(229,57,53,0.07)'; ctx.fillRect(0, F.t, F.l, F.b - F.t); // 家的一侧
        ctx.strokeStyle = '#5a5240'; ctx.lineWidth = 2; ctx.setLineDash([7, 7]);
        ctx.strokeRect(F.l, F.t, F.r - F.l, F.b - F.t); ctx.setLineDash([]);
        this._houseArt(ctx); // 小屋=要守的家
        ctx.fillStyle = '#b71c1c'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('家', 56, F.t + 30);
        const padX = F.l + 20, ph = p ? p.padH : 110, py = p ? p.padY : PVZ_VH / 2; // 弹板
        ctx.fillStyle = '#795548'; ctx.strokeStyle = '#333'; ctx.lineWidth = 2.5;
        this.g._rr(ctx, padX - 9, py - ph / 2, 18, ph, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#a1887f'; this.g._rr(ctx, padX - 3, py - ph / 2 + 6, 4, ph - 12, 2); ctx.fill();
        const b = p ? p.ball : { x: PVZ_VW - 180, y: PVZ_VH / 2, r: 13 }; // 弹珠（玻璃球）
        ctx.fillStyle = '#1e88e5'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
        ctx.strokeStyle = '#0d47a1'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(b.x - b.r * 0.32, b.y - b.r * 0.32, b.r * 0.3, 0, 7); ctx.fill();
        this._inventorArt(ctx, PVZ_VW - 96, 330, false, false); // 发明家在右侧发球
        ctx.fillStyle = '#8d6e63'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('发明家', PVZ_VW - 96, 352);
    }
    _drawPongHud(ctx) { // 弹珠关HUD：剩余时间+60s进度条+提示
        const p = this.pong;
        ctx.fillStyle = 'rgba(255,255,255,0.85)'; this.g._rr(ctx, 16, 12, 178, 44, 10); ctx.fill();
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2; this.g._rr(ctx, 16, 12, 178, 44, 10); ctx.stroke();
        ctx.fillStyle = '#222'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText('坚持 ' + Math.ceil(Math.max(0, 60 - p.time)) + ' s', 34, 42);
        ctx.fillStyle = '#555'; ctx.font = '14px sans-serif';
        ctx.fillText('移动鼠标挡弹珠，别让它撞到家!', 216, 40);
        this._skBtn(ctx, 1018, 8, 76, 44, '← 主页');
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; this.g._rr(ctx, 780, 590, 304, 22, 8); ctx.fill();
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2; this.g._rr(ctx, 780, 590, 304, 22, 8); ctx.stroke();
        ctx.fillStyle = '#42a5f5'; this.g._rr(ctx, 784, 594, Math.max(8, 296 * Math.min(1, p.time / 60)), 14, 6); ctx.fill();
        ctx.fillStyle = '#555'; ctx.font = '12px sans-serif'; ctx.textAlign = 'right';
        ctx.fillText('60s生存', 776, 606);
    }
    _drawPongStory(ctx) { // 1-5开场剧情：小黑×发明家（场景作舞台，打字机对话框）
        const L = this.storyL[this.story.i], t = this.story.t;
        const show = Math.min(L.text.length, (t * 14) | 0);
        this._storyMan(ctx, 430, 400, '#212121', 1, L.who === 'hei');
        this._inventorArt(ctx, 720, 400, L.who === 'inv', false);
        ctx.textAlign = 'center'; ctx.font = 'bold 15px sans-serif';
        ctx.fillStyle = '#212121'; ctx.fillText('小黑', 430, 306);
        ctx.fillStyle = '#00838f'; ctx.fillText('发明家', 720, 306);
        this._sceneDialog(ctx, L, t, show, { hei: '小黑', inv: '发明家' }, { hei: '#212121', inv: '#00838f' });
    }
    _drawOver(ctx) {
        ctx.fillStyle = 'rgba(20,16,8,0.55)'; ctx.fillRect(0, 0, PVZ_VW, PVZ_VH);
        ctx.fillStyle = '#f5f0e2'; this.g._rr(ctx, 320, 180, 460, 270, 14); ctx.fill();
        ctx.strokeStyle = '#333'; ctx.lineWidth = 3; this.g._rr(ctx, 320, 180, 460, 270, 14); ctx.stroke();
        ctx.textAlign = 'center';
        if (this.phase === 'win') {
            ctx.fillStyle = '#2e7d32'; ctx.font = 'bold 44px sans-serif';
            ctx.fillText('过 关 !', PVZ_VW / 2, 268);
            ctx.fillStyle = '#555'; ctx.font = '17px sans-serif';
            ctx.fillText(this.mode === 'pong' ? '弹珠一颗都没进家，守满60秒!' : '火柴人守住了阵地 · 第' + (this.lv + 1) + '关完成', PVZ_VW / 2, 310);
        } else {
            ctx.fillStyle = '#b71c1c'; ctx.font = 'bold 40px sans-serif';
            ctx.fillText(this.mode === 'pong' ? '弹珠撞家了!' : '防线被突破!', PVZ_VW / 2, 268);
            ctx.fillStyle = '#555'; ctx.font = '17px sans-serif';
            ctx.fillText(this.mode === 'pong' ? '移动弹板把弹珠弹回去，再试一次!' : '火柴人的脑袋被吃掉了', PVZ_VW / 2, 310);
        }
        this._skBtn(ctx, 360, 400, 180, 56, '再来一次');
        this._skBtn(ctx, 560, 400, 180, 56, '返回主页');
    }
    // ---- 纸片角色 ----
    _houseArt(ctx) { // 左侧小屋（铅笔稿）
        ctx.save();
        ctx.strokeStyle = '#4a4033'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const hx = 76, hy = 292;
        ctx.fillStyle = '#d7c9a8';
        ctx.beginPath(); ctx.rect(hx, hy, 108, 148); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#8d6e63';
        ctx.beginPath(); ctx.moveTo(hx - 10, hy); ctx.lineTo(hx + 54, hy - 46); ctx.lineTo(hx + 118, hy); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#6d4c41';
        ctx.beginPath(); ctx.rect(hx + 38, hy + 72, 32, 76); ctx.fill(); ctx.stroke();
        ctx.strokeRect(hx + 14, hy + 26, 22, 22); ctx.strokeRect(hx + 72, hy + 26, 22, 22);
        ctx.beginPath(); ctx.moveTo(hx + 25, hy + 26); ctx.lineTo(hx + 25, hy + 48); ctx.moveTo(hx + 14, hy + 37); ctx.lineTo(hx + 36, hy + 37); ctx.stroke();
        ctx.restore();
    }
    _mowerArt(ctx, m) { // 手绘小推车
        const y = PVZ_GY + m.row * PVZ_CH + PVZ_CH * 0.8;
        ctx.save(); ctx.translate(m.x, y);
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
        ctx.fillStyle = '#c62828'; ctx.beginPath(); ctx.rect(-16, -24, 34, 16); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-14, -22); ctx.lineTo(-26, -34); ctx.stroke();
        for (const wx of [-9, 11]) {
            ctx.beginPath(); ctx.arc(wx, -5, 6, 0, 7); ctx.fillStyle = '#455a64'; ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.arc(wx, -5, 2, 0, 7); ctx.stroke();
        }
        ctx.save(); ctx.translate(2, -14); ctx.rotate(m.state === 'run' ? this.time * 20 : 0);
        ctx.strokeStyle = '#78909c'; ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.moveTo(0, -7); ctx.lineTo(0, 7); ctx.stroke();
        ctx.restore(); ctx.restore();
    }
    _throwerArt(ctx, pl, x, y) { // 石子火柴人：面朝右投掷
        ctx.save(); ctx.translate(x, y);
        const sway = Math.sin(pl.t * 2.2) * 1.5;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.fillStyle = 'rgba(60,50,30,0.16)'; // 地面软阴影
        ctx.beginPath(); ctx.ellipse(2, 1, 17, 4.5, 0, 0, 7); ctx.fill();
        ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 3.2;
        // 双腿：大小腿两段带膝弯 + 横脚垫（无脚趾）
        ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(-5 + sway * 0.4, -13); ctx.lineTo(-8 + sway * 0.4, -1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(5 - sway * 0.4, -13); ctx.lineTo(8 - sway * 0.4, -1); ctx.stroke();
        ctx.lineWidth = 2.8;
        ctx.beginPath(); ctx.moveTo(-9 + sway * 0.4, -0.5); ctx.lineTo(-3 + sway * 0.4, -0.5); ctx.stroke(); // 后脚垫
        ctx.beginPath(); ctx.moveTo(7 - sway * 0.4, -0.5); ctx.lineTo(13 - sway * 0.4, -0.5); ctx.stroke(); // 前脚垫
        ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(sway * 0.3, -50); ctx.stroke(); // 身
        ctx.beginPath(); ctx.arc(sway * 0.3 + 1, -59, 10, 0, 7); // 头（空心）
        ctx.fillStyle = '#f7f3e6'; ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2b2b2b'; // 眼
        ctx.beginPath(); ctx.arc(sway * 0.3 + 5.5, -61, 1.6, 0, 7); ctx.fill();
        ctx.strokeStyle = '#e53935'; ctx.lineWidth = 2.6; // 红头带+飘带
        ctx.beginPath(); ctx.moveTo(sway * 0.3 - 8.6, -63.5); ctx.lineTo(sway * 0.3 + 10, -64.5); ctx.stroke();
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sway * 0.3 - 8.6, -63.5); ctx.quadraticCurveTo(sway * 0.3 - 15, -63 + sway, sway * 0.3 - 19, -60 + sway * 2); ctx.stroke();
        ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 3.2;
        // 后臂：上臂+前臂两段带肘，末端圆手（无手指）
        ctx.beginPath(); ctx.moveTo(sway * 0.3, -46); ctx.lineTo(sway * 0.3 + 5, -39); ctx.lineTo(sway * 0.3 + 9, -33); ctx.stroke();
        ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.arc(sway * 0.3 + 9, -33, 2.6, 0, 7); ctx.fill();
        // 投掷臂两段：常态高举过头握石；throwT 0.35s 内 后引→过头前甩
        const p = pl.throwT > 0 ? 1 - pl.throwT / 0.35 : 0;
        let ang;
        if (p <= 0) ang = -2.35;                            // 举在头后上方
        else if (p < 0.45) ang = -2.35 - (p / 0.45) * 0.6;  // 后引
        else ang = -2.95 + ((p - 0.45) / 0.55) * 2.75;      // 过头甩向前
        const hx = sway * 0.3 + Math.cos(ang) * 20, hy = -48 + Math.sin(ang) * 20;
        const adx = hx - sway * 0.3, ady = hy + 48, adl = Math.hypot(adx, ady) || 1;
        const ex = sway * 0.3 + adx * 0.5 - ady / adl * 4, ey = -48 + ady * 0.5 + adx / adl * 4; // 肘部侧偏
        ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.moveTo(sway * 0.3, -48); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
        if (p < 0.8) { // 手中石子（深色）
            ctx.fillStyle = '#4f4f4f'; ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(hx, hy - 2, 5, 0, 7); ctx.fill(); ctx.stroke();
        }
        if (pl.buff) { // 红温增益：头顶火苗标记（每层一朵）
            ctx.fillStyle = '#e53935';
            for (let k = 0; k < pl.buff; k++) {
                ctx.beginPath(); ctx.arc(-8 + k * 16, -82, 4.5, 0, 7); ctx.fill();
                ctx.fillStyle = '#ffb300'; ctx.beginPath(); ctx.arc(-8 + k * 16, -80.5, 2, 0, 7); ctx.fill();
                ctx.fillStyle = '#e53935';
            }
        }
        if (pl.hp < pl.maxHp) { // 血条
            ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-16, -76, 32, 4);
            ctx.fillStyle = '#66bb6a'; ctx.fillRect(-16, -76, 32 * pl.hp / pl.maxHp, 4);
        }
        ctx.restore();
    }
    _coldArt(ctx, pl, x, y) { // 寒冷火柴人：冰蓝色调，呼出寒气，手持冰雹投掷
        ctx.save(); ctx.translate(x, y);
        const sway = Math.sin(pl.t * 2.2) * 1.2;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = '#1565c0'; ctx.lineWidth = 3.2;
        // 双腿：两段带膝弯 + 横脚垫（无脚趾）
        ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(-5 + sway * 0.4, -13); ctx.lineTo(-8 + sway * 0.4, -1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(5 - sway * 0.4, -13); ctx.lineTo(8 - sway * 0.4, -1); ctx.stroke();
        ctx.lineWidth = 2.8;
        ctx.beginPath(); ctx.moveTo(-9 + sway * 0.4, -0.5); ctx.lineTo(-3 + sway * 0.4, -0.5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(7 - sway * 0.4, -0.5); ctx.lineTo(13 - sway * 0.4, -0.5); ctx.stroke();
        ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(sway * 0.3, -50); ctx.stroke(); // 身
        // 围巾：颈后绕圈 + 向后飘带
        ctx.strokeStyle = '#64b5f6'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(sway * 0.3, -51, 5.5, 0.15, Math.PI - 0.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sway * 0.3 - 3, -50); ctx.lineTo(sway * 0.3 - 7 - sway, -42); ctx.stroke();
        ctx.strokeStyle = '#1565c0'; ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.arc(sway * 0.3 + 1, -59, 10, 0, 7); // 头
        ctx.fillStyle = '#e3f2fd'; ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1565c0'; // 右眼
        ctx.beginPath(); ctx.arc(sway * 0.3 + 5, -60, 1.6, 0, 7); ctx.fill();
        ctx.strokeStyle = '#90caf9'; ctx.lineWidth = 1.4; // 头顶两片小雪花
        for (const [sx, sy] of [[-5 + sway * 0.3, -74], [5 + sway * 0.3, -77]]) {
            ctx.beginPath();
            ctx.moveTo(sx - 3.4, sy); ctx.lineTo(sx + 3.4, sy);
            ctx.moveTo(sx, sy - 3.4); ctx.lineTo(sx, sy + 3.4);
            ctx.moveTo(sx - 2.4, sy - 2.4); ctx.lineTo(sx + 2.4, sy + 2.4);
            ctx.moveTo(sx - 2.4, sy + 2.4); ctx.lineTo(sx + 2.4, sy - 2.4);
            ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(144,202,249,0.75)'; ctx.lineWidth = 1.6; // 呼出的寒气
        const fog = (pl.t * 22) % 26;
        ctx.beginPath(); ctx.arc(14 + fog, -58, 2 + fog * 0.12, 0, 7); ctx.stroke();
        ctx.strokeStyle = '#1565c0'; ctx.lineWidth = 3.2;
        // 后臂两段带肘 + 圆手
        ctx.beginPath(); ctx.moveTo(sway * 0.3, -48); ctx.lineTo(sway * 0.3 - 6, -42); ctx.lineTo(sway * 0.3 - 9, -36); ctx.stroke();
        ctx.fillStyle = '#1565c0'; ctx.beginPath(); ctx.arc(sway * 0.3 - 9, -36, 2.6, 0, 7); ctx.fill();
        const p = pl.throwT > 0 ? 1 - pl.throwT / 0.35 : 0; // 投掷臂同石子火柴人
        let ang;
        if (p <= 0) ang = -0.5;
        else if (p < 0.45) ang = -0.5 - (p / 0.45) * 1.7;
        else ang = -2.2 + ((p - 0.45) / 0.55) * 2.4;
        const hx = sway * 0.3 + Math.cos(ang) * 19, hy = -48 + Math.sin(ang) * 19;
        const adx = hx - sway * 0.3, ady = hy + 48, adl = Math.hypot(adx, ady) || 1;
        const ex = sway * 0.3 + adx * 0.5 - ady / adl * 4, ey = -48 + ady * 0.5 + adx / adl * 4; // 肘部侧偏
        ctx.beginPath(); ctx.moveTo(sway * 0.3, -48); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
        if (p < 0.8) { // 手中冰雹
            ctx.fillStyle = '#b3e5fc'; ctx.strokeStyle = '#1565c0'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(hx, hy - 2, 4.5, 0, 7); ctx.fill(); ctx.stroke();
        }
        if (pl.hp < pl.maxHp) { // 血条
            ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-16, -76, 32, 4);
            ctx.fillStyle = '#66bb6a'; ctx.fillRect(-16, -76, 32 * pl.hp / pl.maxHp, 4);
        }
        ctx.restore();
    }
    _rageArt(ctx, pl, x, y) { // 红温火柴人：通体赤红高频颤动，引信将尽时白闪
        ctx.save(); ctx.translate(x + Math.sin(pl.t * 30) * 1.6, y);
        const hot = 0.72 + Math.sin(pl.t * 9) * 0.28;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.globalAlpha = 0.32 * hot; ctx.fillStyle = '#ff5252'; // 热浪光晕
        ctx.beginPath(); ctx.arc(0, -34, 27, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = '#c62828'; ctx.lineWidth = 3.4;
        ctx.beginPath(); ctx.moveTo(-2, -28); ctx.lineTo(-9, -14); ctx.lineTo(-12, 0); ctx.stroke(); // 后腿屈膝蹬地
        ctx.beginPath(); ctx.moveTo(-2, -28); ctx.lineTo(7, -14); ctx.lineTo(13, 0); ctx.stroke(); // 前腿弓步前跨
        ctx.lineWidth = 2.8; // 脚垫（无脚趾）
        ctx.beginPath(); ctx.moveTo(-16, -0.5); ctx.lineTo(-10, -0.5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(12, -0.5); ctx.lineTo(18, -0.5); ctx.stroke();
        ctx.lineWidth = 3.4;
        ctx.beginPath(); ctx.moveTo(-2, -28); ctx.lineTo(8, -52); ctx.stroke(); // 躯干前倾
        // 后臂两段向后平伸 + 圆拳
        ctx.beginPath(); ctx.moveTo(5, -48); ctx.lineTo(-5, -52); ctx.lineTo(-15, -50); ctx.stroke();
        ctx.fillStyle = '#c62828'; ctx.beginPath(); ctx.arc(-15, -50, 2.8, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.moveTo(7, -46); ctx.lineTo(12, -38); ctx.lineTo(25, -38); ctx.stroke(); // 前臂弯折指向前方
        ctx.beginPath(); ctx.arc(25, -38, 2.8, 0, 7); ctx.fill(); // 拳
        ctx.beginPath(); ctx.arc(13, -61, 10, 0, 7); // 空心圆头（微泛红）
        ctx.fillStyle = 'rgba(255,120,120,0.28)'; ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#c62828'; // 眼
        ctx.beginPath(); ctx.arc(17, -61, 1.8, 0, 7); ctx.fill();
        if (pl.fuseT !== undefined && pl.fuseT < 0.35 && Math.sin(pl.t * 40) > 0) { // 爆前白闪
            ctx.globalAlpha = 0.55; ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(0, -34, 27, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        }
        if (pl.hp < pl.maxHp) { // 血条
            ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-16, -76, 32, 4);
            ctx.fillStyle = '#66bb6a'; ctx.fillRect(-16, -76, 32 * pl.hp / pl.maxHp, 4);
        }
        ctx.restore();
    }
    _clockArt(ctx, pl, x, y) { // 时钟火柴人：无脚圆表盘贴地浮动；时针(短慢)分针(长快)旋转，内盛蓝药水液面晃动
        ctx.save(); ctx.translate(x, y);
        const bob = Math.sin(pl.t * 2.4) * 1.2, cy = -25 + bob * 0.4;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.arc(0, cy, 22, 0, 7); ctx.fillStyle = '#f7f3e6'; ctx.fill(); ctx.stroke(); // 表盘
        ctx.fillStyle = '#2b2b2b'; // 12/3/6/9刻度
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 - Math.PI / 2; ctx.beginPath(); ctx.arc(Math.cos(a) * 17.5, cy + Math.sin(a) * 17.5, 1.4, 0, 7); ctx.fill(); }
        ctx.save(); ctx.beginPath(); ctx.arc(0, cy, 20, 0, 7); ctx.clip(); // 蓝色药液（波面晃动）
        const wv = Math.sin(pl.t * 3) * 3;
        ctx.fillStyle = '#1e88e5';
        ctx.beginPath(); ctx.moveTo(-24, cy + 8);
        ctx.quadraticCurveTo(-11, cy + 6 + wv, 0, cy + 8);
        ctx.quadraticCurveTo(11, cy + 10 - wv, 24, cy + 8);
        ctx.lineTo(24, cy + 26); ctx.lineTo(-24, cy + 26); ctx.closePath(); ctx.fill();
        ctx.restore();
        const aM = pl.t * 0.5 - Math.PI / 2, aH = pl.t * 0.06 - Math.PI / 2; // 分针快·可伸出表盘；时针短慢
        ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(Math.cos(aM) * 30, cy + Math.sin(aM) * 30); ctx.stroke();
        ctx.lineWidth = 4.2;
        ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(Math.cos(aH) * 16, cy + Math.sin(aH) * 16); ctx.stroke();
        ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.arc(0, cy, 2.4, 0, 7); ctx.fill(); // 轴心
        if (pl.hp < pl.maxHp) { // 血条
            ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-16, -56, 32, 4);
            ctx.fillStyle = '#66bb6a'; ctx.fillRect(-16, -56, 32 * pl.hp / pl.maxHp, 4);
        }
        ctx.restore();
    }
    _shieldArt(ctx, pl, x, y) { // K盾火柴人：火柴人举筝形大盾站桩
        ctx.save(); ctx.translate(x, y);
        const sway = Math.sin(pl.t * 2) * 1.2;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 3.2;
        // 双腿两段带膝弯 + 横脚垫（无脚趾）
        ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(-5 + sway * 0.4, -13); ctx.lineTo(-8 + sway * 0.4, -1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(4 - sway * 0.4, -13); ctx.lineTo(6 - sway * 0.4, -1); ctx.stroke();
        ctx.lineWidth = 2.8;
        ctx.beginPath(); ctx.moveTo(-9 + sway * 0.4, -0.5); ctx.lineTo(-3 + sway * 0.4, -0.5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(5 - sway * 0.4, -0.5); ctx.lineTo(11 - sway * 0.4, -0.5); ctx.stroke();
        ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(sway * 0.3, -50); ctx.stroke(); // 身
        ctx.beginPath(); ctx.moveTo(sway * 0.3, -46); ctx.lineTo(sway * 0.3 + 4, -44); ctx.lineTo(2, -46); ctx.stroke(); // 持盾臂探向盾缘
        ctx.beginPath(); ctx.arc(sway * 0.3, -59, 10, 0, 7); // 头
        ctx.fillStyle = '#f7f3e6'; ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.arc(sway * 0.3 + 4, -60, 1.6, 0, 7); ctx.fill(); // 眼
        // 筝形大盾（钢灰+蓝边+中脊+铆钉；升级变金+光晕），立在身前
        const up = !!pl.upgraded;
        if (up) { ctx.globalAlpha = 0.22 + Math.sin(pl.t * 6) * 0.08; ctx.fillStyle = '#ffd54f'; ctx.beginPath(); ctx.arc(14, -44, 34, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
        ctx.fillStyle = up ? '#ffe082' : '#b0bec5'; ctx.strokeStyle = up ? '#f9a825' : '#1565c0'; ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(14, -74); ctx.lineTo(32, -50); ctx.lineTo(14, -10); ctx.lineTo(-4, -50); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = up ? 'rgba(249,168,37,0.5)' : 'rgba(21,101,192,0.45)'; ctx.lineWidth = 1.6; // 中脊+横肋
        ctx.beginPath(); ctx.moveTo(14, -74); ctx.lineTo(14, -10); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-4, -50); ctx.lineTo(32, -50); ctx.stroke();
        ctx.fillStyle = '#eceff1'; ctx.strokeStyle = up ? '#f9a825' : '#1565c0'; ctx.lineWidth = 1.4;
        for (const [rx, ry] of [[14, -64], [14, -36], [4, -50], [24, -50]]) { ctx.beginPath(); ctx.arc(rx, ry, 2.2, 0, 7); ctx.fill(); ctx.stroke(); }
        ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.arc(-2, -46, 2.8, 0, 7); ctx.fill(); // 盾缘露出的握拳
        if (pl.hp < pl.maxHp) { // 血条（4000血大肉盾）
            ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-16, -82, 32, 4);
            ctx.fillStyle = '#42a5f5'; ctx.fillRect(-16, -82, 32 * Math.max(0, pl.hp) / pl.maxHp, 4);
        }
        ctx.restore();
    }
    _bomberArt(ctx, pl, x, y, bare) { // 自爆兵火柴人：紫色躯干双手捧雷；bare=剧情版(不持雷)；开雷期灰雷+头顶进度环，就绪后红雷闪烁
        ctx.save(); ctx.translate(x, y);
        const sway = Math.sin(pl.t * 2.2) * 1.5, armed = pl.fuseT <= 0;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = '#5e35b1'; ctx.lineWidth = 3.2;
        // 双腿两段带膝弯 + 横脚垫（无脚趾）
        ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(-5 + sway * 0.4, -13); ctx.lineTo(-8 + sway * 0.4, -1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(5 - sway * 0.4, -13); ctx.lineTo(8 - sway * 0.4, -1); ctx.stroke();
        ctx.lineWidth = 2.8;
        ctx.beginPath(); ctx.moveTo(-9 + sway * 0.4, -0.5); ctx.lineTo(-3 + sway * 0.4, -0.5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(7 - sway * 0.4, -0.5); ctx.lineTo(13 - sway * 0.4, -0.5); ctx.stroke();
        ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(sway * 0.3, -50); ctx.stroke(); // 身
        // 弹药斜挎带 + 铜扣
        ctx.strokeStyle = '#4527a0'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(sway * 0.3 - 4, -47); ctx.lineTo(sway * 0.3 + 4, -30); ctx.stroke();
        ctx.fillStyle = '#ffd54f'; ctx.fillRect(sway * 0.3 - 1.5, -39.5, 3.5, 3.5);
        ctx.strokeStyle = '#5e35b1'; ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.arc(sway * 0.3 + 1, -59, 10, 0, 7); // 头
        ctx.fillStyle = '#f7f3e6'; ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#5e35b1'; ctx.beginPath(); ctx.arc(sway * 0.3 + 5, -60, 1.6, 0, 7); ctx.fill(); // 眼
        ctx.strokeStyle = '#5e35b1'; ctx.lineWidth = 3.2;
        if (bare) { // 剧情版：自然手臂（两段+圆手），不持雷
            ctx.beginPath(); ctx.moveTo(sway * 0.3, -46); ctx.lineTo(sway * 0.3 + 8, -42); ctx.lineTo(sway * 0.3 + 12, -38); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(sway * 0.3, -44); ctx.lineTo(sway * 0.3 - 5, -39); ctx.lineTo(sway * 0.3 - 9, -34); ctx.stroke();
            ctx.fillStyle = '#5e35b1';
            ctx.beginPath(); ctx.arc(sway * 0.3 + 12, -38, 2.6, 0, 7); ctx.fill();
            ctx.beginPath(); ctx.arc(sway * 0.3 - 9, -34, 2.6, 0, 7); ctx.fill();
        } else { // 战斗版：双臂前捧雷（圆手托底）
            ctx.beginPath(); ctx.moveTo(sway * 0.3, -46); ctx.quadraticCurveTo(sway * 0.3 + 12, -42, sway * 0.3 + 15, -35); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(sway * 0.3, -44); ctx.quadraticCurveTo(sway * 0.3 + 10, -36, sway * 0.3 + 15, -31); ctx.stroke();
            const gx = sway * 0.3 + 17, gy = -33; // 手雷
            ctx.fillStyle = '#5e35b1'; // 托雷的圆手（无手指）
            ctx.beginPath(); ctx.arc(gx - 4, gy + 4.5, 2.6, 0, 7); ctx.fill();
            ctx.beginPath(); ctx.arc(gx + 4, gy + 5, 2.6, 0, 7); ctx.fill();
            ctx.fillStyle = armed ? (Math.sin(pl.t * 10) > 0 ? '#e53935' : '#c62828') : '#78909c';
            ctx.strokeStyle = '#333'; ctx.lineWidth = 1.8;
            ctx.beginPath(); ctx.arc(gx, gy, 7, 0, 7); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#424242'; ctx.fillRect(gx - 3, gy - 12, 6, 5); // 雷盖
            ctx.strokeStyle = armed ? '#ffb300' : '#90a4ae'; ctx.lineWidth = 1.4; // 引线
            ctx.beginPath(); ctx.moveTo(gx, gy - 12); ctx.quadraticCurveTo(gx + 5, gy - 17, gx + 8, gy - 13); ctx.stroke();
            if (!armed && pl.fuseT !== undefined) { // 开雷进度环（18s）
                ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(0, -80, 9, 0, 7); ctx.stroke();
                ctx.strokeStyle = '#7e57c2';
                ctx.beginPath(); ctx.arc(0, -80, 9, -Math.PI / 2, -Math.PI / 2 + (1 - pl.fuseT / 18) * Math.PI * 2); ctx.stroke();
            } else if (armed) { // 就绪：雷旁警示闪光
                ctx.globalAlpha = 0.5 + Math.sin(pl.t * 10) * 0.3;
                ctx.strokeStyle = '#e53935'; ctx.lineWidth = 1.6;
                for (const a of [-0.6, 0, 0.6]) { ctx.beginPath(); ctx.moveTo(gx + Math.cos(a - 1.2) * 11, gy - 8 + Math.sin(a - 1.2) * 11); ctx.lineTo(gx + Math.cos(a - 1.2) * 15, gy - 8 + Math.sin(a - 1.2) * 15); ctx.stroke(); }
                ctx.globalAlpha = 1;
            }
        }
        if (pl.hp < pl.maxHp) { // 血条
            ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-16, -76, 32, 4);
            ctx.fillStyle = '#66bb6a'; ctx.fillRect(-16, -76, 32 * pl.hp / pl.maxHp, 4);
        }
        ctx.restore();
    }
    _shovelArt(ctx, x, y) { // 铲子图标（卡槽/剧情预告用）
        ctx.save(); ctx.translate(x, y); ctx.rotate(-0.5);
        ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = '#795548'; ctx.lineWidth = 4; // 木柄
        ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, 8); ctx.stroke();
        ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 3; // 手柄横把
        ctx.beginPath(); ctx.moveTo(-7, -15); ctx.lineTo(7, -15); ctx.stroke();
        ctx.fillStyle = '#b0bec5'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1.8; // 铲头
        ctx.beginPath(); ctx.moveTo(-8, 8); ctx.lineTo(8, 8); ctx.lineTo(5, 20); ctx.lineTo(-5, 20); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
    }
    _birdArt(ctx, pl, x, y) { // 食人鸟：一只鸟——椭圆鸟身+圆头+巨喙；biteT猛张嘴，chewT鼓喉咀嚼
        ctx.save(); ctx.translate(x, y);
        const sway = Math.sin(pl.t * 2.4) * 1.3;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // 细鸟腿两站 + 三趾爪
        ctx.strokeStyle = '#e65100'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(-4, -12); ctx.lineTo(-4, -1); ctx.moveTo(4, -12); ctx.lineTo(4, -1); ctx.stroke();
        ctx.lineWidth = 1.8;
        for (const lx of [-4, 4]) for (const dx of [-3, 0, 3]) {
            ctx.beginPath(); ctx.moveTo(lx, -1); ctx.lineTo(lx + dx, -0.2 + (dx === 0 ? 0.8 : 0.3)); ctx.stroke();
        }
        // 尾羽三撇（身后下扬）
        ctx.strokeStyle = '#455a64'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-16, -38); ctx.lineTo(-30, -34 + sway); ctx.moveTo(-16, -36); ctx.lineTo(-31, -29); ctx.moveTo(-16, -34); ctx.lineTo(-28, -25); ctx.stroke();
        // 椭圆鸟身（横卧）
        ctx.fillStyle = '#eceff1'; ctx.strokeStyle = '#455a64'; ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.ellipse(-4, -34, 17, 12, -0.12, 0, 7); ctx.fill(); ctx.stroke();
        // 翅膀：贴身扇动；咀嚼时垂下
        const flap = pl.chewT > 0 ? 0.12 : Math.abs(Math.sin(pl.t * 5)) * 0.7;
        ctx.fillStyle = '#b0bec5'; ctx.strokeStyle = '#455a64'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.ellipse(-7, -36 + flap * 8, 11, 5.5, -0.5 - flap * 0.5, 0, 7); ctx.fill(); ctx.stroke();
        // 圆头（身前上方，随sway微晃）
        const hx = 10 + sway * 0.3, hy = -58;
        ctx.fillStyle = '#eceff1'; ctx.strokeStyle = '#455a64'; ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.arc(hx, hy, 12, 0, 7); ctx.fill(); ctx.stroke();
        // 头顶羽冠
        ctx.strokeStyle = '#455a64'; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(hx - 3, hy - 11); ctx.lineTo(hx - 6, hy - 17); ctx.moveTo(hx + 1, hy - 12); ctx.lineTo(hx + 1, hy - 18); ctx.stroke();
        // 巨喙：上喙微翘定住；下喙随open下转（biteT=猛张吞咬，待机微张）
        const open = pl.biteT > 0 ? 1 : Math.max(0, Math.sin(pl.t * 1.6)) * 0.2;
        ctx.fillStyle = '#ef6c00'; ctx.strokeStyle = '#e65100'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(hx + 7, hy - 6); ctx.lineTo(hx + 27, hy - 4 - open * 6); ctx.lineTo(hx + 8, hy - 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(hx + 8, hy + 1); ctx.lineTo(hx + 24, hy + 2 + open * 16); ctx.lineTo(hx + 7, hy + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
        // 眼
        ctx.fillStyle = '#263238'; ctx.beginPath(); ctx.arc(hx + 3.5, hy - 4, 1.8, 0, 7); ctx.fill();
        if (pl.chewT > 0) { // 咀嚼：鼓起喉囊左右晃 + 进度提示
            const w = 1 + Math.sin(pl.t * 9) * 0.1;
            ctx.fillStyle = '#eceff1'; ctx.strokeStyle = '#455a64'; ctx.lineWidth = 2.4;
            ctx.beginPath(); ctx.ellipse(hx - 3, hy + 15, 8 * w, 7, 0, 0, 7); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = 'rgba(239,108,0,0.85)'; ctx.lineWidth = 2; // 咀嚼进度环
            ctx.beginPath(); ctx.arc(hx, hy - 18, 5, -Math.PI / 2, -Math.PI / 2 + (1 - pl.chewT / STK_BIRD_CHEW) * Math.PI * 2); ctx.stroke();
        }
        if (pl.hp < pl.maxHp) { // 血条
            ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(-16, -80, 32, 4);
            ctx.fillStyle = '#66bb6a'; ctx.fillRect(-16, -80, 32 * pl.hp / pl.maxHp, 4);
        }
        ctx.restore();
    }
    _szArt(ctx, z) { // 火柴人僵尸：佝偻/红眼/拖步；临界掉头
        const y = this._zY(z);
        ctx.save(); ctx.translate(z.x, y); ctx.scale(-1, 1); // 面向左（朝屋子行进）
        if (z.type === 'hpz') ctx.scale(1.18, 1.18); // 血量僵尸：体型大一圈
        else if (z.type === 'pz') { // 紫柴boss：巨型紫身+气场
            ctx.scale(1.9, 1.9);
            ctx.fillStyle = 'rgba(123,31,162,0.13)';
            ctx.beginPath(); ctx.arc(4, -46, 52, 0, 7); ctx.fill();
        }
        if (z.jumpT > 0) ctx.translate(0, -Math.sin(Math.PI * (1 - z.jumpT / STK_MECH_JUMP_T)) * 46); // 弹力器跳跃弧线
        if (z.dead) { const d = Math.min(1, z.die / 0.7); ctx.rotate(d * 1.5); ctx.globalAlpha = 1 - d; }
        const col = z.crit ? '#689f38' : z.type === 'pz' ? '#7b1fa2' : z.type === 'mech' ? '#546e7a' : z.type === 'hpz' ? '#1b5e20' : '#33691e'; // 绿皮；boss=紫；机械=铁灰；血量=深绿；临界后变浅绿
        ctx.fillStyle = 'rgba(40,60,20,0.18)'; // 地面软阴影
        ctx.beginPath(); ctx.ellipse(0, 1, 18, 4.5, 0, 0, 7); ctx.fill();
        const frz = z.freezeT > 0;
        const step = frz ? 0 : Math.sin(z.t * 5), bob = frz ? 0 : Math.sin(z.t * 4) * 2; // 冻结定身不动
        ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 3.4;
        ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(-6 - step * 2, -12); ctx.lineTo(-9 - step * 4, -1); ctx.stroke(); // 后腿拖行
        ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(5 + step * 3, -13); ctx.lineTo(9 + step * 4, 0); ctx.stroke(); // 前腿迈步
        ctx.lineWidth = 2.6; // 脚（无脚趾）
        ctx.beginPath(); ctx.moveTo(-9 - step * 4, -0.5); ctx.lineTo(-13 - step * 4, -0.5); ctx.stroke(); // 后脚拖后
        ctx.beginPath(); ctx.moveTo(9 + step * 4, -0.5); ctx.lineTo(14 + step * 4, -0.5); ctx.stroke();   // 前脚探前
        ctx.lineWidth = 3.4;
        ctx.beginPath(); ctx.moveTo(0, -28); ctx.quadraticCurveTo(4, -40, 8, -52); ctx.stroke(); // 佝偻躯干
        ctx.beginPath(); ctx.moveTo(8, -50); ctx.quadraticCurveTo(16, -46 + bob, 22, -42 + bob); ctx.stroke(); // 双臂前伸
        ctx.beginPath(); ctx.moveTo(8, -50); ctx.quadraticCurveTo(14, -40 - bob, 20, -34 - bob); ctx.stroke();
        ctx.fillStyle = col; // 圆爪手（无手指）
        for (const [hx2, hy2] of [[22, -42 + bob], [20, -34 - bob]]) {
            ctx.beginPath(); ctx.arc(hx2, hy2, 3, 0, 7); ctx.fill();
        }
        ctx.save(); // 破布衣角：腰间飘动的撕裂布条
        ctx.strokeStyle = z.type === 'pz' ? '#ce93d8' : '#8d6e63'; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(1, -36); ctx.lineTo(-5 - step * 1.5, -28); ctx.moveTo(3, -40); ctx.lineTo(-3 - step * 1.5, -31); ctx.moveTo(-1, -33); ctx.lineTo(-8 - step * 2, -25); ctx.stroke();
        ctx.restore();
        if (!z.crit || z.dead) { // 头（临界后掉落）
            ctx.beginPath(); ctx.arc(12, -61, 10, 0, 7);
            ctx.fillStyle = '#c5e1a5'; ctx.fill(); ctx.stroke();
            ctx.fillStyle = 'rgba(60,80,30,0.35)'; // 眼眶阴影
            ctx.beginPath(); ctx.ellipse(16, -62, 3.4, 2.6, 0, 0, 7); ctx.ellipse(16, -57.5, 3.4, 2.6, 0, 0, 7); ctx.fill();
            ctx.fillStyle = '#d32f2f';
            ctx.beginPath(); ctx.arc(16, -62, 1.6, 0, 7); ctx.arc(16, -57.5, 1.6, 0, 7); ctx.fill(); // 红眼
            ctx.strokeStyle = col; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(17, -54); ctx.lineTo(21, -52); ctx.stroke(); // 歪嘴
            ctx.beginPath(); ctx.moveTo(17.5, -55.5); ctx.lineTo(18.5, -52.8); ctx.moveTo(19.8, -55); ctx.lineTo(20.6, -52.3); ctx.stroke(); // 缝线
        }
        if (z.armor > 0 && (!z.crit || z.dead)) { // 绿帽子（一类防具）：戴在头上
            ctx.fillStyle = '#43a047'; ctx.strokeStyle = '#1b5e20'; ctx.lineWidth = 1.8;
            ctx.beginPath(); ctx.moveTo(1, -69); ctx.lineTo(23, -69); ctx.lineTo(19, -85); ctx.lineTo(5, -85); ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.lineWidth = 2.6; // 帽檐
            ctx.beginPath(); ctx.moveTo(-1, -69); ctx.lineTo(25, -69); ctx.stroke();
        }
        if (z.pshield > 0) { // 纸盾：手绘皱纸方盾挡在身前（免疫任意1次伤害）
            const tw = Math.sin(z.t * 6) * 1.4;
            ctx.fillStyle = '#f5f0e2'; ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(24 + tw, -72); ctx.lineTo(40 + tw, -66); ctx.lineTo(38 + tw, -20); ctx.lineTo(22 + tw, -26); ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.strokeStyle = 'rgba(141,110,99,0.6)'; ctx.lineWidth = 1.2; // 皱褶+撕边
            ctx.beginPath(); ctx.moveTo(27 + tw, -62); ctx.lineTo(36 + tw, -58); ctx.moveTo(26 + tw, -46); ctx.lineTo(35 + tw, -40); ctx.stroke();
            ctx.fillStyle = '#8d6e63'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
            ctx.fillText('纸', 31 + tw, -40);
        }
        if (z.type === 'hpz' && (!z.crit || z.dead)) { // 血量僵尸：胸前大红心标记（血厚）
            const hh = -40 + bob * 0.4;
            ctx.fillStyle = '#c62828'; ctx.strokeStyle = '#7f0000'; ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(4, hh + 6);
            ctx.bezierCurveTo(-3, hh + 1, 0, hh - 6, 4, hh - 1);
            ctx.bezierCurveTo(8, hh - 6, 11, hh + 1, 4, hh + 6);
            ctx.fill(); ctx.stroke();
        }
        if (z.type === 'pop' && (!z.crit || z.dead)) { // 人缘僵尸：头顶粉色爱心人缘标记
            const hx = 12, hy = -80 + bob * 0.6;
            ctx.fillStyle = '#ec407a';
            ctx.beginPath();
            ctx.moveTo(hx, hy + 4);
            ctx.bezierCurveTo(hx - 8, hy - 3, hx - 4, hy - 10, hx, hy - 4);
            ctx.bezierCurveTo(hx + 4, hy - 10, hx + 8, hy - 3, hx, hy + 4);
            ctx.fill();
            ctx.strokeStyle = '#ad1457'; ctx.lineWidth = 1.2; ctx.stroke();
        }
        if (z.spdMul > 1 && !z.dead) { // 人缘加成：身后速度线
            ctx.strokeStyle = 'rgba(236,64,122,0.55)'; ctx.lineWidth = 2;
            for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-16 - k * 8, -44 + k * 10); ctx.lineTo(-30 - k * 8, -44 + k * 10); ctx.stroke(); }
        }
        if (z.crit && !z.dead) { // 掉落的头：旋转下坠渐隐
            const ht = Math.min(1, z.headT / 0.6);
            ctx.save(); ctx.globalAlpha = 1 - ht;
            ctx.translate(4 - ht * 10, -60 + ht * 42); ctx.rotate(ht * 2.2);
            ctx.fillStyle = '#c5e1a5'; ctx.strokeStyle = col; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#d32f2f'; ctx.beginPath(); ctx.arc(4, -1, 1.6, 0, 7); ctx.arc(4, 4, 1.6, 0, 7); ctx.fill();
            ctx.restore();
        }
        if (z.type === 'mech' && (!z.crit || z.dead)) { // 机械僵尸：铆钉躯干+背后一次性弹力器(用掉变灰)+天线
            ctx.fillStyle = '#78909c'; ctx.strokeStyle = '#37474f'; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.arc(1, -36, 1.6, 0, 7); ctx.arc(4, -44, 1.6, 0, 7); ctx.fill(); ctx.stroke(); // 铆钉
            ctx.strokeStyle = z.jumped ? '#9e9e9e' : '#b71c1c'; ctx.lineWidth = 2.2; // 弹力器弹簧（用掉变灰）
            ctx.beginPath(); ctx.moveTo(-4, -44); ctx.lineTo(-9, -40); ctx.lineTo(-4, -36); ctx.lineTo(-9, -32); ctx.lineTo(-4, -28); ctx.stroke();
            ctx.strokeStyle = '#37474f'; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(12, -70); ctx.lineTo(12, -78); ctx.stroke(); // 天线
            ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(12, -79, 2, 0, 7); ctx.fill();
        }
        if (frz) { // 冻结：全身罩半透明冰块
            ctx.fillStyle = 'rgba(179,229,252,0.5)'; ctx.strokeStyle = '#4fc3f7'; ctx.lineWidth = 1.8;
            ctx.beginPath(); ctx.rect(-14, -76, 42, 78); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.3;
            ctx.beginPath(); ctx.moveTo(-8, -66); ctx.lineTo(-1, -58); ctx.moveTo(20, -70); ctx.lineTo(13, -60); ctx.stroke();
        }
        if (z.flash > 0) { // 受击闪白
            ctx.globalAlpha = 0.5; ctx.strokeStyle = '#fff'; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(8, -52); ctx.stroke();
            ctx.beginPath(); ctx.arc(12, -61, 11, 0, 7); ctx.stroke();
        }
        ctx.restore();
        if (!z.dead && z.armor > 0 && !z.icon) { // 帽子耐久条（绿）
            ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(z.x - 16, y - 88, 32, 4);
            ctx.fillStyle = '#66bb6a'; ctx.fillRect(z.x - 16, y - 88, 32 * z.armor / z.maxArmor, 4);
        }
        if (!z.dead && z.hp < z.maxHp) { // 血条
            ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(z.x - 16, y - 82, 32, 4);
            ctx.fillStyle = '#e53935'; ctx.fillRect(z.x - 16, y - 82, 32 * Math.max(0, z.hp) / z.maxHp, 4);
        }
    }
    _stoneArt(ctx, s) { // 旋转石子；冰雹=浅蓝冰粒，冰块=半透明蓝方块
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot);
        if (s.ice) {
            ctx.fillStyle = 'rgba(179,229,252,0.92)'; ctx.strokeStyle = '#4fc3f7'; ctx.lineWidth = 1.8;
            this.g._rr(ctx, -7, -7, 14, 14, 3); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(4, 4); ctx.moveTo(4, -4); ctx.lineTo(-4, 4); ctx.stroke();
            ctx.restore(); return;
        }
        ctx.fillStyle = s.hail ? '#a8d8f0' : '#8d8d8d'; ctx.strokeStyle = s.hail ? '#4a90c2' : '#3a3a3a'; ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(6, 0); ctx.lineTo(3, -4.5); ctx.lineTo(-2, -5.5); ctx.lineTo(-6, -1); ctx.lineTo(-4, 4); ctx.lineTo(2, 5.5); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(-1.5, -2, 1.4, 0, 7); ctx.fill();
        ctx.restore();
    }
    _inkArt(ctx, x, y, a, brk) { // 药水瓶；brk=破损(裂纹+渗液,1-8)
        ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y);
        ctx.strokeStyle = '#37474f'; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
        ctx.fillStyle = 'rgba(200,230,245,0.9)'; // 玻璃瓶身
        ctx.beginPath(); ctx.moveTo(-4, -14); ctx.lineTo(-4, -6);
        ctx.quadraticCurveTo(-11, -2, -11, 5); ctx.quadraticCurveTo(-11, 13, 0, 13);
        ctx.quadraticCurveTo(11, 13, 11, 5); ctx.quadraticCurveTo(11, -2, 4, -6); ctx.lineTo(4, -14);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#1e88e5'; // 蓝色药液
        ctx.beginPath(); ctx.moveTo(-9, 3); ctx.quadraticCurveTo(-9.6, 12, 0, 12);
        ctx.quadraticCurveTo(9.6, 12, 9, 3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#8d6e63'; ctx.strokeStyle = '#4e342e'; // 软木塞
        ctx.beginPath(); ctx.rect(-4.5, -19, 9, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.75)'; // 玻璃高光
        ctx.beginPath(); ctx.ellipse(-4, 5, 2, 4, 0.3, 0, 7); ctx.fill();
        if (brk) { // 破损：瓶身裂纹+底部渗液
            ctx.strokeStyle = '#37474f'; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(-8, -2); ctx.lineTo(-3, 2); ctx.lineTo(-6, 7); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(3, 4); ctx.lineTo(6, 9); ctx.stroke();
            ctx.fillStyle = '#1565c0';
            ctx.beginPath(); ctx.ellipse(9, 14, 3.5, 1.8, 0, 0, 7); ctx.fill();
        }
        ctx.restore();
    }
}
