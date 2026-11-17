// ===== 小球对战：选球 → 自动对战 =====
// 大重置：所有球种已清空，仅保留选择/对战框架。新赛季球敬请期待。
const BB_TYPES = { // 重置·基础赛季：4种基础球（名字显示在球体内）
    plain: { name: '白板', hp: 1000, atk: 50, spd: 1.0, color: '#9e9e9e', glow: '#e0e0e0', melee: true, ult: true, // 近战类：随机游走
        icon: '<circle cx="12" cy="12" r="6.5"/><path d="M8.6 9.6a4.6 4.6 0 0 1 4.2-4.2"/>' }, // 基准白板
    speed: { name: '速度', hp: 1000, atk: 50, spd: 2.0, color: '#4fc3f7', glow: '#80d8ff', melee: true, ult: true, // 2倍移速
        icon: '<path d="M14.5 2.5 8 12.5h4.3L9.8 21.5 18.5 10h-4.6z"/><path d="M2.2 8.5h3.4M1.8 12h3.4M2.2 15.5h3.4"/>' }, // 闪电+速度线
    hpball: { name: '血量', hp: 1300, atk: 50, spd: 1.0, color: '#66bb6a', glow: '#a5d6a7', melee: true, ult: true, // 血牛
        icon: '<path d="M12 21s-7-4.6-9.4-9.1A5.4 5.4 0 0 1 12 6.6a5.4 5.4 0 0 1 9.4 5.3C19 16.4 12 21 12 21z"/>' }, // 爱心
    dmg: { name: '伤害', hp: 1000, atk: 80, spd: 1.0, color: '#ff5722', glow: '#ffab91', melee: true, ult: true, // 高攻
        icon: '<path d="M9.8 7.2L12 20.5l2.2-13.3z"/><path d="M7.5 7h9"/><path d="M12 2.5v4"/>' }, // 巨剑
    invincible: { name: '无敌', hp: 1000, atk: 50, spd: 1.0, color: '#ffb300', glow: '#ffe082', melee: true, ult: true, // 无敌球：开局3盾，每碎+5伤
        shield: 3, shieldBreakAtk: 5, desc: '我从地狱归来,我而最强球!',
        icon: '<path d="M12 2l7 4v6c0 5-3.5 9.5-7 10-3.5-0.5-7-5-7-10V6l7-4z" fill="none" stroke="rgba(255,255,255,0.92)" stroke-width="1.8"/><path d="M9 12l2 2 4-4" stroke="rgba(255,255,255,0.92)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' },
    blackspeed: { name: '黑速度', hp: 1000, atk: 50, spd: 1.2, color: '#212121', glow: '#7c4dff', melee: true, ult: true, // 黑速度球：每0.5秒+0.2速度，攻击时把累积速度×10加到伤害上并清零
        blkGrow: 0.4, blkDmgMul: 10,
        icon: '<path d="M14.5 2.5 8 12.5h4.3L9.8 21.5 18.5 10h-4.6z"/><path d="M2.2 8.5h3.4M1.8 12h3.4M2.2 15.5h3.4"/>' },
    white: { name: '白色白板', hp: 1000, atk: 50, spd: 1.0, color: '#ffffff', glow: '#ffffff', melee: true, ult: true, // 大招:向周围发射15个50伤小球
        throwEvery: 1, // 被动:每1s向最近敌人扔小球(20伤)，同白板大招变身形态
        iconDark: true, // 白球白底用深色图标，与卡片一致
        icon: '<circle cx="12" cy="12" r="5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>' }, // 圆+放射线
    blackwb: { name: '黑色白板', hp: 1000, atk: 50, spd: 1.0, color: '#212121', glow: '#616161', melee: true, ult: true, // 碰墙1s内减伤50%；大招:边界侵蚀8s
        wallInvSec: 1, // 每次碰到场地边界即获得1s的50%减伤
        icon: '<circle cx="12" cy="12" r="5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>' }, // 圆+放射线(白描边黑底可见)
    // ——以下为联机对战专用/遗留类型：选球界面无卡不可选、不进排行——
    mine: { name: '地雷', hp: 1000, atk: 0, spd: 1.0, color: '#795548', glow: '#ffab40',
        mineEvery: 4, mineDmg: 60, mineR: 55, mineMax: 3, // 每4s原地埋大地雷(r=55/60伤)，场上最多3颗
        smineDmg: 40, smineR: 24, smineMax: 2, // 大雷满3颗后改埋小雷(r=24/40伤)，最多2颗
        icon: '<circle cx="12" cy="14.5" r="6.5"/><path d="M12 8V4.5M7.4 9.9 4.8 7.4M16.6 9.9l2.6-2.5M5.5 14.5H3M21 14.5h-2.5"/><circle cx="12" cy="14.5" r="2.2" fill="rgba(255,255,255,.92)" stroke="none"/>' }, // 圆雷+刺钉+中心点
    tachi: { name: '太刀', hp: 1000, atk: 15, spd: 1.0, color: '#607d8b', glow: '#eceff1', melee: true, seekWander: true, // 近战类：随机游走
        bladeDmg: 85, // 开局一把太刀绕身旋转(r+26)，碰到敌球造成85伤并反转方向（同一目标0.55s内只结算一次）
        icon: '<path d="M5.5 18.5 17.5 6.5"/><path d="M17.5 6.5l1.8-1.8L21.2 6.6 19.4 8.4z"/><path d="M6.5 15.5l2 2M5 18l1.5 1.5"/>' }, // 太刀：刀身+刀镡+柄
    mini: { name: '小白板', hp: 100, atk: 25, spd: 1.5, color: '#fafafa', glow: '#ffffff',
        elim: true, minion: true, // 召唤物：不可选、不进排行、无任何机制
        icon: '<circle cx="12" cy="12" r="6.5"/>' },
};
// 羁绊组：同队凑齐所有成员类型即触发，该队全体攻击力+5（重置后暂无羁绊，新组直接加进表）
const BB_SYNERGY = [
    { name: '元素组', types: ['speed', 'dmg', 'hpball'], atk: 15 },
    { name: '极速双煞', types: ['speed', 'blackspeed'], atk: 10 },
    { name: '王牌组', types: ['invincible', 'dmg'], atk: 10 }
];
const BB_STAT_KEY = 'bbStatsV1';
// 战绩按账号区分：不同账号各自独立统计
function bbStatKey() {
    const u = (window.game && window.game.username) || 'guest';
    return BB_STAT_KEY + '_' + u;
}
// 日期种子随机数：同一天所有账号拿到同一挑战阵容
function bbSeeded(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => {
        h = Math.imul(h ^ (h >>> 15), h | 1);
        h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
        return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
    };
}
// ===== 小宇币/皮肤：小宇币按账号存，游戏盒内每在线20s+5 =====
function bbCoinKey() { return 'xyCoin_' + ((window.game && window.game.username) || 'guest'); }
function bbCoins() { return parseInt(localStorage.getItem(bbCoinKey())) || 0; }
function bbAddCoin(dt) { // 各游戏主循环调用：累计在线时间发币
    this._coinT = (this._coinT || 0) + dt;
    if (this._coinT >= 20) {
        this._coinT -= 20;
        try { localStorage.setItem(bbCoinKey(), String(bbCoins() + 5)); } catch (e) { /* ignore */ }
    }
}
// 皮肤表：base=宿主球 type, price=小宇币价
const BB_SKINS = {
    plain_square: { base: 'plain', name: '方形白板', price: 5, square: true, desc: '变正方形 · 大招改追踪方弹100伤' },
    plain_dragon: { base: 'dmg', name: '龙王', price: 10, dragon: true, desc: '金龙造型 · 伤害球皮肤 · 大招召唤追踪龙200伤' },
    speed_swift: { base: 'speed', name: '迅速', price: 5, swift: true, desc: '疾光造型 · 大招改扔3个黑球(30伤)，1秒未中瞬移并+10血' },
};
function bbSkinKey() { return 'bbSkins_' + ((window.game && window.game.username) || 'guest'); }
function bbSkinSave() { try { return JSON.parse(localStorage.getItem(bbSkinKey()) || '{}'); } catch (e) { return {}; } }
function bbEquipped(type) { const s = bbSkinSave(); return s.equipped && s.equipped[type] ? s.equipped[type] : null; }
const BB_SPEED = 360;    // 基础速度 px/s
const BB_R = 30;         // 球半径
const BB_HIT_CD = 0.7;   // 受击冷却(秒)
const BB_SHRINK_DELAY = 4;  // 开局几秒后场地开始缩小
const BB_SHRINK_RATE = 14;  // 每边缩小速度 px/s
const BB_MIN_W = 720;    // 最小场地宽（缩圈下限：原本360的2倍）
const BB_MIN_H = 520;    // 最小场地高（原本260的2倍）
const BB_TEAMS = [ // 队伍模式（最多4队）
    { name: '红队', color: '#ef5350' },
    { name: '蓝队', color: '#42a5f5' },
    { name: '黄队', color: '#ffca28' },
    { name: '绿队', color: '#66bb6a' },
];

class BallBattleGame {
    constructor() {
        this.canvas = document.getElementById('ballBattleCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.phase = 'select'; // select | countdown | battle | arenaResult | over
        this.picks = [];       // 选中的球type
        this.balls = [];
        this.floats = [];
        this.particles = [];
        this.winner = null;
        this.bounds = null;
        this.battleTime = 0;
        this._raf = null;
        this._lastTime = 0;
        this._bound = false;
        this._overTimer = 0;
        this._rankCache = null;   // 排行模拟结果缓存（会话内）
        this._rankRunning = false;
        this._rankAbort = false;
    }

    start() {
        this._resize();
        if (!this._bound) {
            this._bound = true;
            this._resizeFn = () => this._resize();
            window.addEventListener('resize', this._resizeFn);
            // 部分浏览器旋转时 innerWidth 更新滞后，延迟补一次
            window.addEventListener('orientationchange', () => setTimeout(this._resizeFn, 300));
            // F5：全屏/退出全屏（阻止默认刷新页面）
            window.addEventListener('keydown', (e) => {
                if (e.key === 'F5') {
                    e.preventDefault();
                    if (document.fullscreenElement) document.exitFullscreen();
                    else document.documentElement.requestFullscreen();
                }
            });
            this._bindSelect();
        }
        this._showSelect();
        this._lastTime = performance.now();
        const loop = (t) => {
            this._raf = requestAnimationFrame(loop);
            const dt = Math.min(0.05, (t - this._lastTime) / 1000);
            this._lastTime = t;
            bbAddCoin.call(this, dt); // 小球战争在线也发小宇币
            try {
                this._update(dt);
                this._render();
            } catch (e) {
                // 渲染异常兜底：重置画布状态防 alpha/transform 残留造成残影
                const c = this.ctx;
                if (c) {
                    c.globalAlpha = 1;
                    c.setTransform(1, 0, 0, 1, 0, 0);
                    while (true) { try { c.restore(); } catch (_) { break; } }
                    c.setTransform(1, 0, 0, 1, 0, 0);
                }
                if (!this._rndErrLogged) { this._rndErrLogged = true; console.error('BallBattle render error:', e); }
            }
        };
        this._raf = requestAnimationFrame(loop);
    }

    stop() {
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = null;
        this.balls = [];
        this.floats = [];
        this.particles = [];
        this.bounds = null;
        this.phase = 'select';
        this.teamSel = null;    // {count, idx, teams:[][]} 选队状态，null=普通模式
        this.teamBattle = false; // 本局是否为队伍模式
        this.paddleSel = false;  // 打板模式选球状态
        this.paddleBattle = false; // 本局是否为打板模式
        this.noShrink = false;   // 本局是否不缩圈（打板模式）
    }

    _resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.dpr = dpr;
        const w = window.innerWidth, h = window.innerHeight;
        const ow = this.w || w, oh = this.h || h;
        this.w = w;
        this.h = h;
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';

        // 横竖屏切换：场地边界随画布等比缩放，球钳回场内（否则红墙与画布错位）
        const bd = this.bounds;
        if (bd && ow > 0 && oh > 0) {
            const sx = w / ow, sy = h / oh;
            if (sx !== 1 || sy !== 1) {
                bd.x *= sx; bd.w *= sx;
                bd.y *= sy; bd.h *= sy;
                for (const b of this.balls) {
                    if (b.dead) continue;
                    b.x = Math.min(Math.max(b.x, bd.x + b.r), bd.x + bd.w - b.r);
                    b.y = Math.min(Math.max(b.y, bd.y + b.r), bd.y + bd.h - b.r);
                    b.trail = []; // 拖尾跨尺寸会拉出线，清掉
                }
            }
        }
    }

    // ===== 选球界面 =====
    _bindSelect() {
        document.querySelectorAll('#ballSelectPanel .bb-card[data-type]').forEach(card => {
            card.addEventListener('click', () => this._pick(card.dataset.type));
        });
        // 页码切换（左上 1/2）
        document.querySelectorAll('#ballSelectPanel .bb-page-num').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('#ballSelectPanel .bb-cards').forEach(pg => {
                    pg.style.display = pg.id === 'bbPage' + btn.dataset.p ? '' : 'none';
                });
                document.querySelectorAll('#ballSelectPanel .bb-page-num').forEach(b => b.classList.toggle('active', b === btn));
            });
        });
        document.getElementById('btnStartBattle').addEventListener('click', () => {
            this._dailyPending = null; // 普通开战不带每日挑战标记
            if (this.picks.length >= 2) this._startBattle();
        });
        document.getElementById('btnBattleAgain').addEventListener('click', () => {
            document.getElementById('ballResultPanel').style.display = 'none';
            this._startBattle();
        });
        document.getElementById('btnReselect').addEventListener('click', () => {
            document.getElementById('ballResultPanel').style.display = 'none';
            this._showSelect();
        });
        document.getElementById('btnBallRank').addEventListener('click', () => this._showRank());
        document.getElementById('btnRankSpeed').addEventListener('click', (e) => {
            this.uiSpeed = (this.uiSpeed || 1) % 3 + 1; // 1→2→3→1循环
            e.target.textContent = '速度×' + this.uiSpeed;
        });
        document.getElementById('btnClearStats').addEventListener('click', (e) => {
            localStorage.removeItem(bbStatKey()); // 当前账号所有历史战绩失效
            e.target.textContent = '已消除';
            setTimeout(() => { e.target.textContent = '消除记录'; }, 1200);
            if (document.getElementById('ballRankPanel').style.display !== 'none') this._showRank(); // 面板开着则重算刷新
        });
        document.getElementById('btnCloseRank').addEventListener('click', () => {
            this._rankAbort = true; // 中止未跑完的模拟
            document.getElementById('ballRankPanel').style.display = 'none';
        });
        // 队伍模式
        document.getElementById('btnTeamMode').addEventListener('click', () => {
            const cfg = document.getElementById('bbTeamCfg');
            cfg.style.display = cfg.style.display === 'none' ? 'flex' : 'none';
        });
        document.querySelectorAll('.bb-team-num').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('bbTeamCfg').style.display = 'none';
                this._teamStart(parseInt(btn.dataset.n));
            });
        });
        document.getElementById('btnTeamCancel').addEventListener('click', () => {
            document.getElementById('bbTeamCfg').style.display = 'none';
        });
        document.getElementById('btnTeamConfirm').addEventListener('click', () => {
            if (this.arenaSel) this._arenaConfirm();
            else if (this.paddleSel) this._paddleConfirm();
            else this._teamConfirm();
        });
        document.getElementById('btnDaily').addEventListener('click', () => this._dailyStart());
        // 皮肤商店
        document.getElementById('btnSkinShop').addEventListener('click', () => this._showSkins());
        document.getElementById('btnCloseSkin').addEventListener('click', () => {
            document.getElementById('ballSkinPanel').style.display = 'none';
        });
        document.getElementById('btnArena').addEventListener('click', () => this._arenaStart());
        document.getElementById('btnArenaFight').addEventListener('click', () => this._arenaLaunch());
        document.getElementById('btnArenaBack').addEventListener('click', () => this._arenaIntroBack());
        // 打板模式：选2球，分两个场地各打自己的3块板
        document.getElementById('btnPaddleMode').addEventListener('click', () => this._paddleStart());
    }

    // 队伍模式：确定队伍数后开始依次选球（红队→蓝队→黄队→绿队）
    _teamStart(n) {
        this._dailyPending = null;
        this.arenaSel = null;
        this.arena = null;
        this.teamSel = { count: n, idx: 0, teams: [] };
        this.picks = [];
        this._refreshSelect();
    }

    // 确定当前队伍：收走已选球，切下一队；最后一队确定后直接开战
    _teamConfirm() {
        const ts = this.teamSel;
        if (!ts || this.picks.length < 1) return;
        ts.teams[ts.idx] = this._dailyPending ? this.picks.slice(0, 3) : this.picks.slice(); // 每日挑战最多3球
        ts.idx++;
        this.picks = [];
        if (this._dailyPending && ts.idx === 1) { ts.teams[1] = this._dailyPending.enemies.slice(); ts.idx = 2; } // 敌方固定阵容自动就位
        if (ts.idx >= ts.count) this._startBattle();
        else this._refreshSelect();
    }

    // 每日挑战：按当天日期定种子，敌方固定3球阵容；玩家自选(≤3球)为红队对阵
    _dailyStart() {
        const d = new Date();
        const key = 'bbDaily_' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
        const rnd = bbSeeded(key);
        const pool = Object.keys(BB_TYPES).filter(t => !BB_TYPES[t].minion && document.querySelector('#ballSelectPanel .bb-card[data-type="' + t + '"]'));
        const enemies = [];
        for (let i = 0; i < 3; i++) enemies.push(pool[Math.floor(rnd() * pool.length)]);
        this._dailyPending = { key, enemies };
        this.arenaSel = null;
        this.arena = null;
        this.teamSel = { count: 2, idx: 0, teams: [] };
        this.picks = [];
        this._refreshSelect();
        const st = document.getElementById('bbTeamState');
        st.style.display = 'block';
        st.innerHTML = '<span style="color:#ffd54f;font-weight:bold">每日挑战</span>·敌方: ' +
            enemies.map(t => BB_TYPES[t].name).join('、') + ' — 选你的球(≤3)后点确定开战';
    }

    // 每日挑战结算：写入当日榜(localStorage)，胜者优先，同胜按用时排
    _dailyResult() {
        const win = !!(this.winner && this.winner.team === 0);
        const u = (window.game && window.game.username) || 'guest';
        let arr = [];
        try { arr = JSON.parse(localStorage.getItem(this.daily.key) || '[]'); } catch (e) {}
        arr.push({ u: u, w: win ? 1 : 0, t: Math.round(this.battleTime * 10) / 10 });
        try { localStorage.setItem(this.daily.key, JSON.stringify(arr)); } catch (e) {}
        const bd = document.getElementById('bbDailyBoard');
        if (bd) {
            const sorted = arr.slice().sort((a, b) => b.w - a.w || a.t - b.t);
            bd.innerHTML = '<b style="color:#ffd54f">每日挑战榜</b> 你: ' + (win ? '胜利' : '失败') +
                ' · ' + Math.round(this.battleTime) + 's<br>' +
                sorted.slice(0, 8).map((r, i) => (i + 1) + '. ' + r.u + ' ' + (r.w ? '胜' : '负') + ' ' + r.t + 's').join('<br>');
            bd.style.display = 'block';
        }
        this.daily = null;
    }

    // 打板模式：选2个球，分两个场地，每个球打自己的3块板（本局特性：自己板子血量÷2）
    _paddleStart() {
        this._dailyPending = null;
        this.arenaSel = null;
        this.arena = null;
        this.teamSel = null;
        this.paddleSel = true;
        this.picks = [];
        this._refreshSelect();
    }
    _paddleConfirm() {
        if (this.picks.length !== 2) return;
        this._startBattle();
    }
    // 每块板定义：血量+木质色系（从浅色白桦木、中度橡木、到深色胡桃木），halve=血量球特性
    _makePads(f, halve) {
        const defs = [
            { hp: 100, woodType: 'birch', c: '#a1887f' },   // 第1块：100血 浅色桦木板
            { hp: 800, woodType: 'oak', c: '#8d6e63' },     // 第2块：800血 经典橡木板
            { hp: 2000, woodType: 'walnut', c: '#5d4037' }, // 第3块：2000血 深色胡桃木厚板
        ];
        return defs.map((d, i) => {
            const w = f.w * 0.9, h = 24, hp = halve ? d.hp / 2 : d.hp; // 场宽90%
            return { x: f.x + (f.w - w) / 2, y: f.y + 120 + i * 70, w, h, hp, maxHp: hp, color: d.c, woodType: d.woodType };
        });
    }

    _pick(type) {
        if (this.arenaSel) { this._arenaPick(type); return; } // 擂台赛：先锁擂主，再按顺序选挑战者
        if (!BB_TYPES[type] || BB_TYPES[type].elim) return; // 未开放/已淘汰的球不可选择
        const n = this.picks.filter(t => t === type).length;
        if (n >= 3) {
            this.picks = this.picks.filter(t => t !== type); // 点第4次全部取消（0→1→2→3→0）
        } else {
            this.picks.push(type); // 同种球最多重复选3次，同名球也会互相打
        }
        this._refreshSelect();
    }

    _refreshSelect() {
        document.querySelectorAll('#ballSelectPanel .bb-card[data-type]').forEach(card => {
            const type = card.dataset.type;
            const n = this.picks.filter(t => t === type).length;
            const isArenaKing = !!(this.arenaSel && this.arenaSel.king === type);
            card.classList.toggle('picked', n > 0);
            card.classList.toggle('boss-picked', isArenaKing || (this.arenaSel && this.arenaSel.stage === 'king' && n > 0));
            // 擂台赛：擂主确认后置灰，挑战者卡片显示点击顺序
            if (this.arenaSel) {
                const lockedKing = this.arenaSel.stage === 'challengers' && isArenaKing;
                card.style.opacity = lockedKing ? '0.35' : '';
                card.style.outline = isArenaKing ? '2px solid #ff8a65' : '';
            } else { card.style.opacity = ''; card.style.outline = ''; }
            let badge = card.querySelector('.bb-cnt');
            const order = this.arenaSel && this.arenaSel.stage === 'challengers' ? this.picks.indexOf(type) : -1;
            if (order >= 0 || n > 1) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'bb-cnt';
                    card.appendChild(badge);
                }
                badge.textContent = order >= 0 ? '第' + (order + 1) + '位' : '×' + n;
            } else if (badge) badge.remove();
            // 皮肤外观：方形皮肤 → 卡片球变方、显示皮肤名
            const eq = bbEquipped(card.dataset.type);
            const bl = card.querySelector('.bb-ball');
            if (bl) bl.style.borderRadius = (BB_SKINS[eq] && BB_SKINS[eq].square) ? '6px' : '';
            const nm = card.querySelector('.bb-name');
            if (nm) nm.textContent = (eq && BB_SKINS[eq] ? BB_SKINS[eq].name : BB_TYPES[card.dataset.type].name);
        });
        const cnt = {};
        this.picks.forEach(t => { cnt[t] = (cnt[t] || 0) + 1; });
        const names = Object.keys(cnt).map(t => BB_TYPES[t].name + (cnt[t] > 1 ? '×' + cnt[t] : '')).join('、') || '无';
        const picksEl = document.getElementById('bbPicks');
        const teamState = document.getElementById('bbTeamState');
        const btnStart = document.getElementById('btnStartBattle');
        const btnTeam = document.getElementById('btnTeamMode');
        const btnConfirm = document.getElementById('btnTeamConfirm');
        const btnPaddle = document.getElementById('btnPaddleMode');
        if (this.arenaSel) { // 擂台赛：先锁擂主，再按点击顺序选挑战者
            const a = this.arenaSel;
            const kingName = a.king ? BB_TYPES[a.king].name : '未确定';
            const seq = this.picks.map((t, i) => (i + 1) + '.' + BB_TYPES[t].name).join(' → ');
            teamState.innerHTML = a.stage === 'king'
                ? '<span style="color:#ff8a65;font-weight:bold">擂台赛 · 第一步</span>：先选1个球作为擂主，然后点确定'
                : '<span style="color:#ff8a65;font-weight:bold">擂台赛 · 第二步</span>：按挑战顺序点选其他球（至少1个）<br>' +
                  '<span style="color:#8ab4d8;font-size:0.9em">擂主: ' + kingName + '｜挑战顺序: ' + (seq || '未选择') + '</span>';
            picksEl.textContent = a.stage === 'king'
                ? '擂主: ' + (this.picks[0] ? BB_TYPES[this.picks[0]].name : '未选择')
                : '挑战者(' + this.picks.length + '): ' + (this.picks.map(t => BB_TYPES[t].name).join('、') || '无');
            teamState.style.display = 'block';
            btnStart.style.display = 'none'; btnTeam.style.display = 'none';
            btnPaddle.style.display = 'none'; btnConfirm.style.display = '';
            btnConfirm.textContent = a.stage === 'king' ? '确定' : '开始比赛';
            btnConfirm.disabled = a.stage === 'king' ? this.picks.length !== 1 : this.picks.length < 1;
            return;
        }
        if (this.paddleSel) {
            // 打板模式：选满2球即可开战
            teamState.innerHTML = '<span style="color:#b39ddb;font-weight:bold">打板模式</span>：选2个球，分两个场地，各打自己的3块板' +
                '<br><span style="color:#8ab4d8;font-size:0.9em">板血 100/800/2000；血量球特性：自己板子血量÷2 → 50/400/1000；谁先打完3块板谁赢</span>';
            picksEl.textContent = '已选(' + this.picks.length + '/2): ' + names;
            teamState.style.display = 'block';
            btnStart.style.display = 'none';
            btnTeam.style.display = 'none';
            btnPaddle.style.display = 'none';
            btnConfirm.style.display = '';
            btnConfirm.textContent = '开始打板';
            btnConfirm.disabled = this.picks.length !== 2;
        } else if (!this.teamSel) {
            // 普通模式
            picksEl.textContent = '已选(' + this.picks.length + '): ' + names;
            teamState.style.display = 'none';
            btnStart.style.display = '';
            btnTeam.style.display = '';
            btnPaddle.style.display = '';
            btnConfirm.style.display = 'none';
            btnStart.disabled = this.picks.length < 2;
        } else {
            // 队伍模式：显示当前队伍与已确定队伍
            const ts = this.teamSel, team = BB_TEAMS[ts.idx];
            let html = '<span style="color:' + team.color + '">' + team.name + '</span>（第 ' +
                (ts.idx + 1) + ' / ' + ts.count + ' 队）选球';
            if (this._dailyPending) { // 每日挑战：常驻显示敌方固定阵容
                html = '<span style="color:#ffd54f;font-weight:bold">每日挑战</span>·敌方: ' +
                    this._dailyPending.enemies.map(t => BB_TYPES[t].name).join('、') + '<br>' + html;
            }
            for (let i = 0; i < ts.teams.length; i++) {
                const tn = ts.teams[i].map(t => BB_TYPES[t].name).join('+') || '空';
                html += '<br><span style="color:' + BB_TEAMS[i].color + '">' + BB_TEAMS[i].name + '</span>: ' + tn;
            }
            teamState.innerHTML = html;
            teamState.style.display = 'block';
            picksEl.textContent = team.name + '已选(' + this.picks.length + '): ' + names;
            btnStart.style.display = 'none';
            btnTeam.style.display = 'none';
            btnPaddle.style.display = 'none';
            btnConfirm.style.display = '';
            btnConfirm.disabled = this.picks.length < 1;
            btnConfirm.textContent = '确定' + team.name;
        }
    }

    _showSelect() {
        this.phase = 'select';
        this.picks = [];
        this.teamSel = null;
        this.teamBattle = false;
        this.paddleSel = false;
        this.paddleBattle = false;
        this.noShrink = false;
        this.balls = [];
        this.pills = [];
        this.mines = [];          // 地雷球布下的雷
        this.shots = [];
        this.swords = [];
        this.uni = [];            // 宇宙球天体召唤物
        this.waves = [];          // 大招伤害光波
        this._boomSrc = null;     // 炸弹引爆者（团灭时判它赢）
        this.timeMul = 1;
        this.synergyMsg = '';
        this.winner = null;
        this.daily = null;
        this._dailyPending = null;
        this.arenaSel = null;       // 擂台赛选球状态
        this.arena = null;          // 擂台赛逐场挑战状态
        const ai = document.getElementById('ballArenaIntro');
        if (ai) ai.style.display = 'none';
        this.edgeCurse = null;      // 黑色白板边界侵蚀
        this._statsDone = false;
        this.killBanner = null;
        this._showStats();
        document.getElementById('ballResultPanel').style.display = 'none';
        document.getElementById('bbTeamCfg').style.display = 'none';
        document.getElementById('ballSelectPanel').style.display = 'flex';
        this._refreshSelect();
    }

    // ===== 开始对战 =====
    _startBattle() {
        document.getElementById('ballSelectPanel').style.display = 'none';
        const W = this.w || window.innerWidth, H = this.h || window.innerHeight;
        // 队伍模式下按队伍造球（队友互弹但不互伤），否则每个选球各为一队
        this.teamBattle = !!this.teamSel;
        this.paddleBattle = !!this.paddleSel;
        this.daily = this._dailyPending || null; this._dailyPending = null; // 每日挑战标记仅本局有效
        this.noShrink = this.paddleBattle; // 打板模式不缩圈
        const ai = document.getElementById('ballArenaIntro');
        if (ai) ai.style.display = 'none';
        const list = [];
        if (this.arena) { // 擂台赛：每场都是独立1v1
            const a = this.arena;
            a.round = 1;
            a.result = null;
            a.roundResult = null;
            a.roundWait = 0;
            a.defeater = null;
            a.statBalls = [];
            list.push({ type: a.kingType, team: 0 });
            if (a.challengers[0]) list.push({ type: a.challengers[0], team: 1 });
        } else if (this.teamBattle) {
            this.teamSel.teams.forEach((picks, ti) => picks.forEach(t => list.push({ type: t, team: ti })));
        } else {
            this.picks.forEach((t, i) => list.push({ type: t, team: i }));
        }
        this.balls = list.map((b, i) => {
            let x = W * (i + 1) / (list.length + 1);
            let y = H * 0.5 + (Math.random() * 200 - 100);
            const ball = this._makeBall(b.type, x, y);
            ball.team = b.team;
            return ball;
        });
        if (this.arena) {
            this.arena.king = this.balls[0] || null;
            this.arena.current = this.balls[1] || null;
            this.arena.statBalls = this.balls.slice();
        }
        if (this.paddleBattle) { // 打板模式：左右分场，每球绑定自己场地+3块板
            const fw = W / 2;
            this.balls.forEach((ball, i) => {
                ball.field = { x: i * fw, y: 0, w: fw, h: H };
                ball.pads = this._makePads(ball.field);
                ball.padHitCd = 0;
                ball.x = ball.field.x + ball.field.w / 2;
                ball.y = ball.field.y + ball.field.h * 0.62;
                const ang = -Math.PI / 2 + (Math.random() - 0.5) * 0.8; // 朝上发射
                const sp = Math.hypot(ball.vx, ball.vy) || BB_SPEED;
                ball.vx = Math.cos(ang) * sp;
                ball.vy = Math.sin(ang) * sp;
            });
        }
        this.floats = [];
        this.particles = [];
        this.pills = [];
        this.mines = [];
        this.shots = [];
        this.swords = [];
        this.uni = [];            // 宇宙球天体召唤物
        this.waves = [];          // 大招伤害光波
        this._boomSrc = null;     // 炸弹引爆者（团灭时判它赢）
        this.winner = null;
        this._overTimer = 0;
        this._statsDone = false;
        this.bounds = { x: 0, y: 0, w: W, h: H }; // 场地边界（会缩小）
        this.timeMul = this.balls.some(b => b.pillEvery) ? 1.8 : 1; // 耐力在场：整局1.8倍速
        this._applySynergy();
        this.battleTime = 0;
        // 开局倒计时冻结 4.3s：3/2/1各1s + 开始!1.3s（缩圈/计时均不动）
        this.phase = 'countdown';
        this.countdownT = 4.3;
    }

    // ===== 羁绊：同队凑齐羁绊组成员 → 该队全体+5攻且所有伤害+5%（滚动球滚动伤害也+5，超伤额外judgeDps+5），生成上场横幅 =====
    _applySynergy() {
        this.synergyMsg = '';
        const byTeam = {};
        for (const b of this.balls) (byTeam[b.team] = byTeam[b.team] || []).push(b);
        const msgs = [];
        for (const bs of Object.values(byTeam)) {
            for (const syn of BB_SYNERGY) {
                if (syn.types.every(t => bs.some(b => (b.srcType || b.type) === t))) {
                    const add = syn.atk || 5;
                    for (const b of bs) { b.atk += add; if (b.judgeWait) b.judgeDps += add; if (b.rollEvery) b.rollDmg += add; b.synMul += 0.05; b.synOn = true; }
                    msgs.push(syn.name + '上场! 攻+' + add + '·伤害+5%!');
                }
            }
        }
        if (msgs.length) this.synergyMsg = msgs.join('  ');
    }

    // 造球（对战/模拟共用）
    _makeBall(type, x, y) {
        const t = BB_TYPES[type];
        const ang = Math.random() * Math.PI * 2;
        const b = {
            type, srcType: type, name: t.name, color: t.color, glow: t.glow,
            x, y,
            vx: Math.cos(ang) * BB_SPEED * t.spd,
            vy: Math.sin(ang) * BB_SPEED * t.spd,
            r: BB_R, hp: t.hp, maxHp: t.maxhp || t.hp, atk: t.atk,
            shield: t.shield || 0,            // 免伤护盾次数（无敌球开局3层，挡伤害+挡效果）
            shieldBase: t.shield || 0,        // 护盾基准值（审判结束恢复用）
            shieldBonus: t.shieldBonus || 0,  // 盾全碎后攻击力加成（一次性）
            shieldBreakAtk: t.shieldBreakAtk || 0, // 每碎一个盾自身伤害+N
            shieldBroken: false,              // 破盾加成是否已触发
            blade: t.blade || 0,              // 名刀次数：致命一击免疫并+1盾+5攻
            showHp: !!t.showHp,     // 血条上显示剩余血量数字
            spdMul: 1,                        // 速度倍率（随时间成长）
            spdGrow: t.spdGrow || 0,          // 每秒速度倍率增量
            blkGrow: t.blkGrow || 0,          // 黑速度球：每秒累积速度
            blkDmgMul: t.blkDmgMul || 0,      // 黑速度球：攻击时累积速度换算伤害的倍数
            blkAdd: 0,                        // 黑速度球：当前累积的额外速度
            spdBase: t.spd,                   // 基础速度倍率（黑速度球清零用）
            kills: 0, synOn: false,           // 击杀数 / 羁绊激活标记
            spdMax: t.spdMax || 1,            // 速度倍率上限
            wallEvery: t.wallEvery || 0,      // 每撞N次墙触发成长（速度球）
            wallGrow: t.wallGrow || 0,        // 撞墙成长+攻
            wallSpd: t.wallSpd || 0,          // 撞墙成长+速（速度倍率）
            wallHp: t.wallHp || 0,            // 撞墙成长回血（可超上限至overMax金色血条）
            wallHits: 0,                      // 已撞墙次数
            wallBonus: 3,                     // 升级后撞墙需求增量（每次翻倍：+3→+6→+12…）
            spd: t.spd,                       // 速度倍率（可成长，初始=类型定义）
            atkRange: t.atkRange || 1,        // 攻击范围倍率
            blinkEvery: t.blinkEvery || 0,    // 定时闪现间隔秒数（0=不定时闪现）
            blinkCost: t.blinkCost || 0,      // 每次定时闪现消耗血量
            blinkCd: t.blinkEvery || 0,       // 距下次定时闪现剩余秒数
            dodgeHp: t.dodgeHp || 0,        // 血量低于此值才触发闪避（0=不闪避）
            dodgeEvery: t.dodgeEvery || 0,  // 闪避节奏：每N次受击躲1次
            dodgeCostMin: t.dodgeCostMin || 0, // 闪避耗血下限（0=免费）
            dodgeCostMax: t.dodgeCostMax || 0, // 闪避耗血上限（区间内随机）
            reflHp: t.reflHp || 0,            // 血量低于该值时闪避耗血转为反伤+小伤也闪（0=不反）
            dodgeMinDmg: t.dodgeMinDmg || 0,  // 受击伤害低于此值不闪现（低血除外）
            reflMul: t.reflMul || 1,          // 低血反伤倍率
            reflCh: t.reflCh || 0,            // 低血反伤概率（闪现球<400血20%）
            shotEvery: t.shotEvery || 0,      // 牙签发射间隔秒数（启动球，0=不发射）
            shotDmg: t.shotDmg || 0,          // 牙签伤害
            shotSpd: t.shotSpd || 0,          // 弹速倍率（远程球5×BB_SPEED；0=默认牙签速260）
            shotCd: t.shotEvery || 0,         // 距下次发射剩余秒数
            summonEvery: t.summonEvery || 0,  // 召唤间隔秒数（召唤球6s）
            summonT: t.summonEvery || 0,      // 距下次召唤剩余秒数
            waveEvery: t.waveEvery || 0,      // 宇宙波澜间隔秒数（宇宙球10s）
            waveT: t.waveEvery || 0,          // 距下次波澜剩余秒数
            waveSec: t.waveSec || 0,          // 波澜持续秒数（1.5）
            waveOn: 0,                        // 波澜进行中剩余秒数
            waveDmg: t.waveDmg || 0,          // 波澜每跳伤害
            waveIv: t.waveIv || 0.5,          // 波澜跳伤间隔（0.5s）
            waveTick: 0,                      // 波澜跳伤计时
            waveLchSec: t.waveLchSec || 0,    // 波澜附赠嗜血秒数（4）
            mineEvery: t.mineEvery || 0,      // 布雷间隔秒数（地雷球4s）
            mineT: t.mineEvery || 0,          // 距下次布雷剩余秒数
            mineDmg: t.mineDmg || 0,          // 地雷伤害（80）
            mineR: t.mineR || 0,              // 地雷半径（55，踩入即炸）
            mineMax: t.mineMax || 3,          // 大雷场上限
            smineDmg: t.smineDmg || 0,        // 小雷伤害（40）
            smineR: t.smineR || 0,            // 小雷半径（24）
            smineMax: t.smineMax || 0,        // 小雷场上限（2）
            snipeEvery: t.snipeEvery || 0,    // 狙击枪：射击准备间隔（3s）
            snipeAim: t.snipeAim || 0,        // 狙击枪：瞄准时长（2.3s）
            snipeDmg: t.snipeDmg || 0,        // 狙击枪：弹伤害（80）
            snipeSpd: t.snipeSpd || 0,        // 狙击枪：弹速倍率（8.5）
            snipeT: t.snipeEvery || 0,        // 距下次瞄准剩余秒数
            snipeWind: 0,                     // 瞄准剩余秒数（>0=瞄准中）
            snipeTgt: null,                   // 瞄准锁定的目标
            arrowEvery: t.arrowEvery || 0,    // 弓箭球：射箭间隔秒数（1.8s）
            arrowDmg: t.arrowDmg || 0,        // 弓箭球：箭伤害（20）
            arrowSpd: t.arrowSpd || 0,        // 弓箭球：箭速倍率（6.8×BB_SPEED）
            arrowT: t.arrowEvery || 0,        // 距下次射箭剩余秒数
            arrowN: 0,                        // 连续命中箭数（漏箭清零，满arrowBurstN开大；大招箭不计数）
            arrowBurstN: t.arrowBurstN || 0,  // 触发大招所需连续命中箭数（5）
            arrowBurstEvery: t.arrowBurstEvery || 0, // 大招射箭间隔（0.1s）
            arrowBurstSec: t.arrowBurstSec || 0,     // 大招持续秒数（0.5s）
            arrowBurstDmg: t.arrowBurstDmg || 0,     // 大招箭伤害（10）
            arrowBurstSpd: t.arrowBurstSpd || 0,     // 大招箭速倍率（9×BB_SPEED）
            arrowBurst: 0,                    // 大招剩余秒数（>0=大招连射中）
            arrowBurstCd: 0,                  // 大招内距下次射箭剩余秒数
            axeDmg: t.axeDmg || 0,            // 斧头球：砍击/飞斧伤害（80）
            axeReach: t.axeReach || 0,        // 左半圆攻击距离倍率（1.9×r）
            axeCdMax: t.axeCd || 0,           // 砍击冷却（1.3s）
            axeCd: 0,                         // 距下次可砍剩余秒数
            axeSwing: 0,                      // 挥砍动画剩余（0.22s）
            axeSwung: true,                   // 本次挥砍是否已结算
            axeLowHp: t.axeLowHp || 0,        // 低血阈值（280）
            axeThrowSpd: t.axeThrowSpd || 0,  // 飞斧速度倍率（1.4×BB_SPEED）
            axeWaitMax: t.axeWait || 0,       // 飞斧回收后等待秒数（0.5s）
            axeWaitT: 0,                      // 等待再扔计时
            axeState: 'idle',                 // idle|fly|return|wait（低血飞斧状态机）
            axeX: 0, axeY: 0, axeSpin: 0,     // 飞斧位置/自旋角
            ranged: !!t.ranged,               // 远程类标记
            boomSec: t.boomSec || 0,          // 引爆倒计时秒数（炸弹球30s）
            boomT: t.boomSec || 0,            // 距引爆剩余秒数
            boomed: false,                    // 是否已引爆
            capDmg: t.capDmg || 0,            // 单次受伤上限（不存在球=1）
            nonexistSec: t.nonexistSec || 0,  // 不存在buff：死后复活无敌秒数
            nonexistHeal: t.nonexistHeal || 0, // 不存在复活血量
            markHits: t.markHits || 0,        // 标记的解除受击数
            markMul: t.markMul || 0,          // 被标记球受伤倍率
            ghostT: 0,                        // 复活无敌剩余秒数
            nonexistUsed: false,              // 不存在复活是否已用（仅一次）
            revHp: t.revHp || 0,              // 复活体血量/上限（复活球500）
            revAtk: t.revAtk || 0,            // 复活后攻击加成（+10）
            tgtHp: t.tgtHp || 0,              // 靶子血量（250）
            tgtSec: t.tgtSec || 0,            // 靶子存活窗口秒数（18.5）
            tgtRed: t.tgtRed || 0,            // 靶子阶段减伤（30%）
            revPhase: 0,                      // 复活球阶段：0初始/1复活体/2靶子
            revT: 0,                          // 靶子剩余秒数
            fx: t.fx || 0,                    // 效果球标记
            fxStunCh: t.fxStunCh || 0, fxStunSec: t.fxStunSec || 0, // 命中50%眩晕
            fxPsnCh: t.fxPsnCh || 0, fxPsnSec: t.fxPsnSec || 0,     // 命中35%中毒
            fxPsnDmg: t.fxPsnDmg || 0, fxPsnIv: t.fxPsnIv || 0,
            fxLchCh: t.fxLchCh || 0, fxLchSec: t.fxLchSec || 0,     // 命中20%嗜血
            fxLchDmg: t.fxLchDmg || 0, fxLchIv: t.fxLchIv || 0,
            fxMarkCh: t.fxMarkCh || 0, fxMarkHits: t.fxMarkHits || 0, fxMarkMul: t.fxMarkMul || 0, // 命中4%不存在标记
            fxKillCh: t.fxKillCh || 0, fxKillSec: t.fxKillSec || 0, // 命中1%秒杀
            fxKillDmg: t.fxKillDmg || 0, fxKillIv: t.fxKillIv || 0,
            psnT: 0, psnTick: 0, psnIv: 0, psnDmg: 0, psnSrc: null, // 身上debuff：中毒
            lchT: 0, lchTick: 0, lchIv: 0, lchDmg: 0, lchSrc: null, // 身上debuff：嗜血
            killT: 0, killTick: 0, killIv: 0, killDmg: 0, killSrc: null, // 身上debuff：秒杀
            noExist: 0,                       // 被标记为不存在：剩余解除受击数
            noExistMul: 0,                    // 标记期间受伤倍率
            lastHitBy: null,                  // 最后对自己造成伤害的球（标记击杀者用）
            chargeHit: t.chargeHit || 0,      // 弹道每次伤害充能比例（牙签+5%）
            chargeMelee: t.chargeMelee || 0,  // 近战每次伤害充能比例（+15%）
            charge: 0,                        // 启动条0~1
            superOn: false,                   // 超级形态中
            superT: 0,                        // 超态剩余秒数
            superAtk: t.superAtk || 0,        // 超态近战伤害
            superSec: t.superSec || 0,        // 超态基础时长
            superExtend: t.superExtend || 0,  // 超态中每次攻击续时秒数
            bombDmg: t.bombDmg || 0,          // 超态炸弹爆炸伤害
            bombRange: t.bombRange || 0,      // 爆炸半径=球直径×该值
            superColor: t.superColor || '',   // 超态颜色
            superGlow: t.superGlow || '',     // 超态光晕
            superShotEvery: t.superShotEvery || 0, // 超态炸弹发射间隔（0=同牙签）
            superReduce: t.superReduce || 0,       // 超态减伤比例
            baseColor: t.color,               // 常态颜色/光晕（超态结束还原）
            baseGlow: t.glow,
            hitCount: 0,                    // 已受击次数（闪避计数）
            atkCdMax: t.atkCdMax || 0,        // 攻击冷却秒数（0=无冷却，受击间隔即可）
            atkCd: 0,                         // 距下次可攻击剩余秒数
            missCh: t.missCh || 0,            // 攻击刺歪概率（骑士30%：自损且本次无伤害）
            missCost: t.missCost || 0,        // 刺歪自损血量
            lance: !!t.lance,                 // 是否持有长枪（攻击时突刺特效）
            lanceFx: 0, lanceAng: 0,          // 突刺特效剩余时间/方向
            knockback: (t.knockback || 0) * BB_SPEED, // 命中时对敌人的击退速度 px/s
            stunSec: t.stunSec || 0,          // 命中时施加的眩晕秒数（0=无眩晕）
            stun: 0,                          // 自身剩余眩晕秒数（>0 不能移动/攻击，受伤+40%）
            kbT: 0,                           // 击退位移剩余秒数（眩晕中仍可被推走）
            stunImm: 0,                       // 眩晕免疫剩余秒数（眩晕结束后3.3s内不再被晕）
            judgeWait: t.judgeWait || 0,      // 审判冷却秒数（0=非审判球）
            judgeSec: t.judgeSec || 0,        // 审判持续秒数
            judgeDps: t.judgeDps || 0,          // 审判期对锁定敌人的每秒真实伤害（6.5s共950）
            judgeT: t.judgeWait || 0,         // 距下次审判剩余秒数
            judgeOn: false,                   // 当前是否在审判环节中
            judgeTarget: null,                // 审判锁定的单个敌人（启动时锁最近者）
            judgeTick: 0,                       // 审判伤害0.1s一跳的计时
            judgeEndHeal: t.judgeEndHeal || 0,  // 审判结束后回血量（超伤球+100）
            revive: t.revive || 0,              // 免死复活次数（超伤球1次：瞬移+回血）
            reviveHeal: t.reviveHeal || 0,      // 复活后血量
            pillEvery: t.pillEvery || 0,      // 药丸雨间隔秒数（耐力球）
            pillT: t.pillEvery || 0,          // 距下次药丸雨剩余秒数
            pillHeal: t.pillHeal || 0,        // 每颗药丸回血
            pillN: t.pillN || 2,              // 每次药丸雨颗数
            pillGoldCh: t.pillGoldCh || 0,    // 金色药丸概率（耐力35%）
            pillGoldHeal: t.pillGoldHeal || 0,    // 金丸回血
            pillGoldShield: t.pillGoldShield || 0, // 金丸加盾数
            pillEnemyHeal: t.pillEnemyHeal || 0,   // 敌方吃普通丸回血
            pillEnemyGoldHeal: t.pillEnemyGoldHeal || 0, // 敌方吃金丸回血
            pillStunCh: t.pillStunCh || 0,      // 敌方吃丸眩晕概率
            pillStunSec: t.pillStunSec || 0,    // 敌方吃丸眩晕秒数
            dmgReduce: t.dmgReduce || 0,      // 受到伤害减免比例（耐力球0.05）
            defHp: t.defHp || 0,              // 盾牌球：血量低于该值进入防御态（举盾）
            defReduce: t.defReduce || 0,      // 防御态减伤比例（0.4=40%）
            lowHpRegenHp: t.lowHpRegenHp || 0,// 盾牌球：血量低于该值开始回血
            lowHpRegen: t.lowHpRegen || 0,    // 低血每秒回血量
            thornHp: t.thornHp || 0,          // 盾牌球：血量低于该值时受击反弹伤害
            thornMul: t.thornMul || 0,        // 反弹伤害比例（0.3=30%）
            takeMul: t.takeMul || 1,          // 受到的所有伤害倍率（炸弹1.9，含真伤）
            auraDps: t.auraDps || 0,          // 光环每跳基础伤害（耐力球）
            auraDmg: t.auraDps || 0,          // 光环当前每跳伤害（每3跳+0.5成长）
            auraSelfRed: t.auraSelfRed || 0,  // 光环自伤减伤比例（>0时光环也打自己）
            growAtk: t.growAtk || 0,          // 每次出手永久+攻（伤害球）
            critEvery: t.critEvery || 0,      // 每第N次出手暴击不保留（伤害球）
            critMul: t.critMul || 2,          // 暴击伤害倍率
            critCh: t.critCh || 0,            // 每次攻击暴击概率（暴击球，暴击后成长）
            critGrowAtk: t.critGrowAtk || 0,  // 暴击后基础伤害+X（暴击球）
            critGrowCh: t.critGrowCh || 0,    // 暴击后暴击率+X（暴击球）
            atkCount: 0,                      // 出手计数（伤害球暴击判定）
            hitStunCh: t.hitStunCh || 0,      // 攻击命中眩晕概率（攻击球20%）
            hitStunSec: t.hitStunSec || 0,    // 概率眩晕的秒数
            calmSec: t.calmSec || 0,          // 每N秒没被攻击到触发成长（攻击球3s）
            calmAtk: t.calmAtk || 0,          // 成长攻击力
            calmT: 0,                         // 未被攻击计时（被攻击掉血清零）
            comboMax: t.comboMax || 0,        // 连续攻击N次触发天降巨剑（攻击球5次）
            comboN: 0,                        // 当前连击数（被攻击掉血清零）
            swordDmg: t.swordDmg || 0,        // 巨剑伤害
            swordStun: t.swordStun || 0,      // 巨剑眩晕秒数
            pctHpDmg: t.pctHpDmg || 0,        // 每击额外加对方当前血量比例伤害（百分比球）
            pctHpTh: t.pctHpTh || 0,          // 对方血量低于此比例时换用pctHpDmg2
            pctHpDmg2: t.pctHpDmg2 || 0,      // 残血档比例伤害
            healEvery: t.healEvery || 0,      // 自回血间隔秒数（治疗球2s）
            healAmt: t.healAmt || 0,          // 每次回血量
            overMax: t.overMax || 0,          // 可超血量上限的额度（治疗球200，超出为金色血条）
            healT: 0,                         // 距下次回血计时
            rollEvery: t.rollEvery || 0,      // 滚动球：每隔N秒向对方滚动一次
            rollCd: t.rollEvery || 0,         // 距下次滚动剩余秒数（停下后重计）
            rollDmg: t.rollDmg || 0,          // 滚动初始伤害
            rollDecay: t.rollDecay || 0,      // 每滚动0.1s衰减的伤害
            rollSpd: t.rollSpd || 0,          // 滚动速度倍率
            rolling: false,                   // 滚动中
            rollT: 0,                         // 本次已滚动秒数（伤害衰减用）
            rollEnd: false,                   // 本帧撞球待结束标记
            rollReduce: t.rollReduce || 0,    // 滚动中减伤比例
            rollReduceSec: t.rollReduceSec || 0, // 滚动停止后减伤续秒数
            rollReduceT: 0,                   // 减伤剩余秒数（滚动中持续刷新）
            rollStunCh: t.rollStunCh || 0,    // 滚动结束自晕概率
            rollStunSec: t.rollStunSec || 0,  // 自晕秒数
            rollWallCost: t.rollWallCost || 0,// 滚动扑墙自损血量
            rollWindupSec: t.rollWindupSec || 0, // 蓄力秒数（不动+颤动）
            rollWindup: 0,                    // 蓄力剩余秒数
            rollDur: t.rollDur || 0,          // 滚动最长时间
            rollSpdDecay: t.rollSpdDecay || 0,// 每0.2s衰减的速度倍率
            fragileSec: t.fragileSec || 0,      // 易碎球：受伤触发易碎buff秒数
            fragileT: 0,                        // 易碎buff剩余秒数
            fragileRed: t.fragileRed || 0,      // 易碎期免伤修正（-0.2=受伤+20%）
            fragileAtkMul: t.fragileAtkMul || 0,// 易碎期攻击力+百分比（1.25=+125%）
            fragileAuraHp: t.fragileAuraHp || 0,// 光环：低于该血量的敌方免伤-20%
            fragileAuraRed: t.fragileAuraRed || 0,
            auraT: 1,                         // 距下次光环跳剩余秒数（1s一跳）
            auraHits: 0,                      // 光环已跳次数
            auraGrowEvery: t.auraGrowEvery || 0,// 光环增伤间隔秒数（耐力球3.5s）
            auraGrowAmt: t.auraGrowAmt || 0,    // 光环每次增伤量
            auraGrowT: t.auraGrowEvery || 0,    // 距下次光环增伤剩余秒数
            dizzy: 0, dizzyStar: [],          // 遗留字段（当前无来源，保留避免NaN/崩溃）
            dead: false,
            team: 0,                // 所属队伍（队伍模式用）
            synMul: 1,                      // 羁绊额外伤害倍率（触发羁绊+0.05）
            melee: !!t.melee,                 // 近战类标记（随机游走）
            seekWander: !!t.seekWander,         // 太刀：游走转向偏向最近敌人
            bladeDmg: t.bladeDmg || 0,        // 太刀球：环绕刀伤害（0=无刀）
            bladeA: Math.random() * Math.PI * 2, // 环绕刀当前角度
            bladeDir: 1,                      // 环绕刀旋转方向（命中后反转）
            bladeHitT: 0,                     // 作为受击方：被刀命中后的结算冷却
            hitCd: 0, flash: 0, trail: [],
            ultType: t.ult ? type : null,     // 大招类型（能量满100自动释放）
            energy: 0,                        // 大招能量0~100
            ultEnT: 0,                        // 存活充能计时（每2s+8）
            ultSpeed: 0,                      // 速度球大招剩余秒数（期间无敌定身）
            ultTgt: null,                     // 速度球大招锁定目标
            ultN: 0, ultTick: 0,              // 大招剩余攻击次数/攻击间隔计时
            ultForm: 0,                       // 白板变身白色白板剩余秒数
            ultShotT: 0,                      // 白色白板扔小球计时
            ultSave: null,                    // 变身前属性快照
            throwEvery: t.throwEvery || 0,    // 白色白板被动：扔小球间隔秒数
            throwT: 0,                        // 距下次扔小球秒数
            ultSpdMul: 1,                     // 黑速度大招速度倍率
            ultSpdT: 0,                       // 黑速度大招提速剩余秒数
            wallInvSec: t.wallInvSec || 0,    // 黑色白板：碰墙减伤持续秒数
            wallInvT: 0,                      // 碰墙减伤剩余秒数
            iconDark: !!t.iconDark,           // 浅色球体用深色图标(与卡片一致)
            wanderT: Math.random() * 1.2,     // 近战随机游走：距下次转向秒数（初始错开）
        };
        // 皮肤：白板装备皮肤 → 外观/大招替换，战绩按变体单独统计
        const _eqSkin = bbEquipped(type);
        if (type === 'plain' && _eqSkin === 'plain_square') {
            b.square = true; b.statKey = 'plain_square'; b.iconDark = true;
            b.name = '方形白板'; b.color = '#ffffff'; b.glow = '#ffffff';
        } else if (type === 'dmg' && _eqSkin === 'plain_dragon') {
            b.dragon = true; b.statKey = 'plain_dragon'; b.iconDark = true;
            b.name = '龙王'; b.color = '#ff8f00'; b.glow = '#ffd54f';
        } else if (type === 'speed' && _eqSkin === 'speed_swift') {
            b.swift = true; b.statKey = 'speed_swift';
            b.name = '迅速'; b.color = '#00bcd4'; b.glow = '#84ffff';
        }
        return b;
    }

    // ===== 强度模拟：无头运行一场对战，返回胜者type或null =====
    _simulate(ta, tb) {
        const sim = Object.create(BallBattleGame.prototype);
        sim.canvas = { width: 800, height: 600 };
        sim.picks = [ta, tb];
        sim.floats = [];
        sim.particles = [];
        sim.pills = [];
        sim.mines = [];
        sim.shots = [];
        sim.balls = [this._makeBall(ta, 200, 300), this._makeBall(tb, 600, 300)];
        sim.balls[0].team = 0; sim.balls[1].team = 1; // 各为一队，否则瞬间判负
        sim.bounds = { x: 0, y: 0, w: 800, h: 600 };
        sim.timeMul = sim.balls.some(b => b.pillEvery) ? 1.8 : 1;
        sim.uiSpeed = this.uiSpeed || 1; // 排行面板倍速同样作用于模拟
        sim.battleTime = 0;
        sim.phase = 'battle';
        sim.winner = null;
        sim._overTimer = 0;
        sim.isSim = true;
        // 模拟不需要特效：跳过飘字/火花/爆炸的数组开销
        sim._float = () => {};
        sim._sparks = () => {};
        sim._explode = () => {};
        let steps = 0;
        while (sim.phase === 'battle' && steps < 5400) { sim._update(1 / 30); steps++; } // 30fps步进，最多180秒
        return sim.winner ? (sim.winner.srcType || sim.winner.type) : null;
    }

    // ===== 队伍强度模拟：teamA/teamB为type数组，返回胜者队伍下标0/1或null =====
    _simulateTeams(teamA, teamB) {
        const sim = Object.create(BallBattleGame.prototype);
        sim.canvas = { width: 800, height: 600 };
        sim.picks = teamA.concat(teamB);
        sim.floats = [];
        sim.particles = [];
        sim.pills = [];
        sim.mines = [];
        sim.shots = [];
        sim.balls = [];
        teamA.forEach((t, i) => {
            const b = this._makeBall(t, 200, 180 + i * 240);
            b.team = 0; sim.balls.push(b);
        });
        teamB.forEach((t, i) => {
            const b = this._makeBall(t, 600, 180 + i * 240);
            b.team = 1; sim.balls.push(b);
        });
        sim.bounds = { x: 0, y: 0, w: 800, h: 600 };
        sim.timeMul = sim.balls.some(b => b.pillEvery) ? 1.8 : 1;
        sim.uiSpeed = this.uiSpeed || 1; // 排行面板倍速同样作用于模拟
        sim.battleTime = 0;
        sim.phase = 'battle';
        sim.winner = null;
        sim._overTimer = 0;
        sim.isSim = true;
        sim._float = () => {};
        sim._sparks = () => {};
        sim._explode = () => {};
        sim._applySynergy(); // 队伍模式才可能有羁绊
        let steps = 0;
        while (sim.phase === 'battle' && steps < 5400) { sim._update(1 / 30); steps++; }
        return sim.winner ? sim.winner.team : null;
    }

    // ===== 强度排行：两两循环模拟，按胜率排名（梯度+对位明细+会话缓存）=====
    _showRank() {
        const panel = document.getElementById('ballRankPanel');
        const list = document.getElementById('bbRankList');
        const prog = document.getElementById('bbRankProgress');
        const progFill = document.getElementById('bbRankProgressFill');
        const progText = document.getElementById('bbRankProgressText');
        panel.style.display = 'flex';
        // 只测第1页起的球：页码归属以卡片为准——0~-2页卡片带bb-elim类，全部排除；
        // BB_TYPES的elim标志只标了第0页8个球（不可靠），无卡片的召唤物/测试球自然排除
        const types = Object.keys(BB_TYPES).filter(t => {
            const card = document.querySelector('#ballSelectPanel .bb-card[data-type="' + t + '"]');
            return card && !card.classList.contains('bb-elim') && !card.classList.contains('bb-soon');
        });
        if (types.length === 0) {
            prog.style.display = 'none';
            list.innerHTML = '<div style="color:#8ab4f8;padding:20px">新赛季球种筹备中，暂无排行</div>';
            return;
        }
        // 会话缓存：同一套球种算过一次后直接渲染，重复打开秒开
        const key = types.join(',');
        if (this._rankCache && this._rankCache.key === key) {
            prog.style.display = 'none';
            this._renderRank(this._rankCache);
            return;
        }
        if (this._rankRunning) return; // 防连点重入
        this._rankRunning = true;
        this._rankAbort = false;
        const wins = {}, games = {}, rec = {}; // rec[a][b]=a对b的胜场数
        types.forEach(t => { wins[t] = 0; games[t] = 0; rec[t] = {}; });
        const SIMS = 60; // 每对60场
        const pairs = [];
        for (let i = 0; i < types.length; i++)
            for (let j = i + 1; j < types.length; j++) pairs.push([types[i], types[j]]);
        let pi = 0;
        prog.style.display = 'block';
        progFill.style.width = '0%';
        list.innerHTML = '';
        const runPair = () => {
            if (this._rankAbort) { this._rankRunning = false; return; }
            if (pi >= pairs.length) { // 少于2个球或全部跑完：直接出结果
                this._rankRunning = false;
                prog.style.display = 'none';
                this._rankCache = { key, wins, games, rec, sims: SIMS, total: SIMS * pairs.length };
                this._renderRank(this._rankCache);
                return;
            }
            const [ta, tb] = pairs[pi];
            for (let k = 0; k < SIMS; k++) {
                const w = this._simulate(ta, tb);
                games[ta]++; games[tb]++;
                if (w === ta) { wins[ta]++; rec[ta][tb] = (rec[ta][tb] || 0) + 1; }
                else if (w === tb) { wins[tb]++; rec[tb][ta] = (rec[tb][ta] || 0) + 1; }
            }
            pi++;
            progFill.style.width = Math.round(pi / pairs.length * 100) + '%';
            progText.textContent = '模拟计算中… ' + pi + ' / ' + pairs.length + ' 组对决';
            if (pi < pairs.length) { setTimeout(runPair, 0); return; } // 分片执行，界面不卡死
            this._rankRunning = false;
            prog.style.display = 'none';
            this._rankCache = { key, wins, games, rec, sims: SIMS, total: SIMS * pairs.length };
            this._renderRank(this._rankCache);
        };
        setTimeout(runPair, 30);
    }

    // 渲染：梯度徽章+胜率条+战绩，点行展开对每个球的对位胜率
    _renderRank(data) {
        const list = document.getElementById('bbRankList');
        const sub = document.getElementById('bbRankSub');
        const types = data.key.split(',');
        const rank = types.map(t => ({ t, rate: data.games[t] ? data.wins[t] / data.games[t] : 0 }))
            .sort((x, y) => y.rate - x.rate);
        const n = rank.length;
        const tierOf = i =>
            i < Math.max(1, Math.ceil(n * 0.2)) ? 'S' :
            i < Math.max(2, Math.ceil(n * 0.4)) ? 'A' :
            i < Math.ceil(n * 0.6) ? 'B' :
            i < Math.ceil(n * 0.8) ? 'C' : 'D';
        const icon = t => '<svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.92)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + BB_TYPES[t].icon + '</svg>';
        sub.textContent = '两两循环模拟 · 每组' + data.sims + '场 · 共' + data.total + '场 · 点击行查看对位';
        list.innerHTML = rank.map((r, i) => {
            const T = BB_TYPES[r.t], tier = tierOf(i);
            const medal = i === 0 ? ' m1' : i === 1 ? ' m2' : i === 2 ? ' m3' : '';
            // 对位明细：按胜率从高到低排，≥50%绿 <50%红
            const vs = types.filter(o => o !== r.t)
                .map(o => ({ o, w: data.rec[r.t][o] || 0 }))
                .sort((x, y) => y.w - x.w);
            const detail = vs.map(v => {
                const rate = v.w / data.sims, O = BB_TYPES[v.o];
                const c = rate >= 0.5 ? '#66bb6a' : '#ef5350';
                return '<div class="bb-rank-vs">' +
                    '<span class="vs-name" style="color:' + O.color + '">' + O.name + '</span>' +
                    '<span class="vs-bar"><i style="width:' + (rate * 100).toFixed(0) + '%;background:' + c + '"></i></span>' +
                    '<span class="vs-rate" style="color:' + c + '">' + (rate * 100).toFixed(1) + '%</span></div>';
            }).join('');
            const barC = r.rate >= 0.5 ? 'linear-gradient(90deg,#66bb6a,#a5d6a7)' : 'linear-gradient(90deg,#ef5350,#ff8a65)';
            return '<div class="bb-rank-row" data-i="' + i + '">' +
                '<span class="bb-rank-no' + medal + '">' + (i + 1) + '</span>' +
                '<span class="bb-rank-ico">' + icon(r.t) + '</span>' +
                '<span class="bb-rank-name" style="color:' + T.color + '">' + T.name +
                    (T.elim ? '<i class="bb-rank-elim">淘汰</i>' : '') + '</span>' +
                '<span class="bb-rank-tier t' + tier + '">' + tier + '</span>' +
                '<span class="bb-rank-bar"><i style="width:' + (r.rate * 100).toFixed(1) + '%;background:' + barC + '"></i></span>' +
                '<span class="bb-rank-wl">' + data.wins[r.t] + 'W / ' + (data.games[r.t] - data.wins[r.t]) + 'L</span>' +
                '<span class="bb-rank-rate">' + (r.rate * 100).toFixed(1) + '%</span></div>' +
                '<div class="bb-rank-detail">' + detail + '</div>';
        }).join('');
        list.querySelectorAll('.bb-rank-row').forEach(row => {
            row.addEventListener('click', () => row.nextElementSibling.classList.toggle('open'));
        });
    }

    _update(dt) {
        const now = performance.now();
        if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
        // 飘字/粒子始终更新
        this.floats = this.floats.filter(f => now - f.born < 1000);
        this.particles = this.particles.filter(p => now - p.born < p.life);
        for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; }

        // 开局倒计时：全场冻结（缩圈/战斗时间不计），归零后才进入battle
        if (this.phase === 'countdown') {
            this.countdownT -= dt;
            if (this.countdownT <= 0) { this.countdownT = 0; this.phase = 'battle'; }
            return;
        }
        // 擂台赛单场结算：Win/Wasted停留一段时间，再进入下一场或总结算
        if (this.phase === 'arenaResult') {
            const a = this.arena;
            if (!a) { this.phase = 'over'; return; }
            a.roundWait -= dt;
            if (a.roundWait <= 0) this._arenaAdvance();
            return;
        }
        if (this.phase !== 'battle') return;
        if (this.slowT > 0) { this.slowT -= dt; dt *= 0.35; } // 击杀慢镜头
        dt *= (this.timeMul || 1) * (this.uiSpeed || 1); // 耐力1.8倍×界面倍速(排行面板按钮)
        if (this.paddleBattle) { // 打板模式：独立循环（分场打板，无球互撞/不缩圈/球不死）
            this.battleTime += dt;
            this._updatePaddle(dt);
            return;
        }
        const bd = this.bounds;

        // 场地缩小：延迟后每边向中心收缩
        this.battleTime += dt;
        if (!this.noShrink && this.battleTime > BB_SHRINK_DELAY) {
            const s = BB_SHRINK_RATE * dt;
            if (bd.w > BB_MIN_W) { bd.x += s; bd.w = Math.max(BB_MIN_W, bd.w - s * 2); }
            if (bd.h > BB_MIN_H) { bd.y += s; bd.h = Math.max(BB_MIN_H, bd.h - s * 2); }
        }

        for (const ball of this.balls) {
            if (ball.dead) continue;
            ball.hitCd = Math.max(0, ball.hitCd - dt);
            ball.flash = Math.max(0, ball.flash - dt * 4);
            ball.atkCd = Math.max(0, ball.atkCd - dt);        // 攻击冷却
            ball.lanceFx = Math.max(0, ball.lanceFx - dt);    // 长枪突刺特效
            ball.dizzy = Math.max(0, ball.dizzy - dt);        // 遗留眩晕字段倒计时
            if (ball.stun > 0) {                          // 眩晕倒计时：归零瞬间进入3.3s免疫
                ball.stun -= dt;
                if (ball.stun <= 0) { ball.stun = 0; ball.stunImm = 3.3; }
            }
            ball.stunImm = Math.max(0, ball.stunImm - dt);    // 眩晕免疫倒计时
            ball.rollReduceT = Math.max(0, ball.rollReduceT - dt); // 滚动减伤倒计时
            ball.fragileT = Math.max(0, ball.fragileT - dt);       // 易碎buff倒计时

            // 效果球debuff跳伤：中毒每0.5s扣血 / 嗜血抽血自回 / 秒杀每0.1s扣1000（均真伤）
            if (ball.psnT > 0) {
                ball.psnT -= dt; ball.psnTick -= dt;
                if (ball.psnTick <= 0) { ball.psnTick += ball.psnIv || 0.5; this._hurt(ball, ball.psnDmg, false, ball.psnSrc, true); }
            }
            if (ball.lchT > 0) {
                ball.lchT -= dt; ball.lchTick -= dt;
                if (ball.lchTick <= 0) {
                    ball.lchTick += ball.lchIv || 0.5;
                    this._hurt(ball, ball.lchDmg, false, ball.lchSrc, true);
                    const src = ball.lchSrc, cap = src && src.maxHp + (src.overMax || 0);
                    if (src && !src.dead && src.hp < cap) {
                        const add = Math.min(ball.lchDmg, cap - src.hp);
                        src.hp += add; src.flash = 1;
                        this._float(src.x, src.y - src.r - 14, '+' + Math.round(add), '#ef9a9a');
                    }
                }
            }
            if (ball.killT > 0) {
                ball.killT -= dt; ball.killTick -= dt;
                if (ball.killTick <= 0) { ball.killTick += ball.killIv || 0.1; this._hurt(ball, ball.killDmg, false, ball.killSrc, true); }
            }

            // 攻击球：每3s没被攻击到 → 攻+5（被攻击掉血即重置计时）
            if (ball.calmSec) {
                ball.calmT += dt;
                if (ball.calmT >= ball.calmSec) {
                    ball.calmT = 0;
                    ball.atk += ball.calmAtk;
                    this._float(ball.x, ball.y - ball.r - 14, '+' + ball.calmAtk + '攻', '#eceff1');
                }
            }

            // 治疗球：每2s自回25血，可超血量上限（超出上限overMax封顶，显示为金色血条）
            if (ball.healEvery) {
                ball.healT += dt;
                while (ball.healT >= ball.healEvery) {
                    ball.healT -= ball.healEvery;
                    const cap = ball.maxHp + ball.overMax;
                    if (ball.hp < cap) {
                        const add = Math.min(ball.healAmt, cap - ball.hp);
                        ball.hp += add;
                        this._float(ball.x, ball.y - ball.r - 14, '+' + Math.round(add), ball.hp > ball.maxHp ? '#ffd54f' : '#a5d6a7');
                    }
                }
            }

            // 盾牌球：血量低于阈值持续回血（每秒lowHpRegen点，不超上限）
            if (ball.lowHpRegen && ball.hp < ball.lowHpRegenHp) {
                ball.hp = Math.min(ball.maxHp, ball.hp + ball.lowHpRegen * dt);
            }

            // 复活球靶子：18.5s没被击破则复活，继承靶子剩余血量（上限500）+60攻
            if (ball.revPhase === 2) {
                ball.revT -= dt;
                if (ball.revT <= 0) {
                    ball.revPhase = 1;
                    ball.maxHp = ball.revHp;
                    ball.hp = Math.max(1, Math.min(ball.hp, ball.maxHp)); // 继承靶子剩余血量
                    ball.atk = BB_TYPES[ball.srcType].atk + ball.revAtk;
                    const ra2 = Math.random() * Math.PI * 2;
                    ball.vx = Math.cos(ra2) * BB_SPEED * ball.spd; ball.vy = Math.sin(ra2) * BB_SPEED * ball.spd;
                    ball.flash = 1;
                    this._float(ball.x, ball.y - ball.r - 14, '复活!', ball.glow);
                    this._sparks(ball.x, ball.y, 12);
                }
            }

            // 黑速度球：每0.5秒累积+0.2速度
            if (ball.blkGrow) {
                ball.blkAdd += ball.blkGrow * dt;
                ball.spd = (ball.spdBase + ball.blkAdd) * (ball.ultSpdMul || 1);
                this._normalize(ball);
            }
            // 速度球：速度逐渐变快（每秒+spdGrow倍率，上限spdMax）
            if (ball.spdGrow && ball.spdMul < ball.spdMax) {
                ball.spdMul = Math.min(ball.spdMax, ball.spdMul + ball.spdGrow * dt);
                this._normalize(ball);
            }

            // ===== 大招系统：能量满100自动释放 =====
            if (ball.ultType) {
                if (ball.ultSpdT > 0) { // 黑速度大招：提速倒计时结束还原
                    ball.ultSpdT -= dt;
                    if (ball.ultSpdT <= 0) { ball.ultSpdMul = 1; ball.spd = ball.spdBase + ball.blkAdd; this._normalize(ball); }
                }
                if (ball.ultForm > 0) { // 白板大招：白色白板变身倒计时
                    ball.ultForm -= dt;
                    ball.ultShotT -= dt;
                    if (ball.ultShotT <= 0) { ball.ultShotT += 1; this._fireUltShot(ball); } // 每1s扔小球
                    if (ball.ultForm <= 0) this._ultFormEnd(ball);
                }
                if (ball.throwEvery) { // 白色白板被动：常驻每1s扔小球(20伤)
                    ball.throwT -= dt;
                    if (ball.throwT <= 0) { ball.throwT += ball.throwEvery; this._fireUltShot(ball); }
                }
                if (ball.ultSpeed > 0) { // 速度球大招：锁敌快速攻击2次(不无敌)
                    ball.ultSpeed -= dt;
                    ball.vx = ball.vy = 0;
                    if (!ball.ultTgt || ball.ultTgt.dead) ball.ultTgt = this._nearestEnemy(ball);
                    if (ball.ultTgt && ball.ultN > 0) {
                        ball.ultTick -= dt;
                        if (ball.ultTick <= 0) {
                            ball.ultTick += 0.2;
                            this._hurt(ball.ultTgt, ball.atk, false, ball);
                            this._sparks(ball.ultTgt.x, ball.ultTgt.y, 8);
                            ball.ultN--;
                        }
                    }
                    if (ball.ultN <= 0 || ball.ultSpeed <= 0) { ball.ultSpeed = 0; this._ultResume(ball); }
                } else if (ball.stun <= 0) {
                    ball.ultEnT += dt;
                    if (ball.ultEnT >= 2) { ball.ultEnT -= 2; ball.energy = Math.min(100, ball.energy + 8); } // 每2s+8 // 存活充能
                    if (ball.energy >= 100 && !ball.ultForm) this._castUlt(ball);
                }
            }

            // 闪现球：到冷却即瞬移至场内随机位置并扣血（不会超出场地边界）
            ball.kbT = Math.max(0, ball.kbT - dt);            // 击退位移窗口倒计时
            ball.bladeHitT = Math.max(0, ball.bladeHitT - dt); // 太刀刀伤结算冷却（受击方）

            if (ball.blinkEvery) {
                ball.blinkCd -= dt;
                if (ball.blinkCd <= 0) {
                    ball.blinkCd = ball.blinkEvery;
                    this._blink(ball);
                }
            }

            // 超伤球：25s等待 → 审判锁定最近1敌（眩晕6.5s+单次900真实伤害）→ 循环
            if (ball.judgeWait) {
                ball.judgeT -= dt;
                if (ball.judgeT <= 0) {
                    if (!ball.judgeOn) {
                        ball.judgeOn = true;
                        ball.judgeT = ball.judgeSec;
                        ball.judgeTick = 0; // 立即结算第一跳
                        // 索敌：审判启动瞬间锁最近的1个敌人，无视护盾与眩晕免疫
                        let best = null, bd2 = Infinity;
                        for (const e of this.balls) {
                            if (e.dead || e.team === ball.team) continue;
                            const d = Math.hypot(e.x - ball.x, e.y - ball.y);
                            if (d < bd2) { bd2 = d; best = e; }
                        }
                        ball.judgeTarget = best;
                        if (best) { best.stun = ball.judgeSec; best.stunImm = 0; }
                        this._float(ball.x, ball.y - ball.r - 30, '审判!', '#ff5252');
                    } else {
                        ball.judgeOn = false;
                        ball.judgeTarget = null;
                        ball.judgeT = ball.judgeWait;
                        ball.shield = ball.shieldBase || ball.shield; // 重新进入等待期并恢复满护盾
                        if (ball.judgeEndHeal) { // 审判结束回血（超伤球+100）
                            ball.hp = Math.min(ball.maxHp, ball.hp + ball.judgeEndHeal);
                            this._float(ball.x, ball.y - ball.r - 14, '+' + ball.judgeEndHeal, '#a5d6a7');
                        }
                    }
                }
                if (ball.judgeOn && ball.stun <= 0) { // 眩晕中无法审判：时间照样流逝但无效果
                    // 目标中途死亡（或未锁到）：改锁当前最近的另1敌，眩晕持续至本轮审判结束
                    if (!ball.judgeTarget || ball.judgeTarget.dead) {
                        let best = null, bd2 = Infinity;
                        for (const e of this.balls) {
                            if (e.dead || e.team === ball.team) continue;
                            const d = Math.hypot(e.x - ball.x, e.y - ball.y);
                            if (d < bd2) { bd2 = d; best = e; }
                        }
                        ball.judgeTarget = best;
                        if (best) { best.stun = ball.judgeT; best.stunImm = 0; }
                    }
                    if (ball.judgeTarget && !ball.judgeTarget.dead) {
                        ball.judgeTick -= dt;
                        if (ball.judgeTick <= 0) { // 审判总伤900均摊每0.1s一跳：可被护盾挡/闪避躲/名刀救
                            ball.judgeTick += 0.1;
                            this._hurt(ball.judgeTarget, ball.judgeDps * 0.1 / ball.judgeSec, false, ball, true);
                        }
                    }
                }
            }

            // 耐力球：每pillEvery秒天降pillN颗药丸（敌我通吃；25%金丸；敌方吃低回血+概率眩晕）；在场时敌方全体持续掉血
            if (ball.pillEvery) {
                ball.pillT -= dt;
                if (ball.pillT <= 0) {
                    ball.pillT += ball.pillEvery;
                    this._dropPills(ball, ball.pillN || 2);
                }
            }
            // 药丸拾取：任何球碰到即吃（己方全效；敌方低回血+概率眩晕）
            if (this.pills && this.pills.length) {
                for (let pi = this.pills.length - 1; pi >= 0; pi--) {
                    const p = this.pills[pi];
                    if (Math.hypot(p.x - ball.x, p.y - ball.y) < ball.r + 9) {
                        this.pills.splice(pi, 1);
                        const enemy = p.team !== ball.team;
                        const heal = enemy ? (p.eHeal || 0) : p.heal;
                        ball.hp = Math.min(ball.maxHp, ball.hp + heal);
                        if (!enemy && p.shield) ball.shield += p.shield; // 金丸附赠护盾（仅己方）
                        if (heal > 0) this._float(ball.x, ball.y - ball.r - 14, '+' + heal + (!enemy && p.shield ? ' +盾' : ''), p.gold ? '#ffd54f' : '#a5d6a7');
                        this._sparks(ball.x, ball.y, 8);
                        if (enemy && p.stunCh && Math.random() < p.stunCh && ball.stun <= 0 && ball.stunImm <= 0) { // 敌方吃丸概率眩晕
                            ball.stun = p.stunSec;
                            this._float(ball.x, ball.y - ball.r - 32, '眩晕!', '#80cbc4');
                        }
                    }
                }
            }
            if (ball.auraDps) { // 每1s敌方全体-auraDmg真伤；每auraGrowEvery秒单跳伤害+auraGrowAmt
                if (ball.auraGrowEvery) {
                    ball.auraGrowT -= dt;
                    if (ball.auraGrowT <= 0) { ball.auraGrowT += ball.auraGrowEvery; ball.auraDmg += ball.auraGrowAmt; }
                }
                ball.auraT -= dt;
                if (ball.auraT <= 0) {
                    ball.auraT += 1;
                    for (const e of this.balls) {
                        if (e.dead) continue;
                        const stunMul = e.stun > 0 ? 1.4 : 1; // 光环吃眩晕增伤（真伤管线内跳过，调用点手动乘）
                        if (e.team !== ball.team) this._hurt(e, ball.auraDmg * stunMul, false, ball, true); // 真伤：可被护盾挡/闪避躲/名刀救
                        else if (e === ball && ball.auraSelfRed) this._hurt(e, ball.auraDmg * (1 - ball.auraSelfRed) * stunMul, false, ball, true); // 光环自伤：按auraSelfRed减伤(耐力球90%)，同样吃眩晕增伤
                    }
                    ball.auraHits++;
                }
            }
            if (ball.ghostT > 0) ball.ghostT -= dt; // 不存在：复活无敌倒计时
            if (ball.wallInvT > 0) ball.wallInvT -= dt; // 黑色白板：碰墙减伤倒计时
            // 召唤球：每6s在身边召唤1只小白板（同队、不互殴、无机制）
            if (ball.summonEvery) {
                ball.summonT -= dt;
                if (ball.summonT <= 0) {
                    ball.summonT += ball.summonEvery;
                    const bd = this.bounds, sa = Math.random() * Math.PI * 2, sd = ball.r * 2.2;
                    const m = this._makeBall('mini',
                        Math.min(Math.max(ball.x + Math.cos(sa) * sd, bd.x + 22), bd.x + bd.w - 22),
                        Math.min(Math.max(ball.y + Math.sin(sa) * sd, bd.y + 22), bd.y + bd.h - 22));
                    if (this.balls.length < 60) { // 总数保险上限，防球数失控卡死
                        m.r = 20; m.team = ball.team; m.srcType = 'summon'; // 小白板更小；记召唤球为本源
                        this.balls.push(m);
                    }
                    this._float(m.x, m.y - m.r - 10, '召唤!', '#9575cd');
                    this._sparks(m.x, m.y, 10);
                }
            }
            // 宇宙球：每10s释放宇宙波澜(1.5s)：期间每0.5s对敌方全体10真伤；波澜结束随机召唤天体
            if (ball.waveEvery) {
                ball.waveT -= dt;
                if (ball.waveT <= 0) {
                    ball.waveT += ball.waveEvery;
                    ball.waveOn = ball.waveSec;
                    ball.waveTick = 0; // 立即结算第一跳
                    if (ball.waveLchSec) { // 嗜血buff4s：敌方全体被抽血供养宇宙球
                        for (const e of this.balls) {
                            if (e.dead || e.team === ball.team) continue;
                            e.lchT = ball.waveLchSec; e.lchIv = 0.5; e.lchTick = 0.5;
                            e.lchDmg = 5; e.lchSrc = ball;
                            this._float(e.x, e.y - e.r - 32, '嗜血!', '#ef5350');
                        }
                    }
                    this._float(ball.x, ball.y - ball.r - 30, '宇宙波澜!', '#b388ff');
                }
                if (ball.waveOn > 0) {
                    ball.waveOn -= dt;
                    ball.waveTick -= dt;
                    if (ball.waveTick <= 0) {
                        ball.waveTick += ball.waveIv || 0.5;
                        for (const e of this.balls) {
                            if (e.dead || e.team === ball.team) continue;
                            this._hurt(e, ball.waveDmg, false, ball, true);
                        }
                    }
                    if (ball.waveOn <= 0) this._uniSummon(ball); // 波澜结束→随机召唤天体
                }
            }
            // 炸弹球：30s倒计时→自爆，炸死场上所有球（全场死光判炸弹赢）
            if (ball.boomSec && !ball.boomed) {
                ball.boomT -= dt;
                if (ball.boomT <= 0) this._boomAll(ball);
            }
            // 地雷球：每4s在原地放一个大地雷；敌球踩到受80伤（一次消耗，可被盾挡/闪避）
            if (ball.mineEvery) {
                ball.mineT -= dt;
                if (ball.mineT <= 0) {
                    let big = 0, small = 0; // 该球场上的大雷/小雷数
                    for (const mn of this.mines) if (mn.src === ball) (mn.small ? small++ : big++);
                    if (big < (ball.mineMax || 3)) { // 大雷未满：继续埋大雷(60伤/r55)
                        ball.mineT += ball.mineEvery;
                        this.mines.push({ x: ball.x, y: ball.y, r: ball.mineR || 55, dmg: ball.mineDmg || 60, team: ball.team, src: ball, small: false });
                        this._float(ball.x, ball.y - ball.r - 30, '布雷!', '#ffab40');
                    } else if (small < (ball.smineMax || 2)) { // 大雷满3颗：改埋小雷(40伤/r24)，最多2颗
                        ball.mineT += ball.mineEvery;
                        this.mines.push({ x: ball.x, y: ball.y, r: ball.smineR || 24, dmg: ball.smineDmg || 40, team: ball.team, src: ball, small: true });
                        this._float(ball.x, ball.y - ball.r - 30, '小雷!', '#ffcc80');
                    } else {
                        ball.mineT = 0.5; // 全满：0.5s后再查，有雷被引爆就补
                    }
                }
            }
            // 太刀球：一把刀绕身旋转(r+26)，碰到敌球造成85伤并反转旋转方向（同一目标0.55s内只结算一次）
            if (ball.bladeDmg && !ball.dead) {
                ball.bladeA += dt * 4 * ball.bladeDir;
                const bx = ball.x + Math.cos(ball.bladeA) * (ball.r + 26);
                const by = ball.y + Math.sin(ball.bladeA) * (ball.r + 26);
                for (const e of this.balls) {
                    if (e === ball || e.dead || e.team === ball.team || e.ghostT > 0 || e.bladeHitT > 0) continue;
                    if (Math.hypot(e.x - bx, e.y - by) < e.r + 13) {
                        e.bladeHitT = 0.55;
                        ball.bladeDir *= -1; // 命中后反转旋转方向
                        this._hurt(e, ball.bladeDmg, false, ball);
                        this._sparks(bx, by, 8);
                    }
                }
            }
            // 狙击枪(远程类)：每3s进入2.3s瞄准，随后向锁定目标发射中弹(8.5速,80伤)
            if (ball.snipeEvery && !ball.dead) {
                if (ball.snipeWind > 0) { // 瞄准中：倒计时到0即击发
                    ball.snipeWind -= dt;
                    if (ball.snipeWind <= 0) {
                        const tgt = (ball.snipeTgt && !ball.snipeTgt.dead) ? ball.snipeTgt : this._nearestEnemy(ball);
                        ball.snipeTgt = null;
                        if (tgt) {
                            if (!this.shots) this.shots = [];
                            const a = Math.atan2(tgt.y - ball.y, tgt.x - ball.x);
                            const sp = BB_SPEED * ball.snipeSpd;
                            const mx = ball.x + Math.cos(a) * (ball.r + 12), my = ball.y + Math.sin(a) * (ball.r + 12);
                            this.shots.push({ x: mx, y: my, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, spd: sp, age: 0,
                                dmg: ball.snipeDmg, sniper: true, size: 9, small: false, col: '#fff59d', owner: ball, team: ball.team });
                            this._sparks(mx, my, 8); // 枪口火光
                        }
                        ball.snipeT = ball.snipeEvery;
                    }
                } else {
                    ball.snipeT -= dt;
                    if (ball.snipeT <= 0) { // 到点进入瞄准并锁定最近敌人
                        ball.snipeWind = ball.snipeAim;
                        ball.snipeTgt = this._nearestEnemy(ball);
                    }
                }
            }
            // 地雷触发：敌球踏入雷圈即炸（己方无效；幽灵态不引爆）
            if (this.mines.length) {
                for (let mi = this.mines.length - 1; mi >= 0; mi--) {
                    const mn = this.mines[mi];
                    if (mn.team === ball.team || ball.ghostT > 0) continue;
                    if (Math.hypot(mn.x - ball.x, mn.y - ball.y) < mn.r + ball.r * 0.6) {
                        this.mines.splice(mi, 1);
                        this._hurt(ball, mn.dmg, false, mn.src);
                        this._sparks(mn.x, mn.y, 18);
                        this._float(ball.x, ball.y - ball.r - 14, '踩雷!', '#ff5252');
                    }
                }
            }

            // 启动球：定时发射牙签（超态为炸弹）；超态倒计时结束还原
            if (ball.shotEvery) {
                ball.shotCd -= dt;
                if (ball.shotCd <= 0) {
                    ball.shotCd += (ball.superOn && ball.superShotEvery) ? ball.superShotEvery : ball.shotEvery; // 超态炸弹2s一发
                    this._fireShot(ball);
                }
            }
            // 弓箭球：每1.3s射一箭；连续命中5箭(漏箭清零)大招——每0.1s一箭持续0.5s（大招箭不计数）
            if (ball.arrowEvery) {
                if (ball.arrowBurst > 0) {          // 大招连射中
                    ball.arrowBurst -= dt;
                    ball.arrowBurstCd -= dt;
                    if (ball.arrowBurstCd <= 0) { ball.arrowBurstCd += ball.arrowBurstEvery; this._fireArrow(ball, true); }
                    if (ball.arrowBurst <= 0) ball.arrowT = ball.arrowEvery; // 大招结束继续普射
                } else {
                    ball.arrowT -= dt;
                    if (ball.arrowT <= 0) {
                        ball.arrowT += ball.arrowEvery;
                        this._fireArrow(ball);
                    }
                }
            }

            // 斧头球：敌入左半圆(r×1.9)挥斧砍击80伤（挥砍0.22s，冷却1.3s）；血量≤280改扔追踪飞斧(1.4速80伤，命中飞回，回收0.5s再扔)
            if (ball.axeDmg) {
                if (ball.hp > ball.axeLowHp) {          // 常态：左半圆挥砍
                    if (ball.axeState !== 'idle') ball.axeState = 'idle'; // 回血脱离飞斧模式
                    ball.axeCd -= dt;
                    if (ball.axeSwing > 0) {
                        ball.axeSwing -= dt;
                        if (!ball.axeSwung && ball.axeSwing <= 0.1) { ball.axeSwung = true; this._axeChop(ball); } // 砍到中途结算
                    } else if (ball.axeCd <= 0) {
                        const reach = ball.r * ball.axeReach;
                        for (const e of this.balls) {
                            if (e === ball || e.dead || e.team === ball.team || e.x >= ball.x) continue; // 只打左半圆
                            if (Math.hypot(e.x - ball.x, e.y - ball.y) < reach + e.r) {
                                ball.axeSwing = 0.22; ball.axeSwung = false; ball.axeCd = ball.axeCdMax;
                                break;
                            }
                        }
                    }
                } else {                                // 低血：追踪飞斧状态机
                    ball.axeSwing = 0;
                    const axSp = BB_SPEED * ball.axeThrowSpd;
                    if (ball.axeState === 'idle') { ball.axeState = 'fly'; ball.axeX = ball.x; ball.axeY = ball.y; }
                    if (ball.axeState === 'fly') {
                        let tgt = null, bd2 = Infinity;
                        for (const e of this.balls) {
                            if (e === ball || e.dead || e.team === ball.team) continue;
                            const dd = (e.x - ball.axeX) * (e.x - ball.axeX) + (e.y - ball.axeY) * (e.y - ball.axeY);
                            if (dd < bd2) { bd2 = dd; tgt = e; }
                        }
                        if (!tgt) ball.axeState = 'return';
                        else {
                            ball.axeSpin += dt * 12; // 飞行自旋
                            const tFly = Math.hypot(tgt.x - ball.axeX, tgt.y - ball.axeY) / axSp;
                            const aa = Math.atan2(tgt.y + tgt.vy * tFly - ball.axeY, tgt.x + tgt.vx * tFly - ball.axeX); // 追踪预判
                            ball.axeX += Math.cos(aa) * axSp * dt; ball.axeY += Math.sin(aa) * axSp * dt;
                            if (Math.hypot(tgt.x - ball.axeX, tgt.y - ball.axeY) < tgt.r + 8) {
                                this._hurt(tgt, ball.axeDmg, false, ball);
                                this._sparks(ball.axeX, ball.axeY, 8);
                                ball.axeState = 'return';
                            }
                        }
                    } else if (ball.axeState === 'return') {
                        ball.axeSpin += dt * 12;
                        const aa = Math.atan2(ball.y - ball.axeY, ball.x - ball.axeX);
                        ball.axeX += Math.cos(aa) * axSp * dt; ball.axeY += Math.sin(aa) * axSp * dt;
                        if (Math.hypot(ball.x - ball.axeX, ball.y - ball.axeY) < ball.r + 10) {
                            ball.axeState = 'wait'; ball.axeWaitT = ball.axeWaitMax;
                        }
                    } else if (ball.axeState === 'wait') {
                        ball.axeWaitT -= dt;
                        if (ball.axeWaitT <= 0) { ball.axeState = 'fly'; ball.axeX = ball.x; ball.axeY = ball.y; }
                    }
                }
            }
            if (ball.superOn) {
                ball.superT -= dt;
                if (ball.superT <= 0) {
                    ball.superOn = false;
                    ball.color = ball.baseColor; ball.glow = ball.baseGlow;
                    ball.charge = 0; // 启动条清空重新充能
                }
            }

            // 滚动球：每5s进入蓄力(不动+颤动)2.5s → 朝最近敌人滚动(预判)；速度每0.2s-0.6，归零自然停下
            if (ball.rollEvery) {
                if (ball.rolling) {
                    ball.rollT += dt;
                    ball.rollReduceT = ball.rollReduceSec; // 滚动中减伤保持，停下后才衰减
                    const spd = Math.max(0, BB_SPEED * (ball.rollSpd - ball.rollSpdDecay * ball.rollT / 0.2)); // 每0.2s速度-0.6
                    const cur = Math.hypot(ball.vx, ball.vy) || 1;
                    ball.vx = ball.vx / cur * spd;
                    ball.vy = ball.vy / cur * spd;
                    if (spd <= 0 || ball.rollT >= ball.rollDur) this._rollEnd(ball); // 滚空：速度归零/超时停下，自损40
                } else if (ball.rollWindup > 0) {
                    ball.rollWindup -= dt;     // 蓄力中：不动（颤动在渲染层）
                    ball.vx = ball.vy = 0;
                    if (ball.rollWindup <= 0) {
                        let best = null, bd2 = Infinity;
                        for (const e of this.balls) {
                            if (e.dead || e.team === ball.team) continue;
                            const d = Math.hypot(e.x - ball.x, e.y - ball.y);
                            if (d < bd2) { bd2 = d; best = e; }
                        }
                        if (best) {
                            const rs = BB_SPEED * ball.rollSpd;
                            // 预判走位：飞行时间×目标速度×0.85取提前量
                            const tFly = Math.hypot(best.x - ball.x, best.y - ball.y) / rs;
                            const ra = Math.atan2(best.y + best.vy * tFly * 0.85 - ball.y, best.x + best.vx * tFly * 0.85 - ball.x);
                            ball.vx = Math.cos(ra) * rs; ball.vy = Math.sin(ra) * rs;
                            ball.rolling = true; ball.rollT = 0;
                            this._float(ball.x, ball.y - ball.r - 14, '滚动!', ball.glow);
                        } else ball.rollCd = 0.5; // 没有敌人：半秒后再试
                    }
                } else if (ball.stun <= 0) {
                    ball.rollCd -= dt;
                    if (ball.rollCd <= 0) {   // 到4s：进入2.5s蓄力
                        ball.rollWindup = ball.rollWindupSec;
                        this._float(ball.x, ball.y - ball.r - 14, '蓄力!', '#eceff1');
                    }
                }
            }

            // 眩晕中不能移动；清醒时正常移动+边界反弹（复活球靶子固定不动）
            if (ball.stun <= 0 && ball.dizzy <= 0 && ball.revPhase !== 2) {
                // 近战类球随机游走：每0.6~1.5s速度方向偏转±34°，不再直线撞墙；蓄力/滚动/击退期不动方向
                if (ball.melee && !ball.rolling && ball.rollWindup <= 0 && ball.kbT <= 0) {
                    ball.wanderT -= dt;
                    if (ball.wanderT <= 0) {
                        ball.wanderT = 0.6 + Math.random() * 0.9;
                        const cur = Math.hypot(ball.vx, ball.vy);
                        if (cur > 0.01) {
                            let a;
                            if (ball.seekWander) { // 太刀：转向偏向最近敌人（±38°散布），没敌人则沿用当前方向
                                const tgt = this._nearestEnemy(ball);
                                const base = tgt ? Math.atan2(tgt.y - ball.y, tgt.x - ball.x) : Math.atan2(ball.vy, ball.vx);
                                a = base + (Math.random() - 0.5) * 1.35;
                            } else {
                                a = Math.atan2(ball.vy, ball.vx) + (Math.random() - 0.5) * 1.2;
                            }
                            ball.vx = Math.cos(a) * cur;
                            ball.vy = Math.sin(a) * cur;
                        }
                    }
                }
                ball.x += ball.vx * dt;
                ball.y += ball.vy * dt;

                if (ball.x < bd.x + ball.r)          { ball.x = bd.x + ball.r;          ball.vx = Math.abs(ball.vx);  this._onWallHit(ball); }
                if (ball.x > bd.x + bd.w - ball.r)   { ball.x = bd.x + bd.w - ball.r;   ball.vx = -Math.abs(ball.vx); this._onWallHit(ball); }
                if (ball.y < bd.y + ball.r)          { ball.y = bd.y + ball.r;          ball.vy = Math.abs(ball.vy);  this._onWallHit(ball); }
                if (ball.y > bd.y + bd.h - ball.r)   { ball.y = bd.y + bd.h - ball.r;   ball.vy = -Math.abs(ball.vy); this._onWallHit(ball); }

                // 拖尾记录
                ball.trail.push({ x: ball.x, y: ball.y });
                if (ball.trail.length > 14) ball.trail.shift();
            } else {
                // 眩晕中被击退仍会飞出：击退窗口内按击退速度位移
                if (ball.kbT > 0) {
                    ball.x += ball.vx * dt;
                    ball.y += ball.vy * dt;
                }
                // 眩晕不动（击退窗口外），且始终钳回界内防止卡出墙外
                ball.x = Math.min(Math.max(ball.x, bd.x + ball.r), bd.x + bd.w - ball.r);
                ball.y = Math.min(Math.max(ball.y, bd.y + ball.r), bd.y + bd.h - ball.r);
            }

            //眩晕星星特效
            if (ball.dizzy > 0) {
                ball.dizzyStar.push({ x: ball.x, y: ball.y });
                if (ball.dizzyStar.length > 10) ball.dizzyStar.shift();
            }
        }

        // 药丸从天而降落到场内
        if (this.pills) {
            for (const p of this.pills) {
                if (p.y < p.ty) p.y = Math.min(p.ty, p.y + p.vy * dt);
            }
        }

        // 攻击球巨剑：0.45s从天而降，持续追踪目标头顶，落下结算120伤+1.8s眩晕
        if (this.swords && this.swords.length) {
            for (let i = this.swords.length - 1; i >= 0; i--) {
                const s = this.swords[i];
                const e = s.target;
                if (e && !e.dead) { s.x = e.x; s.ty = e.y - e.r - 6; } // 追着对方头顶砸
                s.t += dt;
                if (s.t < s.fall) continue;
                this.swords.splice(i, 1);
                this._sparks(s.x, s.ty + 10, 16);
                if (!e || e.dead) continue;
                this._hurt(e, s.dmg, false, s.owner); // 巨剑伤害（吃眩晕增伤/减伤）
                if (!e.dead && e.stun <= 0 && e.stunImm <= 0) {
                    e.stun = s.stunSec;
                    this._float(e.x, e.y - e.r - 32, '巨剑眩晕!', '#eceff1');
                }
            }
        }

        // 启动球牙签/炸弹飞行与命中
        this._updateShots(dt);
        // 宇宙球天体召唤物
        this._updateUni(dt);
        // 大招伤害光波
        this._updateWaves(dt);

        // 球与球碰撞：弹性弹开 + 造成伤害
        for (let i = 0; i < this.balls.length; i++) {
            const a = this.balls[i];
            if (a.dead) continue;
            for (let j = i + 1; j < this.balls.length; j++) {
                const b = this.balls[j];
                if (b.dead) continue;
                const dx = b.x - a.x, dy = b.y - a.y;
                const d = Math.hypot(dx, dy), min = a.r + b.r;
                if (d === 0) continue;
                const sameTeam = a.team === b.team; // 队友：只弹开不造成伤害
                // 攻击范围倍率：范围内即可造成伤害（不必完全接触）
                const reachA = min * a.atkRange; // a能打到b的距离
                const reachB = min * b.atkRange;
                if (sameTeam && d >= min) continue;
                if (d >= reachA && d >= reachB && d >= min) continue;
                if (d < min) {
                    const nx = dx / d, ny = dy / d;
                    // 分离重叠
                    const push = (min - d) / 2;
                    a.x -= nx * push; a.y -= ny * push;
                    b.x += nx * push; b.y += ny * push;
                    // 法向速度交换（弹性碰撞）
                    const an = a.vx * nx + a.vy * ny;
                    const bn = b.vx * nx + b.vy * ny;
                    a.vx += (bn - an) * nx; a.vy += (bn - an) * ny;
                    b.vx += (an - bn) * nx; b.vy += (an - bn) * ny;
                    // 恢复各自特征速度
                    this._normalize(a);
                    this._normalize(b);
                    // 滚动球撞到任何球（含队友）停下；标记延后到本对伤害结算后再结束
                    if (a.rolling) a.rollEnd = true;
                    if (b.rolling) b.rollEnd = true;
                }
                // 范围内伤害（受击冷却内不重复结算，队友不造成伤害；攻击方有冷却时出手后才可再打）
                if (!sameTeam) {
                    const ux = dx / d, uy = dy / d; // a→b 方向
                    // b攻击a：需a可被击(受击冷却结束)且b可出手(攻击冷却结束且未眩晕)
                    const atkB = (b.rolling ? this._rollDmgNow(b)
                        : b.judgeWait ? 0 : (b.superOn && b.superAtk ? b.superAtk : b.atk))
                        * (b.fragileT > 0 ? 1 + b.fragileAtkMul : 1); // 滚动撞击伤害随时间衰减；超伤无普攻；启动超态近战150；易碎期攻+125%
                    const atkA = (a.rolling ? this._rollDmgNow(a)
                        : a.judgeWait ? 0 : (a.superOn && a.superAtk ? a.superAtk : a.atk))
                        * (a.fragileT > 0 ? 1 + a.fragileAtkMul : 1);
                    if (d <= reachB && a.hitCd <= 0 && b.atkCd <= 0 && b.stun <= 0 && atkB > 0) {
                        a.hitCd = BB_HIT_CD; b.atkCd = b.atkCdMax;
                        if (b.lance) { b.lanceFx = 0.45; b.lanceAng = Math.atan2(a.y - b.y, a.x - b.x); }
                        if (b.missCh && Math.random() < b.missCh) { // 骑士刺歪：自损20且本次无伤害（效果也不触发）
                            b.hp -= b.missCost; b.flash = 1;
                            this._float(b.x, b.y - b.r - 14, '刺歪! -' + b.missCost, '#ff8a65');
                        } else {
                        let hitB = atkB, critB = false;
                        if (b.growAtk) { // 伤害球：每次出手+5攻；每第3次伤害×1.5（不保留）
                            b.atkCount++;
                            if (b.critEvery && b.atkCount % b.critEvery === 0) { hitB *= b.critMul; critB = true; }
                            b.atk += b.growAtk;
                        }
                        if (b.critCh && Math.random() < b.critCh) { // 暴击球：概率暴击×1.5，暴击后+10攻+10%暴率
                            hitB *= b.critMul; critB = true;
                            b.atk += b.critGrowAtk; b.critCh += b.critGrowCh;
                            this._float(b.x, b.y - b.r - 32, '暴击↑', '#f48fb1');
                        }
                        if (b.blkGrow) { // 黑速度球：累积速度×10加到本次伤害，然后清零
                            const bonus = b.blkAdd * b.blkDmgMul;
                            if (bonus > 0) { hitB += bonus; this._float(b.x, b.y - b.r - 32, '+' + bonus.toFixed(1) + '速伤', '#b388ff'); }
                            b.blkAdd = 0; b.spd = b.spdBase; this._normalize(b);
                        }
                        if (b.pctHpDmg) hitB += a.hp * (a.hp <= a.maxHp * b.pctHpTh ? (b.pctHpDmg2 || b.pctHpDmg) : b.pctHpDmg); // 百分比球：平时20%，对方血<30%打35%
                        if (a.shield <= 0) { // 护盾把本次效果也一起挡下
                            if (b.knockback) { a.vx = -ux * b.knockback; a.vy = -uy * b.knockback; a.kbT = 0.45; } // 击退a（眩晕中也可被推走0.45s）
                            if (b.stunSec && a.stun <= 0 && a.stunImm <= 0) a.stun = b.stunSec; // 眩晕a（固定5s，不刷新，免疫期不生效）
                            if (b.hitStunCh && Math.random() < b.hitStunCh && a.stun <= 0 && a.stunImm <= 0) { // 攻击球：20%概率眩晕1.5s
                                a.stun = b.hitStunSec;
                                this._float(a.x, a.y - a.r - 32, '眩晕!', '#eceff1');
                            }
                            if (b.fx) this._applyFx(b, a); // 效果球：命中掷骰上debuff
                        }
                        this._hurt(a, hitB, critB, b, false, b.chargeMelee || b.chargeHit); // 近战充能15%
                        if (b.comboMax && ++b.comboN >= b.comboMax) { b.comboN = 0; this._dropSword(b, a); } // 攻击球：连击5次天降巨剑
                        }
                    }
                    if (d <= reachA && b.hitCd <= 0 && a.atkCd <= 0 && a.stun <= 0 && atkA > 0) {
                        b.hitCd = BB_HIT_CD; a.atkCd = a.atkCdMax;
                        if (a.lance) { a.lanceFx = 0.45; a.lanceAng = Math.atan2(b.y - a.y, b.x - a.x); }
                        if (a.missCh && Math.random() < a.missCh) { // 骑士刺歪：自损20且本次无伤害（效果也不触发）
                            a.hp -= a.missCost; a.flash = 1;
                            this._float(a.x, a.y - a.r - 14, '刺歪! -' + a.missCost, '#ff8a65');
                        } else {
                        let hitA = atkA, critA = false;
                        if (a.growAtk) { // 伤害球：每次出手+5攻；每第3次伤害×1.5（不保留）
                            a.atkCount++;
                            if (a.critEvery && a.atkCount % a.critEvery === 0) { hitA *= a.critMul; critA = true; }
                            a.atk += a.growAtk;
                        }
                        if (a.critCh && Math.random() < a.critCh) { // 暴击球：概率暴击×1.5，暴击后+10攻+10%暴率
                            hitA *= a.critMul; critA = true;
                            a.atk += a.critGrowAtk; a.critCh += a.critGrowCh;
                            this._float(a.x, a.y - a.r - 32, '暴击↑', '#f48fb1');
                        }
                        if (a.blkGrow) {
                            const bonus = a.blkAdd * a.blkDmgMul;
                            if (bonus > 0) { hitA += bonus; this._float(a.x, a.y - a.r - 32, '+' + bonus.toFixed(1) + '速伤', '#b388ff'); }
                            a.blkAdd = 0; a.spd = a.spdBase; this._normalize(a);
                        }
                        if (a.pctHpDmg) hitA += b.hp * (b.hp <= b.maxHp * a.pctHpTh ? (a.pctHpDmg2 || a.pctHpDmg) : a.pctHpDmg); // 百分比球：平时20%，对方血<30%打35%
                        if (b.shield <= 0) { // 护盾把本次效果也一起挡下
                            if (a.knockback) { b.vx = ux * a.knockback; b.vy = uy * a.knockback; b.kbT = 0.45; } // 击退b（眩晕中也可被推走0.45s）
                            if (a.stunSec && b.stun <= 0 && b.stunImm <= 0) b.stun = a.stunSec; // 眩晕b（固定5s，不刷新，免疫期不生效）
                            if (a.hitStunCh && Math.random() < a.hitStunCh && b.stun <= 0 && b.stunImm <= 0) { // 攻击球：20%概率眩晕1.5s
                                b.stun = a.hitStunSec;
                                this._float(b.x, b.y - b.r - 32, '眩晕!', '#eceff1');
                            }
                            if (a.fx) this._applyFx(a, b); // 效果球：命中掷骰上debuff
                        }
                        this._hurt(b, hitA, critA, a, false, a.chargeMelee || a.chargeHit); // 近战充能15%
                        if (a.comboMax && ++a.comboN >= a.comboMax) { a.comboN = 0; this._dropSword(a, b); } // 攻击球：连击5次天降巨剑
                        }
                    }
                }
                // 滚动球撞球后停下（伤害已按滚动伤害结算）
                if (a.rollEnd) { a.rollEnd = false; this._rollEnd(a, true); }  // 撞到球=不罚自损
                if (b.rollEnd) { b.rollEnd = false; this._rollEnd(b, true); }
            }
        }

        // 死亡判定
        for (const ball of this.balls) {
            if (!ball.dead && ball.hp <= 0) {
                if (ball.nonexistSec && !ball.nonexistUsed) { // 不存在球：死后复活（仅一次）——无敌(打一下解除，最长5s)+回8血，击杀者被标记为不存在
                    ball.nonexistUsed = true;
                    ball.ghostT = ball.nonexistSec;
                    ball.hp = ball.nonexistHeal;
                    ball.flash = 1;
                    this._float(ball.x, ball.y - ball.r - 14, '[不存在] 无敌+8血', '#90a4ae');
                    this._sparks(ball.x, ball.y, 10);
                    const k = ball.lastHitBy;
                    if (k && !k.dead && k.team !== ball.team) {
                        k.noExist = ball.markHits; k.noExistMul = ball.markMul;
                        this._float(k.x, k.y - k.r - 14, '被标记为不存在!', '#90a4ae');
                    }
                    continue;
                }
                if (ball.revive > 0) { // 复活类：免死瞬移+回血（仅一次）
                    ball.revive--;
                    this._blink(ball, true, true);
                    ball.hp = ball.reviveHeal;
                    ball.flash = 1;
                    this._float(ball.x, ball.y - ball.r - 14, '神不会流血! +' + ball.reviveHeal, '#ffd700');
                    this._sparks(ball.x, ball.y, 12);
                    continue;
                }
                if (ball.type === 'revive' && ball.revPhase === 0) { // 复活球一死：上限降为500，攻+10
                    ball.revPhase = 1;
                    ball.hp = ball.maxHp = ball.revHp;
                    ball.atk += ball.revAtk;
                    ball.flash = 1;
                    this._float(ball.x, ball.y - ball.r - 14, '复活! 500血+' + ball.revAtk + '攻', ball.glow);
                    this._sparks(ball.x, ball.y, 12);
                    continue;
                }
                if (ball.type === 'revive' && ball.revPhase === 1) { // 复活球二死：变250血靶子(0攻0速)18.5s
                    ball.revPhase = 2;
                    ball.hp = ball.maxHp = ball.tgtHp;
                    ball.atk = 0;
                    ball.vx = ball.vy = 0;
                    ball.revT = ball.tgtSec;
                    ball.flash = 1;
                    this._float(ball.x, ball.y - ball.r - 14, '变为靶子 ' + ball.tgtSec + 's!', ball.glow);
                    this._sparks(ball.x, ball.y, 12);
                    continue;
                }
                ball.dead = true;
                this._explode(ball);
                this._onKill(ball);
            }
        }

        // 黑色白板大招：边界侵蚀——贴边的敌方每1s扣5血，持续8s
        if (this.edgeCurse) {
            const ec = this.edgeCurse;
            ec.t -= dt; ec.tick -= dt;
            if (ec.tick <= 0) {
                ec.tick += 1;
                for (const e of this.balls) {
                    if (e.dead || e.team === ec.team) continue;
                    if (e.x - e.r <= bd.x + 1 || e.x + e.r >= bd.x + bd.w - 1 || e.y - e.r <= bd.y + 1 || e.y + e.r >= bd.y + bd.h - 1) {
                        this._hurt(e, 5, false, null, true);
                        this._float(e.x, e.y - e.r - 14, '-5 边界侵蚀', '#90a4ae');
                    }
                }
            }
            if (ec.t <= 0) this.edgeCurse = null;
        }
        // 擂台赛：当前擂主/挑战者分出胜负后，先显示Win/Wasted再等下一场
        const alive = this.balls.filter(b => !b.dead);
        if (this.arena) {
            const a = this.arena;
            const kingAlive = !!(a.king && !a.king.dead);
            const foeAlive = !!(a.current && !a.current.dead);
            if (!kingAlive || !foeAlive) {
                a.roundResult = kingAlive ? 'Win' : 'Wasted';
                a.roundWait = 1.6;
                this.winner = kingAlive ? a.king : (a.current || alive.find(b => b.team === 1) || null);
                this.phase = 'arenaResult';
            }
        } else {
            const teamsLeft = new Set(alive.map(b => b.team));
            if (teamsLeft.size <= 1) {
                this.phase = 'over';
                this.winner = alive.find(b => !BB_TYPES[b.type].minion) || alive[0] || this._boomSrc || null; // 胜者优先取非召唤物；爆炸团灭判炸弹赢
                this._overTimer = performance.now() + 900;
            }
        }
    }

    // ===== 伤害结算：闪避→护盾→名刀→扣血；pure=真伤（护盾/闪避/名刀仍生效，跳过眩晕增伤与减伤）=====
    _applyFx(src, dst) { // 效果球：命中独立掷骰，可同时中多个debuff
        if (src.fxStunCh && Math.random() < src.fxStunCh && dst.stun <= 0 && dst.stunImm <= 0) {
            dst.stun = src.fxStunSec;
            this._float(dst.x, dst.y - dst.r - 32, '眩晕!', '#eceff1');
        }
        if (src.fxPsnCh && Math.random() < src.fxPsnCh) {
            dst.psnT = src.fxPsnSec; dst.psnIv = src.fxPsnIv; dst.psnTick = src.fxPsnIv;
            dst.psnDmg = src.fxPsnDmg; dst.psnSrc = src;
            this._float(dst.x, dst.y - dst.r - 32, '中毒!', '#aed581');
        }
        if (src.fxLchCh && Math.random() < src.fxLchCh) {
            dst.lchT = src.fxLchSec; dst.lchIv = src.fxLchIv; dst.lchTick = src.fxLchIv;
            dst.lchDmg = src.fxLchDmg; dst.lchSrc = src;
            this._float(dst.x, dst.y - dst.r - 32, '嗜血!', '#ef5350');
        }
        if (src.fxMarkCh && Math.random() < src.fxMarkCh && dst.noExist <= 0) {
            dst.noExist = src.fxMarkHits; dst.noExistMul = src.fxMarkMul; // 同不存在球标记
            this._float(dst.x, dst.y - dst.r - 14, '被标记为不存在!', '#90a4ae');
        }
        if (src.fxKillCh && Math.random() < src.fxKillCh) {
            dst.killT = src.fxKillSec; dst.killIv = src.fxKillIv; dst.killTick = src.fxKillIv;
            dst.killDmg = src.fxKillDmg; dst.killSrc = src;
            this._float(dst.x, dst.y - dst.r - 32, '秒杀!', '#ff1744');
            this._sparks(dst.x, dst.y, 10);
        }
    }
    _hurt(ball, dmg, crit, attacker, pure, charge) {
        if (ball.dead) return;
        if (dmg <= 0) return; // 0伤害不消耗护盾/闪避次数
        if (ball.wallInvT > 0) dmg = Math.max(1, Math.round(dmg * 0.5)); // 黑色白板：碰墙后1s内受伤-50%
        if (ball.ghostT > 0) { // 不存在buff：被打一下即解除（本次伤害免疫）
            ball.ghostT = 0;
            this._float(ball.x, ball.y - ball.r - 32, '存在回来了!', '#90a4ae');
            return;
        }
        if (attacker && attacker.noExist > 0) return; // 被标记为不存在：攻击无效
        if (attacker && attacker.synMul > 1) dmg = Math.round(dmg * attacker.synMul); // 羁绊：造成的所有伤害+5%
        if (ball.noExist > 0 && ball.noExistMul) dmg = Math.round(dmg * ball.noExistMul); // 被标记为不存在：受伤+250%
        if (ball.takeMul && ball.takeMul !== 1) dmg = Math.round(dmg * ball.takeMul); // 受伤倍率：所有伤害生效（含真伤）
        // 闪避：血量低于阈值后每N次受击瞬移躲开（闪现球，确定性）
        if (ball.dodgeEvery > 0 && ball.hp < ball.dodgeHp
            && !(ball.dodgeMinDmg && dmg < ball.dodgeMinDmg && ball.hp >= ball.reflHp)) { // 伤害<11不闪（血<300除外），也不占闪避计数
            ball.hitCount++;
            if (ball.hitCount % ball.dodgeEvery === 0) {
                this._blink(ball, true, false, attacker);
                return;
            }
        }
        if (ball.shield > 0) {
            ball.shield--;
            this._float(ball.x, ball.y - ball.r - 14, '格挡!', '#ffd54f');
            this._sparks(ball.x, ball.y, 6);
            ball.flash = 1;
            // 无敌球机制：每打碎一个盾，他的伤害+5
            if (ball.shieldBreakAtk) {
                ball.atk += ball.shieldBreakAtk;
                this._float(ball.x, ball.y - ball.r - 32, '破盾觉醒 +' + ball.shieldBreakAtk + '伤!', '#ffca28');
            }
            // 超伤球：碎一个盾就在自身附近1.8范围随机瞬移
            if (ball.judgeWait) this._hop(ball, 1.8);
            // 盾全碎：攻击力一次性加成（无敌球+15）
            if (ball.shield === 0 && ball.shieldBonus && !ball.shieldBroken) {
                ball.shieldBroken = true;
                ball.atk += ball.shieldBonus;
                this._float(ball.x, ball.y - ball.r - 32, '破盾之力 +' + ball.shieldBonus + '攻', '#ff8a65');
            }
            return;
        }
        if (!pure && ball.stun > 0) dmg = Math.round(dmg * 1.4); // 眩晕中受伤+40%（真伤不吃）
        // 闪现球低血反伤：血量<reflHp时reflCh概率把本次伤害×reflMul弹回攻击方，自身不掉血（直扣血不进_hurt防链反）
        if (ball.reflCh && attacker && !attacker.dead && ball.hp < ball.reflHp && Math.random() < ball.reflCh) {
            const rd = Math.round(dmg * ball.reflMul);
            attacker.hp -= rd;
            attacker.flash = 1;
            this._float(ball.x, ball.y - ball.r - 14, '反伤!', '#ea80fc');
            this._float(attacker.x, attacker.y - attacker.r - 14, '-' + rd, '#ea80fc');
            this._sparks(attacker.x, attacker.y, 8);
            return;
        }
        // 名刀：致命一击免疫（不掉血），+1护盾+5攻，仅一次
        if (ball.blade > 0 && ball.hp - dmg <= 0) {
            ball.blade--;
            ball.shield++;
            ball.atk += 5;
            ball.flash = 1;
            this._float(ball.x, ball.y - ball.r - 14, '名刀!', '#ffd700');
            this._sparks(ball.x, ball.y, 12);
            return;
        }
        const fragileAura = this.balls && this.balls.some( // 易碎光环：存在存活敌方易碎球且本球血<阈值 → 免伤-20%
            f => !f.dead && f.team !== ball.team && f.fragileAuraHp && ball.hp < f.fragileAuraHp);
        const reduce = (ball.dmgReduce || 0) + (ball.superOn ? ball.superReduce : 0)
            + (ball.rollReduceT > 0 ? ball.rollReduce : 0) // 减伤=自身修正+启动超态15%+滚动40%
            + (ball.fragileT > 0 ? ball.fragileRed : 0)    // 易碎期免伤-20%
            + (ball.revPhase === 2 ? ball.tgtRed : 0)      // 复活球靶子：减伤30%
            + (ball.defHp && ball.hp < ball.defHp ? ball.defReduce : 0) // 盾牌球防御态：减伤40%
            + (fragileAura ? -0.2 : 0);
        if (!pure && reduce) dmg = Math.max(1, Math.round(dmg * (1 - reduce))); // 伤害减免：正=减伤(耐力-5%/启动超态-15%)，负=增伤(超伤+10%)（真伤不吃）
        if (ball.capDmg) dmg = Math.min(dmg, ball.capDmg); // 不存在球：每次最多受1点伤害
        ball.hp -= dmg;
        if (!pure) { // 大招充能：命中+15/受击+5（真伤不充）
            if (attacker && !attacker.dead && attacker !== ball && attacker.ultType)
                attacker.energy = Math.min(100, attacker.energy + 15);
            if (ball.ultType) ball.energy = Math.min(100, ball.energy + 5);
        }
        if (attacker && !attacker.dead && attacker !== ball) ball.lastHitBy = attacker; // 记录击杀者（不存在标记用）
        // 盾牌球荆棘：血量低于阈值时，本次实际伤害×thornMul弹回攻击方（直扣血不进_hurt防链反）
        if (ball.thornHp && ball.thornMul && attacker && !attacker.dead && attacker !== ball && ball.hp < ball.thornHp) {
            const rd = Math.round(dmg * ball.thornMul);
            if (rd > 0) {
                attacker.hp -= rd;
                attacker.flash = 1;
                this._float(ball.x, ball.y - ball.r - 32, '荆棘!', '#ffd54f');
                this._float(attacker.x, attacker.y - attacker.r - 14, '-' + rd, '#ffd54f');
                this._sparks(attacker.x, attacker.y, 6);
            }
        }
        if (ball.noExist > 0) { // 被标记球实际受到伤害才计数，3次后解除标记
            ball.noExist--;
            if (ball.noExist <= 0) { ball.noExistMul = 0; this._float(ball.x, ball.y - ball.r - 32, '存在回来了', '#90a4ae'); }
        }
        if (ball.fragileSec) {                // 易碎球：掉血获得易碎buff10s（免伤-20%/攻+125%）
            if (ball.fragileT <= 0) this._float(ball.x, ball.y - ball.r - 32, '易碎!', '#90caf9');
            ball.fragileT = ball.fragileSec;
        }
        // 攻击球：被攻击到掉血 → 冷静成长计时与连击数清零
        ball.calmT = 0; ball.comboN = 0;
        // 启动球充能：攻击方造成伤害后按来源充能（牙签22%/近战chargeMelee）
        if (attacker && !attacker.dead && attacker.chargeHit) this._gainCharge(attacker, charge !== undefined ? charge : attacker.chargeHit);
        // 启动球充能：受直接攻击也攒能（受近战/牙签伤+20%，真伤类光环/审判不算）
        if (ball.chargeRate && charge !== undefined) this._gainCharge(ball, ball.chargeRate);
        // 超伤球：受到40以下的实际伤害时审判提前3.5s（格挡/审判中不触发）
        if (ball.judgeWait && !ball.judgeOn && !pure && dmg > 0 && dmg < 40) {
            ball.judgeT = Math.max(0, ball.judgeT - 3.5);
        }
        ball.flash = 1;
        if (dmg > 0) this._float(ball.x, ball.y - ball.r - 14, '-' + Math.round(dmg), crit ? '#ff5252' : '#fff');
        this._sparks(ball.x, ball.y, crit ? 14 : 8);
    }

    // ===== 瞬移到场地内随机位置（不越界）；free=true 为闪避耗血；avoidEnemies=落点距每个敌人>其攻击范围×1.5 =====
    _blink(ball, free, avoidEnemies, attacker) {
        const bd = this.bounds;
        this._sparks(ball.x, ball.y, 10); // 起点残影
        // 在边界内（留出球半径）随机取落点
        const minX = bd.x + ball.r, maxX = bd.x + bd.w - ball.r;
        const minY = bd.y + ball.r, maxY = bd.y + bd.h - ball.r;
        let px = minX + Math.random() * Math.max(0, maxX - minX);
        let py = minY + Math.random() * Math.max(0, maxY - minY);
        if (avoidEnemies) {
            let bestX = px, bestY = py, bestD = -1;
            for (let i = 0; i < 40; i++) {
                const cx = minX + Math.random() * Math.max(0, maxX - minX);
                const cy = minY + Math.random() * Math.max(0, maxY - minY);
                let minD = Infinity, ok = true;
                for (const e of this.balls) {
                    if (e === ball || e.dead || e.team === ball.team) continue;
                    const reach = (e.r + ball.r) * e.atkRange; // 敌方攻击范围
                    const dd = Math.hypot(cx - e.x, cy - e.y);
                    if (dd < minD) minD = dd;
                    if (dd <= reach * 1.5) { ok = false; break; }
                }
                if (ok) { bestX = cx; bestY = cy; break; }
                if (minD > bestD) { bestD = minD; bestX = cx; bestY = cy; }
            }
            px = bestX; py = bestY;
        }
        ball.x = px;
        ball.y = py;
        ball.trail = []; // 清除拖尾，避免跨越全屏的连线
        ball.flash = 1;
        this._sparks(ball.x, ball.y, 10); // 落点闪光
        if (free) {
            const dcMin = ball.dodgeCostMin || 0, dcMax = ball.dodgeCostMax || 0;
            const cost = Math.round(dcMin + Math.random() * (dcMax - dcMin));
            if (cost > 0) {
                ball.hp -= cost;
                this._float(ball.x, ball.y - ball.r - 14, '闪避 -' + cost, '#ea80fc');
            } else {
                this._float(ball.x, ball.y - ball.r - 14, '闪避!', '#ea80fc');
            }
        } else {
            ball.hp -= ball.blinkCost;
            this._float(ball.x, ball.y - ball.r - 14, '闪现 -' + ball.blinkCost, '#ea80fc');
        }
    }

    // ===== 近距瞬移：以自身为中心、半径=球径×mul范围内随机落点（不越界）；超伤球盾破逃逸用 =====
    _hop(ball, mul) {
        const bd = this.bounds;
        this._sparks(ball.x, ball.y, 10);
        const rr = ball.r * 2 * (mul || 1.8);
        const a = Math.random() * Math.PI * 2, d = Math.random() * rr;
        ball.x = Math.min(Math.max(ball.x + Math.cos(a) * d, bd.x + ball.r), bd.x + bd.w - ball.r);
        ball.y = Math.min(Math.max(ball.y + Math.sin(a) * d, bd.y + ball.r), bd.y + bd.h - ball.r);
        ball.trail = [];
        ball.flash = 1;
        this._sparks(ball.x, ball.y, 10);
    }

    // 启动球：伤害充能→满值进入超级形态；超态中每次攻击续时
    _gainCharge(b, amt) {
        if (b.superOn) { b.superT += b.superExtend; return; } // 每次攻击+0.75s
        b.charge += amt !== undefined ? amt : b.chargeHit;
        if (b.charge >= 1) {
            b.charge = 1;
            b.superOn = true;
            b.superT = b.superSec;
            b.color = b.superColor; b.glow = b.superGlow;
            this._float(b.x, b.y - b.r - 32, '启动!!', '#ff5252');
            this._sparks(b.x, b.y, 16);
        }
    }

    // ===== 启动球弹道：向最近敌人发射牙签；超态时改发射炸弹 =====
    // ===== 大招释放：能量满100自动触发（各球种效果不同）=====
    _castUlt(ball) {
        const bd = this.bounds;
        const type = ball.srcType || ball.type;
        switch (type) {
            case 'speed': { // 速度球：瞬移到最近敌人旁，快速攻击2次(不无敌)；迅速皮肤改扔3黑球
                const tgt = this._nearestEnemy(ball);
                if (!tgt) return; // 没有敌人：能量保留，下帧再试
                if (ball.swift) { // 迅速皮肤：3个黑球各30伤；1秒未命中则瞬移到黑球处并+10血
                    if (!this.shots) this.shots = [];
                    const base = Math.atan2(tgt.y - ball.y, tgt.x - ball.x), sp = BB_SPEED * 2.4;
                    for (let i = -1; i <= 1; i++) {
                        const a = base + i * 0.28;
                        this.shots.push({ x: ball.x, y: ball.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                            spd: sp, age: 0, life: 1, dmg: 30, size: 12, small: true, swift: true,
                            col: '#111111', owner: ball, team: ball.team });
                    }
                    this._float(ball.x, ball.y - ball.r - 30, '迅速三连!', '#84ffff');
                    this._sparks(ball.x, ball.y, 18);
                    break;
                }
                const a = Math.random() * Math.PI * 2, d = tgt.r + ball.r + 8;
                ball.x = Math.min(Math.max(tgt.x + Math.cos(a) * d, bd.x + ball.r), bd.x + bd.w - ball.r);
                ball.y = Math.min(Math.max(tgt.y + Math.sin(a) * d, bd.y + ball.r), bd.y + bd.h - ball.r);
                ball.trail = [];
                ball.ultTgt = tgt; ball.ultN = 2; ball.ultTick = 0; ball.ultSpeed = 1.0;
                this._float(ball.x, ball.y - ball.r - 30, '疾风连突!', '#80d8ff');
                this._sparks(ball.x, ball.y, 16);
                break;
            }
            case 'blackwb': { // 黑色白板：边界侵蚀——贴边敌人每1s扣5血，持续8s
                this.edgeCurse = { team: ball.team, t: 8, tick: 1 };
                this._float(ball.x, ball.y - ball.r - 30, '边界侵蚀!', '#9e9e9e');
                this._sparks(ball.x, ball.y, 16);
                break;
            }
            case 'dmg': { // 伤害球：释放伤害光波（扩散环扫过敌人造成110伤）
                if (!this.waves) this.waves = [];
                this.waves.push({ x: ball.x, y: ball.y, r: ball.r, spd: 850, maxR: 620, dmg: 110,
                    team: ball.team, owner: ball, col: ball.glow || '#ffab91', hit: new Set() });
                this._float(ball.x, ball.y - ball.r - 30, '伤害光波!', '#ffab91');
                break;
            }
            case 'invincible': { // 无敌球：全队新增一层护盾
                for (const e of this.balls) {
                    if (e.dead || e.team !== ball.team) continue;
                    e.shield++; e.flash = 1;
                    this._float(e.x, e.y - e.r - 14, '+盾', '#ffd54f');
                }
                this._float(ball.x, ball.y - ball.r - 30, '无敌军团!', '#ffe082');
                break;
            }
            case 'plain': { // 白板：变身白色白板3s(继承当前血量/50攻/1倍速/每1s扔小球20伤)；方形皮肤→追踪方弹100伤
                if (ball.square) { // 方形皮肤大招：投掷一枚追踪正方形白弹(100伤)
                    if (!this.shots) this.shots = [];
                    const tgt = this._nearestEnemy(ball);
                    const a = tgt ? Math.atan2(tgt.y - ball.y, tgt.x - ball.x) : Math.atan2(ball.vy, ball.vx);
                    const sp = BB_SPEED * 2;
                    this.shots.push({ x: ball.x, y: ball.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                        spd: sp, age: 0, dmg: 100, size: 16, square: true, track: true, target: tgt,
                        col: '#ffffff', owner: ball, team: ball.team });
                    this._float(ball.x, ball.y - ball.r - 30, '方弹出击!', '#ffffff');
                    this._sparks(ball.x, ball.y, 12);
                    break;
                }
                if (ball.dragon) { // 龙王皮肤大招：召唤追踪龙(200伤)
                    if (!this.shots) this.shots = [];
                    const tgt = this._nearestEnemy(ball);
                    const a = tgt ? Math.atan2(tgt.y - ball.y, tgt.x - ball.x) : Math.atan2(ball.vy, ball.vx);
                    const sp = BB_SPEED * 2.4;
                    this.shots.push({ x: ball.x, y: ball.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                        spd: sp, age: 0, dmg: 200, size: 20, dragon: true, track: true, target: tgt,
                        col: '#ffb300', owner: ball, team: ball.team });
                    this._float(ball.x, ball.y - ball.r - 30, '龙王降临!', '#ffd54f');
                    this._sparks(ball.x, ball.y, 20);
                    break;
                }
                ball.ultSave = { name: ball.name, color: ball.color, glow: ball.glow,
                    atk: ball.atk, spd: ball.spd, maxHp: ball.maxHp };
                ball.ultForm = 3; ball.ultShotT = 0;
                ball.name = '白色白板'; ball.color = '#ffffff'; ball.glow = '#ffffff'; ball.iconDark = true;
                ball.maxHp = 1000; ball.hp = Math.min(ball.hp, ball.maxHp); // 血量继承：不满血重置
                ball.atk = 50; ball.spd = 1;
                this._normalize(ball);
                this._float(ball.x, ball.y - ball.r - 30, '白色白板!', '#ffffff');
                this._sparks(ball.x, ball.y, 18);
                break;
            }
            case 'hpball': { // 血量球：全队回血+100
                for (const e of this.balls) {
                    if (e.dead || e.team !== ball.team) continue;
                    const add = Math.min(100, e.maxHp - e.hp);
                    if (add > 0) { e.hp += add; e.flash = 1; this._float(e.x, e.y - e.r - 14, '+' + Math.round(add), '#a5d6a7'); }
                }
                this._float(ball.x, ball.y - ball.r - 30, '生命涌动!', '#a5d6a7');
                break;
            }
            case 'blackspeed': { // 黑速度球：速度翻倍持续5s
                ball.ultSpdMul = 2; ball.ultSpdT = 5;
                ball.spd = (ball.spdBase + ball.blkAdd) * 2;
                this._normalize(ball);
                this._float(ball.x, ball.y - ball.r - 30, '黑速爆发!', '#7c4dff');
                break;
            }
            case 'white': { // 白色白板：向四周发射15个小球(每个50伤)
                if (!this.shots) this.shots = [];
                const sp = BB_SPEED * 2.2;
                for (let i = 0; i < 15; i++) {
                    const a = i / 15 * Math.PI * 2;
                    this.shots.push({ x: ball.x, y: ball.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                        spd: sp, age: 0, dmg: 50, size: 10, small: true, col: '#ffffff', owner: ball, team: ball.team });
                }
                this._float(ball.x, ball.y - ball.r - 30, '白球散射!', '#ffffff');
                this._sparks(ball.x, ball.y, 18);
                break;
            }
            default: return; // 无大招类型：不放不清能
        }
        ball.energy = 0;
    }

    // 白色白板：每1s向最近敌人扔小球(20伤)
    _fireUltShot(ball) {
        const tgt = this._nearestEnemy(ball);
        if (!tgt) return;
        if (!this.shots) this.shots = [];
        const sp = BB_SPEED * 2.2;
        const tFly = Math.hypot(tgt.x - ball.x, tgt.y - ball.y) / sp;
        const ang = Math.atan2(tgt.y + tgt.vy * tFly - ball.y, tgt.x + tgt.vx * tFly - ball.x);
        this.shots.push({ x: ball.x, y: ball.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
            spd: sp, age: 0, dmg: 20, size: 10, small: true, col: '#ffffff', owner: ball, team: ball.team });
    }

    // 白板大招结束：恢复常态（变身期间承伤保留，血量不超原上限）
    _ultFormEnd(ball) {
        const s = ball.ultSave;
        ball.ultForm = 0; ball.ultShotT = 0; ball.ultSave = null;
        if (s) {
            ball.name = s.name; ball.color = s.color; ball.glow = s.glow;
            ball.atk = s.atk; ball.spd = s.spd; ball.maxHp = s.maxHp;
            ball.hp = Math.min(ball.hp, s.maxHp);
        }
        this._normalize(ball);
        this._float(ball.x, ball.y - ball.r - 14, '变回白板', '#bdbdbd');
    }

    // 速度球大招结束：恢复随机游走
    _ultResume(ball) {
        const a = Math.random() * Math.PI * 2;
        ball.vx = Math.cos(a) * BB_SPEED * ball.spd * (ball.spdMul || 1);
        ball.vy = Math.sin(a) * BB_SPEED * ball.spd * (ball.spdMul || 1);
    }

    // 伤害光波：扩散圆环，环带扫过敌人各结算一次伤害
    _updateWaves(dt) {
        if (!this.waves || !this.waves.length) return;
        for (let i = this.waves.length - 1; i >= 0; i--) {
            const w = this.waves[i];
            const r0 = w.r;
            w.r += w.spd * dt;
            for (const e of this.balls) {
                if (e.dead || e.team === w.team || w.hit.has(e)) continue;
                const d = Math.hypot(e.x - w.x, e.y - w.y);
                if (d >= r0 - e.r * 0.5 && d <= w.r + e.r * 0.5) {
                    w.hit.add(e);
                    this._hurt(e, w.dmg, false, w.owner);
                }
            }
            if (w.r >= w.maxR) this.waves.splice(i, 1);
        }
    }

    _fireShot(ball) {
        if (!this.shots) this.shots = [];
        let tgt = null, bd2 = Infinity;
        for (const e of this.balls) {
            if (e === ball || e.dead || e.team === ball.team) continue;
            const dd = (e.x - ball.x) * (e.x - ball.x) + (e.y - ball.y) * (e.y - ball.y);
            if (dd < bd2) { bd2 = dd; tgt = e; }
        }
        if (!tgt) return;
        const sp = ball.shotSpd ? BB_SPEED * ball.shotSpd : 260, bomb = ball.superOn;
        let tx = tgt.x, ty = tgt.y, track = false;
        if (bomb) { // 炸弹有预判：提前量=飞行时间×目标速度；95%追踪必中、5%打偏
            const tFly = Math.hypot(tgt.x - ball.x, tgt.y - ball.y) / sp;
            tx = tgt.x + tgt.vx * tFly; ty = tgt.y + tgt.vy * tFly;
            track = Math.random() < 0.95;
            if (!track) { const oa = Math.random() * Math.PI * 2, off = 80 + Math.random() * 70; tx += Math.cos(oa) * off; ty += Math.sin(oa) * off; }
        } else if (ball.shotSpd) { // 远程球预判走位：提前量=飞行时间×目标速度
            const tFly = Math.hypot(tgt.x - ball.x, tgt.y - ball.y) / sp;
            tx = tgt.x + tgt.vx * tFly; ty = tgt.y + tgt.vy * tFly;
        }
        const ang = Math.atan2(ty - ball.y, tx - ball.x);
        this.shots.push({
            x: ball.x, y: ball.y,
            vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, spd: sp, age: 0,
            dmg: bomb ? ball.bombDmg : ball.shotDmg,
            bomb, bombRange: ball.bombRange, track,
            target: tgt,
            charge: ball.chargeHit, // 牙签命中充能量（+5%）
            size: bomb ? ball.r * 0.5 : ball.r / 3, // 炸弹半径=球半径1/2；牙签半长=球半径1/3
            small: !!ball.shotSpd,            // 远程球弹体：发光小球（否则画牙签线条）
            col: ball.glow,
            owner: ball, team: ball.team,
        });
    }

    // 画斧头：木柄+钢刃，ang为整体朝向角
    _drawAxe(ctx, x, y, ang) {
        ctx.save();
        ctx.translate(x, y); ctx.rotate(ang);
        ctx.shadowColor = '#d7ccc8'; ctx.shadowBlur = 6;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -8); ctx.stroke();       // 斧柄
        ctx.fillStyle = '#b0bec5';
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(-8, -3); ctx.lineTo(-1.5, 2); ctx.closePath(); ctx.fill(); // 斧刃
        ctx.restore();
    }

    // 斧头球挥砍结算：左半圆(r×axeReach)内所有敌人吃axeDmg
    _axeChop(ball) {
        const reach = ball.r * ball.axeReach;
        let hitAny = false;
        for (const e of this.balls) {
            if (e === ball || e.dead || e.team === ball.team || e.x >= ball.x) continue; // 只打左半圆
            if (Math.hypot(e.x - ball.x, e.y - ball.y) < reach + e.r) { this._hurt(e, ball.axeDmg, false, ball); hitAny = true; }
        }
        if (hitAny) this._sparks(ball.x - reach * 0.7, ball.y, 10);
    }

    // ===== 弓箭球弹道：向最近敌人射箭（预判走位，6.8速20伤；大招9速10伤）=====
    _fireArrow(ball, burst) {
        if (!this.shots) this.shots = [];
        const tgt = this._nearestEnemy(ball);
        if (!tgt) return;
        const sp = BB_SPEED * (burst ? ball.arrowBurstSpd : ball.arrowSpd); // 大招箭9速/普箭6.8速
        const tFly = Math.hypot(tgt.x - ball.x, tgt.y - ball.y) / sp; // 预判：飞行时间×目标速度
        const tx = tgt.x + tgt.vx * tFly, ty = tgt.y + tgt.vy * tFly;
        const ang = Math.atan2(ty - ball.y, tx - ball.x);
        this.shots.push({
            x: ball.x, y: ball.y,
            vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, spd: sp, age: 0,
            dmg: burst ? ball.arrowBurstDmg : ball.arrowDmg, arrow: true, burstShot: !!burst, // 大招箭10伤且不计入命中计数
            size: 7, small: false, col: '#d7ccc8',
            owner: ball, team: ball.team,
        });
    }

    // 迅速黑球1秒未命中：宿主瞬移到黑球处并回复10血（每次大招最多一次）
    _swiftLand(s) {
        const ow = s.owner, bd = this.bounds;
        if (!ow || ow.dead || !bd) return;
        ow.x = Math.min(Math.max(s.x, bd.x + ow.r), bd.x + bd.w - ow.r);
        ow.y = Math.min(Math.max(s.y, bd.y + ow.r), bd.y + bd.h - ow.r);
        ow.trail = [];
        const add = Math.min(10, ow.maxHp - ow.hp);
        if (add > 0) ow.hp += add;
        ow.flash = 1;
        this._float(ow.x, ow.y - ow.r - 18, '瞬移 +' + Math.round(add), '#84ffff');
        this._sparks(ow.x, ow.y, 18);
    }

    // 牙签/炸弹直线飞行；碰到敌人结算（炸弹改为范围爆炸），出界消失
    _updateShots(dt) {
        if (!this.shots || !this.shots.length) return;
        const bd = this.bounds;
        for (let i = this.shots.length - 1; i >= 0; i--) {
            const s = this.shots[i];
            s.age += dt;
            if (s.track) { // 追踪炸弹：每帧按目标预判点修正弹道
                let tgt = s.target && !s.target.dead ? s.target : null;
                if (!tgt) { // 原目标死了改追最近敌人
                    let bd2 = Infinity;
                    for (const e of this.balls) {
                        if (e.dead || e.team === s.team) continue;
                        const dd = (e.x - s.x) * (e.x - s.x) + (e.y - s.y) * (e.y - s.y);
                        if (dd < bd2) { bd2 = dd; tgt = e; }
                    }
                    s.target = tgt;
                }
                if (tgt) {
                    const tFly = Math.hypot(tgt.x - s.x, tgt.y - s.y) / s.spd;
                    const aa = Math.atan2(tgt.y + tgt.vy * tFly - s.y, tgt.x + tgt.vx * tFly - s.x);
                    s.vx = Math.cos(aa) * s.spd; s.vy = Math.sin(aa) * s.spd;
                }
            }
            s.x += s.vx * dt; s.y += s.vy * dt;
            if (s.swift) { // 迅速黑球：撞墙后停在原地，等待1秒结算瞬移回血
                s.x = Math.min(Math.max(s.x, bd.x + s.size), bd.x + bd.w - s.size);
                s.y = Math.min(Math.max(s.y, bd.y + s.size), bd.y + bd.h - s.size);
                if (s.x <= bd.x + s.size || s.x >= bd.x + bd.w - s.size) s.vx = 0;
                if (s.y <= bd.y + s.size || s.y >= bd.y + bd.h - s.size) s.vy = 0;
            } else if (s.age > 6 || s.x < bd.x || s.x > bd.x + bd.w || s.y < bd.y || s.y > bd.y + bd.h) {
                if (s.arrow && !s.burstShot && s.owner) s.owner.arrowN = 0; // 普箭漏掉：连击清零
                this.shots.splice(i, 1); continue;
            }
            let hit = false;
            for (const e of this.balls) {
                if (e.dead || e.team === s.team) continue;
                if (Math.hypot(e.x - s.x, e.y - s.y) < e.r + s.size) {
                    if (s.bomb) this._bombHit(s);            // 炸弹：范围爆炸150
                    else if (s.sniper) { // 狙击弹：1%爆头秒杀 / 30%身体命中本次+80% / 其余90
                        const roll = Math.random();
                        if (roll < 0.01) { this._float(e.x, e.y - e.r - 16, '爆头!', '#ff1744'); this._hurt(e, e.hp, true, s.owner); }
                        else if (roll < 0.31) { this._float(e.x, e.y - e.r - 16, '身体命中!', '#ffe082'); this._hurt(e, s.dmg * 1.8, false, s.owner); }
                        else this._hurt(e, s.dmg, false, s.owner);
                    }
                    else if (s.arrow) { // 箭矢：连续命中计数，满5开大；漏箭清零（大招箭不计数）
                        this._hurt(e, s.dmg, false, s.owner);
                        const ow = s.owner;
                        if (ow && !ow.dead && !s.burstShot && ++ow.arrowN >= ow.arrowBurstN) {
                            ow.arrowN = 0;
                            ow.arrowBurst = ow.arrowBurstSec; ow.arrowBurstCd = 0;
                            this._float(ow.x, ow.y - ow.r - 14, '箭雨!', '#ffe082');
                        }
                    }
                    else this._hurt(e, s.dmg, false, s.owner, false, s.charge); // 牙签：单体5伤+5%充能
                    hit = true; break;
                }
            }
            if (hit) { this.shots.splice(i, 1); continue; }
            if (s.swift && s.age >= (s.life || 1)) { // 每个黑球独立结算：1秒未命中即瞬移到该球处并+10血
                this._swiftLand(s);
                this.shots.splice(i, 1);
            }
        }
    }

    // 炸弹爆炸：命中点球直径×bombRange范围内所有敌人吃bombDmg
    _bombHit(s) {
        const rr = s.owner.r * 2 * (s.bombRange || 1);
        this._sparks(s.x, s.y, 14);
        for (const e of this.balls) {
            if (e.dead || e.team === s.team) continue;
            if (Math.hypot(e.x - s.x, e.y - s.y) <= rr + e.r) this._hurt(e, s.dmg, false, s.owner);
        }
    }

    // ===== 宇宙球：波澜结束随机召唤天体（50%小行星/25%小行星带/20%红巨星/4%超行星爆炸/1%中子星）=====
    _uniSummon(ball) {
        if (!this.uni) this.uni = [];
        const r = Math.random();
        const kind = r < 0.50 ? 'ast' : r < 0.75 ? 'belt' : r < 0.95 ? 'giant' : r < 0.99 ? 'nova' : 'neutron';
        const tgt = this._nearestEnemy(ball);
        const s = { kind, x: ball.x, y: ball.y, owner: ball, team: ball.team, tgt,
            t: 0, tick: 0, r: 14, vx: 0, vy: 0, dur: 0, life: 0, charging: false };
        if (kind === 'ast') {            // 小行星：向对方冲去80伤
            const a = tgt ? Math.atan2(tgt.y - s.y, tgt.x - s.x) : Math.random() * Math.PI * 2;
            s.vx = Math.cos(a) * BB_SPEED * 1.7; s.vy = Math.sin(a) * BB_SPEED * 1.7;
            s.r = 16; s.life = 6;
            this._float(s.x, s.y - 30, '小行星!', '#a1887f');
        } else if (kind === 'belt') {    // 小行星带：缠住对方4s，每秒20伤+0.5s晕
            s.dur = 4; s.tick = 1;
            this._float(s.x, s.y - 30, '小行星带!', '#bcaaa4');
        } else if (kind === 'giant') {   // 红巨星：辐射4s(每0.5s/5伤)→向对方冲去130伤
            s.dur = 4; s.tick = 0.5; s.r = 26;
            this._float(s.x, s.y - 34, '红巨星!', '#ff7043');
        } else if (kind === 'nova') {    // 超行星爆炸：降临对方位置0.6s后爆发400伤+5s晕
            if (tgt) { s.x = tgt.x; s.y = tgt.y; }
            s.dur = 0.6; s.r = 26;
            this._float(s.x, s.y - 40, '超行星爆炸!', '#ffee58');
        } else {                        // 中子星：贴脸5s每0.1s/5伤→爆炸上嗜血+中毒5.5s
            s.dur = 5; s.tick = 0.1; s.r = 13;
            this._float(s.x, s.y - 30, '中子星!', '#82b1ff');
        }
        this.uni.push(s);
    }

    // 距某点最近的敌方球（召唤物索敌）
    _nearestEnemy(s) {
        let best = null, bd = Infinity;
        for (const e of this.balls) {
            if (e.dead || e.team === s.team) continue;
            const d = Math.hypot(e.x - s.x, e.y - s.y);
            if (d < bd) { bd = d; best = e; }
        }
        return best;
    }

    // 天体召唤物更新：各自运动学/跳伤/命中结算
    _updateUni(dt) {
        if (!this.uni || !this.uni.length) return;
        const spd = BB_SPEED * 1.8;
        for (let i = this.uni.length - 1; i >= 0; i--) {
            const s = this.uni[i];
            s.t += dt;
            if (s.kind === 'ast') {          // 小行星：追踪冲向敌人，命中80伤
                const tgt = (s.tgt && !s.tgt.dead) ? s.tgt : (s.tgt = this._nearestEnemy(s));
                if (tgt) {
                    const a = Math.atan2(tgt.y - s.y, tgt.x - s.x);
                    const v = Math.hypot(s.vx, s.vy) || spd;
                    s.vx = Math.cos(a) * v; s.vy = Math.sin(a) * v;
                }
                s.x += s.vx * dt; s.y += s.vy * dt;
                let hit = false;
                for (const e of this.balls) {
                    if (e.dead || e.team === s.team) continue;
                    if (Math.hypot(e.x - s.x, e.y - s.y) < e.r + s.r) { this._hurt(e, 80, false, s.owner); hit = true; break; }
                }
                if (hit || s.t > s.life) this.uni.splice(i, 1);
            } else if (s.kind === 'belt') {  // 小行星带：缠着目标转，每秒20伤+0.5s晕
                const tgt = (s.tgt && !s.tgt.dead) ? s.tgt : (s.tgt = this._nearestEnemy(s));
                if (!tgt) { this.uni.splice(i, 1); continue; }
                s.x = tgt.x; s.y = tgt.y; // 跟随目标
                s.tick -= dt;
                if (s.tick <= 0) {
                    s.tick += 1;
                    this._hurt(tgt, 20, false, s.owner);
                    if (!tgt.dead && tgt.stun <= 0 && tgt.stunImm <= 0) tgt.stun = 0.5;
                }
                if (s.t >= s.dur || tgt.dead) this.uni.splice(i, 1);
            } else if (s.kind === 'giant') { // 红巨星：4s辐射(每0.5s/5伤)→冲撞130
                if (!s.charging) {
                    const tgt = (s.tgt && !s.tgt.dead) ? s.tgt : (s.tgt = this._nearestEnemy(s));
                    if (tgt) {
                        s.tick -= dt;
                        if (s.tick <= 0) { s.tick += 0.5; this._hurt(tgt, 5, false, s.owner, true); }
                    }
                    if (s.t >= s.dur) { // 辐射结束→向对方冲去
                        s.charging = true;
                        if (tgt) {
                            const a = Math.atan2(tgt.y - s.y, tgt.x - s.x);
                            s.vx = Math.cos(a) * spd; s.vy = Math.sin(a) * spd;
                        }
                        this._float(s.x, s.y - s.r - 12, '红巨星冲撞!', '#ff7043');
                    }
                } else {
                    const tgt = (s.tgt && !s.tgt.dead) ? s.tgt : (s.tgt = this._nearestEnemy(s));
                    if (tgt) {
                        const a = Math.atan2(tgt.y - s.y, tgt.x - s.x);
                        s.vx = Math.cos(a) * spd; s.vy = Math.sin(a) * spd;
                    }
                    s.x += s.vx * dt; s.y += s.vy * dt;
                    let hit = false;
                    for (const e of this.balls) {
                        if (e.dead || e.team === s.team) continue;
                        if (Math.hypot(e.x - s.x, e.y - s.y) < e.r + s.r) { this._hurt(e, 130, false, s.owner); hit = true; break; }
                    }
                    if (hit || s.t > 10) this.uni.splice(i, 1);
                }
            } else if (s.kind === 'nova') {  // 超行星爆炸：聚爆0.6s→敌方全体400伤+5s晕
                if (s.t >= s.dur) {
                    for (const e of this.balls) {
                        if (e.dead || e.team === s.team) continue;
                        this._hurt(e, 400, false, s.owner);
                        if (!e.dead) { e.stun = 5; e.stunImm = 0; }
                    }
                    this._explode({ x: s.x, y: s.y, color: '#ffee58' });
                    this.uni.splice(i, 1);
                }
            } else {                        // 中子星：贴脸5s每0.1s/5伤→爆：嗜血+中毒5.5s
                const tgt = (s.tgt && !s.tgt.dead) ? s.tgt : (s.tgt = this._nearestEnemy(s));
                if (tgt) { s.x = tgt.x; s.y = tgt.y; } // 锁定贴在目标上
                if (tgt && s.t < s.dur) {
                    s.tick -= dt;
                    if (s.tick <= 0) { s.tick += 0.1; this._hurt(tgt, 5, false, s.owner, true); }
                }
                if (s.t >= s.dur || !tgt) { // 结束后爆炸
                    if (tgt && !tgt.dead) {
                        tgt.lchT = 5.5; tgt.lchIv = 0.5; tgt.lchTick = 0.5; tgt.lchDmg = 5; tgt.lchSrc = s.owner;
                        tgt.psnT = 5.5; tgt.psnIv = 0.5; tgt.psnTick = 0.5; tgt.psnDmg = 15; tgt.psnSrc = s.owner;
                        this._float(tgt.x, tgt.y - tgt.r - 32, '嗜血+中毒!', '#ef5350');
                    }
                    this._sparks(s.x, s.y, 18);
                    this.uni.splice(i, 1);
                }
            }
        }
    }

    // ===== 炸弹球：30s后自爆，无视复活/闪避/护盾直接炸死所有球 =====
    _boomAll(ball) {
        ball.boomed = true;
        this._boomSrc = ball; // 引爆者：全场死光时判它赢
        this._float(ball.x, ball.y - ball.r - 40, 'BOOM!!!', '#ffab00');
        for (const e of this.balls) {
            if (e.dead) continue;
            e.hp = 0;
            e.dead = true;
            this._explode(e);
        }
        this._explode({ x: ball.x, y: ball.y, color: '#ffab00' });
    }

    // ===== 攻击球：连续攻击5次 → 天降巨剑砸向对方头顶（120伤+1.8s眩晕） =====
    _dropSword(owner, target) {
        if (!this.swords) this.swords = [];
        this.swords.push({ x: target.x, ty: target.y - target.r - 6, t: 0, fall: 0.45,
            target, owner, dmg: owner.swordDmg, stunSec: owner.swordStun });
        this._float(target.x, target.y - target.r - 46, '天降巨剑!', '#eceff1');
    }

    // ===== 耐力球药丸：从天而降落到场内随机点（同队可吃） =====
    _dropPills(ball, n) {
        if (!this.pills) this.pills = [];
        const bd = this.bounds;
        for (let i = 0; i < n && this.pills.length < 40; i++) {
            const gold = Math.random() < (ball.pillGoldCh || 0); // 金丸：高回血+附赠护盾
            this.pills.push({
                x: bd.x + 20 + Math.random() * Math.max(0, bd.w - 40),
                y: bd.y - 15,                                   // 从场外顶部落下
                ty: bd.y + 30 + Math.random() * Math.max(0, bd.h - 60),
                vy: 170 + Math.random() * 70,
                r: 7, gold,
                team: ball.team, heal: gold ? ball.pillGoldHeal : ball.pillHeal, // 归属队伍+回血量（队友拾取时用）
                shield: gold ? (ball.pillGoldShield || 0) : 0,
                eHeal: gold ? (ball.pillEnemyGoldHeal || 0) : (ball.pillEnemyHeal || 0), // 敌方吃时回血
                stunCh: ball.pillStunCh || 0, stunSec: ball.pillStunSec || 0, // 敌方吃时眩晕概率/时长
            });
        }
    }

    // 滚动球：当前滚动伤害 = 初始伤害 - 每0.1s×衰减，跌到0为止
    _rollDmgNow(b) { return Math.max(0, Math.round(b.rollDmg - b.rollDecay * 10 * b.rollT)); }

    // 滚动停止：恢复普通移速(随机方向)，重新计4s；减伤续1s；30%概率自晕0.5s；hit=false(撞空)自损40
    _rollEnd(ball, hit) {
        ball.rolling = false;
        ball.rollCd = ball.rollEvery;
        ball.rollReduceT = Math.max(ball.rollReduceT, ball.rollReduceSec);
        const ra = Math.random() * Math.PI * 2;
        const rs = BB_SPEED * ball.spd * (ball.spdMul || 1);
        ball.vx = Math.cos(ra) * rs; ball.vy = Math.sin(ra) * rs;
        this._sparks(ball.x, ball.y, 8);
        if (!hit && ball.rollWallCost) { // 撞空(扑墙或滚到没撞到人)：自损40
            ball.hp -= ball.rollWallCost;
            ball.flash = 1;
            this._float(ball.x, ball.y - ball.r - 14, '-' + ball.rollWallCost, '#ff8a65');
        }
        if (ball.rollStunCh && Math.random() < ball.rollStunCh && ball.stun <= 0) {
            ball.stun = ball.rollStunSec;
            this._float(ball.x, ball.y - ball.r - 32, '眩晕!', '#80cbc4');
        }
    }

    // ===== 打板模式：每球在自己场地弹，撞到自己板掉atk血；3板全碎者胜 =====
    _updatePaddle(dt) {
        for (const ball of this.balls) {
            const f = ball.field;
            ball.flash = Math.max(0, ball.flash - dt * 4);
            ball.padHitCd = Math.max(0, ball.padHitCd - dt);
            ball.x += ball.vx * dt;
            ball.y += ball.vy * dt;
            // 自己场地的四面墙
            if (ball.x < f.x + ball.r) { ball.x = f.x + ball.r; ball.vx = Math.abs(ball.vx); this._onWallHit(ball); }
            if (ball.x > f.x + f.w - ball.r) { ball.x = f.x + f.w - ball.r; ball.vx = -Math.abs(ball.vx); this._onWallHit(ball); }
            if (ball.y < f.y + ball.r) { ball.y = f.y + ball.r; ball.vy = Math.abs(ball.vy); this._onWallHit(ball); }
            if (ball.y > f.y + f.h - ball.r) { ball.y = f.y + f.h - ball.r; ball.vy = -Math.abs(ball.vy); this._onWallHit(ball); }
            // 撞板：推出并按最小穿透轴反弹，每次命中掉 atk 血（0.3s冷却防瞬间融板）
            for (const p of ball.pads) {
                if (p.hp <= 0) continue;
                if (ball.x + ball.r < p.x || ball.x - ball.r > p.x + p.w || ball.y + ball.r < p.y || ball.y - ball.r > p.y + p.h) continue;
                const lo = ball.x + ball.r - p.x, ro = p.x + p.w - (ball.x - ball.r);
                const to = ball.y + ball.r - p.y, bo = p.y + p.h - (ball.y - ball.r);
                const mx = Math.min(lo, ro), my = Math.min(to, bo);
                if (mx < my) { ball.x += lo < ro ? -mx : mx; ball.vx = (lo < ro ? -1 : 1) * Math.abs(ball.vx); }
                else { ball.y += to < bo ? -my : my; ball.vy = (to < bo ? -1 : 1) * Math.abs(ball.vy); }
                if (ball.padHitCd <= 0) {
                    ball.padHitCd = 0.3;
                    p.hp = Math.max(0, p.hp - ball.atk);
                    ball.flash = 1;
                    this._sparks(ball.x, ball.y - ball.r, 6);
                    this._float(ball.x, ball.y - ball.r - 12, '-' + ball.atk, '#ffd54f');
                    if (p.hp <= 0) {
                        this._sparks(p.x + p.w / 2, p.y + p.h / 2, 24);
                        this._float(p.x + p.w / 2, p.y - 6, '板碎!', '#ff8a80');
                    }
                }
                this._perturb(ball);
                this._normalize(ball);
            }
            // 拖尾记录
            ball.trail.push({ x: ball.x, y: ball.y });
            if (ball.trail.length > 14) ball.trail.shift();
            // 胜负：自己3块板全碎即获胜
            if (ball.pads.every(p => p.hp <= 0)) {
                this.phase = 'over';
                this.winner = ball;
                this._overTimer = performance.now() + 900;
                return;
            }
        }
    }

    _renderPaddle(ctx) { // 中场虚线 + 双方精美木板（含木纹、拼缝、金属铆钉、血条与数值）
        const W = this.w || window.innerWidth, H = this.h || window.innerHeight;
        ctx.save();
        ctx.strokeStyle = 'rgba(140,190,255,0.4)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([14, 12]);
        ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
        ctx.restore();

        for (const ball of this.balls) {
            if (!ball.pads) continue;
            for (const p of ball.pads) {
                if (p.hp <= 0) continue;
                const ratio = Math.max(0, p.hp / p.maxHp);
                const woodBase = p.woodType === 'birch' ? '#a1887f' : p.woodType === 'oak' ? '#8d6e63' : '#5d4037';
                const woodDark = p.woodType === 'birch' ? '#6d4c41' : p.woodType === 'oak' ? '#4e342e' : '#3e2723';
                const woodLight = p.woodType === 'birch' ? '#d7ccc8' : p.woodType === 'oak' ? '#bcaaa4' : '#8d6e63';

                ctx.save();
                // 1. 木板柔和底部阴影（立体感）
                ctx.fillStyle = 'rgba(0,0,0,0.45)';
                ctx.beginPath();
                ctx.roundRect ? ctx.roundRect(p.x + 2, p.y + 4, p.w, p.h, 4) : ctx.rect(p.x + 2, p.y + 4, p.w, p.h);
                ctx.fill();

                // 2. 木板本体：渐变木质底色
                const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
                grad.addColorStop(0, woodLight);
                grad.addColorStop(0.18, woodBase);
                grad.addColorStop(0.85, woodBase);
                grad.addColorStop(1, woodDark);
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.roundRect ? ctx.roundRect(p.x, p.y, p.w, p.h, 4) : ctx.rect(p.x, p.y, p.w, p.h);
                ctx.fill();

                // 3. 细腻横向木纹与年轮线条
                ctx.save();
                ctx.beginPath();
                ctx.roundRect ? ctx.roundRect(p.x, p.y, p.w, p.h, 4) : ctx.rect(p.x, p.y, p.w, p.h);
                ctx.clip();

                // 木板中间两道纵向拼缝（将整块大木分成3块木板拼接）
                const seam1 = p.x + p.w * 0.33, seam2 = p.x + p.w * 0.67;
                ctx.strokeStyle = 'rgba(0,0,0,0.35)';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(seam1, p.y); ctx.lineTo(seam1, p.y + p.h);
                ctx.moveTo(seam2, p.y); ctx.lineTo(seam2, p.y + p.h);
                ctx.stroke();
                // 拼缝微高光反光边
                ctx.strokeStyle = 'rgba(255,255,255,0.18)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(seam1 + 1.2, p.y + 1); ctx.lineTo(seam1 + 1.2, p.y + p.h - 1);
                ctx.moveTo(seam2 + 1.2, p.y + 1); ctx.lineTo(seam2 + 1.2, p.y + p.h - 1);
                ctx.stroke();

                // 木纹细纹
                ctx.lineWidth = 1;
                for (let k = 1; k <= 3; k++) {
                    const ly = p.y + k * (p.h / 4);
                    ctx.strokeStyle = 'rgba(40,20,10,0.18)';
                    ctx.beginPath();
                    ctx.moveTo(p.x, ly);
                    ctx.bezierCurveTo(p.x + p.w * 0.3, ly + (k % 2 === 0 ? 1.5 : -1.5), p.x + p.w * 0.7, ly + (k % 2 === 0 ? -1.2 : 1.2), p.x + p.w, ly);
                    ctx.stroke();
                }

                // 4. 两端与拼缝处的铁加固铆钉（增强坚固木器质感）
                const nailX = [p.x + 12, seam1 - 10, seam1 + 10, seam2 - 10, seam2 + 10, p.x + p.w - 12];
                for (const nx of nailX) {
                    // 铆钉底圈
                    ctx.fillStyle = '#263238';
                    ctx.beginPath(); ctx.arc(nx, p.y + p.h / 2, 2.8, 0, Math.PI * 2); ctx.fill();
                    // 铆钉金属高光
                    ctx.fillStyle = '#cfd8dc';
                    ctx.beginPath(); ctx.arc(nx - 0.7, p.y + p.h / 2 - 0.7, 1.2, 0, Math.PI * 2); ctx.fill();
                }

                // 5. 顶面亮沿 + 底面深色阴影边（凹凸立体倒角）
                ctx.fillStyle = 'rgba(255,255,255,0.32)';
                ctx.fillRect(p.x + 1, p.y, p.w - 2, 1.8);
                ctx.fillStyle = 'rgba(0,0,0,0.45)';
                ctx.fillRect(p.x + 1, p.y + p.h - 2, p.w - 2, 2);
                ctx.restore();

                // 6. 木板边框
                ctx.strokeStyle = woodDark;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.roundRect ? ctx.roundRect(p.x, p.y, p.w, p.h, 4) : ctx.rect(p.x, p.y, p.w, p.h);
                ctx.stroke();

                // 7. 板子上方耐久血条（木纹小凹槽内嵌血条）
                const by = p.y - 10, bh = 5;
                ctx.fillStyle = 'rgba(10,16,24,0.7)';
                ctx.beginPath();
                ctx.roundRect ? ctx.roundRect(p.x, by, p.w, bh, 2.5) : ctx.rect(p.x, by, p.w, bh);
                ctx.fill();

                if (ratio > 0) {
                    const hpGrad = ctx.createLinearGradient(p.x, by, p.x + p.w * ratio, by);
                    hpGrad.addColorStop(0, '#81c784');
                    hpGrad.addColorStop(0.5, '#ffb74d');
                    hpGrad.addColorStop(1, '#ff7043');
                    ctx.fillStyle = hpGrad;
                    ctx.beginPath();
                    ctx.roundRect ? ctx.roundRect(p.x, by, p.w * ratio, bh, 2.5) : ctx.rect(p.x, by, p.w * ratio, bh);
                    ctx.fill();
                }
                ctx.strokeStyle = 'rgba(255,255,255,0.2)';
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.roundRect ? ctx.roundRect(p.x, by, p.w, bh, 2.5) : ctx.rect(p.x, by, p.w, bh);
                ctx.stroke();

                // 8. 木板刻字：木雕烙印立体字
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                // 雕刻浅底高光
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.fillText(Math.ceil(p.hp) + ' / ' + p.maxHp, p.x + p.w / 2, p.y + p.h / 2 + 5.2);
                // 雕刻深色阴影
                ctx.fillStyle = '#21120a';
                ctx.fillText(Math.ceil(p.hp) + ' / ' + p.maxHp, p.x + p.w / 2, p.y + p.h / 2 + 4.2);
                // 表面文字
                ctx.fillStyle = '#fff8e1';
                ctx.fillText(Math.ceil(p.hp) + ' / ' + p.maxHp, p.x + p.w / 2, p.y + p.h / 2 + 4.5);

                ctx.restore();
            }
        }
    }

    // 撞墙：随机偏转防轨迹循环 + 恢复特征速度 + 撞墙成长（速度球每15次升级：+10攻+0.5速）
    _onWallHit(ball) {
        if (ball.rolling) { this._rollEnd(ball); return; } // 滚动扑墙：撞空自损40在_rollEnd里
        if (ball.wallInvSec && ball.wallInvT <= 0) this._float(ball.x, ball.y - ball.r - 14, '碰墙减伤!', '#9e9e9e');
        if (ball.wallInvSec) ball.wallInvT = ball.wallInvSec; // 黑色白板：每次碰墙刷新1s减伤
        this._perturb(ball);
        this._normalize(ball);
        if (ball.wallEvery && ++ball.wallHits % ball.wallEvery === 0) {
            ball.wallEvery += ball.wallBonus; // 撞墙需求递增：15→18→24→36…（+3→+6→+12）
            ball.wallBonus *= 2;
            ball.atk += ball.wallGrow;
            ball.spd += ball.wallSpd; // 每升级一次攻击力同时+0.5速度
            if (ball.wallHp) ball.hp = Math.min(ball.maxHp + ball.overMax, ball.hp + ball.wallHp); // +75血，可超上限至金色血条
            this._float(ball.x, ball.y - ball.r - 14, '+' + ball.wallGrow + '攻 +' + ball.wallSpd + '速' + (ball.wallHp ? ' +' + ball.wallHp + '血' : ''), '#80d8ff');
        }
    }

    // 反弹时加小随机偏转，避免轨迹循环
    _perturb(ball) {
        const ang = Math.atan2(ball.vy, ball.vx) + (Math.random() - 0.5) * 0.3;
        const spd = Math.hypot(ball.vx, ball.vy);
        ball.vx = Math.cos(ang) * spd;
        ball.vy = Math.sin(ang) * spd;
    }

    // 恢复球自身特征速度
    _normalize(ball) {
        const spd = BB_SPEED * (ball.spd !== undefined ? ball.spd : BB_TYPES[ball.type].spd) * (ball.spdMul || 1);
        const cur = Math.hypot(ball.vx, ball.vy) || 1;
        ball.vx = ball.vx / cur * spd;
        ball.vy = ball.vy / cur * spd;
    }

    // 球内SVG图标：BB_TYPES[].icon为svg内部元素，懒加载缓存为Image
    _iconImg(type, superOn, dark) {
        if (!this._iconCache) this._iconCache = {};
        const t = BB_TYPES[type];
        const dk = dark || !!(t && t.iconDark); // 浅色球体用深色描边，否则白球白图标看不见
        const key = type + (superOn ? '_s' : '') + (dk ? '_d' : ''); // 超态用iconSuper（启动球生气脸）
        if (this._iconCache[key] !== undefined) return this._iconCache[key];
        const ic = superOn && t && t.iconSuper ? t.iconSuper : (t ? t.icon : null);
        let img = null;
        if (ic) {
            img = new Image();
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
                'stroke="' + (dk ? 'rgba(55,65,81,0.92)' : 'rgba(255,255,255,0.92)') + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
                ic + '</svg>');
        }
        this._iconCache[key] = img;
        return img;
    }

    _float(x, y, text, color) {
        this.floats.push({ x, y, text, color, born: performance.now() });
    }

    _sparks(x, y, n) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = 60 + Math.random() * 160;
            this.particles.push({
                x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                color: '#fff', born: performance.now(),
                life: 300 + Math.random() * 300, r: 2 + Math.random() * 3,
            });
        }
    }

    _onKill(ball) {
        const now = performance.now();
        this.shakeT = 0.45;
        this.slowT = 0.3;
        this._sparks(ball.x, ball.y, 24);
        const k = ball.lastHitBy;
        if (!k || k.dead || BB_TYPES[ball.type].minion) return;
        k.kills++;
        if (k.ultType) k.energy = Math.min(100, k.energy + 25); // 击杀充能
        if (now - (k.lastKillAt || 0) < 4000) k.streak = (k.streak || 1) + 1; else k.streak = 1;
        k.lastKillAt = now;
        const names = ['', '', '双杀!', '三连杀!', '四连杀!', '超神!'];
        if (k.streak >= 2) this.killBanner = { text: k.name + ' ' + names[Math.min(5, k.streak)], color: k.glow || k.color, born: now };
    }

    _recordStats() {
        if (this.paddleBattle || this._statsDone) return;
        this._statsDone = true;
        try {
            const data = JSON.parse(localStorage.getItem(bbStatKey()) || '{}');
            const seen = new Set();
            const statBalls = this.arena ? (this.arena.statBalls || []) : this.balls;
            for (const b of statBalls) {
                const bt = BB_TYPES[b.srcType || b.type];
                if (bt && bt.minion) continue;
                const t = b.statKey || b.srcType || b.type; // 皮肤变体单独记账
                const d = data[t] = data[t] || { g: 0, w: 0 };
                if (!seen.has(t)) { d.g++; seen.add(t); }
            }
            if (this.winner) {
                const wbt = BB_TYPES[this.winner.srcType || this.winner.type];
                const wt = this.winner.statKey || this.winner.srcType || this.winner.type;
                if (data[wt] && wbt && !wbt.minion) data[wt].w++;
            }
            localStorage.setItem(bbStatKey(), JSON.stringify(data));
        } catch (e) { /* ignore */ }
    }

    _showStats() {
        let data = {};
        try { data = JSON.parse(localStorage.getItem(bbStatKey()) || '{}'); } catch (e) { /* ignore */ }
        document.querySelectorAll('#ballSelectPanel .bb-card').forEach(card => {
            const eq = bbEquipped(card.dataset.type);
            const label = (eq && BB_SKINS[eq] ? BB_SKINS[eq].name + ' ' : '');
            const d = data[eq || card.dataset.type]; // 当前装备形态的战绩
            let s = card.querySelector('.bb-wr');
            if (!s) { s = document.createElement('div'); s.className = 'bb-wr'; s.style.cssText = 'font-size:11px;color:#ffd54f;margin-top:2px'; card.appendChild(s); }
            s.textContent = d && d.g ? label + '胜率 ' + Math.round(d.w / d.g * 100) + '% · ' + d.g + '局' : label + '暂无战绩';
        });
    }

    // ===== 皮肤商店：小宇币购买，可装备/卸下，按账号存 =====
    _showSkins() {
        const sv = bbSkinSave();
        const eq = sv.equipped || {};
        document.getElementById('bbCoinNow').textContent = '小宇币: ' + bbCoins();
        const box = document.getElementById('bbSkinItems');
        box.innerHTML = '';
        for (const [id, sk] of Object.entries(BB_SKINS)) {
            const owned = sv.owned && sv.owned.includes(id);
            const equipped = eq[sk.base] === id;
            const it = document.createElement('div');
            it.style.cssText = 'border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:8px 12px;min-width:160px;background:rgba(255,255,255,.05)';
            it.innerHTML = '<div style="font-weight:bold;color:#fff">' + sk.name + '</div>' +
                '<div style="font-size:12px;color:#b0bec5;margin:4px 0 8px">' + BB_TYPES[sk.base].name + '皮肤 · ' + sk.price + '币<br>' + (sk.desc || '') + '</div>';
            const btn = document.createElement('button');
            btn.className = 'bb-btn bb-btn2';
            btn.style.cssText = 'padding:4px 14px;font-size:13px' + (equipped ? ';border-color:#ffd54f;color:#ffd54f' : '');
            btn.textContent = !owned ? '购买(' + sk.price + '币)' : (equipped ? '卸下' : '装备');
            btn.addEventListener('click', () => this._skinAction(id));
            it.appendChild(btn);
            box.appendChild(it);
        }
        document.getElementById('ballSkinPanel').style.display = 'flex';
    }

    _skinAction(id) {
        const sk = BB_SKINS[id];
        if (!sk) return;
        const sv = bbSkinSave();
        sv.owned = sv.owned || [];
        sv.equipped = sv.equipped || {};
        if (!sv.owned.includes(id)) {
            const c = bbCoins();
            if (c < sk.price) { alert('小宇币不足(需' + sk.price + ',当前' + c + ')'); return; }
            try { localStorage.setItem(bbCoinKey(), String(c - sk.price)); } catch (e) { /* ignore */ }
            sv.owned.push(id);
            sv.equipped[sk.base] = id; // 购买即装备
        } else if (sv.equipped[sk.base] === id) {
            delete sv.equipped[sk.base]; // 卸下
        } else {
            sv.equipped[sk.base] = id; // 装备
        }
        try { localStorage.setItem(bbSkinKey(), JSON.stringify(sv)); } catch (e) { /* ignore */ }
        this._showSkins();
        this._refreshSelect();
        this._showStats();
    }

    // ===== 擂台赛：先锁擂主 → 按点击顺序选挑战者 → 赛前展示 → 擂主逐场挑战 =====
    _arenaStart() {
        this._dailyPending = null;
        this.paddleSel = null;
        this.teamSel = null;
        this.arena = null;
        this.arenaSel = { stage: 'king', king: null, challengers: [] };
        this.picks = [];
        document.getElementById('bbTeamCfg').style.display = 'none';
        this._refreshSelect();
    }

    _arenaPick(type) {
        const a = this.arenaSel;
        if (!a || !BB_TYPES[type] || BB_TYPES[type].elim) return;
        if (a.stage === 'king') {
            this.picks = this.picks[0] === type ? [] : [type]; // 只能选1个擂主，再点一次可取消
        } else {
            if (type === a.king) return; // 擂主不能同时当挑战者
            const idx = this.picks.indexOf(type);
            if (idx >= 0) this.picks.splice(idx, 1);
            else this.picks.push(type); // 保留点击顺序，不限挑战者数量
        }
        this._refreshSelect();
    }

    _arenaConfirm() {
        const a = this.arenaSel;
        if (!a) return;
        if (a.stage === 'king') {
            if (this.picks.length !== 1) return;
            a.king = this.picks[0];
            a.stage = 'challengers';
            this.picks = [];
            this._refreshSelect();
            return;
        }
        if (!this.picks.length) return;
        a.challengers = this.picks.slice();
        this._showArenaIntro();
    }

    _arenaCardHtml(type, label, delay) {
        const b = this._makeBall(type, 0, 0);
        const t = BB_TYPES[type];
        const stroke = b.iconDark ? 'rgba(55,65,81,0.92)' : 'rgba(255,255,255,0.92)';
        return '<div class="bb-arena-fighter" style="animation-delay:' + delay + 'ms">' +
            '<div class="bb-arena-tag">' + label + '</div>' +
            '<div class="bb-arena-ball" style="background:' + b.color + ';box-shadow:0 0 26px ' + b.glow + '">' +
            '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="' + stroke + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (t.icon || '') + '</svg>' +
            '</div><div class="bb-arena-name">' + b.name + '</div></div>';
    }

    _showArenaIntro() {
        const a = this.arenaSel;
        if (!a || !a.king || !a.challengers.length) return;
        const king = this._makeBall(a.king, 0, 0);
        document.getElementById('bbArenaTitle').textContent = '谁能战胜[' + king.name + ']？';
        const list = document.getElementById('bbArenaIntroList');
        list.innerHTML = this._arenaCardHtml(a.king, '擂主', 0) +
            '<div class="bb-arena-vs">VS</div>' +
            '<div class="bb-arena-challengers">' +
            a.challengers.map((t, i) => this._arenaCardHtml(t, '挑战者 ' + (i + 1), 220 + i * 160)).join('') +
            '</div>';
        document.getElementById('ballSelectPanel').style.display = 'none';
        document.getElementById('ballArenaIntro').style.display = 'flex';
    }

    _arenaIntroBack() { // 赛前返回：重新选择擂主和挑战者
        document.getElementById('ballArenaIntro').style.display = 'none';
        document.getElementById('ballSelectPanel').style.display = 'flex';
        this.arenaSel = { stage: 'king', king: null, challengers: [] };
        this.picks = [];
        this._refreshSelect();
    }

    _arenaLaunch() {
        const a = this.arenaSel;
        if (!a || !a.king || !a.challengers.length) return;
        this.arena = {
            kingType: a.king,
            challengers: a.challengers.slice(),
            king: null, current: null, round: 1, defeater: null,
            result: null, roundResult: null, roundWait: 0, statBalls: [],
        };
        this.picks = [a.king].concat(a.challengers); // 战绩统计包含全部参赛球
        this.arenaSel = null;
        document.getElementById('ballArenaIntro').style.display = 'none';
        this._startBattle();
    }

    _arenaAdvance() { // Win/Wasted等待结束：无论本场输赢，都先让全部挑战者打完
        const a = this.arena;
        const now = performance.now();
        if (!a) { this.phase = 'over'; return; }
        const kingWon = a.roundResult === 'Win';
        a.roundResult = null;
        a.roundWait = 0;
        if (!kingWon) { // 擂主输过任意一场：整场最终记Wasted，但继续挑战剩余球
            a.result = 'wasted';
            a.defeater = this.winner || a.defeater;
        }
        if (a.round >= a.challengers.length) { // 所有挑战者打完后才总结算
            if (a.result !== 'wasted') a.result = 'win';
            else if (a.defeater) this.winner = a.defeater; // 战绩胜场记给击败擂主的挑战者
            this.phase = 'over';
            this._overTimer = now + 900;
            return;
        }
        a.round++;
        this._arenaSpawnRound();
    }

    _arenaSpawnRound() { // 开启新一场：擂主重新生成，不继承上一场的任何状态
        const a = this.arena;
        const W = this.w || window.innerWidth, H = this.h || window.innerHeight;
        const bd = { x: 0, y: 0, w: W, h: H };
        this.bounds = bd;
        this.battleTime = 0;
        this.winner = null;
        this._overTimer = 0;
        this.slowT = 0;
        this.shakeT = 0;
        this.floats = [];
        this.particles = [];
        this.pills = [];
        this.mines = [];
        this.shots = [];
        this.swords = [];
        this.uni = [];
        this.waves = [];
        this._boomSrc = null;
        this.edgeCurse = null;
        this.killBanner = null;
        this.synergyMsg = '';
        const king = this._makeBall(a.kingType, bd.x + bd.w * 0.28, bd.y + bd.h * 0.5);
        const foe = this._makeBall(a.challengers[a.round - 1], bd.x + bd.w * 0.72, bd.y + bd.h * 0.5);
        king.team = 0;
        foe.team = 1;
        this.balls = [king, foe];
        a.king = king;
        a.current = foe;
        a.statBalls.push(king, foe);
        this.timeMul = this.balls.some(b => b.pillEvery) ? 1.8 : 1;
        this._applySynergy();
        this.phase = 'battle';
        this._float(king.x, king.y - king.r - 20, '擂主满状态登场!', king.glow || king.color);
        this._float(foe.x, foe.y - foe.r - 20, '第' + a.round + '位挑战者 ' + foe.name + '上场!', '#42a5f5');
        this._sparks(king.x, king.y, 14);
        this._sparks(foe.x, foe.y, 14);
    }

    _explode(ball) {
        for (let i = 0; i < 40; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = 80 + Math.random() * 300;
            this.particles.push({
                x: ball.x, y: ball.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                color: ball.color, born: performance.now(),
                life: 500 + Math.random() * 600, r: 3 + Math.random() * 5,
            });
        }
    }

    _rr(ctx, x, y, w, h, r) {
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    _render() {
        const ctx = this.ctx;
        const dpr = this.dpr || 1;
        const W = this.w || window.innerWidth;
        const H = this.h || window.innerHeight;
        const now = performance.now();

        ctx.save();
        ctx.scale(dpr, dpr);
        if (this.shakeT > 0) ctx.translate((Math.random() - 0.5) * 14 * this.shakeT / 0.45, (Math.random() - 0.5) * 14 * this.shakeT / 0.45);

        // 1. 深度太空科技竞技场底图（径向星云渐变 + 柔和暗角）
        const bgGrad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.1, W / 2, H / 2, Math.max(W, H) * 0.75);
        bgGrad.addColorStop(0, '#101d36');
        bgGrad.addColorStop(0.55, '#091122');
        bgGrad.addColorStop(1, '#030712');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // 2. 科技网格与全息能量环
        ctx.save();
        ctx.strokeStyle = 'rgba(64, 150, 255, 0.04)';
        ctx.lineWidth = 1;
        const gridStep = 48;
        for (let x = 0; x < W; x += gridStep) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        }
        for (let y = 0; y < H; y += gridStep) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(64, 180, 255, 0.07)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 12]);
        ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.min(W, H) * 0.28, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.min(W, H) * 0.42, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // 2.5 漂浮星尘：缓慢上飘的微光粒子，增加空间感
        ctx.save();
        for (let i = 0; i < 46; i++) {
            const sx = (i * 137.5 + Math.sin(now / 4000 + i) * 12) % W;
            const sy = (H - ((now / (30 + (i % 5) * 8) + i * 61) % H));
            ctx.globalAlpha = 0.12 + 0.18 * Math.abs(Math.sin(now / 900 + i));
            ctx.fillStyle = i % 3 ? '#9ecbff' : '#ffffff';
            ctx.beginPath(); ctx.arc(sx, sy, 0.8 + (i % 3) * 0.6, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();

        // 3. 场地边界：场外暗化 + 赛博高能激光结界
        const bd = this.bounds;
        if (bd) {
            const fg = ctx.createRadialGradient(bd.x + bd.w / 2, bd.y + bd.h / 2, 10, bd.x + bd.w / 2, bd.y + bd.h / 2, Math.max(bd.w, bd.h) * 0.6);
            fg.addColorStop(0, 'rgba(70,130,255,0.10)'); fg.addColorStop(1, 'rgba(70,130,255,0)');
            ctx.fillStyle = fg; ctx.fillRect(bd.x, bd.y, bd.w, bd.h);
            ctx.fillStyle = 'rgba(5, 2, 6, 0.65)';
            ctx.fillRect(0, 0, W, bd.y);
            ctx.fillRect(0, bd.y + bd.h, W, H - bd.y - bd.h);
            ctx.fillRect(0, bd.y, bd.x, bd.h);
            ctx.fillRect(bd.x + bd.w, bd.y, W - bd.x - bd.w, bd.h);

            const isCritical = bd.w < BB_MIN_W + 80 || bd.h < BB_MIN_H + 80;
            ctx.save();
            ctx.strokeStyle = isCritical ? '#ff1744' : '#ff5252';
            ctx.shadowColor = isCritical ? 'rgba(255,23,68,0.95)' : 'rgba(255,82,82,0.85)';
            ctx.shadowBlur = 18;
            ctx.lineWidth = isCritical ? 3.5 : 2.5;
            ctx.strokeRect(bd.x, bd.y, bd.w, bd.h);

            // 四角能量锚点
            const cs = 14;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(bd.x, bd.y + cs); ctx.lineTo(bd.x, bd.y); ctx.lineTo(bd.x + cs, bd.y); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bd.x + bd.w - cs, bd.y); ctx.lineTo(bd.x + bd.w, bd.y); ctx.lineTo(bd.x + bd.w, bd.y + cs); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bd.x, bd.y + bd.h - cs); ctx.lineTo(bd.x, bd.y + bd.h); ctx.lineTo(bd.x + cs, bd.y + bd.h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bd.x + bd.w - cs, bd.y + bd.h); ctx.lineTo(bd.x + bd.w, bd.y + bd.h); ctx.lineTo(bd.x + bd.w, bd.y + bd.h - cs); ctx.stroke();
            ctx.restore();
        } else {
            ctx.strokeStyle = 'rgba(100,180,255,0.3)';
            ctx.lineWidth = 2;
            ctx.strokeRect(6, 6, W - 12, H - 12);
        }

        // 打板模式：中场线+板
        if (this.paddleBattle) this._renderPaddle(ctx);

        // 耐力球药丸：绿丸+白十字
        if (this.pills) {
            for (const p of this.pills) {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(0.6);
                ctx.fillStyle = p.gold ? '#ffd54f' : '#66bb6a'; // 金丸金色、普通绿色
                ctx.beginPath();
                ctx.arc(0, 0, p.r, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.35)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.fillStyle = '#fff';
                ctx.fillRect(-1.5, -4.5, 3, 9);
                ctx.fillRect(-4.5, -1.5, 9, 3);
                ctx.restore();
            }
        }

        // 地雷球地雷：深色圆盘+红色虚线警戒圈+外圈刺钉+闪烁红点
        if (this.mines) {
            for (const mn of this.mines) {
                ctx.fillStyle = '#455a64';
                ctx.beginPath(); ctx.arc(mn.x, mn.y, mn.r, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = 'rgba(255,82,82,.8)';
                ctx.lineWidth = 2.5;
                ctx.setLineDash([10, 8]);
                ctx.beginPath(); ctx.arc(mn.x, mn.y, mn.r, 0, Math.PI * 2); ctx.stroke();
                ctx.setLineDash([]);
                ctx.strokeStyle = '#263238';
                ctx.lineWidth = mn.small ? 2.5 : 3.5;
                const spikes = mn.small ? 5 : 8;
                for (let i = 0; i < spikes; i++) { // 外圈刺钉
                    const a = i / spikes * Math.PI * 2;
                    ctx.beginPath();
                    ctx.moveTo(mn.x + Math.cos(a) * (mn.r - 4), mn.y + Math.sin(a) * (mn.r - 4));
                    ctx.lineTo(mn.x + Math.cos(a) * (mn.r + 7), mn.y + Math.sin(a) * (mn.r + 7));
                    ctx.stroke();
                }
                if (Math.floor(this.battleTime * 3) % 2 === 0) { // 中心红点闪烁
                    ctx.fillStyle = '#ff5252';
                    ctx.beginPath(); ctx.arc(mn.x, mn.y, mn.small ? 4 : 6, 0, Math.PI * 2); ctx.fill();
                }
            }
        }

        // 黑色白板大招中：场地边界泛暗色侵蚀光
        if (this.edgeCurse && this.bounds) {
            const ebd = this.bounds;
            ctx.save();
            ctx.strokeStyle = 'rgba(96,125,139,' + (0.5 + 0.25 * Math.sin(now / 150)) + ')';
            ctx.lineWidth = 14;
            ctx.strokeRect(ebd.x + 7, ebd.y + 7, ebd.w - 14, ebd.h - 14);
            ctx.restore();
        }

        // 启动球牙签（短线条）/炸弹（发光橙球）
        if (this.shots) {
            for (const s of this.shots) {
                if (s.bomb) {
                    ctx.save();
                    ctx.shadowColor = '#ff7043'; ctx.shadowBlur = 12;
                    ctx.fillStyle = '#ff7043';
                    ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                } else if (s.dragon) { // 龙王召唤龙：金色蛇身+龙头龙角
                    const sa = Math.atan2(s.vy, s.vx), ca = Math.cos(sa), si = Math.sin(sa);
                    ctx.save();
                    for (let k = 4; k >= 1; k--) { // 蛇身：越靠后越小越透明
                        ctx.globalAlpha = 0.85 - k * 0.15;
                        ctx.fillStyle = '#ffb300';
                        ctx.beginPath(); ctx.arc(s.x - ca * s.size * k * 0.9, s.y - si * s.size * k * 0.9, s.size * (0.75 - k * 0.1), 0, Math.PI * 2); ctx.fill();
                    }
                    ctx.globalAlpha = 1;
                    ctx.shadowColor = '#ffd54f'; ctx.shadowBlur = 16;
                    ctx.fillStyle = '#ffca28';
                    ctx.beginPath(); ctx.arc(s.x, s.y, s.size * 0.8, 0, Math.PI * 2); ctx.fill(); // 龙头
                    ctx.shadowBlur = 0;
                    ctx.strokeStyle = '#ff6f00'; ctx.lineWidth = 2.5; // 龙角
                    ctx.beginPath();
                    ctx.moveTo(s.x + ca * s.size * 0.5 - si * s.size * 0.4, s.y + si * s.size * 0.5 + ca * s.size * 0.4);
                    ctx.lineTo(s.x + ca * s.size * 1.1 - si * s.size * 0.9, s.y + si * s.size * 1.1 + ca * s.size * 0.9);
                    ctx.moveTo(s.x + ca * s.size * 0.5 + si * s.size * 0.4, s.y + si * s.size * 0.5 - ca * s.size * 0.4);
                    ctx.lineTo(s.x + ca * s.size * 1.1 + si * s.size * 0.9, s.y + si * s.size * 1.1 - ca * s.size * 0.9);
                    ctx.stroke();
                    ctx.fillStyle = '#b71c1c'; // 龙目
                    ctx.beginPath(); ctx.arc(s.x + ca * s.size * 0.35, s.y + si * s.size * 0.35, 2.4, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                } else if (s.square) { // 方形白弹：旋转白方块+拖尾
                    const sa = Math.atan2(s.vy, s.vx);
                    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    ctx.moveTo(s.x - Math.cos(sa) * s.size * 2.6, s.y - Math.sin(sa) * s.size * 2.6);
                    ctx.lineTo(s.x, s.y);
                    ctx.stroke();
                    ctx.save();
                    ctx.translate(s.x, s.y); ctx.rotate(sa);
                    ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 14; ctx.fillStyle = '#ffffff';
                    ctx.fillRect(-s.size / 2, -s.size / 2, s.size, s.size);
                    ctx.restore();
                } else if (s.swift) { // 迅速黑球：黑色弹体+青色描边，便于和普通小弹区分
                    ctx.save();
                    ctx.shadowColor = '#111111'; ctx.shadowBlur = 10;
                    ctx.fillStyle = '#111111';
                    ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill();
                    ctx.shadowBlur = 0;
                    ctx.strokeStyle = '#84ffff'; ctx.lineWidth = 2;
                    ctx.stroke();
                    ctx.restore();
                } else if (s.small) { // 远程球的小球弹：发光圆点
                    ctx.save();
                    ctx.shadowColor = s.col || '#fff'; ctx.shadowBlur = 8;
                    ctx.fillStyle = s.col || '#fff';
                    ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                } else if (s.arrow) { // 箭矢：箭杆+箭头+尾羽
                    const sa = Math.atan2(s.vy, s.vx), ca = Math.cos(sa), si = Math.sin(sa);
                    ctx.strokeStyle = '#a1887f';
                    ctx.lineWidth = 2;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(s.x - ca * s.size * 1.8, s.y - si * s.size * 1.8);
                    ctx.lineTo(s.x + ca * s.size * 1.4, s.y + si * s.size * 1.4);
                    ctx.stroke();
                    ctx.lineCap = 'butt';
                    ctx.fillStyle = '#eceff1'; // 箭头
                    ctx.beginPath();
                    ctx.moveTo(s.x + ca * s.size * 2.4, s.y + si * s.size * 2.4);
                    ctx.lineTo(s.x + ca * s.size * 1.0 - si * 2.6, s.y + si * s.size * 1.0 + ca * 2.6);
                    ctx.lineTo(s.x + ca * s.size * 1.0 + si * 2.6, s.y + si * s.size * 1.0 - ca * 2.6);
                    ctx.fill();
                    ctx.strokeStyle = '#ffab91'; // 尾羽
                    ctx.lineWidth = 1.6;
                    ctx.beginPath();
                    ctx.moveTo(s.x - ca * s.size * 1.8, s.y - si * s.size * 1.8);
                    ctx.lineTo(s.x - ca * s.size * 2.4 - si * 2, s.y - si * s.size * 2.4 + ca * 2);
                    ctx.moveTo(s.x - ca * s.size * 1.8, s.y - si * s.size * 1.8);
                    ctx.lineTo(s.x - ca * s.size * 2.4 + si * 2, s.y - si * s.size * 2.4 - ca * 2);
                    ctx.stroke();
                } else if (s.sniper) { // 狙击弹：中等弹丸+短拖尾
                    const sa = Math.atan2(s.vy, s.vx);
                    ctx.strokeStyle = 'rgba(255,241,118,.7)';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(s.x - Math.cos(sa) * s.size * 3.2, s.y - Math.sin(sa) * s.size * 3.2);
                    ctx.lineTo(s.x, s.y);
                    ctx.stroke();
                    ctx.save();
                    ctx.shadowColor = '#fff59d'; ctx.shadowBlur = 10;
                    ctx.fillStyle = '#fff59d';
                    ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                } else {
                    const sa = Math.atan2(s.vy, s.vx);
                    ctx.strokeStyle = '#eceff1';
                    ctx.lineWidth = 2.5;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(s.x - Math.cos(sa) * s.size, s.y - Math.sin(sa) * s.size);
                    ctx.lineTo(s.x + Math.cos(sa) * s.size, s.y + Math.sin(sa) * s.size);
                    ctx.stroke();
                    ctx.lineCap = 'butt';
                }
            }
        }

        // 攻击球天降巨剑：剑尖朝下从屏幕上方砸向目标头顶
        if (this.swords) {
            for (const s of this.swords) {
                const p = Math.min(1, s.t / s.fall);
                const sy = s.ty - 30 - (1 - p) * 170;
                ctx.save();
                ctx.translate(s.x, sy);
                ctx.shadowColor = '#eceff1'; ctx.shadowBlur = 14;
                ctx.fillStyle = '#b0bec5'; // 剑身（尖朝下）
                ctx.beginPath();
                ctx.moveTo(0, 34);
                ctx.lineTo(-9, -6); ctx.lineTo(-9, -26);
                ctx.lineTo(9, -26); ctx.lineTo(9, -6);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#ffd54f'; // 剑格
                ctx.fillRect(-17, -30, 34, 6);
                ctx.fillStyle = '#8d6e63'; // 剑柄
                ctx.fillRect(-3.5, -42, 7, 12);
                ctx.restore();
            }
        }

        // 宇宙球天体召唤物
        if (this.uni) {
            for (const s of this.uni) {
                ctx.save();
                if (s.kind === 'ast') {          // 小行星：棕灰岩球+陨坑
                    ctx.shadowColor = '#a1887f'; ctx.shadowBlur = 10;
                    ctx.fillStyle = '#8d6e63';
                    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#6d4c41';
                    ctx.beginPath(); ctx.arc(s.x - 4, s.y - 3, 4, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(s.x + 5, s.y + 4, 3, 0, Math.PI * 2); ctx.fill();
                } else if (s.kind === 'belt') {   // 小行星带：环绕目标的小岩块
                    const rr = (s.tgt && !s.tgt.dead ? s.tgt.r : 30) + 20;
                    ctx.fillStyle = '#a1887f';
                    for (let k = 0; k < 7; k++) {
                        const aa = now / 280 + k * Math.PI * 2 / 7;
                        ctx.beginPath();
                        ctx.arc(s.x + Math.cos(aa) * rr, s.y + Math.sin(aa) * rr * 0.62, 4.5, 0, Math.PI * 2);
                        ctx.fill();
                    }
                } else if (s.kind === 'giant') {  // 红巨星：大红球+光冕脉动
                    ctx.shadowColor = '#ff5722'; ctx.shadowBlur = 26;
                    ctx.fillStyle = '#ff5722';
                    const rr = s.r * (1 + 0.07 * Math.sin(now / 150));
                    ctx.beginPath(); ctx.arc(s.x, s.y, rr, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#ffab91';
                    ctx.beginPath(); ctx.arc(s.x - rr * 0.26, s.y - rr * 0.26, rr * 0.38, 0, Math.PI * 2); ctx.fill();
                    if (s.charging) { // 冲刺尾焰
                        ctx.strokeStyle = 'rgba(255,87,34,0.55)'; ctx.lineWidth = 5;
                        ctx.beginPath();
                        ctx.moveTo(s.x - s.vx * 0.09, s.y - s.vy * 0.09);
                        ctx.lineTo(s.x, s.y); ctx.stroke();
                    }
                } else if (s.kind === 'nova') {   // 超行星：聚爆中的亮星→爆发
                    const p = Math.min(1, s.t / s.dur);
                    ctx.shadowColor = '#ffee58'; ctx.shadowBlur = 32;
                    ctx.fillStyle = '#fff9c4';
                    ctx.beginPath(); ctx.arc(s.x, s.y, s.r * (0.55 + p * 0.9), 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = 'rgba(255,235,59,' + (0.3 + p * 0.7) + ')'; ctx.lineWidth = 3;
                    ctx.beginPath(); ctx.arc(s.x, s.y, s.r + p * 26 + Math.sin(now / 60) * 4, 0, Math.PI * 2); ctx.stroke();
                } else {                        // 中子星：蓝白小亮球+脉冲环
                    ctx.shadowColor = '#82b1ff'; ctx.shadowBlur = 26;
                    ctx.fillStyle = '#e3f2fd';
                    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
                    const ph = (now % 400) / 400;
                    ctx.strokeStyle = 'rgba(130,177,255,' + (1 - ph) + ')'; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.arc(s.x, s.y, s.r + 6 + ph * 22, 0, Math.PI * 2); ctx.stroke();
                }
                ctx.restore();
            }
        }

        // 粒子
        for (const p of this.particles) {
            const t = 1 - (now - p.born) / p.life;
            if (t <= 0) continue; // 过期粒子跳过：负半径arc会让整帧渲染崩溃→alpha残留=残影
            ctx.globalAlpha = Math.min(1, t);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * t, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // 大招伤害光波（扩散发光环）
        if (this.waves) {
            for (const w of this.waves) {
                const p = w.r / w.maxR;
                ctx.save();
                ctx.globalAlpha = Math.max(0, 0.85 - p * 0.7);
                ctx.strokeStyle = w.col;
                ctx.lineWidth = 26 * (1 - p) + 6;
                ctx.shadowColor = w.col;
                ctx.shadowBlur = 24;
                ctx.beginPath();
                ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        }

        // 球
        for (const ball of this.balls) {
            if (ball.hp <= 0) continue;
            ctx.save();
            if (ball.rollWindup > 0) ctx.translate((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5); // 蓄力颤动
            // 柔和地面投影（营造立体浮空感）
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.beginPath();
            ctx.ellipse(ball.x, ball.y + ball.r * 0.92, ball.r * 0.82, ball.r * 0.32, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // 拖尾（小尺寸渐隐残影：明显小于球体，避免看起来像球群复制）
            for (let i = 0; i < ball.trail.length; i++) {
                const tp = ball.trail[i];
                const t = i / ball.trail.length;
                ctx.globalAlpha = t * 0.18;
                ctx.fillStyle = ball.glow || ball.color;
                ctx.beginPath();
                ctx.arc(tp.x, tp.y, ball.r * t * 0.42, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            if (ball.synOn) { // 羁绊激活：金色描边
                ctx.save(); ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 3; ctx.shadowColor = '#ffd54f'; ctx.shadowBlur = 12;
                ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r + 5, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
            }
            if (ball.hp > 0 && ball.hp < ball.maxHp * 0.25) { // 危险：红光脉动
                ctx.save(); ctx.strokeStyle = 'rgba(255,23,68,' + (0.45 + 0.35 * Math.sin(now / 110)) + ')'; ctx.lineWidth = 4;
                ctx.shadowColor = '#ff1744'; ctx.shadowBlur = 18;
                ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r + 8, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
            }
            if (ball.ultSpeed > 0) { // 疾风连突中：蓝白脉冲环标记无敌
                ctx.save();
                ctx.strokeStyle = 'rgba(128,216,255,' + (0.5 + 0.4 * Math.sin(now / 60)) + ')';
                ctx.lineWidth = 4;
                ctx.shadowColor = '#80d8ff'; ctx.shadowBlur = 22;
                ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r + 10, 0, Math.PI * 2); ctx.stroke();
                ctx.restore();
            }
            // 骑士长枪：出手时向目标方向突刺（0.45s内先伸出再收回），枪柄藏在球体下方
            if (ball.lanceFx > 0) {
                const p = 1 - ball.lanceFx / 0.45;              // 0→1
                const ext = p < 0.35 ? p / 0.35 : 1 - (p - 0.35) / 0.65; // 前35%刺出，后65%收回
                const reach = ball.r * (1 + ball.atkRange);      // 枪尖伸到攻击范围边缘
                const tip = ball.r * 0.4 + (reach - ball.r * 0.4) * ext;
                const bx = Math.cos(ball.lanceAng), by = Math.sin(ball.lanceAng);
                const tx = ball.x + bx * (tip - 12), ty = ball.y + by * (tip - 12);
                const hx = ball.x + bx * tip, hy = ball.y + by * tip;
                // 枪杆
                ctx.strokeStyle = '#8d6e63';
                ctx.lineWidth = 5;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(tx - bx * 14, ty - by * 14);
                ctx.lineTo(hx - bx * 16, hy - by * 16);
                ctx.stroke();
                // 枪头（菱形）
                const px = -by, py = bx; // 垂直方向
                ctx.fillStyle = '#eceff1';
                ctx.beginPath();
                ctx.moveTo(hx, hy);
                ctx.lineTo(hx - bx * 14 + px * 5, hy - by * 14 + py * 5);
                ctx.lineTo(hx - bx * 22, hy - by * 22);
                ctx.lineTo(hx - bx * 14 - px * 5, hy - by * 14 - py * 5);
                ctx.closePath();
                ctx.fill();
                ctx.lineCap = 'butt';
            }
            // 地面接触阴影：球体下方椭圆柔影
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.32)';
            ctx.beginPath(); ctx.ellipse(ball.x + 3, ball.y + ball.r * 0.95, ball.r * 0.95, ball.r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            // 外层灵动呼吸光晕
            const pulse = 0.5 + 0.5 * Math.sin(now / 280 + (ball.x + ball.y) * 0.01);
            ctx.save();
            ctx.shadowColor = ball.glow;
            ctx.shadowBlur = 16 + pulse * 14;
            ctx.strokeStyle = ball.glow;
            ctx.lineWidth = 1.8;
            ctx.globalAlpha = 0.4 + pulse * 0.35;
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.r + 1.5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            // 球本体：3D径向渐变，打造圆润玉球质感
            ctx.save();
            if (ball.flash > 0) {
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = '#ffffff';
                ctx.shadowBlur = 24;
                if (ball.square) ctx.fillRect(ball.x - ball.r, ball.y - ball.r, ball.r * 2, ball.r * 2);
                else { ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill(); }
            } else {
                const grad = ctx.createRadialGradient(
                    ball.x - ball.r * 0.32, ball.y - ball.r * 0.35, ball.r * 0.1,
                    ball.x, ball.y, ball.r
                );
                grad.addColorStop(0, '#ffffff');
                grad.addColorStop(0.22, ball.glow || ball.color);
                grad.addColorStop(0.72, ball.color);
                grad.addColorStop(1, 'rgba(0,0,0,0.55)');
                ctx.fillStyle = grad;
                ctx.shadowColor = ball.glow;
                ctx.shadowBlur = 18;
                if (ball.square) {
                    ctx.fillRect(ball.x - ball.r, ball.y - ball.r, ball.r * 2, ball.r * 2);
                    ctx.strokeStyle = 'rgba(55,65,81,0.85)'; ctx.lineWidth = 2.5;
                    ctx.strokeRect(ball.x - ball.r, ball.y - ball.r, ball.r * 2, ball.r * 2);
                } else { ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill(); }
            }
            ctx.restore();

            // 环绕球体的流光弧
            ctx.save();
            ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
            const oa = now / 520 + ball.x * 0.01;
            ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r + 3.5, oa, oa + 0.9); ctx.stroke();
            ctx.restore();
            // 弧形顶高光（水晶曲面高光）
            ctx.save();
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.beginPath();
            ctx.ellipse(ball.x - ball.r * 0.28, ball.y - ball.r * 0.32, ball.r * 0.38, ball.r * 0.22, -Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
            // 次级锐利微高光
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.beginPath();
            ctx.arc(ball.x - ball.r * 0.35, ball.y - ball.r * 0.38, ball.r * 0.1, 0, Math.PI * 2);
            ctx.fill();
            // 底部环境漫反射边缘泛光
            ctx.strokeStyle = 'rgba(255,255,255,0.22)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.r - 1.2, Math.PI * 0.25, Math.PI * 0.95);
            ctx.stroke();
            // 内缘细线，强化立体轮廓
            ctx.strokeStyle = 'rgba(0,0,0,0.38)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.r - 0.8, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            // 队伍模式：队色描边环
            if (this.teamBattle && BB_TEAMS[ball.team]) {
                ctx.strokeStyle = BB_TEAMS[ball.team].color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(ball.x, ball.y, ball.r + 5, 0, Math.PI * 2);
                ctx.stroke();
            }
            // 眩晕特效：头顶环绕的晕星
            if (ball.stun > 0) {
                ctx.font = '13px sans-serif';
                ctx.fillStyle = '#ffd54f';
                for (let si = 0; si < 3; si++) {
                    const sa = now / 220 + si * Math.PI * 2 / 3;
                    ctx.fillText('✦', ball.x + Math.cos(sa) * ball.r * 0.6 - 6,
                        ball.y - ball.r * 0.35 + Math.sin(sa) * ball.r * 0.25 + 4);
                }
            }
            // 护盾环（精致双层旋转金环 + 发光）
            if (ball.shield > 0) {
                ctx.save();
                ctx.shadowColor = '#ffd54f';
                ctx.shadowBlur = 10;
                ctx.strokeStyle = '#ffe082';
                ctx.lineWidth = 2.5;
                ctx.setLineDash([10, 6]);
                ctx.beginPath();
                ctx.arc(ball.x, ball.y, ball.r + 7, now / 260, now / 260 + Math.PI * 2);
                ctx.stroke();
                // 逆向内层轻金环
                ctx.strokeStyle = 'rgba(255,213,79,0.45)';
                ctx.lineWidth = 1.2;
                ctx.setLineDash([4, 8]);
                ctx.beginPath();
                ctx.arc(ball.x, ball.y, ball.r + 4.5, -now / 320, -now / 320 + Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();
            }
            // 盾牌球防御态：身前举盾（钢盾金边，血<defHp时出现）
            if (ball.defHp && ball.hp < ball.defHp) {
                const s = ball.r * 1.05;
                ctx.save();
                ctx.translate(ball.x, ball.y);
                ctx.beginPath();
                ctx.moveTo(0, -s);
                ctx.lineTo(s * 0.78, -s * 0.62);
                ctx.lineTo(s * 0.78, s * 0.12);
                ctx.quadraticCurveTo(s * 0.78, s * 0.72, 0, s);
                ctx.quadraticCurveTo(-s * 0.78, s * 0.72, -s * 0.78, s * 0.12);
                ctx.lineTo(-s * 0.78, -s * 0.62);
                ctx.closePath();
                ctx.globalAlpha = 0.88;
                ctx.fillStyle = '#78909c';
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.strokeStyle = '#ffd54f';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            }
            // 滚动球：滚动中画旋转弧 + 球下显示当前滚动伤害
            if (ball.rolling) {
                ctx.strokeStyle = ball.glow;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(ball.x, ball.y, ball.r + 5, now / 120, now / 120 + Math.PI * 1.4);
                ctx.stroke();
                ctx.font = 'bold 11px sans-serif';
                ctx.fillStyle = '#eceff1';
                ctx.fillText(Math.round(this._rollDmgNow(ball)) + '', ball.x, ball.y + ball.r + 18);
            }
            // 宇宙波澜：扩散紫色波纹
            if (ball.waveOn > 0) {
                const wp = 1 - ball.waveOn / ball.waveSec;
                if (wp > 0) { // wp<=0时半径可能为负，跳过防arc崩溃
                    ctx.strokeStyle = 'rgba(179,136,255,' + (0.75 * (1 - wp)) + ')';
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.arc(ball.x, ball.y, ball.r + wp * 240, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
            // 审判中：红色脉冲环
            if (ball.judgeOn) {
                ctx.strokeStyle = 'rgba(255,60,60,' + (0.5 + 0.4 * Math.sin(now / 90)) + ')';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(ball.x, ball.y, ball.r + 5 + Math.sin(now / 80) * 3, 0, Math.PI * 2);
                ctx.stroke();
            }
            // 球内细节：淡内环 + SVG图案 + 球名（图标在上，名字在下）
            ctx.strokeStyle = 'rgba(255,255,255,0.14)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.r - 5, 0, Math.PI * 2);
            ctx.stroke();
            const ic = this._iconImg(ball.type, ball.superOn, ball.iconDark);
            const hasIc = !!(ic && ic.complete && ic.naturalWidth > 0);
            if (hasIc) {
                const is = 22;
                ctx.drawImage(ic, ball.x - is / 2, ball.y - ball.r * 0.38 - is / 2, is, is);
            }
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = 'bold ' + (ball.name.length > 4 ? 10 : 12) + 'px sans-serif';
            const nameY = hasIc ? ball.y + ball.r * 0.52 : ball.y;
            ctx.strokeStyle = 'rgba(0,0,0,0.75)';
            ctx.lineWidth = 3;
            ctx.strokeText(ball.name, ball.x, nameY);
            ctx.fillStyle = '#fff';
            ctx.fillText(ball.name, ball.x, nameY);
            ctx.textBaseline = 'alphabetic';
            // 血条（渐变质感 + 圆润边角）
            const bw = 70, bh = 8, bx = ball.x - bw / 2, by = ball.y - ball.r - 21;
            ctx.save();
            ctx.fillStyle = 'rgba(10,16,28,0.75)';
            ctx.fillRect(bx, by, bw, bh);
            const hpRatio = Math.min(1, Math.max(0, ball.hp) / ball.maxHp);
            if (hpRatio > 0) {
                const hpCol1 = ball.hp <= 300 ? '#ff1744' : ball.hp <= 600 ? '#ffb300' : '#43a047';
                const hpCol2 = ball.hp <= 300 ? '#ff8a80' : ball.hp <= 600 ? '#ffe082' : '#a5d6a7';
                const hpGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
                hpGrad.addColorStop(0, hpCol2);
                hpGrad.addColorStop(0.35, hpCol1);
                hpGrad.addColorStop(1, hpCol1);
                ctx.fillStyle = hpGrad;
                ctx.fillRect(bx, by, bw * hpRatio, bh);
                // 顶部细微反光亮线
                ctx.fillStyle = 'rgba(255,255,255,0.45)';
                ctx.fillRect(bx, by, bw * hpRatio, 1.5);
            }
            // 治疗球：超出血量上限的部分画金色附加血条（比例=超出量/overMax）
            if (ball.overMax && ball.hp > ball.maxHp) {
                ctx.fillStyle = '#ffd54f';
                ctx.fillRect(bx, by - 5, bw * Math.min(1, (ball.hp - ball.maxHp) / ball.overMax), 4);
            }
            ctx.strokeStyle = 'rgba(255,255,255,0.28)';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, bw, bh);
            ctx.restore();
            // 减伤标识：生效中的减伤>0 → 血条右侧金色小盾
            const red = (ball.dmgReduce || 0) + (ball.superOn ? ball.superReduce : 0)
                + (ball.rollReduceT > 0 ? ball.rollReduce : 0)
                + (ball.defHp && ball.hp < ball.defHp ? ball.defReduce : 0) // 盾牌球防御态同样显示金盾
                + (ball.revPhase === 2 ? ball.tgtRed : 0);
            if (red > 0) {
                ctx.save();
                ctx.translate(ball.x + bw / 2 + 10, ball.y - ball.r - 16.5);
                ctx.fillStyle = '#ffd54f';
                ctx.beginPath();
                ctx.moveTo(0, -5);
                ctx.lineTo(4.5, -3.2); ctx.lineTo(4.5, 1);
                ctx.quadraticCurveTo(4.5, 4.5, 0, 6.5);
                ctx.quadraticCurveTo(-4.5, 4.5, -4.5, 1);
                ctx.lineTo(-4.5, -3.2);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
            // 血条内显示剩余血量数字（所有球统一显示）
            ctx.font = 'bold 10px sans-serif';
            const hpTxt = Math.max(0, Math.ceil(ball.hp)) + ' / ' + ball.maxHp + (ball.revPhase === 2 ? ' 靶子' + ball.revT.toFixed(1) + 's' : '');
            ctx.strokeStyle = 'rgba(0,0,0,0.8)';
            ctx.lineWidth = 2.5;
            ctx.strokeText(hpTxt, ball.x, ball.y - ball.r - 14.8);
            ctx.fillStyle = '#fff';
            ctx.fillText(hpTxt, ball.x, ball.y - ball.r - 14.8);
            // 启动条：血条上方（启动球专属，超态时满条变红）
            if (ball.chargeHit) {
                const cy = ball.y - ball.r - 27;
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(ball.x - bw / 2, cy, bw, 4);
                ctx.fillStyle = ball.superOn ? '#ff5252' : '#ffb300';
                ctx.fillRect(ball.x - bw / 2, cy, bw * Math.min(1, ball.charge), 4);
            }
            // 大招能量条：血条上方蓝色细条+⚡标记，0能量也清晰可见；满能量变金高亮
            if (ball.ultType) {
                const ey = ball.y - ball.r - (ball.chargeHit ? 33 : 27); // 有启动条时上移错开
                const full = ball.energy >= 100;
                ctx.fillStyle = 'rgba(10,20,40,0.75)';
                ctx.fillRect(ball.x - bw / 2, ey, bw, 5);
                ctx.fillStyle = full ? '#ffe082' : '#4fc3f7';
                ctx.fillRect(ball.x - bw / 2, ey, bw * Math.min(1, ball.energy / 100), 5);
                ctx.strokeStyle = full ? 'rgba(255,224,130,0.9)' : 'rgba(120,180,255,0.6)';
                ctx.lineWidth = 1;
                ctx.strokeRect(ball.x - bw / 2, ey - 0.5, bw, 6);
                ctx.font = '9px sans-serif';
                ctx.fillStyle = full ? '#ffe082' : 'rgba(120,180,255,0.85)';
                ctx.fillText('⚡', ball.x - bw / 2 - 10, ey + 5);
            }
            // 剩余护盾数
            if (ball.shield > 0) {
                ctx.font = '11px sans-serif';
                ctx.fillStyle = '#ffd54f';
                ctx.fillText('盾×' + ball.shield, ball.x, ball.y + ball.r + 18);
            }
            // 炸弹球：剩余引爆倒计时；最后5s变红并脉冲报警
            if (ball.boomSec && !ball.boomed && !ball.dead) {
                ctx.font = 'bold 12px sans-serif';
                ctx.fillStyle = ball.boomT <= 5 ? '#ff5252' : '#ffab91';
                ctx.fillText(Math.ceil(ball.boomT) + 's', ball.x, ball.y + ball.r + (ball.shield > 0 ? 32 : 18));
                if (ball.boomT <= 5) {
                    ctx.strokeStyle = 'rgba(255,82,82,' + (0.4 + 0.4 * Math.sin(now / 70)) + ')';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(ball.x, ball.y, ball.r + 5 + Math.sin(now / 80) * 3, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
            // 超伤球审判状态：等待期显示倒计时，审判期显示'审判中'
            if (ball.judgeWait) {
                ctx.font = 'bold 12px sans-serif';
                ctx.fillStyle = ball.judgeOn ? '#ff5252' : '#ff8a80';
                const jy = ball.y + ball.r + (ball.shield > 0 ? 32 : 18);
                ctx.fillText(ball.judgeOn ? '审判中!' : Math.ceil(ball.judgeT) + 's', ball.x, jy);
            }
            // 狙击枪：瞄准中的红色虚线指向锁定目标（随瞄准进度变亮）
            if (ball.snipeWind > 0 && !ball.dead) {
                const tgt = (ball.snipeTgt && !ball.snipeTgt.dead) ? ball.snipeTgt : this._nearestEnemy(ball);
                if (tgt) {
                    const prog = 1 - ball.snipeWind / ball.snipeAim;
                    ctx.save();
                    ctx.strokeStyle = 'rgba(255,23,68,' + (0.2 + 0.55 * prog) + ')';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([6, 6]);
                    ctx.beginPath(); ctx.moveTo(ball.x, ball.y); ctx.lineTo(tgt.x, tgt.y); ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.restore();
                }
            }
            // 太刀球：环绕刀（轨道虚线圈 + 沿切向的刀刃）
            if (ball.bladeDmg && !ball.dead) {
                const bx = ball.x + Math.cos(ball.bladeA) * (ball.r + 26);
                const by = ball.y + Math.sin(ball.bladeA) * (ball.r + 26);
                ctx.save();
                ctx.strokeStyle = 'rgba(236,239,241,0.16)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([4, 7]);
                ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r + 26, 0, Math.PI * 2); ctx.stroke();
                ctx.setLineDash([]);
                ctx.translate(bx, by);
                ctx.rotate(ball.bladeA + Math.PI / 2); // 刀刃沿轨道切向
                ctx.shadowColor = '#eceff1'; ctx.shadowBlur = 8;
                ctx.lineCap = 'round';
                ctx.strokeStyle = '#eceff1'; ctx.lineWidth = 3.5;
                ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(10, 0); ctx.stroke(); // 刀身
                ctx.strokeStyle = '#90a4ae'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(15, 0); ctx.stroke();  // 刀尖
                ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 5;
                ctx.beginPath(); ctx.moveTo(-14, -3.5); ctx.lineTo(-14, 3.5); ctx.stroke(); // 刀镡
                ctx.strokeStyle = '#5d4037'; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(-21, 0); ctx.stroke();  // 柄
                ctx.restore();
            }
            // 斧头球：左半圆范围虚线 + 固定斧头（挥砍下压动画）；低血显示自旋飞斧
            if (ball.axeDmg && !ball.dead) {
                const reach = ball.r * ball.axeReach;
                if (ball.hp > ball.axeLowHp) {
                    ctx.save();
                    ctx.strokeStyle = 'rgba(215,204,200,0.14)';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([4, 7]);
                    ctx.beginPath(); ctx.arc(ball.x, ball.y, reach, Math.PI / 2, Math.PI * 1.5); ctx.stroke(); // 左半圆
                    ctx.setLineDash([]);
                    const prog = ball.axeSwing > 0 ? 1 - ball.axeSwing / 0.22 : 0;
                    const aa = Math.PI - 0.55 + prog * 1.1; // 左上→左下挥砍
                    this._drawAxe(ctx, ball.x + Math.cos(aa) * reach * 0.82, ball.y + Math.sin(aa) * reach * 0.82, aa + Math.PI / 2);
                    ctx.restore();
                } else if (ball.axeState !== 'idle') {
                    this._drawAxe(ctx, ball.axeX, ball.axeY, ball.axeSpin);
                }
            }
            ctx.restore();
        }

        // 飘字（立体发光与弹跳动态）
        for (const f of this.floats) {
            const t = (now - f.born) / 1000;
            ctx.save();
            ctx.globalAlpha = Math.max(0, 1 - t * 0.95);
            const scale = 1 + Math.sin(Math.min(1, t * 5) * Math.PI) * 0.3;
            ctx.translate(f.x, f.y - t * 45);
            ctx.scale(scale, scale);
            ctx.font = '900 17px sans-serif';
            ctx.textAlign = 'center';
            ctx.strokeStyle = 'rgba(0,0,0,0.85)';
            ctx.lineWidth = 3.5;
            ctx.strokeText(f.text, 0, 0);
            ctx.fillStyle = f.color;
            ctx.shadowColor = f.color;
            ctx.shadowBlur = 10;
            ctx.fillText(f.text, 0, 0);
            ctx.restore();
        }
        ctx.globalAlpha = 1;

        // 顶部面板：2球显示科技VS血条HUD，多球显示混战存活勋章
        if (this.phase === 'countdown' || this.phase === 'battle' || this.phase === 'arenaResult' || this.phase === 'over') {
            ctx.textAlign = 'center';
            if (this.balls.length === 2) {
                const [a, b] = this.balls;
                const bw2 = Math.min(220, W * 0.28);
                const cy = 40;
                const panelW = bw2 * 2 + 130;

                ctx.save();
                // 顶部电竞底座卡片（磨砂深色底 + 柔和科技发光边）
                ctx.fillStyle = 'rgba(8, 16, 32, 0.75)';
                ctx.strokeStyle = 'rgba(100, 180, 255, 0.28)';
                ctx.lineWidth = 1.5;
                this._rr(ctx, W / 2 - panelW / 2, 8, panelW, 58, 14);
                ctx.fill(); ctx.stroke();

                // 双方名称（带投影）
                ctx.font = 'bold 15px sans-serif';
                ctx.fillStyle = a.color;
                ctx.fillText(a.name, W / 2 - bw2 / 2 - 38, cy - 11);
                ctx.fillStyle = b.color;
                ctx.fillText(b.name, W / 2 + bw2 / 2 + 38, cy - 11);

                // 中央立体金属 VS 徽标（金芒发光）
                ctx.save();
                ctx.font = 'italic 900 18px sans-serif';
                ctx.fillStyle = '#ffd54f';
                ctx.shadowColor = 'rgba(255,213,79,0.95)';
                ctx.shadowBlur = 14;
                ctx.fillText('VS', W / 2, cy + 4);
                ctx.restore();

                const hpRatio = bl => this.paddleBattle && bl.pads
                    ? bl.pads.reduce((s, p) => s + p.hp, 0) / bl.pads.reduce((s, p) => s + p.maxHp, 0)
                    : Math.min(1, Math.max(0, bl.hp) / bl.maxHp);

                // 左方血条槽
                const ax = W / 2 - bw2 - 38, ay = cy + 2, bh2 = 12;
                ctx.fillStyle = 'rgba(0,0,0,0.65)';
                ctx.fillRect(ax, ay, bw2, bh2);
                ctx.strokeStyle = 'rgba(255,255,255,0.18)';
                ctx.lineWidth = 1;
                ctx.strokeRect(ax, ay, bw2, bh2);

                // 右方血条槽
                const bx = W / 2 + 38, by2 = cy + 2;
                ctx.fillStyle = 'rgba(0,0,0,0.65)';
                ctx.fillRect(bx, by2, bw2, bh2);
                ctx.strokeStyle = 'rgba(255,255,255,0.18)';
                ctx.lineWidth = 1;
                ctx.strokeRect(bx, by2, bw2, bh2);

                // 左方血条本体（带高光与渐变，右向左退缩）
                const ra = hpRatio(a);
                if (ra > 0) {
                    const ga = ctx.createLinearGradient(ax, ay, ax, ay + bh2);
                    ga.addColorStop(0, '#ffffff'); ga.addColorStop(0.3, a.color); ga.addColorStop(1, a.color);
                    ctx.fillStyle = ga;
                    ctx.fillRect(ax + bw2 * (1 - ra), ay, bw2 * ra, bh2);
                    // 顶边高光细线
                    ctx.fillStyle = 'rgba(255,255,255,0.55)';
                    ctx.fillRect(ax + bw2 * (1 - ra), ay, bw2 * ra, 1.8);
                }

                // 右方血条本体（带高光与渐变，左向右延展）
                const rb = hpRatio(b);
                if (rb > 0) {
                    const gb = ctx.createLinearGradient(bx, by2, bx, by2 + bh2);
                    gb.addColorStop(0, '#ffffff'); gb.addColorStop(0.3, b.color); gb.addColorStop(1, b.color);
                    ctx.fillStyle = gb;
                    ctx.fillRect(bx, by2, bw2 * rb, bh2);
                    // 顶边高光细线
                    ctx.fillStyle = 'rgba(255,255,255,0.55)';
                    ctx.fillRect(bx, by2, bw2 * rb, 1.8);
                }

                // 治疗球超限血量：金色条
                ctx.fillStyle = '#ffd54f';
                if (a.overMax && a.hp > a.maxHp) ctx.fillRect(ax, ay - 4, bw2 * Math.min(1, (a.hp - a.maxHp) / a.overMax), 3);
                if (b.overMax && b.hp > b.maxHp) ctx.fillRect(bx, by2 - 4, bw2 * Math.min(1, (b.hp - b.maxHp) / b.overMax), 3);
                ctx.restore();
            } else {
                const aliveN = this.balls.filter(x => !x.dead).length;
                ctx.save();
                ctx.fillStyle = 'rgba(8, 16, 32, 0.72)';
                ctx.strokeStyle = 'rgba(100, 180, 255, 0.25)';
                this._rr(ctx, W / 2 - 90, 14, 180, 40, 12);
                ctx.fill(); ctx.stroke();
                ctx.font = 'bold 16px sans-serif';
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = 'rgba(100, 180, 255, 0.6)';
                ctx.shadowBlur = 10;
                ctx.fillText(aliveN + ' 球混战 · 激烈角逐', W / 2, 39);
                ctx.restore();
            }
            // 场地缩小提示
            if (this.phase === 'battle' && this.battleTime > BB_SHRINK_DELAY &&
                (this.bounds.w > BB_MIN_W || this.bounds.h > BB_MIN_H)) {
                ctx.save();
                ctx.font = 'bold 13px sans-serif';
                ctx.fillStyle = '#ff5252';
                ctx.shadowColor = 'rgba(255,82,82,0.8)';
                ctx.shadowBlur = 8;
                ctx.fillText('▲ 场地缩小中 · 危险区域扩大', W / 2, 84);
                ctx.restore();
            }
        }

        // 开局倒计时大字：3/2/1 各1s，开始! 1.3s（此时对战才正式开始）
        if (this.phase === 'countdown') {
            const el = 4.3 - this.countdownT;             // 已进入倒计时的秒数
            const label = el < 1 ? '3' : el < 2 ? '2' : el < 3 ? '1' : '开始!';
            const isGo = label === '开始!';
            const segT = isGo ? el - 3 : el % 1;          // 本段内经过时间
            const pop = Math.min(1, segT / 0.15);         // 弹出动画
            const size = (isGo ? 88 : 115) * (1.35 - 0.35 * pop);
            ctx.save();
            ctx.textAlign = 'center';
            // 扩散外光环
            const ringR = size * 0.85 + segT * 40;
            ctx.strokeStyle = isGo ? 'rgba(255, 213, 79, ' + (1 - segT) * 0.6 + ')' : 'rgba(100, 180, 255, ' + (1 - segT) * 0.5 + ')';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(W / 2, H / 2, ringR, 0, Math.PI * 2); ctx.stroke();

            ctx.font = '900 ' + Math.round(size) + 'px sans-serif';
            ctx.fillStyle = isGo ? '#ffd54f' : '#ffffff';
            ctx.shadowColor = isGo ? 'rgba(255,213,79,0.95)' : 'rgba(140,190,255,0.9)';
            ctx.shadowBlur = 32;
            ctx.fillText(label, W / 2, H / 2 + size * 0.35);
            ctx.restore();
        }

        // 擂台赛每场结果：停留一会再进入下一场/总结算
        if (this.phase === 'arenaResult' && this.arena) {
            const a = this.arena;
            const result = a.roundResult || 'Win';
            const isWin = result === 'Win';
            const waitLeft = Math.max(0, a.roundWait);
            const alpha = Math.min(1, waitLeft / 0.25, (1.6 - waitLeft) / 0.15 + 0.35);
            ctx.save();
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(0, 0, W, H);
            ctx.globalAlpha = alpha;
            ctx.font = '900 ' + Math.min(112, Math.round(W * 0.11)) + 'px sans-serif';
            ctx.strokeStyle = 'rgba(0,0,0,0.9)';
            ctx.lineWidth = 10;
            ctx.strokeText(result, W / 2, H / 2 + 20);
            ctx.fillStyle = isWin ? '#ffd54f' : '#ff5252';
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 34;
            ctx.fillText(result, W / 2, H / 2 + 20);
            ctx.globalAlpha = alpha * 0.9;
            ctx.font = 'bold 22px sans-serif';
            ctx.shadowBlur = 8;
            ctx.fillStyle = '#fff';
            const nextTxt = a.round < a.challengers.length
                ? '下一位挑战者即将上场…'
                : (isWin ? '擂主守擂成功' : '擂主倒下了');
            ctx.fillText(nextTxt, W / 2, H / 2 + 76);
            ctx.restore();
        }

        // 连杀播报
        if (this.killBanner && now - this.killBanner.born < 1800 && this.phase !== 'select') {
            const kb = this.killBanner, p = (now - kb.born) / 1800;
            ctx.save();
            ctx.textAlign = 'center';
            ctx.globalAlpha = Math.min(1, (1 - p) * 2);
            ctx.font = '900 ' + Math.round(34 + 10 * Math.max(0, 1 - p * 5)) + 'px sans-serif';
            ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 6;
            ctx.strokeText(kb.text, W / 2, H * 0.2);
            ctx.fillStyle = kb.color; ctx.shadowColor = kb.color; ctx.shadowBlur = 22;
            ctx.fillText(kb.text, W / 2, H * 0.2);
            ctx.restore();
        }

        // 羁绊上场横幅：倒计时全程+开局前3s显示
        if (this.synergyMsg && this.phase !== 'select' && this.phase !== 'over' && this.battleTime < 3) {
            ctx.save();
            ctx.textAlign = 'center';
            ctx.font = 'bold 28px sans-serif';
            ctx.strokeStyle = 'rgba(0,0,0,0.85)';
            ctx.lineWidth = 5;
            ctx.strokeText(this.synergyMsg, W / 2, H * 0.28);
            ctx.fillStyle = 'rgba(255,213,79,' + (0.75 + 0.25 * Math.sin(now / 120)) + ')';
            ctx.shadowColor = 'rgba(255,82,82,0.9)';
            ctx.shadowBlur = 20;
            ctx.fillText(this.synergyMsg, W / 2, H * 0.28);
            ctx.restore();
        }

        // 结算延迟后弹面板
        if (this.phase === 'over' && this._overTimer && now >= this._overTimer) {
            this._overTimer = 0;
            this._recordStats();
            if (this.daily) this._dailyResult();
            else { const bd = document.getElementById('bbDailyBoard'); if (bd) bd.style.display = 'none'; }
            const rt = document.getElementById('bbResultText');
            if (this.arena && this.arena.result) {
                rt.textContent = this.arena.result === 'win' ? 'Win' : 'Wasted';
                rt.style.color = this.arena.result === 'win' ? '#ffd54f' : '#ff5252';
            } else {
                rt.textContent = this.winner
                    ? '★ ' + (this.teamBattle ? BB_TEAMS[this.winner.team].name + ' ' : '')
                        + this.winner.name + ' 获胜!'
                    : '平局!';
                rt.style.color = this.winner ? this.winner.color : '#fff';
            }
            document.getElementById('ballResultPanel').style.display = 'flex';
        }

        ctx.restore(); // 恢复 DPR 缩放矩阵
    }
}