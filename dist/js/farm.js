// 衬彩稻田：8×8种田小游戏（重置版：仅水稻，无工坊/烹饪）
// 布局：上=商店功能 中=8×8地块 左=游戏日志 下=15格物品栏
// 玩法：选中物品栏物品再点地块 —— 灰尘锄头=耕地/收割 稻种=播种 发霉洒水壶=浇水
// 锄头/水壶不在物品栏时自动补发
(function () {
    'use strict';

    const N = 64;                 // 8×8
    const GROW_MS = 5000;         // 浇水后每阶段5s
    const SEED_PRICE = 5;         // 稻种价格
    const SELL_PRICE = { hoe: 0, can: 0, seed: 4, rice: 8 }; // 出售单价
    const CROPS = { // 作物表：种子/每阶段毫秒/总阶段数/贴图后缀
        rice: { seed: 'seed', grow: GROW_MS, stages: 4, sfx: '' },
    };
    const SEEDS = { seed: 'rice' }; // 种子→作物类型
    const SLOTS = 15, STACK = 99; // 物品栏15格，每格叠99
    const SAVE_KEY = 'farm_save_v2'; // v2：重置稻田，旧档作废
    // ===== SVG 图标库 =====
    const ICO = {
        hoe: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20L13 11" stroke="#8d6e63" stroke-width="2.4" stroke-linecap="round"/><path d="M13 11c-1-4 2-8 8-8-1 5-4 8-8 8z" fill="#b0bec5" stroke="#78909c"/><circle cx="6.5" cy="17.5" r="1.1" fill="#a1887f"/></svg>',
        can: '<svg viewBox="0 0 24 24"><rect x="8" y="9" width="10" height="11" rx="2.5" fill="#90a4ae" stroke="#546e7a"/><path d="M8 12L3 8" stroke="#546e7a" stroke-width="2" stroke-linecap="round"/><circle cx="3" cy="7" r="1.6" fill="#546e7a"/><path d="M18 12c3 0 4 2 4 4s-1 4-4 4" fill="none" stroke="#546e7a" stroke-width="2"/><circle cx="12" cy="13" r="1.3" fill="#81c784"/><circle cx="15" cy="17" r="1" fill="#81c784"/><circle cx="11" cy="17.5" r=".8" fill="#a5d6a7"/></svg>',
        seed: '<svg viewBox="0 0 24 24"><ellipse cx="9" cy="13" rx="4" ry="6" fill="#d7a86e" stroke="#8d6e63" transform="rotate(-18 9 13)"/><ellipse cx="16" cy="12" rx="3.4" ry="5.2" fill="#e8c48d" stroke="#8d6e63" transform="rotate(15 16 12)"/><path d="M9 9.5v7M16 8.8v6.5" stroke="#a1887f"/></svg>',
        rice: '<img src="img/ico_rice.png" class="farm-item-img" draggable="false">', // 稻米图标：稻穗局部
        drop: '<svg viewBox="0 0 24 24"><path d="M12 3c4 5.5 6 8.5 6 11a6 6 0 0 1-12 0c0-2.5 2-5.5 6-11z" fill="#4fc3f7" stroke="#0288d1"/></svg>',
        st0: '<img src="img/crop_rice_s0.png" class="farm-crop-img" draggable="false">', // 土堆+小芽
        st1: '<img src="img/crop_rice_s1.png" class="farm-crop-img" draggable="false">', // 幼苗
        st2: '<img src="img/crop_rice_s2.png" class="farm-crop-img" draggable="false">', // 长高抽青穗
        st3: '<img src="img/crop_rice.png" class="farm-crop-img" draggable="false">', // 成熟水稻：农作物LOGO贴图
    };
    const ITEMS = {
        hoe:  { name: '灰尘锄头',   ico: ICO.hoe },
        can:  { name: '发霉洒水壶', ico: ICO.can },
        seed: { name: '稻种', ico: ICO.seed },
        rice: { name: '稻米', ico: ICO.rice },
        medal: { name: '农耕勋章', ico: '<svg viewBox="0 0 24 24"><path d="M8.5 10L6.5 20l5.5-2.5L17.5 20 15.5 10z" fill="#ef5350" stroke="#c62828" stroke-width=".8"/><circle cx="12" cy="9" r="6.2" fill="#ffd54f" stroke="#f9a825"/><circle cx="12" cy="9" r="4.6" fill="#ffe082"/><path d="M12 5.8l.9 1.9 2.1.3-1.5 1.5.35 2.1-1.85-1-1.85 1 .35-2.1-1.5-1.5 2.1-.3z" fill="#f57f17"/></svg>' },
    };
    const el = id => document.getElementById(id);

    class FarmGame {
        constructor() {
            this.plots = Array.from({ length: N }, () => ({ s: 'grass', stage: 0, wet: false, t: 0 }));
            this.inv = Array(SLOTS).fill(null); // [{type,count}]
            this.sel = 0;             // 物品栏选中格
            this.gold = 50;
            this._tickT = null;
            this._saveT = null;
            this._cells = [];
            this._slotEls = [];
            this._drag = false;       // 按住拖动连种（需农耕勋章）
            this.medalGot = false;    // 勋章每人只能出1次
            this._built = false;
            // 聊天室
            this._mqtt = null;        // mqtt客户端
            this._chatOn = false;     // 是否已连上
            this._inGame = false;     // 是否在稻田界面（离场断开聊天）
            this._chatB = 0;          // broker轮换下标
            this._ownMids = [];       // 自己发的消息id（去重回显）
            this._chatName = '';      // 聊天显示名
            this._fresh = !localStorage.getItem(SAVE_KEY);
            this._load();
            this._ensureTools();
            if (this._fresh) this._addItem('seed', 5); // 新档送5粒稻种
        }

        // ===== 进出 =====
        enter() {
            el('farmScreen').style.display = 'flex';
            this._build();
            this._applyOffline();   // 离线生长结算
            this.renderAll();
            if (!this._tickT) this._tickT = setInterval(() => this._tick(), 500);
            if (!this._saveT) this._saveT = setInterval(() => this._save(), 10000);
            // 开发者模式才显示指令输入框
            el('farmChatCmd').style.display = (window.game && window.game.devMode) ? '' : 'none';
            this._chatConnect();
        }
        exit() {
            this._save();
            el('farmScreen').style.display = 'none';
            this._inGame = false;
            if (this._mqtt) { try { this._mqtt.end(true); } catch (e) {} this._mqtt = null; }
            this._chatOn = false;
        }

        _build() {
            if (this._built) return;
            this._built = true;
            const grid = el('farmGrid');
            for (let i = 0; i < N; i++) {
                const c = document.createElement('div');
                c.className = 'farm-cell';
                c.addEventListener('mousedown', e => {
                    e.preventDefault();
                    this._drag = this._count('medal') > 0; // 有勋章才可拖动连种
                    this.use(i);
                });
                c.addEventListener('mouseenter', () => { if (this._drag) this.use(i); });
                grid.appendChild(c);
                this._cells.push(c);
            }
            const bar = el('farmHotbar');
            for (let i = 0; i < SLOTS; i++) {
                const s = document.createElement('div');
                s.className = 'farm-slot';
                s.addEventListener('click', () => { this.sel = i; this.renderHotbar(); });
                bar.appendChild(s);
                this._slotEls.push(s);
            }
            document.addEventListener('mouseup', () => { this._drag = false; });
            el('btnFarmSell').addEventListener('click', () => this.sellSelected());
            el('btnFarmShop').addEventListener('click', () => this.openShop());
            // 聊天室
            el('btnFarmChat').addEventListener('click', () => {
                const c = el('farmChat');
                c.style.display = c.style.display === 'none' ? 'flex' : 'none';
                if (c.style.display !== 'none') {
                    const box = el('farmChatMsgs');
                    box.scrollTop = box.scrollHeight;
                }
            });
            el('btnFarmChatClose').addEventListener('click', () => el('farmChat').style.display = 'none');
            el('btnFarmChatSend').addEventListener('click', () => this._chatSend());
            el('farmChatInput').addEventListener('keydown', e => { if (e.code === 'Enter') this._chatSend(); });
            el('farmChatCmd').addEventListener('keydown', e => { if (e.code === 'Enter') this._chatCmd(); });
            el('btnShopClose').addEventListener('click', () => el('farmShop').style.display = 'none');
            el('btnShopBuy1').addEventListener('click', () => this.buySeeds(1, SEED_PRICE));
            el('btnShopBuy10').addEventListener('click', () => this.buySeeds(10, 45));
            this.log('欢迎来到衬彩稻田！选中下方物品栏工具再点地块。');
        }

        // ===== 物品栏 =====
        _count(type) { let n = 0; for (const it of this.inv) if (it && it.type === type) n += it.count; return n; }
        _addItem(type, n) { // 先进已有叠层再进空格；返回实际放入数量
            const nos = (type === 'hoe' || type === 'can'); // 锄头/洒水壶不可堆叠
            let left = n;
            if (!nos) for (const it of this.inv) {
                if (!left) break;
                if (it && it.type === type && it.count < STACK) {
                    const k = Math.min(STACK - it.count, left);
                    it.count += k; left -= k;
                }
            }
            for (let i = 0; i < SLOTS && left; i++) {
                if (!this.inv[i]) {
                    const k = nos ? 1 : Math.min(STACK, left);
                    this.inv[i] = { type, count: k }; left -= k;
                }
            }
            return n - left;
        }
        _removeAll(type) { for (let i = 0; i < SLOTS; i++) if (this.inv[i] && this.inv[i].type === type) this.inv[i] = null; }
        _takeItem(type, n) { // 从物品栏扣n个，不够返回false
            if (this._count(type) < n) return false;
            let left = n;
            for (let i = 0; i < SLOTS && left; i++) {
                const it = this.inv[i];
                if (it && it.type === type) {
                    const k = Math.min(it.count, left);
                    it.count -= k; left -= k;
                    if (it.count <= 0) this.inv[i] = null;
                }
            }
            return true;
        }

        _ensureTools() { // 锄头/洒水壶缺失自动补发（物品栏满时补不了就提醒）
            if (!this._count('hoe') && !this._addItem('hoe', 1)) this.log('物品栏满了，灰尘锄头补不进来', 'warn');
            if (!this._count('can') && !this._addItem('can', 1)) this.log('物品栏满了，发霉洒水壶补不进来', 'warn');
        }

        // ===== 物品使用 =====
        use(i) {
            const p = this.plots[i];
            const it = this.inv[this.sel];
            const at = (i % 8 + 1) + '行' + (Math.floor(i / 8) + 1) + '列';
            if (!it) return this.log('先在下方物品栏选中工具或种子', 'dim');
            if (it.type === 'hoe') {
                if (p.s === 'grass') {
                    p.s = 'tilled'; p.wet = false;
                    this.log('[' + at + '] 翻好了一块耕地');
                } else if (p.s === 'crop' && p.stage >= (CROPS[p.crop] || CROPS.rice).stages - 1) {
                    const cr = ITEMS[p.crop] ? p.crop : 'rice';   // 作物类型（旧档兜底稻米）
                    const n = 1 + Math.floor(Math.random() * 3);
                    const got = this._addItem(cr, n);
                    if (!got) return this.log('物品栏满了，' + ITEMS[cr].name + '收不进来', 'warn');
                    p.s = 'grass'; p.stage = 0; p.wet = false; p.t = 0; // 收割变回草地，要重新耕田
                    this.log('[' + at + '] 收获' + ITEMS[cr].name + '×' + got + '！地变回草地，要重新翻耕', 'good');
                    if (!this.medalGot && Math.random() < 0.9 && this._addItem('medal', 1)) {
                        this.medalGot = true;
                        this.log('获得【农耕勋章】！现在按住鼠标拖动就能连续种田', 'good');
                    }
                    if (Math.random() < 0.5 && this._addItem(CROPS[cr].seed, 1))
                        this.log('[' + at + '] 返还一粒' + ITEMS[CROPS[cr].seed].name, 'good');
                } else if (p.s === 'crop') { // 未成熟的苗被锄掉，回到耕地
                    p.s = 'tilled'; p.stage = 0; p.wet = false; p.t = 0;
                    this.log('[' + at + '] 把还没熟的苗锄掉了，回到耕地', 'warn');
                } else this.log('[' + at + '] 这里已经耕好了', 'dim');
            } else if (SEEDS[it.type]) {
                if (p.s === 'grass') this.log('[' + at + '] 要先用锄头耕地才能播种', 'dim');
                else if (p.s === 'crop') this.log('[' + at + '] 已经种上作物了', 'dim');
                else {
                    it.count--; if (it.count <= 0) this.inv[this.sel] = null;
                    p.s = 'crop'; p.stage = 0; p.wet = false; p.t = 0;
                    p.crop = SEEDS[it.type];
                    this.log('[' + at + '] 播下一粒' + ITEMS[it.type].name);
                }
            } else if (it.type === 'can') {
                if (p.s !== 'crop') this.log('[' + at + '] 这里没有作物要浇水', 'dim');
                else if (p.stage >= (CROPS[p.crop] || CROPS.rice).stages - 1) this.log('[' + at + '] 已经成熟，用锄头收割吧', 'dim');
                else if (p.wet) this.log('[' + at + '] 这块地已经浇过水了', 'dim');
                else {
                    p.wet = true; p.t = Date.now();
                    this.log('[' + at + '] 浇了水，作物开始生长');
                }
            } else this.log('这个物品不能用在土地上', 'dim');
            this._ensureTools();
            this.renderPlot(i);
            this.renderHotbar();
        }

        // ===== 生长 =====
        _tick() {
            const now = Date.now();
            let dirty = false;
            for (let i = 0; i < N; i++) {
                const p = this.plots[i];
                const cf = CROPS[p.crop] || CROPS.rice;
                if (p.s === 'crop' && p.stage < cf.stages - 1 && p.wet && now - p.t >= cf.grow) {
                    p.stage++; p.wet = false; p.t = 0;
                    const at = '[' + (i % 8 + 1) + '行' + (Math.floor(i / 8) + 1) + '列] ';
                    if (p.stage >= cf.stages - 1) {
                        this.log(at + (ITEMS[p.crop] ? ITEMS[p.crop].name : '稻子') + '成熟了！', 'good');
                    }
                    this.renderPlot(i); dirty = true;
                }
            }
            if (dirty) this._save();
        }
        _applyOffline() { // 离线期间按真实时间补生长
            const now = Date.now();
            for (const p of this.plots) {
                const cf = CROPS[p.crop] || CROPS.rice;
                while (p.s === 'crop' && p.stage < cf.stages - 1 && p.wet && p.t && now - p.t >= cf.grow) {
                    p.stage++; p.wet = false; p.t += cf.grow;
                }
            }
        }
        // ===== 商店 =====
        openShop() {
            el('farmShopGold').textContent = this.gold;
            el('farmShop').style.display = 'flex';
        }
        buySeeds(n, cost, type) { // 通用购买：稻种/橘子种子
            type = type || 'seed';
            const name = ITEMS[type].name;
            if (this.gold < cost) return this.log('金币不够（需' + cost + '金币）', 'warn');
            const got = this._addItem(type, n);
            if (!got) return this.log('物品栏放不下' + name + '了', 'warn');
            const pay = Math.ceil(cost * got / n);
            this.gold -= pay;
            this.log('买入' + name + '×' + got + '，花' + pay + '金币');
            el('farmShopGold').textContent = this.gold;
            this.renderHotbar();
        }
        sellSelected() { // 出售选中的物品（锄头/洒水壶0元不卖，勋章不能卖）
            const it = this.inv[this.sel];
            if (!it) return this.log('先在物品栏选中要出售的物品', 'dim');
            const price = SELL_PRICE[it.type];
            if (price === undefined) return this.log('【' + ITEMS[it.type].name + '】不能出售', 'warn');
            if (price <= 0) return this.log('【' + ITEMS[it.type].name + '】不值钱，不卖', 'dim');
            const g = it.count * price;
            this.gold += g;
            this.log('出售' + ITEMS[it.type].name + '×' + it.count + '，获得' + g + '金币', 'good');
            this.inv[this.sel] = null;
            this.renderHotbar();
        }

        // ===== 渲染 =====
        renderPlot(i) {
            const p = this.plots[i], c = this._cells[i];
            let cls = 'farm-cell ', icon = '';
            if (p.s === 'grass') cls += 'grass';
            else if (p.s === 'tilled') cls += 'tilled' + (p.wet ? ' wet' : '');
            else {
                cls += 'crop st' + p.stage + (p.wet ? ' wet' : '');
                const cf = CROPS[p.crop] || CROPS.rice;
                icon = ICO['st' + p.stage + cf.sfx] || ICO['st' + p.stage];
            }
            c.className = cls;
            c.innerHTML = '<span class="farm-ico">' + icon + '</span>' +
                (p.wet ? '<span class="farm-drop">' + ICO.drop + '</span>' : '');
            const cc = CROPS[p.crop] || CROPS.rice;
            c.title = { grass: '草地', tilled: '耕地', crop: (ITEMS[p.crop] ? ITEMS[p.crop].name : '作物') + ' 阶段' + (p.stage + 1) + '/' + cc.stages }[p.s];
        }
        renderAll() {
            for (let i = 0; i < N; i++) this.renderPlot(i);
            this.renderHotbar();
        }
        renderHotbar() {
            el('farmGold').textContent = this.gold;
            for (let i = 0; i < SLOTS; i++) {
                const s = this._slotEls[i], it = this.inv[i];
                s.className = 'farm-slot' + (i === this.sel ? ' sel' : '');
                s.innerHTML = it ? '<span class="farm-slot-ico">' + ITEMS[it.type].ico + '</span>' +
                    (it.count > 1 ? '<span class="farm-slot-n">' + it.count + '</span>' : '') : '';
                s.title = it ? ITEMS[it.type].name + ' ×' + it.count : '空';
            }
            el('btnFarmSell').disabled = !this.inv[this.sel]; // 有选中物才能卖
        }
        log(msg, cls) {
            const box = el('farmLog');
            if (!box) return;
            const d = document.createElement('div');
            d.className = 'farm-log-line' + (cls ? ' ' + cls : '');
            const t = new Date();
            d.innerHTML = '<span class="farm-log-t">' +
                String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0') +
                '</span>' + msg;
            box.prepend(d);
            while (box.children.length > 100) box.removeChild(box.lastChild);
        }

        // ===== 聊天室（MQTT公共频道） =====
        _chatConnect() {
            if (this._mqtt) return;
            this._inGame = true;
            this._chatName = (window.game && window.game.username) || '玩家';
            this._chatTry();
        }
        _chatTry() {
            if (this._mqtt) { try { this._mqtt.end(true); } catch (e) {} this._mqtt = null; }
            if (typeof mqtt === 'undefined') { this._chatLine(null, '聊天服务不可用', 'err'); return; }
            const brokers = [
                'wss://broker.emqx.io:8084/mqtt',
                'wss://test.mosquitto.org:8081/mqtt',
                'wss://broker.hivemq.com:8884/mqtt',
            ];
            try {
                this._mqtt = mqtt.connect(brokers[this._chatB], {
                    clientId: 'farm_' + this._chatName + '_' + Math.random().toString(36).substr(2, 6),
                    clean: true, connectTimeout: 6000, keepalive: 20, reconnectPeriod: 0,
                });
            } catch (e) { return; }
            const timeout = setTimeout(() => { // 连不上换下一个broker
                if (!this._chatOn && this._inGame) { this._chatB = (this._chatB + 1) % brokers.length; this._chatTry(); }
            }, 7000);
            this._mqtt.on('connect', () => {
                clearTimeout(timeout);
                this._chatOn = true;
                this._mqtt.subscribe('xyxnyz/farm/chat', { qos: 0 });
                this._chatLine(null, '已连接聊天室', 'sys');
            });
            this._mqtt.on('message', (t, p) => {
                try { this._chatRecv(JSON.parse(p.toString())); } catch (e) {}
            });
            this._mqtt.on('close', () => {
                clearTimeout(timeout);
                const was = this._chatOn;
                this._chatOn = false;
                if (this._inGame && was) this._chatTry(); // 已连过又断线才重连
            });
            this._mqtt.on('error', () => {});
        }
        _chatRecv(m) {
            if (m.t === 'm') {
                if (m.mid && this._ownMids.includes(m.mid)) return; // 自己的回显跳过
                this._chatLine(m.u, m.s, m.u === 'xy' ? 'dev' : '');
            } else if (m.t === 'g') {
                const name = ITEMS[m.item] ? ITEMS[m.item].name : m.item;
                const n = Math.max(1, Math.min(9999, m.n || 1));
                this._chatLine(null, m.u + ' 赐予了 ' + m.to + ' 【' + name + '】×' + n, 'sys');
                if (m.to === this._chatName && ITEMS[m.item]) {
                    const got = this._addItem(m.item, n);
                    this.renderHotbar(); this._save();
                    this.log('开发者赐予了你【' + ITEMS[m.item].name + '】×' + got, 'good');
                }
            }
        }
        _chatSend() {
            const inp = el('farmChatInput');
            const text = inp.value.trim();
            if (!text) return;
            inp.value = '';
            const mid = Math.random().toString(36).substr(2, 8);
            this._ownMids.push(mid);
            if (this._ownMids.length > 30) this._ownMids.shift();
            this._chatLine(this._chatName, text, 'me'); // 本地先显示
            if (this._chatOn) this._mqtt.publish('xyxnyz/farm/chat',
                JSON.stringify({ t: 'm', u: this._chatName, s: text, mid }), { qos: 0 });
        }
        _chatCmd() { // 开发者指令：#赐予 玩家名称 物品 [数量]
            const inp = el('farmChatCmd');
            const text = inp.value.trim();
            if (!text) return;
            const m = text.match(/^#赐予\s+(\S+)\s+(\S+)(?:\s+(\S+))?$/);
            if (!m) { this._chatLine(null, '指令格式：#赐予 玩家名称 物品 [数量]', 'err'); return; }
            const who = m[1], itemName = m[2];
            const n = (m[3] === undefined) ? 1 : parseInt(m[3], 10);
            if (!/^\d+$/.test(m[3] || '1') || n < 1) { this._chatLine(null, '错误：数量必须是正整数', 'err'); return; }
            let key = ITEMS[itemName] ? itemName : null;          // 先试内部名
            if (!key) for (const k in ITEMS) if (ITEMS[k].name === itemName) { key = k; break; } // 再试显示名
            if (!key) { this._chatLine(null, '错误：不存在物品「' + itemName + '」', 'err'); return; }
            inp.value = '';
            if (this._chatOn) {
                this._mqtt.publish('xyxnyz/farm/chat',
                    JSON.stringify({ t: 'g', u: this._chatName, to: who, item: key, n }), { qos: 0 });
            } else { // 离线兜底：本地直接处理
                this._chatRecv({ t: 'g', u: this._chatName, to: who, item: key, n });
            }
        }
        _chatLine(who, text, cls) {
            const box = el('farmChatMsgs');
            if (!box) return;
            const d = document.createElement('div');
            d.className = 'farm-chat-msg' + (cls ? ' ' + cls : '');
            d.innerHTML = who ? '<b>' + this._esc(who) + '</b>：' + this._esc(text) : this._esc(text);
            box.appendChild(d);
            while (box.children.length > 80) box.removeChild(box.firstChild);
            box.scrollTop = box.scrollHeight;
        }
        _esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

        // ===== 存档 =====
        _save() {
            try {
                localStorage.setItem(SAVE_KEY, JSON.stringify({
                    plots: this.plots, gold: this.gold, inv: this.inv, sel: this.sel,
                    medalGot: this.medalGot, t: Date.now()
                }));
            } catch (e) {}
        }
        _load() {
            try {
                const s = JSON.parse(localStorage.getItem(SAVE_KEY));
                if (!s) return;
                if (Array.isArray(s.plots) && s.plots.length === N) this.plots = s.plots;
                this.gold = s.gold ?? 50;
                this.sel = s.sel || 0;
                this.medalGot = !!s.medalGot;
                if (Array.isArray(s.inv)) {              // 新格式
                    for (let i = 0; i < Math.min(SLOTS, s.inv.length); i++) this.inv[i] = (s.inv[i] && ITEMS[s.inv[i].type]) ? s.inv[i] : null; // 过滤已删除物品
                } else {                                  // 旧格式迁移：seeds/rice进物品栏
                    if (s.seeds) this._addItem('seed', s.seeds);
                    if (s.rice) this._addItem('rice', s.rice);
                }
            } catch (e) {}
        }
    }

    window.farm = new FarmGame();
})();
