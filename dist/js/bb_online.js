// ===== 小球对战 · 联机1v1（复用MQTT公共broker方案，无需自建服务器）=====
// 匹配协议（大厅主题 xyxnyz/bb/lobby）：
//   {t:'s',id,name}       每1.2s广播"我在匹配"；{t:'x',id} 取消匹配
//   {t:'p',mid,a,b}       配对：由当前最小id者发起（a=发起方/b=应约方）
//   {t:'ok',mid}          应约方确认；{t:'busy',mid} 已在别局→拒绝
// 对局主题 xyxnyz/bb/m/<mid>：
//   {t:'st',x,y,hp}       每90ms位置+血量同步（归一化坐标，血量各自权威）
//   {t:'atk'}             按J出手（0.2s前摇）；{t:'hit',dmg} 攻击方判定命中→受击方扣血
//   {t:'die'} 血量归零；{t:'bye'} 离开对局
// 注意：broker会将消息回送给发布者自己，_pub统一注入发送者id，收信时过滤自己的回声，
// 否则自己的st会污染对方坐标（对方“隔空命中”/镜像跟随），hit回声会打到自己，lastSeen也会被回声刷新导致断线判定失效。
// broker优先级：页面由 server.js 提供时同源 /mqtt 即游戏服务器内置broker
//（局域网低延迟、不依赖外网）；部署到静态托管(Netlify等)时该地址会快速失败，自动回退公共broker
const BBOL_BROKERS = (() => {
    const loc = window.location;
    const list = [];
    if (/^https?:$/.test(loc.protocol)) {
        list.push((loc.protocol === 'https:' ? 'wss://' : 'ws://') + loc.host + '/mqtt');
    }
    list.push(
        'wss://broker.emqx.io:8084/mqtt',
        'wss://test.mosquitto.org:8081/mqtt',
        'wss://broker.hivemq.com:8884/mqtt',
    );
    return list;
})();
const BBOL_LOBBY = 'xyxnyz/bb/lobby';
const BBOL_SPD = 0.55;      // 移速：每秒移动场地高度的55%（两轴同像素速）
const BBOL_ATK_CD = 2;      // 攻击冷却2s
const BBOL_WINDUP = 0.2;    // 攻击前摇0.2s
const BBOL_DMG = 50;        // 白板攻击伤害
const BBOL_HP = 1000;       // 白板血量
const BBOL_MINE_CD = 6;     // 地雷球J放雷冷却6s
const BBOL_MINE_R = 32;     // 联机地雷半径（比PvE的55小）
const BBOL_MINE_DMG = 80;   // 联机地雷伤害
const BBOL_MINE_MAX = 4;    // 场上同时最多4颗
const BBOL_BLADE_SEC = 1.6; // 旋刀持续秒数（4rad/s ≈1圈）
const BBOL_BLADE_DMG = 85;  // 联机太刀伤害
const BBOL_BLADE_HIT_CD = 0.55; // 同一目标受击间隔（防一帧多结算）
const BBOL_BLADE_SPD = 4;   // 太刀旋转角速度 rad/s

class BbOnline {
    constructor(game) {
        this.g = game;                    // BallBattleGame（画布+飘字/粒子工具）
        this.active = false;              // 联机流程中→接管game._update/_render
        this.state = 'idle';              // idle|matching|waitok|countdown|battle|over
        this.myId = 'bb_' + Math.random().toString(36).substr(2, 8);
        this.myName = '玩家';
        this.mqtt = null;
        this.brokerIdx = 0;
        this.connected = false;
        this.picked = null;               // 已选出战球type（null=未选）
        this.myMines = [];                // 我方布下的雷（本地实体，不同步给对方）
        this.seen = {};                   // 正在匹配的其他人 {id:{ts,name}}
        this.matched = null;              // {mid, opp:{id,name}, role:'a'|'b'}
        this.pendingAt = 0;
        this.matchTopic = null;
        this.keys = {};
        this.me = null; this.opp = null;
        this.lastPub = 0; this.lastSeen = 0;
        this.result = null; this.resultWhy = '';
        this.overT = 0;
        this._panelBound = false;
        this._bgTimer = null;            // 标签页后台时接管update（rAF在后台停发）
        this._bgLast = 0;
        this._bindKeys();
    }

    // ===== 按键：WASD移动 / J攻击 =====
    _bindKeys() {
        window.addEventListener('keydown', e => {
            if (!this.active) return;
            this.keys[e.code] = true;
            if (this.state === 'battle' && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyJ'].includes(e.code)) e.preventDefault();
            if (this.state === 'battle' && e.code === 'KeyJ' && !e.repeat) this._tryAttack();
        });
        window.addEventListener('keyup', e => { this.keys[e.code] = false; });
        window.addEventListener('blur', () => { this.keys = {}; });
    }

    _el(id) { return document.getElementById(id); }
    _setStatus(t) { const el = this._el('bbOnlineStatus'); if (el) el.textContent = t; }
    _pub(topic, obj) { try { if (this.mqtt && this.connected) { obj.id = this.myId; this.mqtt.publish(topic, JSON.stringify(obj), { qos: 0 }); } } catch (e) {} }

    // ===== 进入联机面板 =====
    enter() {
        this.active = true;
        this.myName = (window.game && window.game.username) || '玩家';
        this._el('ballSelectPanel').style.display = 'none';
        this._el('bbOnlinePanel').style.display = 'flex';
        if (!this._panelBound) {
            this._panelBound = true;
            this._olCards = [this._el('bbOnlineCard'), this._el('bbOnlineCardMine'), this._el('bbOnlineCardTachi')].filter(Boolean);
            for (const el of this._olCards) {
                el.addEventListener('click', () => { // 单选：点选/再点取消
                    this.picked = (this.picked === el.dataset.type) ? null : el.dataset.type;
                    for (const e2 of this._olCards) e2.classList.toggle('picked', e2.dataset.type === this.picked);
                    this._refreshBtns();
                });
            }
            this._el('btnBbMatch').addEventListener('click', () => {
                if (this.state === 'matching' || this.state === 'waitok') this._cancelMatch();
                else if (this.picked) this._startMatch();
            });
            this._el('btnBbOnlineQuit').addEventListener('click', () => this.leave());
        }
        this._setStatus(this.connected ? '选择出战球后点击「开始匹配」' : '连接服务器中…');
        this._refreshBtns();
        this._connect();
        // 后台兜底：切到后台后rAF停发、游戏主循环停摆，改用setInterval驱动update。
        // 用真实流逝时间做dt，保证心跳(st)/匹配广播/断线判定按真实时间走；
        // 浏览器会把后台定时器降到约1Hz，对局会继续但本地球只会站住不动。
        if (!this._bgTimer) {
            this._bgLast = Date.now();
            this._bgTimer = setInterval(() => {
                if (!this.active || !document.hidden) { this._bgLast = Date.now(); return; }
                const now = Date.now();
                const dt = Math.min(2, Math.max(0.001, (now - this._bgLast) / 1000)); // 上限2s防长时挂起后大跳变
                this._bgLast = now;
                this.update(dt);
            }, 200);
        }
    }

    _refreshBtns() {
        const b = this._el('btnBbMatch');
        if (this.state === 'matching' || this.state === 'waitok') {
            b.textContent = '取消匹配'; b.disabled = false;
        } else if (this.state === 'over') {
            b.textContent = '重新匹配'; b.disabled = false;
        } else {
            b.textContent = '开始匹配'; b.disabled = !this.picked || !this.connected;
        }
    }

    // ===== MQTT连接（同farm聊天室：多broker轮换）=====
    _connect() {
        if (this.mqtt || typeof mqtt === 'undefined') {
            if (typeof mqtt === 'undefined') this._setStatus('联机服务不可用');
            return;
        }
        try {
            this.mqtt = mqtt.connect(BBOL_BROKERS[this.brokerIdx], {
                clientId: this.myId + '_' + Math.random().toString(36).substr(2, 4),
                clean: true, connectTimeout: 6000, keepalive: 20, reconnectPeriod: 0,
            });
        } catch (e) { this.mqtt = null; return; }
        const cli = this.mqtt; // 旧client事件串扰守卫：回调只认当前连接
        const timeout = setTimeout(() => {
            if (this.mqtt === cli && !this.connected && this.active) {
                this.brokerIdx = (this.brokerIdx + 1) % BBOL_BROKERS.length;
                try { cli.end(true); } catch (e) {}
                this.mqtt = null; this._connect();
            }
        }, 7000);
        cli.on('connect', () => {
            if (this.mqtt !== cli) { try { cli.end(true); } catch (e) {} return; }
            clearTimeout(timeout);
            this.connected = true;
            cli.subscribe(BBOL_LOBBY, { qos: 0 });
            if (this.state === 'idle') this._setStatus('已连接，选择出战球后点击「开始匹配」');
            this._refreshBtns();
        });
        cli.on('message', (topic, p) => {
            if (this.mqtt !== cli) return;
            let m; try { m = JSON.parse(p.toString()); } catch (e) { return; }
            if (topic === BBOL_LOBBY) this._onLobby(m);
            else if (topic === this.matchTopic) this._onMatch(m);
        });
        cli.on('close', () => {
            if (this.mqtt !== cli) return;
            clearTimeout(timeout);
            const was = this.connected;
            this.connected = false;
            if (!this.active) { this.mqtt = null; return; }
            if (this.state === 'battle' || this.state === 'countdown') {
                this._endMatch('lose', '你已掉线'); // 对局中掉线判负
            } else if (this.state === 'matching' || this.state === 'waitok') {
                this.matched = null; this.state = 'idle';
                this._setStatus('连接断开，重连中…'); this._refreshBtns();
            }
            if (was) { try { cli.end(true); } catch (e) {} this.mqtt = null; this._connect(); }
            else if (this.active) { // 尚未连上就断开（如本地无服务器）→延迟换下一个broker，避免快速失败卡死
                this.mqtt = null;
                this.brokerIdx = (this.brokerIdx + 1) % BBOL_BROKERS.length;
                setTimeout(() => { if (this.active && !this.mqtt) this._connect(); }, 800);
            }
        });
        cli.on('error', () => {});
    }

    // ===== 匹配 =====
    _startMatch() {
        this._resetRoom();
        this.state = 'matching';
        this.seen = {};
        this._seekT = 0;
        this._setStatus('匹配中…等待其他玩家');
        this._refreshBtns();
        this._pub(BBOL_LOBBY, { t: 's', id: this.myId, name: this.myName });
    }

    _cancelMatch() {
        this._pub(BBOL_LOBBY, { t: 'x', id: this.myId });
        this._resetRoom();
        this.state = 'idle';
        this._setStatus('已取消匹配');
        this._refreshBtns();
    }

    _resetRoom() {
        if (this.matchTopic && this.mqtt) { try { this.mqtt.unsubscribe(this.matchTopic); } catch (e) {} }
        this.matchTopic = null;
        this.matched = null;
        this.me = this.opp = null;
        this.myMines = [];
    }

    _onLobby(m) {
        if (m.id === this.myId) return; // 忽略自己消息的回声
        if (m.t === 's') {
            const prev = this.seen[m.id];
            this.seen[m.id] = { ts: Date.now(), name: m.name || '玩家', busyUntil: (prev && prev.busyUntil) || 0 }; // 保留拒绝冷却
            this._tryPair();
        } else if (m.t === 'x') {
            delete this.seen[m.id];
        } else if (m.t === 'p' && m.b && m.b.id === this.myId) {
            if (this.state === 'matching' && !this.matched) {
                this.matched = { mid: m.mid, opp: m.a, role: 'b' };
                this._pub(BBOL_LOBBY, { t: 'ok', mid: m.mid });
                this._beginMatch();
            } else {
                this._pub(BBOL_LOBBY, { t: 'busy', mid: m.mid, id: this.myId }); // 已在别局/等确认→拒绝
            }
        } else if (m.t === 'ok' && this.matched && this.state === 'waitok' && m.mid === this.matched.mid) {
            this._beginMatch();
        } else if (m.t === 'busy' && this.matched && m.mid === this.matched.mid) {
            if (this.seen[m.id]) this.seen[m.id].busyUntil = Date.now() + 4000; // 该候选4s内不再尝试
            this.matched = null; this.state = 'matching'; this._seekT = 0; // 被拒→继续匹配
            this._setStatus('对方已在其他对局，继续匹配中…');
        }
    }

    // 只有当前最小id发起配对，与最小候选配对→全局只有一个发起者
    _tryPair() {
        if (this.state !== 'matching' || this.matched) return;
        const now = Date.now();
        let best = null;
        for (const id in this.seen) {
            if (now - this.seen[id].ts > 4000) { delete this.seen[id]; continue; } // 4s未广播视为过期
            if (this.seen[id].busyUntil > now) continue; // 刚拒绝过配对→跳过
            if (!best || id < best.id) best = { id, name: this.seen[id].name };
        }
        if (best && best.id > this.myId) { // 最小候选都比我大→我是全场最小，由我来发
            this.matched = {
                mid: this.myId + '_' + Math.random().toString(36).substr(2, 6),
                opp: { id: best.id, name: best.name }, role: 'a',
            };
            this.state = 'waitok';
            this.pendingAt = now;
            this._setStatus('匹配到 ' + best.name + '，等待对方确认…');
            this._pub(BBOL_LOBBY, { t: 'p', mid: this.matched.mid, a: { id: this.myId, name: this.myName }, b: { id: best.id, name: best.name } });
        }
    }

    _beginMatch() {
        this.state = 'countdown';
        this.countdownT = 4.3;
        this.matchTopic = 'xyxnyz/bb/m/' + this.matched.mid;
        this.mqtt.subscribe(this.matchTopic, { qos: 0 });
        const myType = this.picked || 'plain';
        const mk = (nx, pname, type) => {
            const bt = BB_TYPES[type] || BB_TYPES.plain;
            return {
                type, name: bt.name, pname, color: bt.color, glow: bt.glow,
                nx, ny: 0.5, x: 0, y: 0, tx: nx, ty: 0.5, r: BB_R,
                hp: BBOL_HP, maxHp: BBOL_HP, atkCd: 0,
                cdMax: type === 'mine' ? BBOL_MINE_CD : BBOL_ATK_CD, // 太刀无冷却
                windup: 0, atkFx: 0, flash: 0,
                bladeA: -Math.PI / 2, bladeT: 0, bladeHitCd: 0, // 太刀：刀角度/旋刀剩余秒数/受击结算冷却
                trail: [], dead: false,
            };
        };
        this.me = mk(this.matched.role === 'a' ? 0.22 : 0.78, this.myName, myType); // a左b右
        this.opp = mk(this.matched.role === 'a' ? 0.78 : 0.22, this.matched.opp.name, 'plain'); // 真实球种等st.bt同步
        this.myMines = [];
        const W0 = this.g.canvas.width, H0 = this.g.canvas.height; // 初始像素位置（倒计时期间也要画对）
        for (const b of [this.me, this.opp]) { b.x = b.nx * W0; b.y = b.ny * H0; }
        this.keys = {};
        this.lastPub = 0; this.lastSeen = Date.now();
        this.result = null; this.resultWhy = ''; this.overT = 0;
        this._el('bbOnlinePanel').style.display = 'none';
    }

    // ===== 攻击：J按下→0.2s前摇→攻击方本地判定命中→通知对方扣血 =====
    _tryAttack() {
        const me = this.me;
        if (!me || me.dead || me.atkCd > 0 || me.windup > 0) return;
        if (me.type === 'mine') { // 地雷球：J原地放雷（本地实体不发消息，对方不可见）
            if (this.myMines.length >= BBOL_MINE_MAX) return;
            me.atkCd = BBOL_MINE_CD;
            this.myMines.push({ x: me.x, y: me.y, r: BBOL_MINE_R });
            this.g._float(me.x, me.y - me.r - 14, '布雷!', '#ffab40');
            this.g._sparks(me.x, me.y, 6);
            return;
        }
        if (me.type === 'tachi') { // 太刀球：J让太刀旋转1.6s（无冷却；旋转中不重触）
            if (me.bladeT > 0) return;
            me.bladeT = BBOL_BLADE_SEC;
            this._pub(this.matchTopic, { t: 'atk' });
            this.g._sparks(me.x + Math.cos(me.bladeA) * (me.r + 26), me.y + Math.sin(me.bladeA) * (me.r + 26), 6);
            return;
        }
        me.atkCd = BBOL_ATK_CD;
        me.windup = BBOL_WINDUP;
        this._pub(this.matchTopic, { t: 'atk' });
    }

    _onMatch(m) {
        if (m.id === this.myId) return; // 忽略自己消息的回声（断线心跳也只认对方消息）
        const now = Date.now();
        this.lastSeen = now;
        if (m.t === 'st' && this.opp) {
            this.opp.tx = m.x; this.opp.ty = m.y;
            if (typeof m.hp === 'number') this.opp.hp = Math.min(this.opp.maxHp, Math.max(0, m.hp)); // 对方血量以对方为准
            if (m.bt && BB_TYPES[m.bt] && this.opp.type !== m.bt) { // 对方球种随状态同步（配色/名字/冷却时长）
                const bt = BB_TYPES[m.bt];
                this.opp.type = m.bt; this.opp.name = bt.name; this.opp.color = bt.color; this.opp.glow = bt.glow;
                this.opp.cdMax = m.bt === 'mine' ? BBOL_MINE_CD : BBOL_ATK_CD;
            }
        } else if (m.t === 'atk' && this.opp) {
            if (this.opp.type === 'tachi') this.opp.bladeT = BBOL_BLADE_SEC;
            else { this.opp.windup = BBOL_WINDUP; this.opp.atkCd = BBOL_ATK_CD; }
        } else if (m.t === 'hit' && this.me && !this.me.dead) { // 我被命中：受击方权威扣血
            const dmg = Math.min(200, Math.max(1, m.dmg | 0));
            this.me.hp -= dmg;
            this.me.flash = 1;
            this.g._float(this.me.x, this.me.y - this.me.r - 14, '-' + dmg, '#ff8a65');
            this.g._sparks(this.me.x, this.me.y, 10);
            this._pub(this.matchTopic, { t: 'st', x: this.me.nx, y: this.me.ny, hp: this.me.hp, bt: this.me.type }); // 立刻回同步血量
            if (this.me.hp <= 0) {
                this.me.dead = true;
                this.g._explode(this.me);
                this._pub(this.matchTopic, { t: 'die' });
                this._endMatch('lose');
            }
        } else if (m.t === 'die') {
            if (this.opp && !this.opp.dead) { this.opp.dead = true; this.g._explode(this.opp); }
            this._endMatch('win');
        } else if (m.t === 'bye') {
            this._endMatch('win', '对方离开了对战');
        }
    }

    _endMatch(result, why) {
        if (this.state === 'over') return;
        this.state = 'over';
        this.result = result;
        this.resultWhy = why || '';
        this.overT = Date.now() + 1200;
    }

    // ===== 主更新（game._update在联机激活时委托到这里）=====
    update(dt) {
        const now = Date.now();
        if (this.state === 'matching') {
            this._seekT -= dt;
            if (this._seekT <= 0) {
                this._seekT = 1.2;
                this._pub(BBOL_LOBBY, { t: 's', id: this.myId, name: this.myName });
            }
            this._tryPair();
        } else if (this.state === 'waitok') {
            if (now - this.pendingAt > 6000) { // 等ok超时→回匹配
                this.matched = null; this.state = 'matching'; this._seekT = 0;
                this._setStatus('对方未响应，重新匹配中…'); this._refreshBtns();
            }
        } else if (this.state === 'countdown') {
            this.countdownT -= dt;
            const W = this.g.canvas.width, H = this.g.canvas.height; // 球位置随画布同步（倒计时冻结站位）
            for (const b of [this.me, this.opp]) { if (b) { b.x = b.nx * W; b.y = b.ny * H; } }
            if (this.me && this.opp) { this.opp.x = this.opp.tx * W; this.opp.y = this.opp.ty * H; } // 远端站位用同步值
            if (now - this.lastPub > 300) { // 倒计时也发心跳，防断线误判
                this.lastPub = now;
                this._pub(this.matchTopic, { t: 'st', x: this.me.nx, y: this.me.ny, hp: this.me.hp, bt: this.me.type });
            }
            if (this.countdownT <= 0) { this.countdownT = 0; this.state = 'battle'; }
        } else if (this.state === 'battle') {
            this._updateBattle(dt, now);
        } else if (this.state === 'over' && this.overT && now >= this.overT) {
            this.overT = 0;
            this._showOver();
        }
    }

    _updateBattle(dt, now) {
        const W = this.g.canvas.width, H = this.g.canvas.height;
        const me = this.me, opp = this.opp;
        if (!me || !opp) return;
        // WASD移动（归一化坐标：y轴0.55/s，x轴换算成同像素速）
        let dx = (this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0);
        let dy = (this.keys['KeyS'] ? 1 : 0) - (this.keys['KeyW'] ? 1 : 0);
        if (!me.dead && (dx || dy)) {
            const l = Math.hypot(dx, dy);
            me.nx += dx / l * BBOL_SPD * (H / W) * dt;
            me.ny += dy / l * BBOL_SPD * dt;
            const rw = me.r / W, rh = me.r / H;
            me.nx = Math.min(1 - rw, Math.max(rw, me.nx));
            me.ny = Math.min(1 - rh, Math.max(rh, me.ny));
        }
        me.x = me.nx * W; me.y = me.ny * H;
        // 对方位置插值（偏离过大直接吸附）
        const ox = opp.tx * W - opp.x, oy = opp.ty * H - opp.y;
        if (Math.hypot(ox, oy) > 260) { opp.x = opp.tx * W; opp.y = opp.ty * H; }
        else { const k = Math.min(1, dt * 12); opp.x += ox * k; opp.y += oy * k; }
        // 计时器
        me.atkCd = Math.max(0, me.atkCd - dt);
        opp.atkCd = Math.max(0, opp.atkCd - dt);
        me.atkFx = Math.max(0, me.atkFx - dt);
        opp.atkFx = Math.max(0, opp.atkFx - dt);
        me.flash = Math.max(0, me.flash - dt * 4);
        opp.flash = Math.max(0, opp.flash - dt * 4);
        if (opp.windup > 0) { // 对方出手前摇结束：攻击方已判定，这里只播放挥击特效
            opp.windup -= dt;
            if (opp.windup <= 0) { opp.windup = 0; opp.atkFx = 0.3; }
        }
        if (me.windup > 0) {
            me.windup -= dt;
            if (me.windup <= 0) { // 前摇结束→攻击方本地判定是否命中
                me.windup = 0; me.atkFx = 0.3;
                const d = Math.hypot(me.x - opp.x, me.y - opp.y);
                if (!opp.dead && d <= me.r + opp.r + 42) {
                    this._pub(this.matchTopic, { t: 'hit', dmg: BBOL_DMG });
                    this.g._float(opp.x, opp.y - opp.r - 14, '-' + BBOL_DMG, '#ff8a65'); // 本地预测飘字
                    this.g._sparks(opp.x, opp.y, 8);
                }
            }
        }
        // 拖尾
        for (const b of [me, opp]) {
            if (b.dead) continue;
            b.trail.push({ x: b.x, y: b.y });
            if (b.trail.length > 12) b.trail.shift();
        }
        // 太刀：J触发旋转（bladeT>0期间bladeA自转，否则静止）；我方权威判定刀尖命中
        for (const b of [me, opp]) {
            if (b.dead || b.type !== 'tachi' || b.bladeT <= 0) continue;
            b.bladeT -= dt;
            b.bladeA += dt * BBOL_BLADE_SPD;
            if (b === me) {
                b.bladeHitCd = Math.max(0, b.bladeHitCd - dt);
                const bx = b.x + Math.cos(b.bladeA) * (b.r + 26), by = b.y + Math.sin(b.bladeA) * (b.r + 26);
                if (b.bladeHitCd <= 0 && !opp.dead && Math.hypot(opp.x - bx, opp.y - by) < opp.r + 13) {
                    b.bladeHitCd = BBOL_BLADE_HIT_CD;
                    this._pub(this.matchTopic, { t: 'hit', dmg: BBOL_BLADE_DMG });
                    this.g._float(opp.x, opp.y - opp.r - 14, '-' + BBOL_BLADE_DMG, '#ff8a65');
                    this.g._sparks(bx, by, 10);
                }
            }
        }
        // 我方地雷：对方踏入雷圈即炸（攻击方权威→发hit；雷不同步，对方不可见）
        for (let i = this.myMines.length - 1; i >= 0; i--) {
            const mn = this.myMines[i];
            if (!opp.dead && Math.hypot(mn.x - opp.x, mn.y - opp.y) < mn.r + opp.r * 0.6) {
                this.myMines.splice(i, 1);
                this._pub(this.matchTopic, { t: 'hit', dmg: BBOL_MINE_DMG });
                this.g._float(opp.x, opp.y - opp.r - 14, '-' + BBOL_MINE_DMG, '#ff8a65');
                this.g._sparks(mn.x, mn.y, 14);
            }
        }
        // 位置+血量+球种同步
        if (now - this.lastPub > 90) {
            this.lastPub = now;
            this._pub(this.matchTopic, { t: 'st', x: me.nx, y: me.ny, hp: me.hp, bt: me.type });
        }
        // 对方断线判定：3.5s无消息→判胜
        if (!opp.dead && now - this.lastSeen > 3500) {
            opp.dead = true;
            this._endMatch('win', '对方已掉线');
        }
    }

    _showOver() {
        const txt = this.result === 'win' ? '★ 你赢了!' : this.result === 'lose' ? '✖ 你输了' : '平局';
        this._setStatus(txt + (this.resultWhy ? '（' + this.resultWhy + '）' : ''));
        this._el('bbOnlinePanel').style.display = 'flex';
        this._refreshBtns(); // 按钮变"重新匹配"
        this._resetRoom();
    }

    // ===== 渲染（game._render在联机激活时委托到这里）=====
    render(ctx) {
        const W = this.g.canvas.width, H = this.g.canvas.height;
        const now = performance.now();
        ctx.fillStyle = '#0d1526';
        ctx.fillRect(0, 0, W, H);
        ctx.save();
        ctx.strokeStyle = 'rgba(100,180,255,0.3)';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#64b5f6'; ctx.shadowBlur = 10;
        ctx.strokeRect(6, 6, W - 12, H - 12);
        ctx.restore();

        // 粒子
        for (const p of this.g.particles) {
            const t = 1 - (now - p.born) / p.life;
            if (t <= 0) continue;
            ctx.globalAlpha = Math.max(0, t);
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r * t, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;

        // 我方地雷：小圆盘+虚线警戒圈+闪烁红点（本地渲染，对方看不到）
        for (const mn of this.myMines) {
            ctx.fillStyle = '#455a64';
            ctx.beginPath(); ctx.arc(mn.x, mn.y, mn.r * 0.45, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(255,82,82,0.8)';
            ctx.lineWidth = 2;
            ctx.setLineDash([7, 6]);
            ctx.beginPath(); ctx.arc(mn.x, mn.y, mn.r, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            if (Math.floor(now / 350) % 2 === 0) {
                ctx.fillStyle = '#ff5252';
                ctx.beginPath(); ctx.arc(mn.x, mn.y, 4.5, 0, Math.PI * 2); ctx.fill();
            }
        }

        // 两个球
        for (const b of [this.me, this.opp]) {
            if (!b || b.dead) continue;
            this._drawBall(ctx, b, b === this.me, now);
        }

        // 飘字
        for (const f of this.g.floats) {
            const t = (now - f.born) / 1000;
            ctx.globalAlpha = 1 - t;
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = f.color;
            ctx.fillText(f.text, f.x, f.y - t * 40);
        }
        ctx.globalAlpha = 1;

        // 顶部VS血条（玩家名）
        if (this.me && this.opp && this.state !== 'idle' && this.state !== 'matching' && this.state !== 'waitok') {
            ctx.textAlign = 'center';
            ctx.font = 'bold 18px sans-serif';
            ctx.fillStyle = this.me.color;
            ctx.fillText(this.me.pname, W / 2 - 170, 40);
            ctx.fillStyle = '#fff';
            ctx.fillText('VS', W / 2, 40);
            ctx.fillStyle = this.opp.color;
            ctx.fillText(this.opp.pname, W / 2 + 170, 40);
            const bw = 200;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(W / 2 - 170 - bw / 2, 52, bw, 10);
            ctx.fillRect(W / 2 + 170 - bw / 2, 52, bw, 10);
            ctx.fillStyle = this.me.color;
            ctx.fillRect(W / 2 - 170 - bw / 2, 52, bw * Math.min(1, Math.max(0, this.me.hp) / this.me.maxHp), 10);
            ctx.fillStyle = this.opp.color;
            ctx.fillRect(W / 2 + 170 - bw / 2, 52, bw * Math.min(1, Math.max(0, this.opp.hp) / this.opp.maxHp), 10);
            // 操作提示
            ctx.font = '13px sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.fillText(this.me.type === 'mine'
                ? 'WASD移动 · J放雷（冷却6s，最多4颗，对方不可见）'
                : this.me.type === 'tachi'
                    ? 'WASD移动 · J旋刀（无冷却，刀碰到对方-85）'
                    : 'WASD移动 · J攻击（冷却2s）', W / 2, H - 18);
        }

        // 倒计时（复用同款样式）
        if (this.state === 'countdown') {
            const el = 4.3 - this.countdownT;
            const label = el < 1 ? '3' : el < 2 ? '2' : el < 3 ? '1' : '开始!';
            const isGo = label === '开始!';
            const segT = isGo ? el - 3 : el % 1;
            const pop = Math.min(1, segT / 0.15);
            const size = (isGo ? 84 : 110) * (1.4 - 0.4 * pop);
            ctx.save();
            ctx.textAlign = 'center';
            ctx.font = 'bold ' + Math.round(size) + 'px sans-serif';
            ctx.fillStyle = isGo ? '#ffd54f' : '#fff';
            ctx.shadowColor = isGo ? 'rgba(255,213,79,0.95)' : 'rgba(140,190,255,0.85)';
            ctx.shadowBlur = 30;
            ctx.fillText(label, W / 2, H / 2);
            ctx.restore();
            // 对阵横幅
            ctx.font = 'bold 22px sans-serif';
            ctx.fillStyle = '#eceff1';
            ctx.textAlign = 'center';
            ctx.fillText(this.myName + '  VS  ' + this.matched.opp.name, W / 2, H * 0.3);
        }

        // 结算大字
        if (this.state === 'over') {
            ctx.save();
            ctx.textAlign = 'center';
            ctx.font = 'bold 64px sans-serif';
            ctx.fillStyle = this.result === 'win' ? '#ffd54f' : '#ff8a80';
            ctx.shadowColor = this.result === 'win' ? 'rgba(255,213,79,0.9)' : 'rgba(255,82,82,0.9)';
            ctx.shadowBlur = 28;
            ctx.fillText(this.result === 'win' ? '你赢了!' : this.result === 'lose' ? '你输了' : '平局', W / 2, H * 0.42);
            if (this.resultWhy) {
                ctx.font = '18px sans-serif';
                ctx.shadowBlur = 0;
                ctx.fillStyle = 'rgba(255,255,255,0.75)';
                ctx.fillText(this.resultWhy, W / 2, H * 0.42 + 44);
            }
            ctx.restore();
        }
    }

    _drawBall(ctx, b, isMe, now) {
        ctx.save();
        // 拖尾
        for (let i = 0; i < b.trail.length; i++) {
            const tp = b.trail[i], t = i / b.trail.length;
            ctx.globalAlpha = t * 0.25;
            ctx.fillStyle = b.color;
            ctx.beginPath(); ctx.arc(tp.x, tp.y, b.r * t * 0.8, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        // 本体
        ctx.shadowColor = b.glow; ctx.shadowBlur = 20;
        ctx.fillStyle = b.flash > 0 ? '#ffffff' : b.color;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        // 高光+边缘
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.25, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 1, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r - 5, 0, Math.PI * 2); ctx.stroke();
        // 图标+球名
        const ic = this.g._iconImg(b.type);
        const hasIc = !!(ic && ic.complete && ic.naturalWidth > 0);
        if (hasIc) ctx.drawImage(ic, b.x - 11, b.y - b.r * 0.38 - 11, 22, 22);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 12px sans-serif';
        const nameY = hasIc ? b.y + b.r * 0.52 : b.y;
        ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = 3;
        ctx.strokeText(b.name, b.x, nameY);
        ctx.fillStyle = '#fff';
        ctx.fillText(b.name, b.x, nameY);
        ctx.textBaseline = 'alphabetic';
        // 血条+数字
        const bw = 70;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(b.x - bw / 2, b.y - b.r - 20, bw, 7);
        ctx.fillStyle = b.hp <= 300 ? '#ff5252' : b.hp <= 600 ? '#ffca28' : '#66bb6a';
        ctx.fillRect(b.x - bw / 2, b.y - b.r - 20, bw * Math.min(1, Math.max(0, b.hp) / b.maxHp), 7);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
        ctx.strokeRect(b.x - bw / 2, b.y - b.r - 20, bw, 7);
        ctx.font = 'bold 10px sans-serif';
        ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 2.5;
        ctx.strokeText(Math.ceil(b.hp) + ' / ' + b.maxHp, b.x, b.y - b.r - 14.8);
        ctx.fillStyle = '#fff';
        ctx.fillText(Math.ceil(b.hp) + ' / ' + b.maxHp, b.x, b.y - b.r - 14.8);
        // 玩家名
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = isMe ? '#a5d6a7' : '#ffab91';
        ctx.fillText(b.pname, b.x, b.y - b.r - 30);
        // 攻击前摇：收缩白环 → 出手时扩散环
        if (b.windup > 0) {
            const p = b.windup / BBOL_WINDUP; // 1→0
            ctx.strokeStyle = 'rgba(255,255,255,' + (0.9 - p * 0.4) + ')';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 4 + p * 30, 0, Math.PI * 2); ctx.stroke();
        }
        if (b.atkFx > 0) {
            const p = 1 - b.atkFx / 0.3; // 0→1
            ctx.strokeStyle = 'rgba(255,235,140,' + (0.85 * (1 - p)) + ')';
            ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 4 + p * 46, 0, Math.PI * 2); ctx.stroke();
        }
        // 我方冷却环：球外圈进度（满=可攻击，亮绿呼吸）
        if (isMe && !b.dead) {
            if (b.atkCd > 0) {
                const p = 1 - b.atkCd / (b.cdMax || BBOL_ATK_CD);
                ctx.strokeStyle = 'rgba(129,199,132,0.85)';
                ctx.lineWidth = 4;
                ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 7, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); ctx.stroke();
            } else {
                ctx.strokeStyle = 'rgba(129,199,132,' + (0.5 + 0.35 * Math.sin(now / 130)) + ')';
                ctx.lineWidth = 4;
                ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 7, 0, Math.PI * 2); ctx.stroke();
            }
        }
        // 太刀：环绕刀（J触发旋转；静止时定角不动）
        if (b.type === 'tachi' && !b.dead) {
            const bx = b.x + Math.cos(b.bladeA) * (b.r + 26), by = b.y + Math.sin(b.bladeA) * (b.r + 26);
            ctx.save();
            ctx.strokeStyle = 'rgba(236,239,241,0.16)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 7]);
            ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 26, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.translate(bx, by);
            ctx.rotate(b.bladeA + Math.PI / 2); // 刀刃沿轨道切向
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
        ctx.restore();
    }

    // ===== 退出联机（quiet=游戏整体返回时不重开选球面板）=====
    leave(quiet) {
        if (this.matchTopic) {
            this._pub(this.matchTopic, { t: 'bye' });
            try { this.mqtt.unsubscribe(this.matchTopic); } catch (e) {}
        }
        if (this.state === 'matching' || this.state === 'waitok') this._pub(BBOL_LOBBY, { t: 'x', id: this.myId });
        if (this.mqtt) { try { this.mqtt.end(true); } catch (e) {} }
        this.mqtt = null;
        this.connected = false;
        if (this._bgTimer) { clearInterval(this._bgTimer); this._bgTimer = null; }
        this.matchTopic = null;
        this.matched = null;
        this.state = 'idle';
        this.active = false;
        this.keys = {};
        this.me = this.opp = null;
        this.picked = null;
        this.myMines = [];
        for (const c of (this._olCards || [])) c.classList.remove('picked');
        this._el('bbOnlinePanel').style.display = 'none';
        if (!quiet) this.g._showSelect();
    }
}
