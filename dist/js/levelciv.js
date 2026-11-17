// ===== 等级文明 · 3D双世界小游戏 =====
// 草等级(草原世界):醒来交税→挖草卖命；泥土等级(泥土世界):传送来收草→用草买食物维持饱和度/买奴隶
// 时钟免同步:daySec = Date.now()/1000 % DAY_MS*? —— 用绝对时间对日长取模,所有客户端天然同天同时
// 联机:轻量MQTT(同bb_online方案);单人时内置3个草民NPC可被索要/购买
(function () {
    'use strict';
    const DAY_MS = 480000, HALF = 240000;      // 8分钟=1天,4白天+4夜晚
    const NEED = 5;                            // 每天需5饱和度
    const FOOD = { milk: { n: '牛奶', g: 1, s: 1 }, steak: { n: '牛排', g: 3, s: 4 }, cake: { n: '蛋糕', g: 10, s: 14 } };
    const SLAVE_G = 20, NPC_TAX = 10;
    const TOPIC = 'lciv_room_v1';
    const BROKERS = (() => {
        const l = window.location, l2 = [(l.protocol === 'https:' ? 'wss://' : 'ws://') + l.host + '/mqtt'];
        return l2.concat(['wss://broker.emqx.io:8084/mqtt', 'wss://test.mosquitto.org:8081/mqtt']);
    })();
    const el = id => document.getElementById(id);
    const rand = (a, b) => a + Math.random() * (b - a);

    const L = window.levelciv = {
        inited: false, running: false,
        me: null, remotes: {}, npcs: [],
        world: 'grass', scene: null, cam: null, rdr: null,
        tufts: [], portalMesh: null, shopMeshes: [],
        yaw: 0, pitch: -0.5, keys: {}, touchMove: { x: 0, y: 0 },
        mqtt: null, conn: false, _clockTick: 0,

        // ---------- 生命周期 ----------
        enter() {
            el('levelcivScreen').style.display = 'block';
            if (!this.inited) { this.inited = true; this._init3D(); this._initDOM(); this._connect(); }
            this._newDay(true);
            this.running = true;
            this._loop();
        },
        exit() {
            this.running = false;
            el('levelcivScreen').style.display = 'none';
            if (this.mqtt) { try { this.mqtt.end(true); } catch (e) {} this.mqtt = null; this.conn = false; }
        },

        // ---------- 时钟:day = 自epoch起的天序号,t = 当天0~480s ----------
        _day() { return Math.floor(Date.now() / DAY_MS); },
        _t() { return (Date.now() % DAY_MS) / 1000; },
        _isDay() { return this._t() < 240; },
        _newDay(first) { // 天亮:扣饱和度/结算税收提示
            if (!this.me) return;
            this.me.daySeen = this._day();
            if (!first) {
                if (this.me.role === 'dirt') {
                    this.me.sat -= NEED;
                    if (this.me.sat < 0) { this.me.grass = Math.floor(this.me.grass / 2); this.me.sat = NEED; this._toast('你饿死了!损失一半草'); }
                    else this._toast(`清晨扣${NEED}饱和度,当前${this.me.sat}`);
                    this._slaveDues(); // 奴隶上供/饿死替换
                } else {
                    this._toast(this.me.grass >= NPC_TAX ? `清晨:先交${NPC_TAX}草税,再去挖草` : '清晨:草不够交税,泥土玩家会找上门…');
                    this._payTax();
                }
            }
            this._hud();
        },
        _slaveDues() { // 每个NPC奴隶交税;交不起→死→新奴隶顶上(真人奴隶由对方客户端自结,发slaveDead)
            for (const sid of [...this.me.slaves]) {
                const n = this.npcs.find(n => n.id === sid);
                if (!n) continue; // 真人奴隶:他自己结
                if (n.grass >= NPC_TAX) { n.grass -= NPC_TAX; this.me.grass += NPC_TAX; }
                else { // 奴隶饿死
                    this.scene.remove(n.mesh);
                    this.npcs.splice(this.npcs.indexOf(n), 1);
                    this.me.slaves = this.me.slaves.filter(x => x !== sid);
                    this._spawnSlave();
                    this._toast(`奴隶${n.name}没草交税饿死了,新奴隶来了`);
                }
            }
        },
        _spawnSlave() { // 新奴隶补位:出生即归我
            const n = this._spawnNpc('s' + Date.now() % 1e5);
            n.owner = this.me.id; this.me.slaves.push(n.id);
            n.mesh.traverse(o => { if (o.isMesh) o.material.color.set(0xffb74d); });
            return n;
        },
        _payTax() { // 草玩家交税:有主人给主人,没主人给在线泥土玩家,否则NPC国库
            const t = Math.min(NPC_TAX, this.me.grass);
            if (this.me.owner && this.me.grass < NPC_TAX) { // 奴隶交不起税→死
                this._pub({ k: 'slaveDead', to: this.me.owner });
                this.me.owner = null; this.me.grass = 0; this.me.pos.set(0, 0, 0);
                this._toast('你交不起税饿死了!重生为自由草民');
                this._hud(); this._sendState();
                return;
            }
            if (!t) return;
            this.me.grass -= t;
            const target = this.me.owner || (() => { const ds = Object.values(this.remotes).filter(r => r.role === 'dirt'); return ds[0] && ds[0].id; })();
            if (target) this._pub({ k: 'tribute', to: target, amt: t });
            this._toast(`已交税${t}草`);
        },

        // ---------- 3D ----------
        _init3D() {
            const cv = el('lcCanvas');
            this.rdr = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
            this.rdr.setPixelRatio(Math.min(devicePixelRatio, 2));
            this.scene = new THREE.Scene();
            this.cam = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
            this.sun = new THREE.DirectionalLight(0xffffff, 1.6); this.sun.position.set(30, 50, 20); this.scene.add(this.sun);
            this.amb = new THREE.AmbientLight(0x8899bb, 0.7); this.scene.add(this.amb);
            this.moon = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 10), new THREE.MeshBasicMaterial({ color: 0xf0f0ff }));
            this.moon.position.set(-40, 60, -60); this.scene.add(this.moon);
            // 地面
            this.ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ color: 0x4caf50 }));
            this.ground.rotation.x = -Math.PI / 2; this.scene.add(this.ground);
            // 自己+远程玩家共用模型工厂
            this.meMesh = this._makeHuman(0x8bc34a);
            this.me = { id: 'me', name: (window.game && window.game.username) || '玩家', role: Math.random() < 0.5 ? 'grass' : 'dirt', grass: 30, sat: NEED, owner: null, slaves: [], pos: new THREE.Vector3(0, 0, 0), mesh: this.meMesh };
            this.world = this.me.role; // 出生在自己等级世界
            this.scene.add(this.meMesh);
            // 3个草民NPC
            for (let i = 0; i < 3; i++) this._spawnNpc(i);
            this._buildWorldDecor();
            this._applyWorld(); // 必须在装饰/传送门建好之后调
            this._resize(); addEventListener('resize', () => this._resize());
            // 鼠标拖动转视角(桌面+触屏右半屏)
            let lx = 0, ly = 0, drag = false;
            cv.addEventListener('pointerdown', e => { drag = true; lx = e.clientX; ly = e.clientY; });
            addEventListener('pointermove', e => { if (!drag) return; this.yaw -= (e.clientX - lx) * 0.006; this.pitch = Math.max(-1.2, Math.min(0.1, this.pitch - (e.clientY - ly) * 0.006)); lx = e.clientX; ly = e.clientY; });
            addEventListener('pointerup', () => drag = false);
            // 触屏左半摇杆
            el('lcJoy').addEventListener('pointermove', e => {
                if (!e.buttons && e.pointerType === 'mouse') return;
                const r = e.target.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
                const m = Math.min(1, Math.hypot(dx, dy) / 40), a = Math.atan2(dy, dx);
                this.touchMove.x = Math.cos(a) * m; this.touchMove.y = Math.sin(a) * m;
            });
            el('lcJoy').addEventListener('pointerup', () => this.touchMove = { x: 0, y: 0 });
            el('lcJoy').addEventListener('pointerleave', () => this.touchMove = { x: 0, y: 0 });
            addEventListener('keydown', e => this.keys[e.code] = true);
            addEventListener('keyup', e => this.keys[e.code] = false);
        },
        _resize() { const w = innerWidth, h = innerHeight; this.rdr.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); },
        _makeHuman(color) {
            const g = new THREE.Group();
            const mat = c => new THREE.MeshStandardMaterial({ color: c });
            const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.7, 4, 8), mat(color)); body.position.y = 0.9;
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), mat(0xffcc99)); head.position.y = 1.75;
            g.add(body, head); return g;
        },
        _spawnNpc(i) {
            const m = this._makeHuman(0x9ccc65);
            const p = { id: 'npc' + i, name: '草民' + i, role: 'grass', grass: rand(10, 40) | 0, npc: true, owner: null, pos: new THREE.Vector3(rand(-15, 15), 0, rand(-15, 15)), mesh: m };
            m.position.copy(p.pos); m.position.y = 0; m.visible = false;
            this.scene.add(m); this.npcs.push(p);
            return p;
        },
        _buildWorldDecor() { // 草丛(可挖) + 泥土地装饰 + 传送门 + 2商店
            // 草丛:60个,挖走15s后重生
            const tg = new THREE.ConeGeometry(0.35, 0.8, 5);
            const tm = new THREE.MeshStandardMaterial({ color: 0x7bc043 });
            for (let i = 0; i < 60; i++) {
                const t = new THREE.Mesh(tg, tm);
                t.position.set(rand(-28, 28), 0.4, rand(-28, 28));
                t.userData = { alive: true, respawn: 0 };
                this.tufts.push(t); this.scene.add(t);
            }
            // 商店(泥土世界):红色食物店+紫色奴隶店
            const mk = (x, z, color, tag) => {
                const b = new THREE.Group();
                const box = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 3), new THREE.MeshStandardMaterial({ color })); box.position.y = 1.2;
                const roof = new THREE.Mesh(new THREE.ConeGeometry(2.5, 1.5, 4), new THREE.MeshStandardMaterial({ color: 0x5d4037 })); roof.position.y = 3.15; roof.rotation.y = Math.PI / 4;
                b.add(box, roof); b.position.set(x, 0, z); b.userData = tag;
                this.scene.add(b); this.shopMeshes.push(b);
            };
            mk(-8, -6, 0xe57373, 'food'); mk(8, -6, 0xba68c8, 'slave');
            // 传送门(泥土世界常驻):金色漩涡柱
            const pm = new THREE.Group();
            pm.add(new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.2, 16), new THREE.MeshStandardMaterial({ color: 0xffd54f })));
            const pillar = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 8, 20), new THREE.MeshStandardMaterial({ color: 0xffb300, emissive: 0x664400 }));
            pillar.position.y = 1.8; pm.add(pillar); pm.position.set(0, 0.1, 6);
            this.portalMesh = pm; this.scene.add(pm);
            // 草世界的泥土传送平台(泥土玩家来收草的落脚点)
            const pad = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.15, 12), new THREE.MeshStandardMaterial({ color: 0x8d6e63 }));
            pad.position.set(0, 0.08, 10); this.dirtPad = pad; this.scene.add(pad);
        },
        _applyWorld() { // 切换世界外观(不改场景,改颜色/可见性)
            const g = this.world === 'grass';
            this.ground.material.color.set(g ? 0x4caf50 : 0x795548);
            this.scene.fog = new THREE.Fog(g ? 0x9fd8ff : 0x6d4c41, 30, 160);
            this.tufts.forEach(t => t.visible = g && t.userData.alive);
            this.shopMeshes.forEach(s => s.visible = !g);
            if (this.portalMesh) this.portalMesh.visible = !g;
            if (this.dirtPad) this.dirtPad.visible = g;
            this.npcs.forEach(n => n.mesh.visible = g);
            Object.values(this.remotes).forEach(r => { if (r.mesh) r.mesh.visible = r.world === this.world; });
        },
        teleport() { // 传送道具:泥土↔草互传(草玩家不需要,但留着也行)
            if (this.me.role === 'grass') { this._toast('草等级没有传送道具'); return; }
            this.world = this.world === 'grass' ? 'dirt' : 'grass';
            this.me.pos.set(0, 0, this.world === 'grass' ? 12 : 8); // 传送点:草世界pad旁/泥土地门旁
            this._applyWorld();
            this._toast(this.world === 'grass' ? '传送到草等级:收草/看奴隶' : '传送回泥土等级');
            this._sendState();
        },


        // ---------- DOM/HUD ----------
        _initDOM() {
            el('btnLcBack').onclick = () => { this.exit(); window.ui.showMainMenu(window.game.username); };
            el('btnLcTeleport').onclick = () => this.teleport();
            el('btnLcInteract').onclick = () => this._interact();
            el('btnLcDig').onclick = () => this._dig();
            el('lcShopClose').onclick = () => el('lcShop').style.display = 'none';
            el('lcSlaveClose').onclick = () => el('lcSlaveShop').style.display = 'none';
            el('lcConfirmYes').onclick = () => { el('lcConfirm').style.display = 'none'; this._confirm && this._confirm(); this._confirm = null; };
            el('lcConfirmNo').onclick = () => { el('lcConfirm').style.display = 'none'; this._confirm = null; };
        },
        _hud() {
            const r = this.me.role === 'grass' ? '草等级' : '泥土等级';
            el('lcRole').textContent = r + (this.me.owner ? '·奴' : '') + (this.me.slaves.length ? `·主(${this.me.slaves.length})` : '');
            el('lcGrass').textContent = this.me.grass;
            el('lcSat').textContent = this.me.role === 'dirt' ? this.me.sat : '—';
            el('btnLcTeleport').style.display = this.me.role === 'dirt' ? '' : 'none';
            el('btnLcDig').style.display = this.me.role === 'grass' && this.world === 'grass' ? '' : 'none';
        },
        _toast(t) { const e = el('lcToast'); e.textContent = t; e.style.opacity = 1; clearTimeout(this._tt); this._tt = setTimeout(() => e.style.opacity = 0, 2600); },
        _ask(title, cb) { el('lcConfirmText').textContent = title; el('lcConfirm').style.display = 'flex'; this._confirm = cb; },

        // ---------- 交互 ----------
        _near(v, d) { return this.me.pos.distanceTo(v) < d; },
        _interact() { // 统一交互键:按距离找最近可交互对象
            if (this.world === 'dirt') {
                for (const s of this.shopMeshes) if (this._near(s.position, 4)) return s.userData === 'food' ? this._openFood() : this._openSlave();
                if (this._near(this.portalMesh.position, 3)) return this.teleport();
                this._toast('附近没有可交互的东西'); return;
            }
            // 草世界:附近草玩家/NPC→索要面板
            const t = this._grassTargets().find(o => this._near(o.pos, 4));
            if (t) return this._demandPanel(t);
            this._toast('附近没有草玩家(走近再按)');
        },
        _grassTargets() { // 草世界的可索要对象:NPC+远程草玩家
            const list = this.npcs.slice();
            for (const r of Object.values(this.remotes)) if (r.role === 'grass' && r.world === 'grass') list.push(r);
            return list;
        },
        _demandPanel(t) {
            if (this.me.role !== 'dirt') { this._toast('只有泥土等级可以索要草'); return; }
            this._ask(`向「${t.name}」索要草?(他有${t.grass}草,想要多少拿多少)`, () => {
                const take = t.npc ? t.grass : t.grass; // 全拿
                if (t.npc) { this.me.grass += take; t.grass = 0; }
                else this._pub({ k: 'take', to: t.id, amt: take });
                this._toast(`拿走了${take}草`);
                this._hud();
            });
        },
        _dig() { // 挖草:附近草丛
            const t = this.tufts.find(t => t.userData.alive && this._near(t.position, 2));
            if (!t) { this._toast('附近没有草,去草地上找'); return; }
            t.userData.alive = false; t.visible = false; t.userData.respawn = Date.now() + 15000;
            this.me.grass++;
            this._toast('+1草');
            this._hud(); this._sendState();
        },
        _openFood() {
            const shop = el('lcShopItems'); shop.innerHTML = '';
            for (const [k, f] of Object.entries(FOOD)) {
                const b = document.createElement('button'); b.className = 'lc-item';
                b.innerHTML = `${f.n}<br><small>${f.g}草→${f.s}饱和度</small>`;
                b.onclick = () => { this._buyFood(k); };
                shop.appendChild(b);
            }
            el('lcShop').style.display = 'flex';
        },
        _buyFood(k) {
            const f = FOOD[k];
            if (this.me.grass < f.g) { this._toast('草不够'); return; }
            this.me.grass -= f.g; this.me.sat += f.s;
            this._toast(`吃了${f.n},饱和度+${f.s}(现在${this.me.sat})`);
            this._hud(); this._sendState();
        },
        _openSlave() {
            const shop = el('lcSlaveList'); shop.innerHTML = '';
            const cands = this._grassTargets().concat(Object.values(this.remotes).filter(r => r.role === 'grass' && r.world !== 'grass'));
            if (!cands.length) shop.innerHTML = '<div style="color:#888">暂时没有草玩家</div>';
            for (const c of cands) {
                if (c.owner || this.me.slaves.includes(c.id)) continue;
                const b = document.createElement('button'); b.className = 'lc-item';
                b.textContent = `买下${c.name}(${SLAVE_G}草)`;
                b.onclick = () => this._buySlave(c);
                shop.appendChild(b);
            }
            el('lcSlaveShop').style.display = 'flex';
        },
        _buySlave(c) {
            if (this.me.grass < SLAVE_G) { this._toast('草不够'); return; }
            this.me.grass -= SLAVE_G;
            if (c.npc) { c.owner = this.me.id; this.me.slaves.push(c.id); c.mesh.traverse(o => { if (o.isMesh) o.material.color.set(0xffb74d); }); this._toast(`买下了${c.name}·奴,每天自动上供草`); }
            else { this.me.slaves.push(c.id); this._pub({ k: 'buySlave', to: c.id, owner: this.me.name }); this._toast(`买下了${c.name}·奴`); }
            this._hud(); this._sendState();
            el('lcSlaveShop').style.display = 'none';
        },

        // ---------- 联机 ----------
        _connect(idx) { // 固定从本地broker开始,全站玩家必在同一服务器;失败才轮换公共broker
            if (typeof mqtt === 'undefined') { this._toast('联机不可用,单机NPC模式'); return; }
            idx = idx || 0;
            if (idx >= BROKERS.length) { this._toast('联机失败,单机NPC模式'); return; }
            this._bIdx = idx;
            try { this.mqtt = mqtt.connect(BROKERS[idx], { connectTimeout: 5000, reconnectPeriod: 0 }); } catch { return this._connect(idx + 1); }
            const c = this.mqtt;
            c.on('connect', () => { if (this.mqtt !== c) return; this.conn = true; c.subscribe(TOPIC, { qos: 0 }); this._sendState(); });
            c.on('message', (t, p) => { if (this.mqtt !== c) return; try { this._msg(JSON.parse(p.toString())); } catch (e) {} });
            c.on('error', () => { if (this.mqtt === c && !this.conn) { try { c.end(true); } catch (e) {} this.mqtt = null; this._connect(idx + 1); } });
            c.on('close', () => { if (this.mqtt === c && !this.conn) { try { c.end(true); } catch (e) {} this.mqtt = null; this._connect(idx + 1); } });
        },
        _pub(o) { if (this.conn) { o.id = this.me.id === 'me' ? this._uid() : this.me.id; this.mqtt.publish(TOPIC, JSON.stringify(o), { qos: 0 }); } },
        _uid() { if (!this._u) this._u = 'u' + Math.random().toString(36).slice(2, 9); return this._u; },
        _sendState() { this._pub({ k: 'hi', n: this.me.name, role: this.me.role, w: this.world, x: this.me.pos.x, z: this.me.pos.z, g: this.me.grass, owner: this.me.owner }); },
        _msg(m) {
            if (m.id === this._uid()) return;
            if (m.k === 'hi') { // 玩家在线状态
                let r = this.remotes[m.id];
                if (!r) { r = this.remotes[m.id] = { id: m.id, mesh: this._makeHuman(0x64b5f6), pos: new THREE.Vector3() }; this.scene.add(r.mesh); }
                r.name = m.n; r.role = m.role; r.world = m.w; r.grass = m.g; r.owner = m.owner; r.t = Date.now();
                r.pos.x = m.x; r.pos.z = m.z;
                r.mesh.visible = r.world === this.world;
            } else if (m.k === 'take' && m.to === this._uid()) { // 被泥土玩家索要
                const t = Math.min(m.amt, this.me.grass); this.me.grass -= t;
                this._toast(`${m.id ? '泥土玩家' : ''}收走了${t}草`);
                this._pub({ k: 'took', to: m.id, amt: t });
                this._hud(); this._sendState();
            } else if (m.k === 'took' && m.to === this._uid()) { // 对方确认被收草
                this.me.grass += m.amt; this._toast(`收到${m.amt}草`); this._hud();
            } else if (m.k === 'tribute' && m.to === this._uid()) { // 奴隶/草玩家上供
                this.me.grass += m.amt; this._toast(`收到上供${m.amt}草`); this._hud();
            } else if (m.k === 'buySlave' && m.to === this._uid()) { // 自己被买
                this.me.owner = m.id; this._toast(`你被${m.owner || '泥土玩家'}买下了!每天自动交税`);
                this._hud();
            } else if (m.k === 'slaveDead' && m.to === this._uid()) { // 我的真人奴隶死了→NPC顶替
                this.me.slaves = this.me.slaves.filter(x => x !== m.id);
                this._spawnSlave();
                this._toast('你的奴隶饿死了,新奴隶顶上');
                this._hud();
            }
        },

        // ---------- 主循环 ----------
        _loop() {
            if (!this.running) return;
            requestAnimationFrame(() => this._loop());
            const now = Date.now();
            // 天切换
            const d = this._day();
            if (this.me.daySeen !== d) {
                if (this.me.daySeen !== undefined) this._newDay(false);
            }
            // 时钟HUD
            if (now - this._clockTick > 500) {
                this._clockTick = now;
                const t = this._t(), day = this._isDay();
                el('lcClock').textContent = `第${d}天·${day ? '☀白天' : '🌙夜晚'} ${Math.floor(t)}s`;
                if (!day) this.moon.position.set(Math.cos(t / 240 * Math.PI) * 50, Math.sin(t / 240 * Math.PI) * 60, -40);
            }
            // 昼夜光照
            const day = this._isDay();
            this.sun.intensity = day ? 1.6 : 0.15;
            this.amb.intensity = day ? 0.7 : 0.25;
            this.scene.background = new THREE.Color(day ? 0x87ceeb : 0x0a0a20);
            // 草丛重生
            for (const t of this.tufts) if (!t.userData.alive && now > t.userData.respawn) { t.userData.alive = true; if (this.world === 'grass') t.visible = true; }
            // 移动
            let mx = (this.keys.KeyD ? 1 : 0) - (this.keys.KeyA ? 1 : 0) + this.touchMove.x;
            let mz = (this.keys.KeyS ? 1 : 0) - (this.keys.KeyW ? 1 : 0) + this.touchMove.y;
            const len = Math.hypot(mx, mz); if (len > 1) { mx /= len; mz /= len; }
            const sp = 6 * (1 / 60), s = Math.sin(this.yaw), c = Math.cos(this.yaw);
            const mvx = (mx * c - mz * s) * sp, mvz = (-mx * s - mz * c) * sp; // W=镜头前方
            this.me.pos.x += mvx; this.me.pos.z += mvz;
            this.me.pos.x = Math.max(-29, Math.min(29, this.me.pos.x));
            this.me.pos.z = Math.max(-29, Math.min(29, this.me.pos.z));
            this.meMesh.position.copy(this.me.pos);
            if (mx || mz) this.meMesh.rotation.y = Math.atan2(mvx, mvz); // 面向移动方向
            // 相机跟随
            const cd = 9, ch = 5;
            this.cam.position.set(this.me.pos.x - Math.sin(this.yaw) * cd, ch + this.pitch * 8, this.me.pos.z - Math.cos(this.yaw) * cd);
            this.cam.lookAt(this.me.pos.x, 1.5, this.me.pos.z);
            // 远程玩家插值
            for (const r of Object.values(this.remotes)) {
                if (!r.mesh) continue;
                if (now - (r.t || 0) > 15000) { this.scene.remove(r.mesh); delete this.remotes[r.id]; continue; }
                r.mesh.position.lerp(r.pos, 0.15); r.mesh.visible = r.world === this.world;
            }
            // NPC游走
            for (const n of this.npcs) {
                n.t = (n.t || 0) + 0.016;
                if (n.t > 3) { n.t = 0; n.dir = rand(0, Math.PI * 2); }
                n.pos.x = Math.max(-27, Math.min(27, n.pos.x + Math.sin(n.dir || 0) * 0.02));
                n.pos.z = Math.max(-27, Math.min(27, n.pos.z + Math.cos(n.dir || 0) * 0.02));
                n.mesh.position.copy(n.pos);
                if (!n.grass) n.grass = Math.floor(rand(5, 15)); // NPC草缓慢再生
            }
            // 定期广播位置
            if (!this._lastPub || now - this._lastPub > 100) { this._lastPub = now; this._sendState(); }
            this.rdr.render(this.scene, this.cam);
        },
    };
})();
